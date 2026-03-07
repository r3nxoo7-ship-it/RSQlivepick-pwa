/**
 * Cloudflare Worker — SofaScore API Proxy
 *
 * Proxies requests to api.sofascore.com from Cloudflare edge nodes.
 * CF IPs are rarely blocked by SofaScore since SofaScore itself uses Cloudflare CDN.
 *
 * Usage:
 *   GET https://<worker>.workers.dev/api/v1/sport/football/scheduled-events/2026-01-15
 *   Header: x-proxy-secret: <your-secret>
 *
 * Deploy:
 *   cd cloudflare-worker
 *   npx wrangler secret put PROXY_SECRET   # set your secret
 *   npx wrangler deploy
 */

interface Env {
  PROXY_SECRET: string;
}

const SOFASCORE_BASE = 'https://api.sofascore.com';

const SOFASCORE_HEADERS: Record<string, string> = {
  Accept: '*/*',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Referer: 'https://www.sofascore.com/',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    // Only allow GET
    if (request.method !== 'GET') {
      return jsonError(405, 'Method not allowed');
    }

    // Validate secret
    const secret = request.headers.get('x-proxy-secret');
    if (!env.PROXY_SECRET || secret !== env.PROXY_SECRET) {
      return jsonError(403, 'Forbidden');
    }

    // Extract path from URL
    const url = new URL(request.url);
    const path = url.pathname + url.search;

    if (!path.startsWith('/api/v1/')) {
      return jsonError(400, 'Path must start with /api/v1/');
    }

    try {
      const response = await fetch(`${SOFASCORE_BASE}${path}`, {
        headers: SOFASCORE_HEADERS,
        cf: {
          // Cache at Cloudflare edge for 60 seconds
          cacheTtl: 60,
          cacheEverything: true,
        },
      });

      // Clone response with CORS headers
      const body = await response.arrayBuffer();
      return new Response(body, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
          'Cache-Control': 'public, max-age=60',
          ...corsHeaders(),
        },
      });
    } catch (err) {
      return jsonError(502, 'Upstream fetch failed');
    }
  },
} satisfies ExportedHandler<Env>;

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'x-proxy-secret, Content-Type',
  };
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}
