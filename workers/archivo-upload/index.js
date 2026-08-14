// Cloudflare Worker — archivo-upload
// Verifies the upload password server-side and returns Cloudinary signed upload
// parameters. The Cloudinary API secret never leaves this Worker.
//
// Required secrets — set via CLI (see wrangler.toml for commands):
//   PW_HASH                    SHA-256 de la contraseña de colaborador
//   ADMIN_HASH                 SHA-256 de la contraseña de admin
//   CLOUDINARY_CLOUD_NAME      e.g. duog120j4
//   CLOUDINARY_API_KEY         from Cloudinary Dashboard > Settings > API Keys
//   CLOUDINARY_API_SECRET      from Cloudinary Dashboard > Settings > API Keys
//   CLOUDINARY_UPLOAD_PRESET   name of your NEW signed preset (e.g. archivo_signed)
//
// Required Cloudinary settings:
//   Dashboard > Settings > Security > enable "SHA-256 signature algorithm"
//   Dashboard > Settings > Upload > create a SIGNED preset named archivo_signed
//     with folder = archivo, then DISABLE the old archivo_unsigned preset.
//
// Actions (POST JSON, routed by body.action):
//   (none)/upload    sign a photo upload         (archivo/<slug>)      [auth]
//   delete           remove photo(s) from Cloudinary + images.json      [auth]
//   list             live photo list from Cloudinary                    [public]
//   ping             probar la contraseña y saber de qué nivel es     [colab]
//   autores          carpetas de autor que ya existen en el archivo    [colab]
//   articulo-propose mandar un poema a la cola de revisión             [colab]
//   articulo-sign    firmar una imagen del poema                       [colab]
//   articulo-submit  publicar sin pasar por la cola                    [admin]
//   articulo-pending ver la cola                                       [admin]
//   articulo-approve publicar un pendiente                             [admin]
//   articulo-reject  rechazar (borra su carpeta de imágenes)           [admin]
//   articulo-delete  borrar un publicado (+ su carpeta)                [admin]
//   respaldo         volcar todos los publicados a Cloudinary          [admin]
//   foto-pending     fotos esperando revisión                          [admin]
//   foto-approve     mover una foto a la galería                       [admin]
//   foto-reject      borrarla                                          [admin]
//
// Lecturas públicas (GET):
//   GET /articulos       índice de publicados
//   GET /articulo?id=N   un artículo completo
//
// Cinco contraseñas fallidas dejan a esa IP fuera 15 minutos (KV: fail:<ip>).
//
// Los artículos viven en KV (binding ARTICULOS); cada poema tiene su propia
// carpeta de imágenes en Cloudinary. Reusa PW_HASH y las creds de Cloudinary
// que ya existían — no hay secrets nuevos. Redeploy: `wrangler deploy`.

import { artistSlug } from './lib/artistSlug.js';
import {
  readIndex,
  getPublicado,
  listPendientes,
  putPendiente,
  publicarDirecto,
  aprobar,
  rechazar,
  borrarPublicado,
  handleInstagram,
} from './lib/articulos.js';

const ALLOWED_ORIGINS = new Set([
  'https://gdldenoxe.github.io',
  'https://www.guadalajaradenoxe.com',
  'https://guadalajaradenoxe.com',
]);
const FOLDER = 'archivo';
// Las fotos que sube la banda caen aquí primero. La galería solo lee `archivo/`,
// así que nada se ve hasta que el admin lo mueve. Aprobar = renombrar.
const FOLDER_PENDIENTE = 'archivo-pendiente';

const GITHUB_OWNER      = 'bncontactme';
const GITHUB_REPO       = 'gdldenoxe.github.io';
const IMAGES_JSON_PATH  = 'archivoPage/images.json';

// Artículos / poemas — misma cuenta de Cloudinary, carpeta propia por poema.
const ARTICULOS_FOLDER = 'articulos';

