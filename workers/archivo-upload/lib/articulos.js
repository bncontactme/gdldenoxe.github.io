// Storage layer for artículos / poemas.
//
// Everything that touches the KV namespace lives here, so swapping KV for R2
// later means rewriting this file and nothing else.
//
// Key layout (KV binding: env.ARTICULOS)
//   art:index          array de resúmenes de los publicados (para listados)
//   art:seq            contador del último id asignado
//   art:pub:<id>       artículo publicado, completo
//   art:pend:<uuid>    envío esperando revisión
//   art:rej:<uuid>     envío rechazado (se conserva, no se borra)
//
// Cada artículo vive además en su propia carpeta de Cloudinary,
// `articulos/<uuid>-<slug>/`, que se crea al enviarlo y nunca se renombra:
// aprobar no mueve archivos, rechazar borra la carpeta entera.

import { artistSlug } from './artistSlug.js';

export const K_INDEX = 'art:index';
export const K_SEQ   = 'art:seq';
export const kPub    = id   => 'art:pub:'  + id;
export const kPend   = uuid => 'art:pend:' + uuid;
export const kRej    = uuid => 'art:rej:'  + uuid;

export const ARTICULOS_FOLDER = 'articulos';

const ALLOWED_TIPOS = new Set(['p', 'lead', 'h2', 'quote', 'hr', 'img']);
const MAX_BLOQUES   = 300;
const MAX_TEXTO     = 8000;
const MAX_IMAGENES  = 20;

// ── Index ─────────────────────────────────────────────────────────────────────

export async function readIndex(env) {
  const raw = await env.ARTICULOS.get(K_INDEX, 'json');
  return Array.isArray(raw) ? raw : [];
}

export function writeIndex(env, list) {
  return env.ARTICULOS.put(K_INDEX, JSON.stringify(list));
}

// Resumen que consume la carpeta de Artículos y el escritorio — sin el cuerpo,
// para que el listado siga siendo un solo fetch chiquito.
export function toIndexEntry(art) {
  return {
    id:          art.id,
    titulo:      art.titulo,
    meta:        art.meta,
    clase:       art.clase || undefined,
    imagen:      art.imagen || undefined,
    descripcion: art.descripcion,
  };
}

async function reindex(env, mutate) {
  const list = mutate(await readIndex(env));
  list.sort((a, b) => a.id - b.id);
  await writeIndex(env, list);
  return list;
}

// ── Lectura ───────────────────────────────────────────────────────────────────

export function getPublicado(env, id) {
  return env.ARTICULOS.get(kPub(id), 'json');
}

export function getPendiente(env, uuid) {
  return env.ARTICULOS.get(kPend(uuid), 'json');
}

export async function listPendientes(env) {
  const { keys } = await env.ARTICULOS.list({ prefix: 'art:pend:' });
  const items = await Promise.all(
    keys.map(k => env.ARTICULOS.get(k.name, 'json')),
  );
  return items
    .filter(Boolean)
    .sort((a, b) => String(b.creado || '').localeCompare(String(a.creado || '')));
}

// ── Escritura ─────────────────────────────────────────────────────────────────

// Guarda un envío en la cola de revisión. Devuelve el artículo normalizado.
export async function putPendiente(env, entrada) {
  const art = normalizar(entrada);
  await env.ARTICULOS.put(kPend(art.uuid), JSON.stringify(art));
  return art;
}

// Mueve un pendiente a publicado y le asigna id definitivo.
export async function aprobar(env, uuid, overrides) {
  const art = await getPendiente(env, uuid);
  if (!art) return null;

  const id = await siguienteId(env);
  const publicado = {
    ...art,
    ...(overrides || {}),
    id,
    uuid,
    estado:    'publicado',
    publicado: new Date().toISOString(),
  };

  await env.ARTICULOS.put(kPub(id), JSON.stringify(publicado));
  await reindex(env, list => list.concat([toIndexEntry(publicado)]));
  await env.ARTICULOS.delete(kPend(uuid));
  return publicado;
}

// Manda un pendiente a rechazados. El llamador se encarga de borrar la carpeta
// de Cloudinary — aquí solo se conserva el texto por si hay que revertir.
export async function rechazar(env, uuid, motivo) {
  const art = await getPendiente(env, uuid);
  if (!art) return null;

  const rechazado = {
    ...art,
    estado:    'rechazado',
    motivo:    String(motivo || '').slice(0, 500),
    rechazado: new Date().toISOString(),
  };
  await env.ARTICULOS.put(kRej(uuid), JSON.stringify(rechazado));
  await env.ARTICULOS.delete(kPend(uuid));
  return rechazado;
}

