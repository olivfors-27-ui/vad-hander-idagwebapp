// Fasta platser från Visit Stockholms öppna API.
//
// Samma värd som eventkällan (api.visitstockholm.com/api/public-v1/...) och samma
// villkor: ingen nyckel, CC BY 4.0. `/objects/` innehåller ~2 900 platser och
// lokaler (restauranger, museer, parker, bad ...) men också en del objekt som
// inte är platser alls (t.ex. "Venture Capital"). Därför mappas `label` till
// appens platstyper och allt utan giltiga koordinater filtreras bort.
//
// API:t tar emot `?size=` och svarar med upp till 1000 objekt per anrop, så hela
// klienthämtningen kostar ETT anrop per besökare och dag (tidigare 24 anrop).

import { MAP_CENTER, PLACES, type Place, type PlaceType } from "./hander-data";

const OBJECTS_URL = "https://api.visitstockholm.com/api/public-v1/objects/";
/** Objekt per anrop. 500 räcker för ~330 platser och håller svaret litet. */
const DEFAULT_PAGE_SIZE = 500;
/** Ett enda anrop per besökare – API:t returnerar 500 objekt på en gång. */
const DEFAULT_MAX_PAGES = 1;
const MAX_DISTANCE_KM = 25;
const BROWSER_CACHE_KEY = "hander-places-cache-v2";

type ApiLocation = { latitude?: number; longitude?: number } | null;

type ApiObject = {
  id?: string;
  title?: string;
  label?: string;
  text?: string;
  href?: string;
  slug?: string;
  location?: ApiLocation;
  locations?: { location?: ApiLocation }[];
  contact?: {
    addresses?: { address?: string; location?: ApiLocation }[];
    href?: string | null;
    label?: string | null;
    telephone?: string | null;
  } | null;
};

type ApiResponse = { count?: number; next?: string | null; results?: ApiObject[] };

/**
 * `label` från API:t är fritext på svenska och engelska, så matchningen sker på
 * nyckelord. Ordningen spelar roll: "Coffee Shop / Café" ska bli café och inte
 * restaurang, och "Museum" före den bredare sevärdhetsregeln.
 */
const LABEL_TYPES: [RegExp, PlaceType][] = [
  [/caf|coffee|bageri|bakery|konditori/i, "cafe"],
  [/museum/i, "museum"],
  [/bad|bath|swim|strand|beach/i, "bad"],
  [/viewpoint|utsikt|view/i, "utsikt"],
  [/park\b|trädgård|garden|naturreservat/i, "park"],
  [/teater|theater|scen|stage|konsert|concert|opera|music/i, "scen"],
  [/gym|fitness|träning|climbing|klättring/i, "gym"],
  [/restaurang|restaurant|krog|bistro|bar\b|pub|bryggeri|brewery|food/i, "restaurang"],
  [/attraction|sevärdhet|sightseeing|activity|aktivitet|excursion|utflykt|guide|tur\b/i, "sevardhet"],
];

const stripHtml = (value: string) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

const pointDistanceKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(aLat)) * Math.cos(toRadians(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const distanceKm = (lat: number, lng: number) =>
  Math.round(pointDistanceKm(MAP_CENTER.lat, MAP_CENTER.lng, lat, lng) * 10) / 10;

/** Första giltiga koordinatparet – objektet, dess filialer eller adressen. */
function coordinatesOf(object: ApiObject): { lat: number; lng: number } | null {
  const candidates: ApiLocation[] = [
    object.location ?? null,
    ...(object.locations ?? []).map((entry) => entry.location ?? null),
    ...(object.contact?.addresses ?? []).map((entry) => entry.location ?? null),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const { latitude, longitude } = candidate;
    if (typeof latitude === "number" && typeof longitude === "number") {
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { lat: latitude, lng: longitude };
    }
  }
  return null;
}

export const placeTypeForLabel = (label: string): PlaceType | null => {
  for (const [pattern, type] of LABEL_TYPES) if (pattern.test(label)) return type;
  return null;
};

/** Ett API-objekt blir en fast plats – eller null om det inte är en plats vi visar. */
export function normalizeObject(object: ApiObject): Place | null {
  const id = (object.id || object.slug || "").trim();
  const name = (object.title ?? "").trim();
  const label = (object.label ?? "").trim();
  if (!id || !name) return null;
  const type = placeTypeForLabel(label);
  if (!type) return null;
  const geo = coordinatesOf(object);
  if (!geo) return null;
  const distance = distanceKm(geo.lat, geo.lng);
  if (distance > MAX_DISTANCE_KM) return null;
  const description = stripHtml(object.text ?? "").slice(0, 320);
  const address = (object.contact?.addresses?.[0]?.address ?? "").trim() || "Stockholm";
  const contact = object.contact?.telephone || object.contact?.label || undefined;
  return {
    id: `vs-${id}`,
    name,
    type,
    description,
    address,
    lat: geo.lat,
    lng: geo.lng,
    distance,
    // API:t har inga öppettider – bara enstaka objekt har dem i fritext.
    open: "Varierar",
    ...(contact ? { contact } : {}),
    ...(object.href ? { link: object.href } : {}),
  };
}

// ---------- Dubbletter mellan API-platser och det kuraterade utbudet ----------

/** Ord som inte säger vilken plats det är (API:t blandar svenska och engelska). */
const NAME_STOP_WORDS = new Set([
  "the",
  "of",
  "and",
  "stockholm",
  "stockholms",
  "restaurang",
  "restaurant",
  "cafe",
  "café",
  "museum",
  "museet",
  "park",
  "parken",
  "bar",
  "scen",
  "scenen",
]);

const nameKey = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const nameTokens = (name: string) =>
  nameKey(name)
    .split(" ")
    .filter((token) => token.length >= 4 && !NAME_STOP_WORDS.has(token));

const bigrams = (value: string) => {
  const compact = value.replace(/\s+/g, "");
  const out = new Set<string>();
  for (let i = 0; i < compact.length - 1; i++) out.add(compact.slice(i, i + 2));
  return out;
};

const diceSimilarity = (a: string, b: string) => {
  const first = bigrams(a);
  const second = bigrams(b);
  if (first.size === 0 || second.size === 0) return 0;
  let shared = 0;
  for (const gram of first) if (second.has(gram)) shared++;
  return (2 * shared) / (first.size + second.size);
};

/**
 * Bedömer om två poster är samma fysiska plats. Namnen skiljer sig ofta mellan
 * källorna ("Vasa Museum" mot "Vasamuseet"), så matchningen väger samman namn
 * och avstånd i stället för att kräva identisk stavning.
 */
export function looksLikeSamePlace(a: Place, b: Place): boolean {
  if (typeof a.lat !== "number" || typeof a.lng !== "number") return false;
  if (typeof b.lat !== "number" || typeof b.lng !== "number") return false;
  const meters = pointDistanceKm(a.lat, a.lng, b.lat, b.lng) * 1000;
  if (meters > 500) return false;

  const keyA = nameKey(a.name);
  const keyB = nameKey(b.name);
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;

  const compactA = keyA.replace(/\s+/g, "");
  const compactB = keyB.replace(/\s+/g, "");
  if (compactA.includes(compactB) || compactB.includes(compactA)) return meters < 400;

  const tokensA = nameTokens(a.name);
  const tokensB = nameTokens(b.name);
  if (tokensA.some((token) => tokensB.includes(token))) return meters < 200;

  // "Vasa Museum" mot "Vasamuseet": samma början och i praktiken samma punkt.
  if (meters < 150 && compactA.slice(0, 4) === compactB.slice(0, 4)) return true;

  return meters < 120 && diceSimilarity(keyA, keyB) >= 0.6;
}

/** Tar bort API-platser som redan finns i det kuraterade utbudet. */
export function withoutDuplicates(places: Place[], curated: Place[] = PLACES): Place[] {
  if (curated.length === 0) return places;
  return places.filter((place) => !curated.some((other) => looksLikeSamePlace(place, other)));
}

const fetchJson = async <T,>(url: string, signal?: AbortSignal) => {
  const response = await fetch(url, {
    ...(signal ? { signal } : {}),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`API svarade ${response.status}`);
  return response.json() as Promise<T>;
};

const fetchPage = (page: number, size: number, signal?: AbortSignal) =>
  fetchJson<ApiResponse>(`${OBJECTS_URL}?size=${size}&page=${page}`, signal);

/**
 * Hämtar platser från API:t. Standard är en enda sida om 500 objekt, alltså ett
 * anrop per besökare och dag – `size` gör att vi inte behöver bläddra igenom
 * ~185 små sidor som förut.
 */
export async function fetchVisitStockholmPlaces(
  signal?: AbortSignal,
  options?: { pageSize?: number; maxPages?: number },
): Promise<Place[]> {
  const pageSize = Math.max(1, options?.pageSize ?? DEFAULT_PAGE_SIZE);
  const maxPages = Math.max(1, options?.maxPages ?? DEFAULT_MAX_PAGES);

  const responses: ApiResponse[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const data = await fetchPage(page, pageSize, signal);
    responses.push(data);
    const received = data.results?.length ?? 0;
    if (received === 0 || received < pageSize || !data.next) break;
  }

  const seen = new Set<string>();
  const places: Place[] = [];
  for (const response of responses) {
    for (const object of response.results ?? []) {
      const place = normalizeObject(object);
      if (!place) continue;
      const key = `${place.name.toLowerCase()}|${place.address.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      places.push(place);
    }
  }
  return places.sort((a, b) => a.distance - b.distance);
}

const todayUtc = () => new Date().toISOString().slice(0, 10);

function readBrowserDayCache(): Place[] | null {
  try {
    const raw = localStorage.getItem(BROWSER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { day?: string; places?: Place[] };
    if (parsed.day !== todayUtc() || !Array.isArray(parsed.places) || parsed.places.length === 0) {
      return null;
    }
    return parsed.places;
  } catch {
    return null;
  }
}

function writeBrowserDayCache(places: Place[]): void {
  try {
    localStorage.setItem(BROWSER_CACHE_KEY, JSON.stringify({ day: todayUtc(), places }));
  } catch {
    /* lagringskvot eller privat läge – hoppa över */
  }
}

/**
 * Hämtar platser via den delade dags-cachen (/api/places, Pages Function) när
 * den finns, och faller tillbaka på ett enda direktanrop annars (lokal vite-dev
 * och den statiska hosten). Resultatet sparas i webbläsaren resten av dagen.
 */
export async function fetchPlacesWithCache(signal?: AbortSignal): Promise<Place[]> {
  const cached = readBrowserDayCache();
  if (cached) return cached;
  try {
    const response = await fetch("/api/places", { signal: signal ?? null });
    if (response.ok) {
      const payload = (await response.json()) as { places?: Place[] };
      if (Array.isArray(payload.places) && payload.places.length > 0) {
        const places = withoutDuplicates(payload.places);
        writeBrowserDayCache(places);
        return places;
      }
    }
  } catch {
    /* funktionen saknas eller nere – kör direkta anrop */
  }
  const direct = withoutDuplicates(await fetchVisitStockholmPlaces(signal));
  if (direct.length > 0) writeBrowserDayCache(direct);
  return direct;
}

export const VISIT_STOCKHOLM_OBJECTS_URL = OBJECTS_URL;