// Con la de colaborador solo se aporta: subir fotos al archivo y mandar poemas
// a la cola. Todo lo que decide o destruye —publicar, rechazar, borrar, tanto
// de artículos como de fotos— pide la de admin.
const ACCIONES_ADMIN = new Set([
  'articulo-submit', 'articulo-pending', 'articulo-approve',
  'articulo-reject', 'articulo-delete', 'respaldo',
  'delete',                                        // borrar fotos publicadas
  'foto-pending', 'foto-approve', 'foto-reject',   // revisión de fotos
]);

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const corsOK =
      ALLOWED_ORIGINS.has(origin) ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1');

    const allowedOrigin = corsOK ? origin : 'https://www.guadalajaradenoxe.com';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(allowedOrigin),
      });
    }

    // ── Lecturas públicas por GET ─────────────────────────────────────────────
    // Sirven al sitio, así que van abiertas a cualquier origen.
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (url.pathname === '/articulos') {
        return handleArticulosList(env, '*');
      }
      if (url.pathname === '/articulo') {
        return handleArticuloGet(url.searchParams.get('id'), env, '*');
      }
      return new Response('Not Found', { status: 404 });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (!corsOK) {
      return new Response('Forbidden', { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400, allowedOrigin);
    }

    // ── Public actions (no password needed) ───────────────────────────────────
    if (body.action === 'list') {
      return handleList(env, allowedOrigin);
    }
    // ── Dos contraseñas ───────────────────────────────────────────────────────
    // Colaborador (PW_HASH): manda poemas e imágenes; todo cae en la cola.
    // Admin (ADMIN_HASH): además decide qué se publica y qué se va.
    //
    // Antes de comparar nada: si esta IP ya falló demasiado, ni se le escucha.
    // Sin esto, adivinar la contraseña es cuestión de dejar corriendo un script.
    const ip = request.headers.get('CF-Connecting-IP') || 'sin-ip';
    if (await estaBloqueada(env, ip)) {
      return jsonResponse(
        { error: 'Demasiados intentos fallidos. Espera unos minutos.' },
        429, allowedOrigin,
      );
    }

    const hash    = await sha256hex(String(body.password || ''));
    const esAdmin = !!env.ADMIN_HASH && hash === env.ADMIN_HASH;
    if (!esAdmin && hash !== env.PW_HASH) {
      await anotarFallo(env, ip);
      return jsonResponse({ error: 'Unauthorized' }, 401, allowedOrigin);
    }
    await limpiarFallos(env, ip);
    if (ACCIONES_ADMIN.has(body.action) && !esAdmin) {
      return jsonResponse({ error: 'Necesitas la contraseña de admin' }, 403, allowedOrigin);
    }

    // ── Nivel colaborador ─────────────────────────────────────────────────────
    if (body.action === 'ping') {
      return jsonResponse({ ok: true, admin: esAdmin }, 200, allowedOrigin);
    }
    if (body.action === 'autores') {
      return handleAutores(env, allowedOrigin);
    }
    if (body.action === 'articulo-propose') {
      return handleArticuloPropose(body, env, allowedOrigin);
    }
    if (body.action === 'articulo-sign') {
      return handleArticuloSign(body, env, allowedOrigin);
    }

    // ── Route by action ───────────────────────────────────────────────────────
    if (body.action === 'delete') {
      return handleDelete(body, env, allowedOrigin);
    }
    // ── Artículos / poemas (solo admin) ───────────────────────────────────────
    if (body.action === 'articulo-submit') {
      return handleArticuloSubmit(body, env, allowedOrigin);
    }
    if (body.action === 'articulo-pending') {
      return handleArticuloPending(env, allowedOrigin);
    }
    if (body.action === 'articulo-approve') {
      return handleArticuloApprove(body, env, allowedOrigin);
    }
    if (body.action === 'articulo-reject') {
      return handleArticuloReject(body, env, allowedOrigin);
    }
    if (body.action === 'articulo-delete') {
      return handleArticuloDelete(body, env, allowedOrigin);
    }
    if (body.action === 'foto-pending') {
      return handleFotoPending(env, allowedOrigin);
    }
    if (body.action === 'foto-approve') {
      return handleFotoApprove(body, env, allowedOrigin);
    }
    if (body.action === 'foto-reject') {
      return handleFotoReject(body, env, allowedOrigin);
    }
    if (body.action === 'respaldo') {
      try {
        return jsonResponse({ ok: true, ...(await respaldarTodo(env)) }, 200, allowedOrigin);
      } catch (e) {
        return jsonResponse({ error: String(e.message || e) }, 502, allowedOrigin);
      }
    }
    return handleUpload(body, env, allowedOrigin);
  },

  // Respaldo semanal (ver [triggers] en wrangler.toml). Vuelca todos los
  // publicados a articulos/respaldo/articulos.json en Cloudinary.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      respaldarTodo(env)
        .then(r => console.log('Respaldo semanal: ' + r.total + ' artículos'))
        .catch(e => console.error('Respaldo semanal falló:', e)),
    );
  },
};

