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
    // Allow the production domain and localhost for local testing
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

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400, corsOK ? origin : ALLOWED_ORIGIN);
    }

    // ── Verify password server-side ───────────────────────────────────────────
    const submittedHash = await sha256hex(String(body.password || ''));
    if (submittedHash !== env.PW_HASH) {
      return jsonResponse({ error: 'Unauthorized' }, 401, corsOK ? origin : ALLOWED_ORIGIN);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Build Cloudinary signing params
    const timestamp    = String(Math.floor(Date.now() / 1000));
    const uploadPreset = env.CLOUDINARY_UPLOAD_PRESET;

    const signingParams = {
      folder:        FOLDER,
      timestamp,
      upload_preset: uploadPreset,
    };

    // Include context metadata (sanitised — no pipe/equals injection)
    const contextParts = [];
    if (body.artista)     contextParts.push('artista='     + sanitize(body.artista));
    if (body.descripcion) contextParts.push('descripcion=' + sanitize(body.descripcion));
    if (body.fecha)       contextParts.push('fecha='       + String(body.fecha || '').replace(/[^0-9\-]/g, ''));
    if (contextParts.length) signingParams.context = contextParts.join('|');

    // Sign: SHA-256( alphabetically_sorted_params + api_secret )
    // Requires "SHA-256 signature algorithm" enabled in Cloudinary Settings > Security.
    const paramString = Object.keys(signingParams)
      .sort()
      .map(k => k + '=' + signingParams[k])
      .join('&');
    const signature = await sha256hex(paramString + env.CLOUDINARY_API_SECRET);

    return jsonResponse(
      {
        signature,
        timestamp,
        api_key:       env.CLOUDINARY_API_KEY,
        cloud_name:    env.CLOUDINARY_CLOUD_NAME,
        upload_preset: uploadPreset,
        folder:        FOLDER,
        context:       signingParams.context || null,
      },
      200,
      corsOK ? origin : ALLOWED_ORIGIN,
    );
  },
};

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
