/**
 * MineSO — Cloudflare Worker
 *
 * Responsabilidades:
 *  1. GET /          → servir a landing page (index.html em KV ou inline)
 *  2. /api/*         → proxy transparente ao backend Render (sem CORS)
 *  3. Qualquer outro → 404
 *
 * Deploy:
 *   wrangler deploy
 *
 * Variáveis de ambiente (wrangler.toml ou Cloudflare Dashboard):
 *   BACKEND_URL = https://mineso-backend-mqdo.onrender.com
 *
 * KV Namespace (opcional — para servir a landing do KV):
 *   ASSETS binding com a key "index.html"
 *   Se não existir, redireccionamos para o backend directamente.
 */

const BACKEND_URL = 'https://mineso-backend-mqdo.onrender.com';

// Headers CORS para respostas da landing (recursos estáticos)
const STATIC_HEADERS = {
  'Content-Type':              'text/html; charset=utf-8',
  'Cache-Control':             'public, max-age=300, stale-while-revalidate=60',
  'X-Content-Type-Options':    'nosniff',
  'X-Frame-Options':           'SAMEORIGIN',
  'Referrer-Policy':           'strict-origin-when-cross-origin',
};

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // ── 1. Preflight OPTIONS para /api/* ──────────────────────────────
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin':  '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-request-id',
          'Access-Control-Max-Age':       '86400',
        },
      });
    }

    // ── 2. Proxy /api/* → backend Render ─────────────────────────────
    if (path.startsWith('/api/')) {
      const backendUrl = (env.BACKEND_URL || BACKEND_URL) + path + url.search;

      // Clonar o request para o backend, removendo o host original
      const proxyReq = new Request(backendUrl, {
        method:  request.method,
        headers: filterHeaders(request.headers),
        body:    ['GET', 'HEAD'].includes(method) ? undefined : request.body,
        redirect: 'follow',
      });

      let backendRes;
      try {
        backendRes = await fetch(proxyReq);
      } catch (e) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Backend inacessível: ' + e.message }),
          { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Reescrever headers da resposta — adicionar CORS
      const resHeaders = new Headers(backendRes.headers);
      resHeaders.set('Access-Control-Allow-Origin',  '*');
      resHeaders.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      resHeaders.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-request-id');
      // Remover headers que o Cloudflare não gosta
      resHeaders.delete('alt-svc');
      resHeaders.delete('cf-ray');

      return new Response(backendRes.body, {
        status:  backendRes.status,
        headers: resHeaders,
      });
    }

    // ── 3. Landing page ───────────────────────────────────────────────
    if (path === '/' || path === '/index.html') {
      // Tentar servir do KV (ASSETS binding) se configurado
      if (env.ASSETS) {
        try {
          const asset = await env.ASSETS.get('index.html', 'text');
          if (asset) {
            return new Response(asset, { status: 200, headers: STATIC_HEADERS });
          }
        } catch (_) {}
      }

      // Fallback: redirecionar para a landing no CDN ou backend
      // (substituir pelo HTML inline se preferir bundle completo)
      return Response.redirect((env.BACKEND_URL || BACKEND_URL), 302);
    }

    // ── 4. Favicon ────────────────────────────────────────────────────
    if (path === '/favicon.ico' || path === '/favicon.svg') {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
        <rect width="32" height="32" rx="8" fill="#0E0E0F"/>
        <polyline points="8,24 13,10 18,24 23,10" fill="none" stroke="#FF5C35"
          stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
      return new Response(svg, {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' },
      });
    }

    // ── 5. 404 ────────────────────────────────────────────────────────
    return new Response('Not found', { status: 404 });
  },
};

/**
 * Filtrar headers do request original antes de reencaminhar ao backend.
 * Remove headers que causam problemas no proxy.
 */
function filterHeaders(headers) {
  const filtered = new Headers();
  const skip = new Set(['host', 'cf-connecting-ip', 'cf-ipcountry', 'cf-ray',
                        'cf-visitor', 'x-forwarded-proto', 'x-real-ip']);
  for (const [key, val] of headers.entries()) {
    if (!skip.has(key.toLowerCase())) filtered.set(key, val);
  }
  return filtered;
}