// artistSlug() is imported from ./lib/artistSlug.js (shared with migrate.mjs).

// Allowed MIME types for upload signing — Cloudinary will also reject non-images,
// but signing only image-shaped MIMEs prevents the worker from being used as a
// generic signing oracle.
const ALLOWED_UPLOAD_MIME = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif',
]);

// ── Upload handler ────────────────────────────────────────────────────────────
async function handleUpload(body, env, origin) {
    // If the client declares a content type, enforce the image allowlist.
    // Missing content_type is tolerated for backward compatibility — Cloudinary
    // will still reject non-images at upload time.
    const declaredMime = String(body.content_type || body.resource_type || '').toLowerCase();
    if (declaredMime && !ALLOWED_UPLOAD_MIME.has(declaredMime)) {
      return jsonResponse({ error: 'Unsupported content type' }, 400, origin);
    }

    const timestamp    = String(Math.floor(Date.now() / 1000));
    const uploadPreset = env.CLOUDINARY_UPLOAD_PRESET;

    // La forma dice «Autor»; el archivo lleva años guardando `artista`. Se
    // aceptan los dos nombres al entrar y se sigue escribiendo `artista`, para
    // no partir en dos las fotos que ya están.
    const autor = body.autor || body.artista || '';

    // Entra a revisión: archivo-pendiente/<autor>/ — invisible en la galería
    // hasta que el admin la apruebe. La carpeta la abre Cloudinary sola con
    // este `folder`, así que un autor nuevo no necesita darse de alta antes.
    const slug   = artistSlug(autor);
    const folder = FOLDER_PENDIENTE + '/' + slug;

    const signingParams = {
      asset_folder:  folder,
      folder,
      timestamp,
      upload_preset: uploadPreset,
    };

    const instagram = handleInstagram(body.instagram);

    const contextParts = [];
    if (autor)            contextParts.push('artista='     + sanitize(autor));
    if (instagram)        contextParts.push('instagram='   + instagram);
    if (body.descripcion) contextParts.push('descripcion=' + sanitize(body.descripcion));
    if (body.fecha)       contextParts.push('fecha='       + String(body.fecha || '').replace(/[^0-9\-]/g, ''));
    if (contextParts.length) signingParams.context = contextParts.join('|');

    const paramString = Object.keys(signingParams)
      .sort()
      .map(k => k + '=' + signingParams[k])
      .join('&');
    const signature = await sha256hex(paramString + env.CLOUDINARY_API_SECRET);

    return jsonResponse(
      { signature, timestamp, api_key: env.CLOUDINARY_API_KEY, cloud_name: env.CLOUDINARY_CLOUD_NAME, upload_preset: uploadPreset, folder, asset_folder: folder, context: signingParams.context || null },
      200, origin,
    );
}

// ── Delete handler ────────────────────────────────────────────────────────────
async function handleDelete(body, env, origin) {
  const publicIds = Array.isArray(body.public_ids) ? body.public_ids : [];
  if (!publicIds.length) {
    return jsonResponse({ error: 'No public_ids provided' }, 400, origin);
  }
  // Limit to 100 per request (Cloudinary Admin API limit)
  const ids = publicIds.slice(0, 100).map(id => String(id));

  // Reject any id outside the managed FOLDER. Without this, an admin password
  // could be abused to delete unrelated Cloudinary assets on the same account.
  const folderPrefix = FOLDER + '/';
  const outOfScope = ids.filter(id => !id.startsWith(folderPrefix));
  if (outOfScope.length) {
    return jsonResponse(
      { error: 'public_ids must be inside the ' + FOLDER + ' folder', invalid: outOfScope },
      400, origin,
    );
  }

  // Cloudinary Admin API — DELETE /resources/image/upload with Basic auth
  const res = await cloudinaryDeleteByPublicIds(env, ids);
  let data;
  try { data = await res.json(); } catch { data = { error: 'Cloudinary returned non-JSON (status ' + res.status + ')' }; }

  if (res.ok) {
    // Update images.json on GitHub — remove entries whose URL contains any deleted public_id
    try {
      await githubUpdateJson(env, IMAGES_JSON_PATH, function(entries) {
        return entries.filter(function(e) {
          return !ids.some(function(id) {
            return e.url && e.url.includes('/' + id + '.');
          });
        });
      });
    } catch (e) {
      console.error('GitHub images.json update failed after delete:', e);
      // Don't fail the response — Cloudinary delete already succeeded
    }
  }

  return jsonResponse(data, res.ok ? res.status : 502, origin);
}

