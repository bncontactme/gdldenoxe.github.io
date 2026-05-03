#!/usr/bin/env node
// One-time migration: moves flat archivo/ images into artist subfolders in Cloudinary.
//
// Usage:
//   CLOUDINARY_CLOUD_NAME=duog120j4 \
//   CLOUDINARY_API_KEY=xxx \
//   CLOUDINARY_API_SECRET=xxx \
//   node workers/archivo-upload/migrate.js
//
// Add --dry-run to preview without making changes.

const https = require('https');

const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
const KEY   = process.env.CLOUDINARY_API_KEY;
const SEC   = process.env.CLOUDINARY_API_SECRET;
const DRY   = process.argv.includes('--dry-run');

if (!CLOUD || !KEY || !SEC) {
  console.error('ERROR: Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
  process.exit(1);
}

const auth = Buffer.from(`${KEY}:${SEC}`).toString('base64');

function req(method, path, postBody) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.cloudinary.com',
      path,
      method,
      headers: { Authorization: `Basic ${auth}` },
    };
    if (postBody) {
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      opts.headers['Content-Length'] = Buffer.byteLength(postBody);
    }
    const r = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (postBody) r.write(postBody);
    r.end();
  });
}

function artistSlug(artista) {
  if (!artista) return 'general';
  const handle = String(artista).match(/@(\w+)/);
  if (handle) return handle[1].toLowerCase();
  return String(artista).trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    .slice(0, 40) || 'general';
}

async function listAll() {
  const resources = [];
  let cursor = null;
  do {
    let qs = `type=upload&prefix=archivo/&context=true&max_results=500`;
    if (cursor) qs += `&next_cursor=${encodeURIComponent(cursor)}`;
    const { status, body } = await req('GET', `/v1_1/${CLOUD}/resources/image?${qs}`);
    if (status !== 200) { console.error('List failed', status, body); process.exit(1); }
    resources.push(...(body.resources || []));
    cursor = body.next_cursor || null;
  } while (cursor);
  return resources;
}

(async () => {
  if (DRY) console.log('=== DRY RUN — no changes will be made ===\n');

  const all = await listAll();
  console.log(`Found ${all.length} total images in archivo/\n`);

  // Only flat images: archivo/filename (one slash = depth 2)
  const flat = all.filter(r => r.public_id.split('/').length === 2);
  const already = all.length - flat.length;

  if (!flat.length) {
    console.log('Nothing to migrate — all images already in subfolders.');
    return;
  }

  console.log(`${flat.length} to migrate, ${already} already in subfolders\n`);

  // Preview grouping
  const groups = {};
  for (const r of flat) {
    const artista = r.context?.custom?.artista || '';
    const slug = artistSlug(artista);
    if (!groups[slug]) groups[slug] = [];
    groups[slug].push(r.public_id);
  }
  console.log('Destination folders:');
  for (const [slug, ids] of Object.entries(groups)) {
    console.log(`  archivo/${slug}/  ← ${ids.length} image(s)`);
  }
  console.log('');

  if (DRY) {
    console.log('Re-run without --dry-run to apply.');
    return;
  }

  let moved = 0, errors = 0;

  for (const r of flat) {
    const artista  = r.context?.custom?.artista || '';
    const slug     = artistSlug(artista);
    const basename = r.public_id.split('/').pop();
    const newId    = `archivo/${slug}/${basename}`;

    process.stdout.write(`  ${r.public_id}  →  ${newId} ... `);

    const body = [
      'from_public_id=' + encodeURIComponent(r.public_id),
      'to_public_id='   + encodeURIComponent(newId),
      'overwrite=false',
      'invalidate=true',
    ].join('&');

    const res = await req('POST', `/v1_1/${CLOUD}/image/rename`, body);

    if (res.status === 200) {
      console.log('OK');
      moved++;
    } else {
      console.log(`ERROR ${res.status}: ${JSON.stringify(res.body)}`);
      errors++;
    }

    // Stay under Cloudinary rate limit (~100 req/min on free tier)
    await new Promise(resolve => setTimeout(resolve, 700));
  }

  console.log(`\nDone. Moved: ${moved}, Errors: ${errors}`);
  if (errors) console.log('Re-run to retry failed renames.');
})();
