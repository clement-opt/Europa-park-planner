/**
 * Relais CORS pour l'API queue-times.com.
 * Déploiement : wrangler deploy, ou copier-coller dans le dashboard Cloudflare Workers.
 * Usage depuis l'app : https://votre-worker.workers.dev/?url=
 */
const ALLOWED = /^https:\/\/queue-times\.com\//;

export default {
  async fetch(request) {
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,OPTIONS",
      "access-control-allow-headers": "*"
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const target = new URL(request.url).searchParams.get("url");
    if (!target || !ALLOWED.test(target)) {
      return new Response(JSON.stringify({ error: "url manquante ou non autorisee" }), {
        status: 400,
        headers: { ...cors, "content-type": "application/json" }
      });
    }

    const upstream = await fetch(target, {
      cf: { cacheTtl: 45, cacheEverything: true },
      headers: { "user-agent": "europa-park-planner" }
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...cors, "content-type": "application/json", "cache-control": "public, max-age=45" }
    });
  }
};