// ── Cloudinary: todas las imágenes bajo un prefijo, paginando ────────────────
async function cloudinaryListar(env, prefix) {
  const basicAuth = btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`);
  const resources = [];
  let nextCursor = null;

  do {
    const params = new URLSearchParams({
      type: 'upload',
      prefix,
      context: 'true',
      max_results: '500',
    });
    if (nextCursor) params.set('next_cursor', nextCursor);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/image?${params}`,
      { headers: { Authorization: `Basic ${basicAuth}` } }
    );
    if (!res.ok) throw new Error('Cloudinary list failed: ' + res.status);
    const data = await res.json();
    resources.push(...(data.resources || []));
    nextCursor = data.next_cursor || null;
  } while (nextCursor);

  return resources;
}

// ── List handler (fetch live image list from Cloudinary) ────────────────────────
async function handleList(env, origin) {
  let resources;
  try {
    resources = await cloudinaryListar(env, FOLDER + '/');
  } catch (e) {
    return jsonResponse({ error: String(e.message || e) }, 502, origin);
  }

  const entries = resources.map(function(r) {
    const url = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/v${r.version}/${r.public_id}.${r.format}`;
    const thumbUrl = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/c_thumb,w_96,h_96,q_auto:best,f_auto/v${r.version}/${r.public_id}.${r.format}`;
    const ctx = r.context && r.context.custom ? r.context.custom : {};
    return {
      url,
      thumbUrl,
      public_id:   r.public_id,   // lo usa la bandeja de admin para borrar
      artista:     ctx.artista     || '',
      instagram:   ctx.instagram   || '',
      descripcion: ctx.descripcion || '',
      fecha:       ctx.fecha       || '',
    };
  });

  return jsonResponse({ entries }, 200, origin);
}

// ── Colaborador: las carpetas de autor que ya existen ────────────────────────
// La forma de subir arma su lista con esto. Se miran las dos carpetas —la
// galería y la cola— para que quien acaba de mandar sus primeras fotos ya se
// vea ahí, sin esperar a que se las aprueben.
//
// El nombre que se devuelve es el de la carpeta: si alguien escribe «zoe nuño»
// donde ya había «Zoe Nuño», la forma lo corrige y las dos tandas caen juntas
// en vez de abrir dos carpetas casi iguales.
//
// Armar la lista cuesta leerse las dos carpetas enteras, y ese cupo de la Admin
// API es el mismo del que vive la galería pública. Como la contraseña de
// colaborador anda en muchas manos, se guarda un minuto: así nadie tumba la
// galería a punta de recargar la forma. El minuto no se siente — quien acaba de
// subir ya se ve en la lista sin preguntarle al Worker.
const K_AUTORES   = 'cache:autores';
const AUTORES_TTL = 60;   // segundos; es el mínimo que acepta KV

async function handleAutores(env, origin) {
  const guardada = await env.ARTICULOS.get(K_AUTORES, 'json').catch(() => null);
  if (guardada) return jsonResponse({ ok: true, autores: guardada }, 200, origin);

  let recursos;
  try {
    const [publicadas, enCola] = await Promise.all([
      cloudinaryListar(env, FOLDER + '/'),
      cloudinaryListar(env, FOLDER_PENDIENTE + '/'),
    ]);
    recursos = publicadas.concat(enCola);
  } catch (e) {
    return jsonResponse({ error: String(e.message || e) }, 502, origin);
  }

  const porSlug = new Map();
  for (const r of recursos) {
    const ctx    = r.context && r.context.custom ? r.context.custom : {};
    const nombre = String(ctx.artista || '').trim();
    if (!nombre) continue;   // las viejas sin firma viven en `general/`

    const slug    = artistSlug(nombre);
    const carpeta = porSlug.get(slug) || { nombre, slug, fotos: 0, instagram: '' };
    // Entre firmas del mismo autor se queda la mejor escrita.
    if (mayusculasIniciales(nombre) > mayusculasIniciales(carpeta.nombre)) {
      carpeta.nombre = nombre;
    }
    carpeta.fotos++;
    if (!carpeta.instagram && ctx.instagram) {
      carpeta.instagram = handleInstagram(ctx.instagram);
    }
    porSlug.set(slug, carpeta);
  }

  const autores = Array.from(porSlug.values())
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  // Si KV falla, la lista igual sale: solo se pierde el ahorro.
  await env.ARTICULOS.put(K_AUTORES, JSON.stringify(autores), { expirationTtl: AUTORES_TTL })
    .catch(e => console.error('No se pudo guardar la lista de autores:', e));

  return jsonResponse({ ok: true, autores }, 200, origin);
}

