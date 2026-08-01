#!/usr/bin/env node
// Migración de una sola vez: pasa articulosPage/articulos.json al KV.
//
// Uso:
//   node workers/archivo-upload/migrate-articulos.mjs           # genera el bulk y lo sube
//   node workers/archivo-upload/migrate-articulos.mjs --dry-run # solo enseña qué haría
//
// Conserva los ids que ya tenían (2–13), así los enlaces viejos
// (?p=articulo&id=7) siguen funcionando tal cual.
//
// Las imágenes de estos artículos viejos siguen siendo rutas del repo
// (articulosPage/articuloImages/…) y ahí se quedan: el visor acepta tanto
// rutas locales como URLs de Cloudinary. Solo los poemas nuevos estrenan
// carpeta propia en Cloudinary.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { artistSlug } from './lib/artistSlug.js';

const AQUI  = dirname(fileURLToPath(import.meta.url));
const REPO  = resolve(AQUI, '../..');
const FUENTE = resolve(REPO, 'articulosPage/articulos.json');
const SALIDA = resolve(AQUI, '.migracion-articulos.json');
const DRY   = process.argv.includes('--dry-run');

// Mismo id de namespace que wrangler.toml (binding ARTICULOS).
const NAMESPACE_ID = '30ab34d6ea9f4df7873e24ee30592549';

const articulos = JSON.parse(readFileSync(FUENTE, 'utf8'));
if (!Array.isArray(articulos) || !articulos.length) {
  console.error('No hay artículos que migrar en', FUENTE);
  process.exit(1);
}

const bulk  = [];
const index = [];
let maxId = 0;

for (const art of articulos) {
  const id = Number(art.id);
  if (!Number.isFinite(id)) {
    console.warn('Saltado (sin id):', art.titulo);
    continue;
  }
  maxId = Math.max(maxId, id);

  const autor = String(art.autor || '').trim();
  const uuid  = 'legacy-' + id;
  const slug  = artistSlug(autor || art.titulo || 'anonimo');

  const completo = {
    uuid,
    slug,
    carpeta:     'articulos/' + uuid + '-' + slug,
    id,
    titulo:      art.titulo,
    autor:       autor || undefined,
    meta:        art.meta || '',
    clase:       art.clase === 'poema' ? 'poema' : undefined,
    descripcion: art.descripcion || '',
    imagen:      art.imagen || undefined,
    contenido:   Array.isArray(art.contenido) ? art.contenido : [],
    estado:      'publicado',
    creado:      art.creado || null,
    publicado:   art.publicado || null,
    migrado:     new Date().toISOString(),
  };

  bulk.push({ key: 'art:pub:' + id, value: JSON.stringify(completo) });
  index.push({
    id,
    titulo:      completo.titulo,
    meta:        completo.meta,
    clase:       completo.clase,
    imagen:      completo.imagen,
    descripcion: completo.descripcion,
  });
}

index.sort((a, b) => a.id - b.id);
bulk.push({ key: 'art:index', value: JSON.stringify(index) });
bulk.push({ key: 'art:seq',   value: String(maxId) });

console.log(`${index.length} artículos (${index.filter(e => e.clase === 'poema').length} poemas)`);
console.log(`ids: ${index.map(e => e.id).join(', ')} — siguiente será ${maxId + 1}`);

if (DRY) {
  console.log('\n--dry-run: no se subió nada. Claves que se escribirían:');
  bulk.forEach(e => console.log('  ' + e.key));
  process.exit(0);
}

writeFileSync(SALIDA, JSON.stringify(bulk));
console.log('\nSubiendo a KV…');
execFileSync(
  'npx',
  ['--yes', 'wrangler@latest', 'kv', 'bulk', 'put', SALIDA, '--namespace-id', NAMESPACE_ID, '--remote'],
  { stdio: 'inherit', cwd: AQUI },
);
console.log('Listo.');