export async function borrarPublicado(env, id) {
  const art = await getPublicado(env, id);
  if (!art) return null;
  await env.ARTICULOS.delete(kPub(id));
  await reindex(env, list => list.filter(e => Number(e.id) !== Number(id)));
  return art;
}

// Alta directa del admin: se salta la cola de revisión.
export async function publicarDirecto(env, entrada) {
  const art = normalizar(entrada);
  const id  = await siguienteId(env);
  const publicado = { ...art, id, estado: 'publicado', publicado: new Date().toISOString() };

  await env.ARTICULOS.put(kPub(id), JSON.stringify(publicado));
  await reindex(env, list => list.concat([toIndexEntry(publicado)]));
  return publicado;
}

// Siembra con id fijo (se usó para migrar articulos.json).
export async function sembrar(env, art) {
  await env.ARTICULOS.put(kPub(art.id), JSON.stringify(art));
  await reindex(env, list =>
    list.filter(e => Number(e.id) !== Number(art.id)).concat([toIndexEntry(art)]),
  );
  const seq = Number(await env.ARTICULOS.get(K_SEQ)) || 0;
  if (art.id > seq) await env.ARTICULOS.put(K_SEQ, String(art.id));
}

async function siguienteId(env) {
  // KV no tiene contadores atómicos. El riesgo real es nulo (solo el admin
  // aprueba, de uno en uno), pero se toma el máximo entre el contador y el
  // índice para que un contador perdido nunca pise un artículo existente.
  const seq   = Number(await env.ARTICULOS.get(K_SEQ)) || 0;
  const index = await readIndex(env);
  const maxId = index.reduce((m, e) => Math.max(m, Number(e.id) || 0), 0);
  const next  = Math.max(seq, maxId) + 1;
  await env.ARTICULOS.put(K_SEQ, String(next));
  return next;
}

// ── Normalización / saneado ───────────────────────────────────────────────────

// Convierte lo que mande el formulario en un artículo con forma conocida.
// Todo lo que no esté en la whitelist se cae aquí, no más adelante.
export function normalizar(entrada) {
  const a = entrada || {};

  const titulo = limpiar(a.titulo, 200);
  if (!titulo) throw new Error('titulo required');

  const autor = limpiar(a.autor, 120);

  const contenido = (Array.isArray(a.contenido) ? a.contenido : [])
    .slice(0, MAX_BLOQUES)
    .map(bloque => normalizarBloque(bloque))
    .filter(Boolean);
  if (!contenido.length) throw new Error('contenido required');

  const uuid = /^[a-z0-9-]{8,64}$/.test(String(a.uuid || '')) ? a.uuid : crypto.randomUUID();
  const slug = artistSlug(autor || titulo || 'anonimo');

  let descripcion = limpiar(a.descripcion, 300);
  if (!descripcion) {
    const primero = contenido.find(b => b.texto) || {};
    descripcion = limpiar(primero.texto, 200);
  }

  const imagen = urlCloudinary(a.imagen);

  return {
    uuid,
    slug,
    carpeta:     ARTICULOS_FOLDER + '/' + uuid + '-' + slug,
    titulo,
    autor,
    instagram:   handleInstagram(a.instagram) || undefined,
    meta:        limpiar(a.meta, 200),
    clase:       a.clase === 'poema' ? 'poema' : undefined,
    descripcion,
    imagen:      imagen || undefined,
    contenido,
    estado:      'pendiente',
    creado:      new Date().toISOString(),
  };
}

function normalizarBloque(bloque) {
  const b = bloque || {};
  const tipo = ALLOWED_TIPOS.has(b.tipo) ? b.tipo : 'p';

  if (tipo === 'hr') return { tipo: 'hr', texto: '' };

  if (tipo === 'img') {
    const url = urlCloudinary(b.url || b.texto);
    if (!url) return null;
    return { tipo: 'img', url, texto: limpiar(b.caption || b.texto, 200) };
  }

  const texto = String(b.texto || '').slice(0, MAX_TEXTO);
  return texto.trim() ? { tipo, texto } : null;
}

// Solo se aceptan URLs https de Cloudinary. Cualquier otra cosa se descarta en
// silencio, así el JSON nunca termina apuntando a un host ajeno.
export function urlCloudinary(valor) {
  const url = String(valor || '').trim();
  return /^https:\/\/res\.cloudinary\.com\/[\w.-]+\//.test(url) ? url : '';
}

// Solo el handle: sin @, sin URL, y con los caracteres que Instagram permite.
// Lo que no cuadre se descarta — nunca se guarda a medias.
export function handleInstagram(valor) {
  const h = String(valor || '').trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '');   // ruta, ?igshid=... y demás cola de los links compartidos
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : '';
}

function limpiar(valor, max) {
  return String(valor || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

export { MAX_IMAGENES };