// "Zoe Nuño" le gana a "zoe nuño": se queda la firma con más iniciales altas.
function mayusculasIniciales(nombre) {
  return String(nombre).split(/\s+/)
    .filter(p => /^[A-ZÁÉÍÓÚÜÑ]/.test(p))
    .length;
}

// ── Artículo: firma la subida de una imagen a la carpeta del poema ───────────
// Llega ya autenticado por el enrutador. El uuid es el del envío, así todas
// las imágenes de un poema caen juntas en su carpeta.
async function handleArticuloSign(body, env, origin) {
  const declaredMime = String(body.content_type || '').toLowerCase();
  if (declaredMime && !ALLOWED_UPLOAD_MIME.has(declaredMime)) {
    return jsonResponse({ error: 'Unsupported content type' }, 400, origin);
  }

  const uuid = uuidValido(body.uuid);
  if (!uuid) return jsonResponse({ error: 'uuid inválido' }, 400, origin);

  const timestamp    = String(Math.floor(Date.now() / 1000));
  const uploadPreset = env.CLOUDINARY_UPLOAD_PRESET;

  // Carpeta propia del poema: articulos/<uuid>-<slug>/
  const folder = ARTICULOS_FOLDER + '/' + uuid + '-' + artistSlug(body.autor || body.titulo || 'anonimo');

  const signingParams = {
    asset_folder:  folder,
    folder,
    timestamp,
    upload_preset: uploadPreset,
  };

  const contextParts = [];
  if (body.autor)  contextParts.push('artista=' + sanitize(body.autor));
  if (body.titulo) contextParts.push('caption=' + sanitize(body.titulo));
  if (contextParts.length) signingParams.context = contextParts.join('|');

  const paramString = Object.keys(signingParams)
    .sort()
    .map(k => k + '=' + signingParams[k])
    .join('&');
  const signature = await sha256hex(paramString + env.CLOUDINARY_API_SECRET);

  return jsonResponse(
    { signature, timestamp, api_key: env.CLOUDINARY_API_KEY, cloud_name: env.CLOUDINARY_CLOUD_NAME, upload_preset: uploadPreset, folder, asset_folder: folder, context: signingParams.context || null },
    200, origin,
  );
}

// ── Colaborador: mandar un poema a la cola de revisión ──────────────────────
async function handleArticuloPropose(body, env, origin) {
  try {
    const art = await putPendiente(env, body.articulo || {});
    return jsonResponse({ ok: true, uuid: art.uuid }, 200, origin);
  } catch (e) {
    return jsonResponse({ error: String(e.message || e) }, 400, origin);
  }
}

// ── Admin: alta directa, sin pasar por la cola ───────────────────────────────
async function handleArticuloSubmit(body, env, origin) {
  try {
    const art = await publicarDirecto(env, body.articulo || {});
    await respaldarPoema(env, art);
    return jsonResponse({ ok: true, id: art.id }, 200, origin);
  } catch (e) {
    return jsonResponse({ error: String(e.message || e) }, 400, origin);
  }
}

// ── Admin: cola de pendientes ────────────────────────────────────────────────
async function handleArticuloPending(env, origin) {
  return jsonResponse({ ok: true, pendientes: await listPendientes(env) }, 200, origin);
}

// ── Admin: aprobar ───────────────────────────────────────────────────────────
async function handleArticuloApprove(body, env, origin) {
  const uuid = uuidValido(body.uuid);
  if (!uuid) return jsonResponse({ error: 'uuid inválido' }, 400, origin);

  // El admin puede corregir título/meta/clase al momento de aprobar.
  const overrides = {};
  if (body.titulo) overrides.titulo = String(body.titulo).trim().slice(0, 200);
  if (body.meta)   overrides.meta   = String(body.meta).trim().slice(0, 200);
  if (body.clase !== undefined) overrides.clase = body.clase === 'poema' ? 'poema' : undefined;

  const art = await aprobar(env, uuid, overrides);
  if (!art) return jsonResponse({ error: 'No existe ese pendiente' }, 404, origin);

  await respaldarPoema(env, art);
  return jsonResponse({ ok: true, id: art.id }, 200, origin);
}

