// Cloudflare Worker — archivo-upload
// Verifies the upload password server-side and returns Cloudinary signed upload
// parameters. The Cloudinary API secret never leaves this Worker.
//
// Required secrets — set via CLI (see wrangler.toml for commands):
//   PW_HASH                    SHA-256 hex of your upload password
//   CLOUDINARY_CLOUD_NAME      e.g. duog120j4
//   CLOUDINARY_API_KEY         from Cloudinary Dashboard > Settings > API Keys
//   CLOUDINARY_API_SECRET      from Cloudinary Dashboard > Settings > API Keys
//   CLOUDINARY_UPLOAD_PRESET   name of your NEW signed preset (e.g. archivo_signed)
//
// Required Cloudinary settings:
//   Dashboard > Settings > Security > enable "SHA-256 signature algorithm"
//   Dashboard > Settings > Upload > create a SIGNED preset named archivo_signed
//     with folder = archivo, then DISABLE the old archivo_unsigned preset.

const ALLOWED_ORIGINS = new Set([
  'https://gdldenoxe.github.io',
  'https://www.guadalajaradenoxe.com',
  'https://guadalajaradenoxe.com',
]);
const FOLDER = 'archivo';

const GITHUB_OWNER      = 'bncontactme';
const GITHUB_REPO       = 'gdldenoxe.github.io';
const IMAGES_JSON_PATH  = 'archivoPage/images.json';

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

    // ── Verify password ───────────────────────────────────────────────────────
    const submittedHash = await sha256hex(String(body.password || ''));
    if (submittedHash !== env.PW_HASH) {
      return jsonResponse({ error: 'Unauthorized' }, 401, allowedOrigin);
    }

    // ── Route by action ───────────────────────────────────────────────────────
    if (body.action === 'delete') {
      return handleDelete(body, env, allowedOrigin);
    }
    if (body.action === 'register') {
      return handleRegister(body, env, allowedOrigin);
    }
    return handleUpload(body, env, allowedOrigin);
  },
};

// ── Subfolder slug from artist name ──────────────────────────────────────────
function artistSlug(artista) {
  if (!artista) return 'general';
  const handle = String(artista).match(/@(\w+)/);
  if (handle) return handle[1].toLowerCase();
  return String(artista).trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    .slice(0, 40) || 'general';
}

// ── Upload handler ────────────────────────────────────────────────────────────
async function handleUpload(body, env, origin) {
    const timestamp    = String(Math.floor(Date.now() / 1000));
    const uploadPreset = env.CLOUDINARY_UPLOAD_PRESET;

    // Place image in archivo/<artist-slug>/ subfolder
    const slug   = artistSlug(body.artista);
    const folder = FOLDER + '/' + slug;

    const signingParams = {
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
      { signature, timestamp, api_key: env.CLOUDINARY_API_KEY, cloud_name: env.CLOUDINARY_CLOUD_NAME, upload_preset: uploadPreset, folder, context: signingParams.context || null },
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

  // Cloudinary Admin API — DELETE /resources/image/upload with Basic auth
  const basicAuth = btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`);
  const qs = ids.map(id => 'public_ids[]=' + encodeURIComponent(id)).join('&');
  const url = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/image/upload?${qs}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Basic ${basicAuth}` },
  });
  let data;
  try { data = await res.json(); } catch { data = { error: 'Cloudinary returned non-JSON (status ' + res.status + ')' }; }

  if (res.ok) {
    // Update images.json on GitHub — remove entries whose URL contains any deleted public_id
    try {
      await githubUpdateImagesJson(env, function(entries) {
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
    await githubUpdateImagesJson(env, function(current) {
      return current.concat(sanitizedEntries);
    });
    return jsonResponse({ ok: true }, 200, origin);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 502, origin);
  }
}

// ── GitHub images.json updater ────────────────────────────────────────────────
async function githubUpdateImagesJson(env, updateFn) {
  const ghHeaders = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'archivo-upload-worker',
  };
  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${IMAGES_JSON_PATH}`;

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
      message: 'chore: update archive manifest [skip ci]',
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '86400',
  };
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}
