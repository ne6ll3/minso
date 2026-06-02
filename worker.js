const LANDING_URL = 'https://mineso-landing.onrender.com';
const BACKEND_URL = 'https://menuos-backend-mqdo.onrender.com;

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // Preflight CORS
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

    // /api/* → backend Render
    if (path.startsWith('/api/')) {
      const target = (env.BACKEND_URL || BACKEND_URL) + path + url.search;
      const proxyReq = new Request(target, {
        method,
        headers: filterHeaders(request.headers),
        body: ['GET','HEAD'].includes(method) ? undefined : request.body,
        redirect: 'follow',
      });
      let res;
      try { res = await fetch(proxyReq); }
      catch (e) {
        return new Response(JSON.stringify({ ok:false, error: e.message }),
          { status:502, headers:{'Content-Type':'application/json'} });
      }
      const h = new Headers(res.headers);
      h.set('Access-Control-Allow-Origin', '*');
      h.delete('alt-svc');
      return new Response(res.body, { status: res.status, headers: h });
    }

    // / e qualquer outro → landing Render
    const landingTarget = (env.LANDING_URL || LANDING_URL) + path + url.search;
    const landingReq = new Request(landingTarget, {
      method,
      headers: filterHeaders(request.headers),
      body: ['GET','HEAD'].includes(method) ? undefined : request.body,
      redirect: 'follow',
    });
    let res;
    try { res = await fetch(landingReq); }
    catch (e) {
      return new Response('Landing inacessível', { status: 502 });
    }
    return new Response(res.body, { status: res.status, headers: new Headers(res.headers) });
  },
};

function filterHeaders(headers) {
  const out  = new Headers();
  const skip = new Set(['host','cf-connecting-ip','cf-ipcountry','cf-ray','cf-visitor','x-forwarded-proto']);
  for (const [k, v] of headers.entries()) {
    if (!skip.has(k.toLowerCase())) out.set(k, v);
  }
  return out;
}