// ── Admin: rechazar (borra la carpeta de imágenes del poema) ─────────────────
async function handleArticuloReject(body, env, origin) {
  const uuid = uuidValido(body.uuid);
  if (!uuid) return jsonResponse({ error: 'uuid inválido' }, 400, origin);

  const art = await rechazar(env, uuid, body.motivo);
  if (!art) return jsonResponse({ error: 'No existe ese pendiente' }, 404, origin);

  await borrarCarpetaCloudinary(env, art.carpeta);
  return jsonResponse({ ok: true, uuid }, 200, origin);
}

// ── Admin: borrar un publicado (+ su carpeta de imágenes) ───────────────────
async function handleArticuloDelete(body, env, origin) {
  const id = Number(body.id);
  if (!Number.isFinite(id)) return jsonResponse({ error: 'id required' }, 400, origin);

  const art = await borrarPublicado(env, id);
  if (!art) return jsonResponse({ ok: true, removed: false }, 200, origin);

  await borrarCarpetaCloudinary(env, art.carpeta);
  return jsonResponse({ ok: true, removed: true, id }, 200, origin);
}

// ── Lecturas públicas ────────────────────────────────────────────────────────
async function handleArticulosList(env, origin) {
  const list = await readIndex(env);
  return jsonResponse({ ok: true, articulos: list }, 200, origin, {
    'Cache-Control': 'public, max-age=30',
  });
}

async function handleArticuloGet(id, env, origin) {
  const art = await getPublicado(env, id);
  if (!art) return jsonResponse({ error: 'No encontrado' }, 404, origin);
  return jsonResponse({ ok: true, articulo: art }, 200, origin, {
    'Cache-Control': 'public, max-age=60',
  });
}

// ── Respaldo en Cloudinary ────────────────────────────────────────────────────
// KV es la fuente de verdad, pero es la única copia: un borrado por error o un
// mal día de Cloudflare y el texto no está en ningún otro lado. Así que cada
// poema deja también un poema.json dentro de su propia carpeta —la carpeta se
// explica sola: portada, imágenes y texto— y una vez por semana se guarda un
// volcado completo en articulos/respaldo/.
//
// Todo es best-effort: si Cloudinary falla, el poema igual queda publicado.

async function respaldarPoema(env, art) {
  if (!art || !art.carpeta) return;
  try {
    await cloudinarySubirTexto(env, art.carpeta + '/poema.json', JSON.stringify(art, null, 2));
  } catch (e) {
    console.error('Respaldo del poema falló (' + art.carpeta + '):', e);
  }
}

async function respaldarTodo(env) {
  const index = await readIndex(env);
  const completos = [];
  for (const entrada of index) {
    const art = await getPublicado(env, entrada.id);
    if (art) completos.push(art);
  }

  const volcado = {
    generado: new Date().toISOString(),
    total:    completos.length,
    articulos: completos,
  };
  const nombre = ARTICULOS_FOLDER + '/respaldo/articulos.json';
  await cloudinarySubirTexto(env, nombre, JSON.stringify(volcado, null, 2));
  return { total: completos.length, archivo: nombre };
}

// Sube un archivo de texto a Cloudinary (resource_type raw). Sobreescribe, para
// que la ruta del respaldo sea siempre la misma y no se llene de versiones.
async function cloudinarySubirTexto(env, publicId, contenido) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const params = {
    invalidate: 'true',
    overwrite:  'true',
    public_id:  publicId,
    timestamp,
  };
  const paramString = Object.keys(params).sort().map(k => k + '=' + params[k]).join('&');
  const signature   = await sha256hex(paramString + env.CLOUDINARY_API_SECRET);

  const fd = new FormData();
  fd.append('file', new Blob([contenido], { type: 'application/json' }), 'datos.json');
  Object.keys(params).forEach(k => fd.append(k, params[k]));
  fd.append('api_key', env.CLOUDINARY_API_KEY);
  fd.append('signature', signature);

  const res = await fetch(
    'https://api.cloudinary.com/v1_1/' + env.CLOUDINARY_CLOUD_NAME + '/raw/upload',
    { method: 'POST', body: fd },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) {
    throw new Error('Cloudinary ' + res.status + ' ' + JSON.stringify(data.error || data).slice(0, 200));
  }
  return data.secure_url;
}

