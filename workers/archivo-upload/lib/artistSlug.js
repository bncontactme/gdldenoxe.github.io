// Shared slug derivation for archivo artist subfolders.
// Consumed by both the Worker (index.js) and the migration CLI (migrate.mjs).
// Rules:
//   - falsy artista                -> 'general'
//   - contains "@handle"           -> handle.toLowerCase()
//   - otherwise lowercase, strip accents, non-alnum -> '_', collapse, trim '_', cap 40

const COMBINING_MARKS = /[̀-ͯ]/g;
const HANDLE_RE = /@(\w+)/;

export function artistSlug(artista) {
  if (!artista) return 'general';
  const handle = String(artista).match(HANDLE_RE);
  if (handle) return handle[1].toLowerCase();
  return String(artista).trim().toLowerCase()
    .normalize('NFD').replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    .slice(0, 40) || 'general';
}
