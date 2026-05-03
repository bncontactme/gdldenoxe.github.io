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

const ALLOWED_ORIGIN = 'https://gdldenoxe.github.io';
const FOLDER = 'archivo';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const corsOK =
      origin === ALLOWED_ORIGIN ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1');

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(corsOK ? origin : ALLOWED_ORIGIN),
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
      return jsonResponse({ error: 'Invalid JSON' }, 400, corsOK ? origin : ALLOWED_ORIGIN);
    }

    // ── Verify password ───────────────────────────────────────────────────────
    const submittedHash = await sha256hex(String(body.password || ''));
    if (submittedHash !== env.PW_HASH) {
      return jsonResponse({ error: 'Unauthorized' }, 401, corsOK ? origin : ALLOWED_ORIGIN);
    }

    // ── Route by action ───────────────────────────────────────────────────────
    if (body.action === 'delete') {
      return handleDelete(body, env, corsOK ? origin : ALLOWED_ORIGIN);
    }
    return handleUpload(body, env, corsOK ? origin : ALLOWED_ORIGIN);
  },
};

// ── Upload handler ────────────────────────────────────────────────────────────
async function handleUpload(body, env, origin) {
    const timestamp    = String(Math.floor(Date.now() / 1000));
    const uploadPreset = env.CLOUDINARY_UPLOAD_PRESET;

    const signingParams = {
      folder:        FOLDER,
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
      { signature, timestamp, api_key: env.CLOUDINARY_API_KEY, cloud_name: env.CLOUDINARY_CLOUD_NAME, upload_preset: uploadPreset, folder: FOLDER, context: signingParams.context || null },
      200, origin,
    );
}

// ── Delete handler ────────────────────────────────────────────────────────────
async function handleDelete(body, env, origin) {
  const publicIds = Array.isArray(body.public_ids) ? body.public_ids : [];
  if (!publicIds.length) {
    return jsonResponse({ error: 'No public_ids provided' }, 400, origin);
  }
  // Limit to 100 per request (Cloudinary API limit)
  const ids = publicIds.slice(0, 100).map(id => String(id));

  const timestamp = String(Math.floor(Date.now() / 1000));
  // Sign: public_ids[]=...&timestamp=...  (sorted, joined)
  const idsParam = ids.sort().join(',');
  const paramString = 'public_ids[]=' + idsParam + '&timestamp=' + timestamp;
  const signature   = await sha256hex(paramString + env.CLOUDINARY_API_SECRET);

  const form = new FormData();
  ids.forEach(id => form.append('public_ids[]', id));
  form.append('timestamp', timestamp);
  form.append('api_key',   env.CLOUDINARY_API_KEY);
  form.append('signature', signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/image/destroy`,
    { method: 'POST', body: form },
  );
  const data = await res.json();
  return jsonResponse(data, res.status, origin);
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
