// Cache-abstraktion för API-funktionerna. Cloudflare Pages ger `caches.default`,
// men en Worker som körs i Freebuff Sites får inte röra den ("This Worker is not
// permitted to access the default cache"). Där faller vi tillbaka på en liten
// cache i minnet per isolat, så upprepade anrop slipper hämta om allt upstream.

type CacheEntry = {
  at: number;
  status: number;
  headers: [string, string][];
  body: ArrayBuffer;
};

const MEMORY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 40;

const memoryStore = new Map<string, CacheEntry>();

function prune(): void {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (now - entry.at > MEMORY_TTL_MS) memoryStore.delete(key);
  }
  while (memoryStore.size > MAX_ENTRIES) {
    const oldest = memoryStore.keys().next();
    if (oldest.done) break;
    memoryStore.delete(oldest.value);
  }
}

const memoryCache = {
  async match(request: Request): Promise<Response | undefined> {
    const entry = memoryStore.get(request.url);
    if (!entry) return undefined;
    if (Date.now() - entry.at > MEMORY_TTL_MS) {
      memoryStore.delete(request.url);
      return undefined;
    }
    return new Response(entry.body.slice(0), {
      status: entry.status,
      headers: entry.headers,
    });
  },
  async put(request: Request, response: Response): Promise<void> {
    const body = await response.arrayBuffer();
    memoryStore.set(request.url, {
      at: Date.now(),
      status: response.status,
      headers: [...response.headers.entries()],
      body,
    });
    prune();
  },
};

export type EdgeCache = {
  match: (request: Request) => Promise<Response | undefined>;
  put: (request: Request, response: Response) => Promise<void>;
};

const PROBE_URL = "https://hander-cache-probe.invalid/";

/**
 * Vissa runtime (Freebuff Sites) lämnar ut `caches.default` men kastar först när
 * cachen används. Därför provar vi en riktig uppslagning en gång per isolat och
 * faller tillbaka på minnescachen om den inte är tillåten.
 */
async function detectEdgeCache(): Promise<EdgeCache> {
  try {
    const cache = caches.default;
    if (!cache) return memoryCache;
    await cache.match(new Request(PROBE_URL));
    return cache as unknown as EdgeCache;
  } catch {
    return memoryCache;
  }
}

let resolvedCache: Promise<EdgeCache> | undefined;

/** Edge-cachen när runtime tillåter den, annars minnescachen ovan. */
export function edgeCache(): Promise<EdgeCache> {
  resolvedCache ??= detectEdgeCache();
  return resolvedCache;
}