// ── Fotos del archivo: revisión ───────────────────────────────────────────────
// Suben a archivo-pendiente/ y ahí se quedan, fuera de la galería, hasta que el
// admin decide. Aprobar es renombrar a archivo/ (Cloudinary no mueve bytes) y
// rechazar es borrar. Los datos de quién y qué viajan en el context del propio
// asset, así que no hace falta llevar una cola aparte.
async function handleFotoPending(env, origin) {
  const basicAuth = btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`);
  const params = new URLSearchParams({
    type: 'upload', prefix: FOLDER_PENDIENTE + '/', context: 'true', max_results: '100',
  });
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/image?${params}`,
    { headers: { Authorization: `Basic ${basicAuth}` } },
  );
  if (!res.ok) return jsonResponse({ error: 'Cloudinary list failed: ' + res.status }, 502, origin);

  const data = await res.json();
  const fotos = (data.resources || []).map(function(r) {
    const ctx = r.context && r.context.custom ? r.context.custom : {};
    return {
      public_id:   r.public_id,
      url:         `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/v${r.version}/${r.public_id}.${r.format}`,
      thumbUrl:    `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/c_thumb,w_160,h_160,q_auto,f_auto/v${r.version}/${r.public_id}.${r.format}`,
      artista:     ctx.artista     || '',
      instagram:   ctx.instagram   || '',
      descripcion: ctx.descripcion || '',
      fecha:       ctx.fecha       || '',
      subida:      r.created_at    || '',
    };
  });
  return jsonResponse({ ok: true, fotos }, 200, origin);
}

async function handleFotoApprove(body, env, origin) {
  const desde = String(body.public_id || '');
  if (!desde.startsWith(FOLDER_PENDIENTE + '/')) {
    return jsonResponse({ error: 'Esa foto no está en revisión' }, 400, origin);
  }
  const hacia = FOLDER + desde.slice(FOLDER_PENDIENTE.length);

  let movida;
  try {
    movida = await cloudinaryRenombrar(env, desde, hacia);
  } catch (e) {
    return jsonResponse({ error: String(e.message || e) }, 502, origin);
  }

  // images.json alimenta la lista de artistas y sus cuentas en el formulario.
  // Si falla, la foto ya quedó publicada igual: no se revierte por esto.
  try {
    const ctx = (movida.context && movida.context.custom) ? movida.context.custom : {};
    await githubUpdateJson(env, IMAGES_JSON_PATH, function(current) {
      return current.concat([{
        url:         movida.secure_url,
        thumbUrl:    movida.secure_url.replace('/upload/', '/upload/c_thumb,w_96,h_96,q_auto:best,f_auto/'),
        artista:     ctx.artista     || body.artista     || '',
        instagram:   handleInstagram(ctx.instagram || body.instagram),
        descripcion: ctx.descripcion || body.descripcion || '',
        fecha:       ctx.fecha       || body.fecha       || '',
      }]);
    });
  } catch (e) {
    console.error('images.json no se actualizó tras aprobar la foto:', e);
  }

  return jsonResponse({ ok: true, public_id: hacia }, 200, origin);
}

async function handleFotoReject(body, env, origin) {
  const id = String(body.public_id || '');
  if (!id.startsWith(FOLDER_PENDIENTE + '/')) {
    return jsonResponse({ error: 'Esa foto no está en revisión' }, 400, origin);
  }
  const res = await cloudinaryDeleteByPublicIds(env, [id]);
  if (!res.ok) return jsonResponse({ error: 'Cloudinary ' + res.status }, 502, origin);
  return jsonResponse({ ok: true }, 200, origin);
}

// Renombrar = mover de carpeta sin volver a subir el archivo.
async function cloudinaryRenombrar(env, desde, hacia) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const params = { from_public_id: desde, timestamp, to_public_id: hacia };
  const paramString = Object.keys(params).sort().map(k => k + '=' + params[k]).join('&');
  const signature   = await sha256hex(paramString + env.CLOUDINARY_API_SECRET);

  const fd = new FormData();
  Object.keys(params).forEach(k => fd.append(k, params[k]));
  fd.append('api_key', env.CLOUDINARY_API_KEY);
  fd.append('signature', signature);

  const res = await fetch(
    'https://api.cloudinary.com/v1_1/' + env.CLOUDINARY_CLOUD_NAME + '/image/rename',
    { method: 'POST', body: fd },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) {
    throw new Error('Cloudinary rename ' + res.status + ' ' + JSON.stringify(data.error || data).slice(0, 200));
  }
  return data;
}

