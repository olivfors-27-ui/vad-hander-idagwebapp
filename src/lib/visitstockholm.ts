import { MAP_CENTER, type CategoryId, type EventItem } from "./hander-data";
import { curatedCategoryFor, isApiEvent, isCuratedEvent, withFeedSource } from "./event-source";
import { categoryForEvent, resolveCategory } from "./event-category";

const VISIT_STOCKHOLM_URL = "https://api.visitstockholm.com/api/public-v1/events/";
const VISIT_SWEDEN_URL = "https://data.visitsweden.com/store/search";
/** Standardgräns: 50 sidor. Pages Function-kopian kör med lägre gräns (Cloudflare subrequest-tak på 50/anrop). */
const MAX_PAGES = 50;
export type FetchEventsOptions = { maxPages?: number };
const MAX_DISTANCE_KM = 25;
const STOCKHOLM_QUERY = "public:true AND rdfType:http\\://schema.org\\/Event";

type ApiTitle = string | { sv?: string; en?: string };
type ApiCategory = { slug?: string; title?: string; subcategories?: ApiCategory[] };
type ApiScheduleDate = { date?: string; start_time?: string | null; end_time?: string | null };

type VisitStockholmEvent = {
  id?: string;
  title?: ApiTitle;
  description?: ApiTitle;
  external_website_url?: string | null;
  price?: unknown;
  price_info?: unknown;
  cost?: unknown;
  image?: unknown;
  images?: unknown;
  address?: string | null;
  venue_name?: string | null;
  city?: string | null;
  location?: { latitude?: number; longitude?: number } | null;
  start_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  categories?: ApiCategory[];
  schedule?: { dates?: ApiScheduleDate[] } | null;
};

type VisitStockholmResponse = { results?: VisitStockholmEvent[]; total_pages?: number };
type JsonLdValue = string | { "@id"?: string; "@value"?: string; "@language"?: string } | undefined;
type JsonLdNode = {
  "@id"?: string;
  "@type"?: string | string[];
  [key: string]: unknown;
};
type VisitSwedenChild = { metadata?: { "@graph"?: JsonLdNode[] }; entryId?: string };
type VisitSwedenResponse = { resource?: { children?: VisitSwedenChild[] } };

const textFor = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    // JSON-LD-objekt: locale-strängar eller {@id,@value}-noder.
    const record = value as Record<string, unknown>;
    const pick = (key: string) => (typeof record[key] === "string" ? (record[key] as string) : "");
    return pick("sv") || pick("en") || pick("@value") || pick("@id") || "";
  }
  return "";
};

const stripHtml = (value: string) =>
  value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();

function parsePrice(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return parsePrice(record["price"]) ?? parsePrice(record["schema:price"]) ?? parsePrice(record["name"]) ?? parsePrice(record["description"]);
  }
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  if (/gratis|free|kostar inget|kostnadsfritt/i.test(normalized)) return 0;
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : undefined;
}

function priceFromText(value: string): number | undefined {
  if (/gratis|free|kostar inget|kostnadsfritt/i.test(value)) return 0;
  const match = value.match(/(?:från|from|pris|entr[eé]|biljett)?\s*(\d{2,5})\s*(?:kr|sek)/i);
  return match ? Number(match[1]) : undefined;
}

const validDate = (value: string | null | undefined) => Boolean(value && /^\d{4}-\d{2}-\d{2}/.test(value));
const dateOnly = (value: string) => value.slice(0, 10);

const addHours = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  const total = ((hours || 0) * 60 + (minutes || 0) + 120) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

