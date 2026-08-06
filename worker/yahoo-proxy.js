/* Cloudflare Worker: adds CORS headers to Yahoo Finance's chart endpoint.
 *
 * Yahoo serves quotes for free and without an API key, but sends no
 * Access-Control-Allow-Origin header — so a browser refuses to read the
 * response. This worker sits in front of it and adds one. Nothing else.
 *
 * Deploy (free tier, 100k requests/day, no card required):
 *
 *   npm i -g wrangler
 *   wrangler login                      # opens a browser
 *   cd worker && wrangler deploy
 *
 * Then put the resulting URL in app.js:
 *
 *   provider:   'yahoo',
 *   yahooProxy: 'https://mrbd-yahoo-proxy.<your-subdomain>.workers.dev/?url='
 *
 * ALLOWED_HOSTS keeps this from becoming an open proxy that anyone can point
 * at any server — without it, the URL is a free relay for abuse traffic.
 */

const ALLOWED_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];

// Restrict to the page(s) allowed to call this worker. '*' permits any origin.
const ALLOWED_ORIGIN = '*';

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'GET') return json(405, { error: 'GET only' });

    const target = new URL(request.url).searchParams.get('url');
    if (!target) return json(400, { error: 'missing ?url=' });

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return json(400, { error: 'malformed url' });
    }

    if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.includes(parsed.hostname)) {
      return json(403, { error: 'host not allowed', host: parsed.hostname });
    }

    let upstream;
    try {
      upstream = await fetch(parsed.toString(), {
        // Yahoo returns 403 to requests without a browser-shaped User-Agent
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; mrbd-stocks/1.0)', Accept: 'application/json' },
        // Collapse identical requests at the edge; quotes need not be per-request fresh
        cf: { cacheTtl: 30, cacheEverything: true }
      });
    } catch (e) {
      return json(502, { error: 'upstream unreachable', detail: String(e) });
    }

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...CORS,
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'public, max-age=30'
      }
    });
  }
};
