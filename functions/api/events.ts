// Cloudflare Pages Function: GET /api/events
// Samlar ihop Stockholms eventkällor (Visit Stockholm + Visit Sweden) EN gång per
// dag och delar samma svar med alla besökare via Cloudflares edge-cache.
// Utan denna funktion hade varje besökares webbläsare hämtat ~50 API-sidor själv.
//
// Cache-nyckeln innehåller dagens datum (UTC) + en versionsstämpel, så cachen
// förnyas automatiskt vid midnatt och när datamappningen ändras (bumpa CACHE_STAMP).
//
// Klienten (src/lib/visitstockholm.ts) faller tillbaka på direkta anrop om
// funktionen inte svarar – t.ex. i lokal vite-dev där Pages Functions saknas.

// Samma hämtnings- och mappningslogik som klienten använder – full trohet mot
// hur pris, kategorier, tider och bilder tolkas. Körs här i Cloudflaras runtime.
import { fetchVisitStockholmEvents } from "../../src/lib/visitstockholm";

interface Env {
  // reserverad för framtida API-nycklar
}

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 h
const UPSTREAM_TIMEOUT_MS = 25_000;
// Cloudflare Free tillåter max 50 subrequests per anrop: kör med marginal så
// funktionen aldrig själv får slut på dem (Visit Stockholm upp till 45 sidor
// + Visit Sweden 3 anrop < 50).
const MAX_PAGES = 45;
const CACHE_STAMP = "v1"; // bumpa vid ändringar i datamappningen

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  const day = new Date().toISOString().slice(0, 10);
  // Cache-nyckeln hostas på ett internt hostname – den kan aldrig krocka med riktiga URL:er.
  const cacheKey = new Request(`https://events-cache.hander.internal/?day=${day}&v=${CACHE_STAMP}`, { method: "GET" });
  const cache = caches.default;

  const cached = await cache.match(cacheKey);
  if (cached) {
    return new Response(cached.body, { status: cached.status, headers: { ...cached.headers, "x-hander-cache": "hit" } });
  }

  try {
    const events = await fetchVisitStockholmEvents(AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), { maxPages: MAX_PAGES });
    if (events.length === 0) {
      // Cache:a ett kortvarigt tomt svar så att en tillfälligt felande källa
      // inte utlöser en storm av anrop från alla besökare samtidigt.
      return json({ events: [], count: 0, day, source: "visit-stockholm" }, 503, {
        "cache-control": "public, max-age=120",
      });
    }
    const body = json(
      { events, count: events.length, day, generatedAt: new Date().toISOString(), source: "visit-stockholm" },
      200,
      { "cache-control": `public, max-age=${CACHE_TTL_SECONDS}` },
    );
    const cacheResponse = body.clone();
    // fire-and-forget cache-skrivning; svaret till användaren väntar inte på det
    void cache.put(cacheKey, cacheResponse).catch(() => undefined);
    return new Response(body.body, { status: 200, headers: { ...body.headers, "x-hander-cache": "miss" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "okänt fel";
    return json({ events: [], error: `kunde inte hämta events: ${reason}` }, 503, {
      "cache-control": "public, max-age=120",
    });
  }
};