const distanceKm = (lat: number, lng: number) => {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat - MAP_CENTER.lat);
  const dLng = toRadians(lng - MAP_CENTER.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(MAP_CENTER.lat)) * Math.cos(toRadians(lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
};

const firstFutureSchedule = (event: VisitStockholmEvent) => {
  const today = new Date().toISOString().slice(0, 10);
  return (event.schedule?.dates ?? []).filter((slot) => validDate(slot.date) && (slot.date as string) >= today).sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
};

const toEvent = ({ id, title, description, address, venue, date, start, end, lat, lng, url, image, price, organizerId }: {
  id: string; title: string; description: string; address: string; venue: string; date: string;
  start?: string | null | undefined; end?: string | null | undefined;
  lat: number; lng: number; url?: string | undefined; image?: string | undefined; price?: number | undefined; organizerId: string;
}): EventItem | null => {
  const distance = distanceKm(lat, lng);
  if (!date || distance > MAX_DISTANCE_KM) return null;
  const startTime = start && /^\d{1,2}:\d{2}/.test(start) ? start.slice(0, 5) : "12:00";
  const name = title || "Event i Stockholm";
  // Titel först, beskrivning bara som reserv. Listan fyller i när API-texten
  // inte kommit längre än till "kultur".
  const category = resolveCategory(
    categoryForEvent({ name, place: venue, description }),
    curatedCategoryFor({ name, sourceUrl: url }),
  );
  return {
    id,
    name,
    // Källan stämplas här, en gång, i stället för i varje kortrendering.
    feedSource: isCuratedEvent({ name, place: venue, sourceUrl: url }) ? "curated" : "api",
    category,
    date: dateOnly(date),
    start: startTime,
    end: end && /^\d{1,2}:\d{2}/.test(end) ? end.slice(0, 5) : addHours(startTime),
    place: venue || "Stockholm",
    address: address || "Stockholm",
    price: price ?? 0,
    priceKnown: price !== undefined,
    // Hela beskrivningen sparas. Kapning sker först vid visning och då vid en
    // meningsgräns (se truncateDescription).
    description,
    ...(typeof image === "string" && /^https?:\/\//i.test(image) ? { image } : {}),
    organizerId,
    interested: [],
    visibility: "public",
    status: "approved",
    lat,
    lng,
    distance,
    ...(url ? { sourceUrl: url } : {}),
  };
};

const fetchJson = async <T,>(url: string, signal?: AbortSignal) => {
  const response = await fetch(url, { ...(signal ? { signal } : {}), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`API svarade ${response.status}`);
  return response.json() as Promise<T>;
};

const fetchVisitStockholmPage = (page: number, signal?: AbortSignal) => fetchJson<VisitStockholmResponse>(`${VISIT_STOCKHOLM_URL}?page=${page}`, signal);

const mapVisitStockholmPage = (page: VisitStockholmResponse): EventItem[] =>
  (page.results ?? []).flatMap((event) => {
    if (!event.id || !event.location || typeof event.location.latitude !== "number" || typeof event.location.longitude !== "number") return [];
    const slot = firstFutureSchedule(event);
    const candidate = slot?.date || event.start_date || "";
    const date = validDate(candidate) ? candidate : "";
    const normalized = toEvent({
      id: `visit-${event.id}`,
      title: textFor(event.title),
      description: stripHtml(textFor(event.description)),
      address: event.address || event.city || "Stockholm",
      venue: event.venue_name || event.address || event.city || "Stockholm",
      date,
      start: slot?.start_time || event.start_time,
      end: slot?.end_time || event.end_time,
      lat: event.location.latitude,
      lng: event.location.longitude,
      url: event.external_website_url || undefined,
      price: parsePrice(event.price) ?? parsePrice(event.price_info) ?? parsePrice(event.cost) ?? priceFromText(stripHtml(textFor(event.description))),
      image: firstImage(event.image) || firstImage(event.images),
      organizerId: "visit-stockholm",
    });
    return normalized ? [normalized] : [];
  });

/** Hämtar sidorna from..to (inklusive), sex åt gången. */
async function fetchVisitStockholmPages(
  from: number,
  to: number,
  signal?: AbortSignal,
): Promise<EventItem[]> {
  const pages: VisitStockholmResponse[] = [];
  for (let start = from; start <= to; start += 6) {
    pages.push(...await Promise.all(
      Array.from({ length: Math.min(6, to - start + 1) }, (_, index) =>
        fetchVisitStockholmPage(start + index, signal),
      ),
    ));
  }
  return pages.flatMap(mapVisitStockholmPage);
}

async function fetchVisitStockholmSource(signal?: AbortSignal, maxPages = MAX_PAGES): Promise<EventItem[]> {
  const firstPage = await fetchVisitStockholmPage(1, signal);
  const pageCount = Math.min(Math.max(firstPage.total_pages ?? 1, 1), maxPages);
  const events = mapVisitStockholmPage(firstPage);
  if (pageCount > 1) events.push(...await fetchVisitStockholmPages(2, pageCount, signal));
  return events;
}

/**
 * Fyller på resten när servern bara hunnit hämta en del av sidorna (Freebuff
 * Sites tillåter 20 subrequests per anrop). Läser total_pages ur första svaret.
 */
export async function fetchVisitStockholmEventsFromPage(
  startPage: number,
  signal?: AbortSignal,
): Promise<EventItem[]> {
  const first = await fetchVisitStockholmPage(startPage, signal);
  const last = Math.max(first.total_pages ?? startPage, startPage);
  const events = mapVisitStockholmPage(first);
  if (last > startPage) events.push(...await fetchVisitStockholmPages(startPage + 1, last, signal));
  return events;
}

const graphValue = (node: JsonLdNode | undefined, key: string) => textFor(node?.[key]);

/** JSON-LD-referens: hämta strängvärdet på {@id} om noden är ett objekt. */
const refId = (value: unknown): string | undefined => {
  if (value && typeof value === "object") {
    const id = (value as { "@id"?: unknown })["@id"];
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
};

function firstImage(value: unknown): string | undefined {
  if (typeof value === "string") return /^https?:\/\//i.test(value) ? value : undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const image = firstImage(item);
      if (image) return image;
    }
    return undefined;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["url", "contentUrl", "thumbnailUrl", "@id"]) {
      const image = firstImage(record[key]);
      if (image) return image;
    }
  }
  return undefined;
}

function normalizeVisitSwedenChild(child: VisitSwedenChild): EventItem | null {
  const graph = child.metadata?.["@graph"] ?? [];
  const event = graph.find((node) => String(node["@type"] ?? "").includes("Event"));
  if (!event) return null;
  const geoRef = refId(event["schema:geo"]);
  const addressRef = refId(event["schema:address"]);
  const geo = graph.find((node) => node["@id"] === geoRef);
  const addressNode = graph.find((node) => node["@id"] === addressRef);
  const lat = Number(graphValue(geo, "schema:latitude"));
  const lng = Number(graphValue(geo, "schema:longitude"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const startDate = graphValue(event, "schema:startDate");
  if (!validDate(startDate)) return null;
  const title = graphValue(event, "schema:name") || "Event i Sverige";
  const description = stripHtml(graphValue(event, "schema:description") || graphValue(event, "dcterms:abstract"));
  const address = graphValue(addressNode, "schema:streetAddress") || graphValue(addressNode, "schema:addressLocality") || "Stockholm";
  const image =
    firstImage(event["schema:image"]) ||
    firstImage(event["schema:photo"]) ||
    firstImage(event["image"]) ||
    firstImage(event["photo"]);
  return toEvent({
    id: `sweden-${child.entryId || event["@id"] || title}`,
    title,
    description,
    address,
    venue: graphValue(addressNode, "schema:addressLocality") || address,
    date: startDate,
    start: startDate.includes("T") ? startDate.slice(11, 16) : "12:00",
    lat,
    lng,
    url: graphValue(event, "schema:url") || (typeof event["@id"] === "string" ? event["@id"] : undefined),
    price: parsePrice(event["schema:price"]) ?? parsePrice(event["schema:offers"]) ?? priceFromText(description),
    image,
    organizerId: "visit-sweden",
  });
}

/** Visit Sweden's national schema.org feed is public and adds image-rich tourism events. */
async function fetchVisitSwedenEvents(signal?: AbortSignal): Promise<EventItem[]> {
  const events: EventItem[] = [];
  for (const offset of [0, 100, 200]) {
    const params = new URLSearchParams({ type: "solr", query: STOCKHOLM_QUERY, limit: "100", offset: String(offset), rdfFormat: "application/ld+json" });
    const page = await fetchJson<VisitSwedenResponse>(`${VISIT_SWEDEN_URL}?${params.toString()}`, signal);
    const normalized = (page.resource?.children ?? []).map(normalizeVisitSwedenChild).filter((event): event is EventItem => Boolean(event));
    events.push(...normalized);
    if ((page.resource?.children?.length ?? 0) < 100) break;
  }
  return events;
}

const dedupeEvents = (events: EventItem[]): EventItem[] => {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.name.toLowerCase()}|${event.date}|${event.place.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export async function fetchVisitStockholmEvents(signal?: AbortSignal, options?: FetchEventsOptions): Promise<EventItem[]> {
  const maxPages = options?.maxPages;
  const results = await Promise.allSettled([
    maxPages === undefined ? fetchVisitStockholmSource(signal) : fetchVisitStockholmSource(signal, maxPages),
    fetchVisitSwedenEvents(signal),
  ]);
  const all = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  return dedupeEvents(all);
}

/**
 * Hämtar events via den delade dags-cachen (/api/events, Pages Function) när den
 * finns – ett enda anrop istället för ~50 per besökare. Sparar dessutom resultatet
 * i webbläsaren under resten av dagen (localStorage), så återbesök samma dag
 * gör noll nätverksanrop. Faller tillbaka på direkta anrop när funktionen
 * saknas (lokal vite-dev) eller svarar tomt.
 */
const BROWSER_CACHE_KEY = "hander-events-cache-v1";
const todayUtc = () => new Date().toISOString().slice(0, 10);

function readBrowserDayCache(): EventItem[] | null {
  try {
    const raw = localStorage.getItem(BROWSER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { day?: string; events?: EventItem[] };
    if (parsed.day !== todayUtc() || !Array.isArray(parsed.events) || parsed.events.length === 0) return null;
    return parsed.events;
  } catch {
    return null;
  }
}

function writeBrowserDayCache(events: EventItem[]): void {
  try {
    localStorage.setItem(BROWSER_CACHE_KEY, JSON.stringify({ day: todayUtc(), events }));
  } catch {
    /* lagringskvot eller privat läge – hoppa över */
  }
}

/**
 * Stämplar källan och räknar om kategorin med samma regler som vid hämtning.
 * Det gäller även poster som redan ligger i dags-cachen, så rättningarna slår
 * igenom direkt i stället för först nästa gång cachen fylls på.
 */
const withSources = (events: EventItem[]): EventItem[] =>
  events.map((event) => {
    const stamped = withFeedSource(event);
    if (!isApiEvent(stamped)) return stamped;
    const category = resolveCategory(
      categoryForEvent(stamped),
      curatedCategoryFor(stamped),
    );
    return category === stamped.category ? stamped : { ...stamped, category };
  });

export async function fetchEventsWithCache(signal?: AbortSignal): Promise<EventItem[]> {
  // Äldre cache-poster saknar stämpel; de får den när de läses in.
  const fromBrowser = readBrowserDayCache();
  if (fromBrowser) return withSources(fromBrowser);
  try {
    const response = await fetch("/api/events", { signal: signal ?? null });
    if (response.ok) {
      const payload = (await response.json()) as {
        events?: EventItem[];
        partial?: boolean;
        pagesFetched?: number;
      };
      if (Array.isArray(payload.events) && payload.events.length > 0) {
        let events = payload.events;
        if (payload.partial) {
          // Servern hann bara hämta en del av sidorna (Sites subrequest-tak).
          // Fyll på resten direkt från API:t i stället för att visa en ofullständig lista.
          const rest = await fetchVisitStockholmEventsFromPage((payload.pagesFetched ?? 0) + 1, signal);
          events = dedupeEvents([...events, ...rest]);
        }
        writeBrowserDayCache(events);
        return withSources(events);
      }
    }
  } catch {
    /* funktionen saknas eller nere – kör direkta anrop som vanligt */
  }
  const direct = await fetchVisitStockholmEvents(signal);
  if (direct.length > 0) writeBrowserDayCache(direct);
  return withSources(direct);
}

export const VISIT_STOCKHOLM_API_URL = VISIT_STOCKHOLM_URL;
export const VISIT_SWEDEN_API_URL = VISIT_SWEDEN_URL;