// ── Cloudinary: borrar la carpeta entera de un poema ─────────────────────────
// Se borra por prefijo, así se van portada e interiores de un solo golpe.
// Es best-effort: si Cloudinary falla, el texto ya salió del sitio igual.
async function borrarCarpetaCloudinary(env, carpeta) {
  const prefix = String(carpeta || '');
  if (!prefix.startsWith(ARTICULOS_FOLDER + '/')) return;

  try {
    const basicAuth = btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`);
    // Las imágenes van como `image` y el poema.json como `raw`: hay que pedir
    // el borrado de los dos, si no el texto se queda huérfano en la carpeta.
    for (const tipo of ['image', 'raw']) {
      const url = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/${tipo}/upload?prefix=${encodeURIComponent(prefix + '/')}`;
      await fetch(url, { method: 'DELETE', headers: { Authorization: `Basic ${basicAuth}` } });
    }
    await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/folders/${encodeURIComponent(prefix)}`,
      { method: 'DELETE', headers: { Authorization: `Basic ${basicAuth}` } });
  } catch (e) {
    console.error('Cloudinary: no se pudo borrar la carpeta ' + prefix + ':', e);
  }
}

function uuidValido(valor) {
  const uuid = String(valor || '').trim().toLowerCase();
  return /^[a-z0-9-]{8,64}$/.test(uuid) ? uuid : null;
}

// ── Cloudinary delete helper (shared by photo + articulo delete) ──────────────
function cloudinaryDeleteByPublicIds(env, ids) {
  const basicAuth = btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`);
  const qs  = ids.map(id => 'public_ids[]=' + encodeURIComponent(id)).join('&');
  const url = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/image/upload?${qs}`;
  return fetch(url, { method: 'DELETE', headers: { Authorization: `Basic ${basicAuth}` } });
}

// ── GitHub images.json updater (solo el archivo fotográfico) ─────────────────
// Los artículos ya no pasan por aquí: viven en KV y no generan commits.
async function githubUpdateJson(env, path, updateFn) {
  const ghHeaders = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'archivo-upload-worker',
  };
  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;

  const getRes = await fetch(apiUrl, { headers: ghHeaders });
  if (!getRes.ok) throw new Error('GitHub GET failed: ' + getRes.status);
  const fileData = await getRes.json();

  // GitHub returns base64 content (with newlines) — decode it
  const currentJson = JSON.parse(atob(fileData.content.replace(/\n/g, '')));
  const updatedJson = updateFn(currentJson);
  const updatedStr  = JSON.stringify(updatedJson, null, 2) + '\n';

  // Re-encode to base64 (TextEncoder handles non-ASCII)
  const bytes = new TextEncoder().encode(updatedStr);
  let binary  = '';
  bytes.forEach(function(b) { binary += String.fromCharCode(b); });
  const updatedB64 = btoa(binary);

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers: { ...ghHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'chore: update ' + path.split('/').pop() + ' [skip ci]',
      content: updatedB64,
      sha:     fileData.sha,
    }),
  });
  if (!putRes.ok) {
    const errData = await putRes.json().catch(() => ({}));
    throw new Error('GitHub PUT failed: ' + putRes.status + ' ' + JSON.stringify(errData));
  }
}

// ── Freno a la fuerza bruta ───────────────────────────────────────────────────
// El filtro de Origin no protege nada (con curl se pone el que sea), así que lo
// único que separa a un extraño de la cuenta es la contraseña. Aquí se le pone
// techo: cinco fallos y esa IP queda fuera un rato.
//
// Es best-effort: KV es eventualmente consistente, así que un ataque muy
// paralelo puede colar algunos intentos de más antes de que el contador se
// propague. Aun así baja el ritmo de miles por minuto a un puñado.
const MAX_FALLOS   = 5;
const BLOQUEO_SEG  = 15 * 60;

const kFallos = ip => 'fail:' + ip;

async function estaBloqueada(env, ip) {
  const n = Number(await env.ARTICULOS.get(kFallos(ip))) || 0;
  return n >= MAX_FALLOS;
}

async function anotarFallo(env, ip) {
  const n = (Number(await env.ARTICULOS.get(kFallos(ip))) || 0) + 1;
  // El TTL se renueva con cada fallo: insistir alarga el castigo.
  await env.ARTICULOS.put(kFallos(ip), String(n), { expirationTtl: BLOQUEO_SEG });
}

async function limpiarFallos(env, ip) {
  if (await env.ARTICULOS.get(kFallos(ip))) await env.ARTICULOS.delete(kFallos(ip));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitize(str) {
  return String(str || '').slice(0, 200).replace(/[|=]/g, ' ');
}

async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '86400',
  };
}

function jsonResponse(data, status, origin, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
      ...(extraHeaders || {}),
    },
  });
}
