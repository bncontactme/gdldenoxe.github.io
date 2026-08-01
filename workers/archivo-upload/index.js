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
//   register         append photo to images.json                       [auth]
//   delete           remove photo(s) from Cloudinary + images.json      [auth]
//   list             live photo list from Cloudinary                    [public]
//   ping             probar la contraseña y saber de qué nivel es     [colab]
//   articulo-propose mandar un poema a la cola de revisión             [colab]
//   articulo-sign    firmar una imagen del poema                       [colab]
//   articulo-submit  publicar sin pasar por la cola                    [admin]
//   articulo-pending ver la cola                                       [admin]
//   articulo-approve publicar un pendiente                             [admin]
//   articulo-reject  rechazar (borra su carpeta de imágenes)           [admin]
//   articulo-delete  borrar un publicado (+ su carpeta)                [admin]
//
// Lecturas públicas (GET):
//   GET /articulos       índice de publicados
//   GET /articulo?id=N   un artículo completo
//
// Los artículos viven en KV (binding ARTICULOS); cada poema tiene su propia
// carpeta de imágenes en Cloudinary. Reusa PW_HASH y las creds de Cloudinary
// que ya existían — no hay secrets nuevos. Redeploy: `wrangler deploy`.

import { artistSlug } from './lib/artistSlug.js';
import {
  readIndex,
  writeIndex,
  getPublicado,
  listPendientes,
  putPendiente,
  publicarDirecto,
  aprobar,
  rechazar,
  borrarPublicado,
} from './lib/articulos.js';

const ALLOWED_ORIGINS = new Set([
  'https://gdldenoxe.github.io',
  'https://www.guadalajaradenoxe.com',
  'https://guadalajaradenoxe.com',
]);
const FOLDER = 'archivo';

const GITHUB_OWNER      = 'bncontactme';
const GITHUB_REPO       = 'gdldenoxe.github.io';
const IMAGES_JSON_PATH  = 'archivoPage/images.json';

// Artículos / poemas — misma cuenta de Cloudinary, carpeta propia por poema.
const ARTICULOS_FOLDER = 'articulos';

// Lo que solo abre la contraseña de admin. El resto lo puede hacer cualquiera
// que tenga la de colaborador.
// El archivo fotográfico se queda como estaba, con la contraseña de siempre.
const ACCIONES_ADMIN = new Set([
  'articulo-submit', 'articulo-pending', 'articulo-approve',
  'articulo-reject', 'articulo-delete',
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
    const hash    = await sha256hex(String(body.password || ''));
    const esAdmin = !!env.ADMIN_HASH && hash === env.ADMIN_HASH;
    if (!esAdmin && hash !== env.PW_HASH) {
      return jsonResponse({ error: 'Unauthorized' }, 401, allowedOrigin);
    }
    if (ACCIONES_ADMIN.has(body.action) && !esAdmin) {
      return jsonResponse({ error: 'Necesitas la contraseña de admin' }, 403, allowedOrigin);
    }

    // ── Nivel colaborador ─────────────────────────────────────────────────────
    if (body.action === 'ping') {
      return jsonResponse({ ok: true, admin: esAdmin }, 200, allowedOrigin);
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
    if (body.action === 'register') {
      return handleRegister(body, env, allowedOrigin);
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
    return handleUpload(body, env, allowedOrigin);
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

    // Place image in archivo/<artist-slug>/ subfolder
    const slug   = artistSlug(body.artista);
    const folder = FOLDER + '/' + slug;

    const signingParams = {
      asset_folder:  folder,
      folder,
      timestamp,
      upload_preset: uploadPreset,
    };

    const contextParts = [];
    if (body.artista)     contextParts.push('artista='     + sanitize(body.artista));
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

// ── List handler (fetch live image list from Cloudinary) ────────────────────────
async function handleList(env, origin) {
  const basicAuth = btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`);
  const resources = [];
  let nextCursor = null;

  do {
    const params = new URLSearchParams({
      type: 'upload',
      prefix: FOLDER + '/',
      context: 'true',
      max_results: '500',
    });
    if (nextCursor) params.set('next_cursor', nextCursor);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/image?${params}`,
      { headers: { Authorization: `Basic ${basicAuth}` } }
    );
    if (!res.ok) {
      return jsonResponse({ error: 'Cloudinary list failed: ' + res.status }, 502, origin);
    }
    const data = await res.json();
    resources.push(...(data.resources || []));
    nextCursor = data.next_cursor || null;
  } while (nextCursor);

  const entries = resources.map(function(r) {
    const url = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/v${r.version}/${r.public_id}.${r.format}`;
    const thumbUrl = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/c_thumb,w_96,h_96,q_auto:best,f_auto/v${r.version}/${r.public_id}.${r.format}`;
    const ctx = r.context && r.context.custom ? r.context.custom : {};
    return {
      url,
      thumbUrl,
      artista:     ctx.artista     || '',
      descripcion: ctx.descripcion || '',
      fecha:       ctx.fecha       || '',
    };
  });

  return jsonResponse({ entries }, 200, origin);
}

// ── Register handler (append new entries to images.json) ──────────────────────
async function handleRegister(body, env, origin) {
  const entries = Array.isArray(body.entries) ? body.entries : (body.entry ? [body.entry] : []);
  if (!entries.length) {
    return jsonResponse({ error: 'No entries provided' }, 400, origin);
  }
  const sanitizedEntries = entries.map(function(e) {
    return {
      url:         String(e.url         || ''),
      thumbUrl:    String(e.thumbUrl    || ''),
      artista:     String(e.artista     || ''),
      descripcion: String(e.descripcion || ''),
      fecha:       String(e.fecha       || ''),
    };
  }).filter(function(e) { return e.url; });

  try {
    await githubUpdateJson(env, IMAGES_JSON_PATH, function(current) {
      return current.concat(sanitizedEntries);
    });
    return jsonResponse({ ok: true }, 200, origin);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 502, origin);
  }
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

// ── Cloudinary: borrar la carpeta entera de un poema ─────────────────────────
// Se borra por prefijo, así se van portada e interiores de un solo golpe.
// Es best-effort: si Cloudinary falla, el texto ya salió del sitio igual.
async function borrarCarpetaCloudinary(env, carpeta) {
  const prefix = String(carpeta || '');
  if (!prefix.startsWith(ARTICULOS_FOLDER + '/')) return;

  try {
    const basicAuth = btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`);
    const url = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/image/upload?prefix=${encodeURIComponent(prefix + '/')}`;
    await fetch(url, { method: 'DELETE', headers: { Authorization: `Basic ${basicAuth}` } });
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
