// Cloudflare Pages Function: GET /api/places
// Samlar Stockholms fasta platser (Visit Stockholms /objects/) EN gång per dag
// och delar samma svar med alla besökare via Cloudflares edge-cache – samma
// mönster som /api/events. Utan funktionen hämtar varje webbläsare sidorna själv.
//
// Klienten (src/lib/visitstockholm-places.ts) faller tillbaka på direkta anrop
// när funktionen inte svarar, t.ex. i lokal vite-dev eller på den statiska hosten.

import { fetchVisitStockholmPlaces } from "../../src/lib/visitstockholm-places";

interface Env {
  // reserverad för framtida API-nycklar
}

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 h
const UPSTREAM_TIMEOUT_MS = 25_000;
// Ett enda upstream-anrop: API:t svarar med 500 objekt per sida (`?size=`).
const CACHE_STAMP = "v2"; // bumpa vid ändringar i mappningen

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  const day = new Date().toISOString().slice(0, 10);
  const cacheKey = new URL(request.url);
  cacheKey.searchParams.set("day", day);
  cacheKey.searchParams.set("v", CACHE_STAMP);
  const cacheRequest = new Request(cacheKey.toString(), { method: "GET" });
  const cache = caches.default;

  const cached = await cache.match(cacheRequest);
  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: { ...cached.headers, "x-hander-cache": "hit" },
    });
  }

  try {
    const places = await fetchVisitStockholmPlaces(AbortSignal.timeout(UPSTREAM_TIMEOUT_MS));
    if (places.length === 0) {
      return json({ places: [], count: 0, day, source: "visit-stockholm-objects" }, 503, {
        "cache-control": "public, max-age=120",
      });
    }
    const body = json(
      {
        places,
        count: places.length,
        day,
        generatedAt: new Date().toISOString(),
        source: "visit-stockholm-objects",
      },
      200,
      { "cache-control": `public, max-age=${CACHE_TTL_SECONDS}` },
    );
    const cacheResponse = body.clone();
    void cache.put(cacheRequest, cacheResponse).catch(() => undefined);
    return new Response(body.body, {
      status: 200,
      headers: { ...body.headers, "x-hander-cache": "miss" },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "okänt fel";
    return json({ places: [], error: `kunde inte hämta platser: ${reason}` }, 503, {
      "cache-control": "public, max-age=120",
    });
  }
};
