// Cloudflare Pages Function: GET /api/event-image?url=<arrangörens sida>
// Läser JSON-LD (schema.org Event/Offer) och og:image från arrangörens officiella
// sida och returnerar en bild-URL. Svaret cachas i Cloudflares edge i 24 h.
//
// Endast bild-URL returneras – webbläsaren laddar bilden direkt från
// arrangörens server, så inget kopieras eller lagras permanent hos oss.

interface Env {
  // reserverad för framtida API-nycklar
}

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 h
const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 600_000;

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

function normalizeImageUrl(value: unknown): string | undefined {
  const candidates: unknown[] = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    let raw: unknown = candidate;
    if (candidate && typeof candidate === "object") {
      const record = candidate as Record<string, unknown>;
      raw = record.url ?? record.contentUrl ?? record["@id"];
    }
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!/^https?:\/\//i.test(trimmed)) continue;
    try {
      const url = new URL(trimmed);
      if (!ALLOWED_PROTOCOLS.has(url.protocol)) continue;
      if (BLOCKED_HOSTS.has(url.hostname)) continue;
      return url.toString();
    } catch {
      continue;
    }
  }
  return undefined;
}

/** Leta JSON-LD-block och plocka Event-bilder (inkl. offers-baserade sidor). */
function imagesFromJsonLd(html: string): string[] {
  const images: string[] = [];
  const scriptPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptPattern.exec(html)) !== null) {
    try {
      const parsed: unknown = JSON.parse(match[1].trim());
      const nodes: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const record = node as Record<string, unknown>;
        for (const key of ["image", "photo", "thumbnailUrl"]) {
          const found = normalizeImageUrl(record[key]);
          if (found) images.push(found);
        }
        const graph = record["@graph"];
        if (Array.isArray(graph)) {
          for (const child of graph) {
            if (!child || typeof child !== "object") continue;
            const childRecord = child as Record<string, unknown>;
            if (!String(childRecord["@type"] ?? "").includes("Event")) continue;
            for (const key of ["image", "photo", "thumbnailUrl"]) {
              const found = normalizeImageUrl(childRecord[key]);
              if (found) images.push(found);
            }
          }
        }
      }
    } catch {
      // Ogiltigt JSON-LD i det här blocket – fortsätt med nästa.
    }
  }
  return images;
}

function imageFromMeta(html: string): string | undefined {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return normalizeImageUrl(match[1]);
  }
  return undefined;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const requestUrl = new URL(request.url);
  const target = requestUrl.searchParams.get("url");
  if (!target) return json({ error: "Parametern 'url' krävs." }, 400);

  let parsedTarget: URL;
  try {
    parsedTarget = new URL(target);
  } catch {
    return json({ error: "Ogiltig URL." }, 400);
  }
  if (!ALLOWED_PROTOCOLS.has(parsedTarget.protocol) || BLOCKED_HOSTS.has(parsedTarget.hostname)) {
    return json({ error: "URL:en är inte tillåten." }, 400);
  }

  const cacheKey = new Request(`https://event-image-cache.hander.internal/?url=${encodeURIComponent(parsedTarget.toString())}`, { method: "GET" });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(parsedTarget.toString(), {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; HanderApp/1.0; +https://hander.pages.dev)",
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return json({ image: null, reason: `arrangör svarade ${response.status}` }, 200, { "cache-control": "public, max-age=1800" });
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_HTML_BYTES) {
      return json({ image: null, reason: "sida för stor" }, 200, { "cache-control": "public, max-age=1800" });
    }
    const html = new TextDecoder("utf-8").decode(buffer);

    const image = imagesFromJsonLd(html)[0] ?? imageFromMeta(html);
    const body = json({ image: image ?? null, source: parsedTarget.hostname });
    const cacheResponse = body.clone();
    cacheResponse.headers.set("cache-control", `public, max-age=${CACHE_TTL_SECONDS}`);
    // fire-and-forget cache-skrivning; svaret till användaren väntar inte på det
    void cache.put(cacheKey, cacheResponse).catch(() => undefined);
    return body;
  } catch {
    return json({ image: null, reason: "kunde inte hämta arrangörssidan" }, 200, { "cache-control": "public, max-age=1800" });
  }
};
