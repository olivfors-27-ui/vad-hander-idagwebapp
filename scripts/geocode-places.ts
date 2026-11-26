/**
 * Geokodar de kuraterade platserna och skriver cachen som
 * src/lib/curated-coordinates.ts byggs av. Redan hittade platser hoppas över,
 * och scripts/place-attempts.json kommer ihåg vilka källor som prövats för varje
 * namn – därför går en omkörning bara på det som ännu inte fått ett svar.
 *
 *   bun run geocode:places
 *
 * Först en batchad Overpass-fråga (många namn per anrop), sedan det lokala
 * OSM-indexet, de handskrivna adresserna i place-overrides.json och till sist
 * Photon och Nominatim. Alla svar måste ligga i Stor-Stockholm.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  type CoordinateHit,
  readCache,
  writeCache,
  writeCoordinateModule,
} from "./build-place-coordinates";
import { CURATED_VENUES } from "../src/lib/event-source";

const OVERPASS = "https://overpass.openstreetmap.fr/api/interpreter";
const PHOTON = "https://photon.komoot.io/api/";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "HanderApp/1.0 (Stockholm event map)";
// Stor-Stockholm: rimliga svar måste ligga här.
const BOUNDS = { minLat: 58.6, maxLat: 60.2, minLng: 17.2, maxLng: 19.1 };
const STOCKHOLM = { lat: 59.3293, lng: 18.0686 };
const OVERRIDES_PATH = "scripts/place-overrides.json";
const BATCH_SIZE = 40;
// Snävare ruta för den lösare sökningen: den är dyrare och platserna ligger
// ändå i Stockholmsområdet.
const INNER_BOUNDS = { minLat: 58.8, minLng: 17.5, maxLat: 59.8, maxLng: 18.8 };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const inBounds = (lat: number, lng: number) =>
  lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lng >= BOUNDS.minLng && lng <= BOUNDS.maxLng;

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/["“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const metersFromStockholm = (lat: number, lng: number) =>
  (lat - STOCKHOLM.lat) ** 2 + (lng - STOCKHOLM.lng) ** 2;

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T | undefined> => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        headers: { "user-agent": USER_AGENT, ...(init?.headers ?? {}) },
        signal: AbortSignal.timeout(90_000),
      });
      if (response.status === 429) {
        await sleep(15_000);
        continue;
      }
      if (!response.ok) return undefined;
      return (await response.json()) as T;
    } catch {
      await sleep(5_000);
    }
  }
  return undefined;
};

type OverpassElement = {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Hämtar koordinater för en batch namn i en enda Overpass-fråga. */
const geocodeBatch = async (
  names: string[],
): Promise<Record<string, CoordinateHit> | undefined> => {
  const pattern = names.map(escapeRegex).join("|");
  const query = `[out:json][timeout:90];nwr["name"~"^(${pattern})$",i](${BOUNDS.minLat},${BOUNDS.minLng},${BOUNDS.maxLat},${BOUNDS.maxLng});out center tags;`;
  const data = await fetchJson<{ elements?: OverpassElement[] }>(OVERPASS, {
    method: "POST",
    body: new URLSearchParams({ data: query }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
  // Inget svar alls betyder att anropet misslyckades – då får namnen inte
  // markeras som prövade.
  if (!data) return undefined;
  const wanted = new Map(names.map((name) => [normalize(name), name]));
  const best: Record<string, { hit: CoordinateHit; distance: number }> = {};

  for (const element of data.elements ?? []) {
    const name = element.tags?.name;
    if (!name) continue;
    const wantedName = wanted.get(normalize(name));
    if (!wantedName) continue;
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    if (typeof lat !== "number" || typeof lng !== "number" || !inBounds(lat, lng)) continue;
    // Helst riktiga verksamheter, inte gator eller administrativa ytor.
    const coarse = ["highway", "boundary", "place"].includes(element.tags?.highway ?? "");
    const distance = metersFromStockholm(lat, lng) + (coarse ? 1000 : 0);
    const current = best[wantedName];
    if (current && current.distance <= distance) continue;
    best[wantedName] = {
      distance,
      hit: { lat, lng, label: name },
    };
  }

  return Object.fromEntries(Object.entries(best).map(([name, value]) => [name, value.hit]));
};

/** Ord som inte säger vilket ställe det är – duger inte som enda träff. */
const GENERIC = new Set([
  "restaurang", "restaurangen", "museet", "museum", "teater", "teatern", "klubb", "klubben",
  "scen", "scenen", "cafe", "kafe", "bar", "baren", "pub", "arena", "arenan", "hotell", "hotel",
  "park", "parken", "stadion", "centret", "center", "stockholm", "sverige", "svenska",
]);

const tokens = (value: string) =>
  normalize(value)
    .split(/[^a-z0-9åäöéü]+/i)
    .filter((token) => token.length >= 4 && !GENERIC.has(token));

/**
 * Andra Overpass-omgången: söker på utmärkande ord i stället för exakt namn,
 * så att t.ex. "Fotografiska" hittar "Fotografiska museet".
 */
const geocodeRelaxed = async (
  names: string[],
): Promise<Record<string, CoordinateHit> | undefined> => {
  const keys = new Map<string, string[]>();
  for (const name of names) {
    const own = tokens(name);
    keys.set(name, own.length > 0 ? own.slice(0, 2) : []);
  }
  const search = [...new Set([...keys.values()].flat())];
  if (search.length === 0) return {};

  const query = `[out:json][timeout:60];nwr["name"~"(${search.map(escapeRegex).join("|")})",i](${INNER_BOUNDS.minLat},${INNER_BOUNDS.minLng},${INNER_BOUNDS.maxLat},${INNER_BOUNDS.maxLng});out center tags;`;
  const data = await fetchJson<{ elements?: OverpassElement[] }>(OVERPASS, {
    method: "POST",
    body: new URLSearchParams({ data: query }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });

  if (!data) return undefined;
  const results: Record<string, CoordinateHit> = {};
  for (const element of data.elements ?? []) {
    const osmName = element.tags?.name;
    if (!osmName) continue;
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    if (typeof lat !== "number" || typeof lng !== "number" || !inBounds(lat, lng)) continue;
    if (element.tags?.highway || element.tags?.boundary) continue;
    const osmTokens = tokens(osmName);
    if (osmTokens.length === 0) continue;

    for (const [name, own] of keys) {
      if (results[name] || own.length === 0) continue;
      const shared = own.filter((token) => osmTokens.includes(token));
      if (shared.length === 0) continue;
      results[name] = { lat, lng, label: `${osmName} (${element.tags?.amenity ?? element.tags?.tourism ?? "OSM"})` };
      break;
    }
  }
  return results;
};

/** Kompakt namn: gemener utan skiljetecken, så "China Teatern" == "Chinateatern". */
const compact = (value: string) => normalize(value).replace(/[^a-z0-9åäöéü]+/gi, "");

/** Antal tecken som behöver ändras för att a ska bli b. */
const editDistance = (a: string, b: string): number => {
  if (Math.abs(a.length - b.length) > 3) return 99;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 99;
};

type OsmPlace = { name: string; lat: number; lng: number };
const INDEX_PATH = "scripts/.osm-index.json";

/** Hämtar alla namngivna platser i Stockholmsområdet en gång och cachar dem. */
const loadOsmIndex = async (): Promise<OsmPlace[]> => {
  if (existsSync(INDEX_PATH)) {
    try {
      const cached = JSON.parse(readFileSync(INDEX_PATH, "utf8")) as OsmPlace[];
      if (cached.length > 1000) return cached;
    } catch {
      // trasig cache – hämta igen
    }
  }

  const places = new Map<string, OsmPlace>();
  const STEPS = 3;
  const latStep = (INNER_BOUNDS.maxLat - INNER_BOUNDS.minLat) / STEPS;
  const lngStep = (INNER_BOUNDS.maxLng - INNER_BOUNDS.minLng) / STEPS;

  for (let row = 0; row < STEPS; row += 1) {
    for (let column = 0; column < STEPS; column += 1) {
      const south = INNER_BOUNDS.minLat + row * latStep;
      const north = south + latStep;
      const west = INNER_BOUNDS.minLng + column * lngStep;
      const east = west + lngStep;
      const bbox = `${south},${west},${north},${east}`;
      const query = `[out:json][timeout:120];(
        nwr["name"]["amenity"](${bbox});
        nwr["name"]["tourism"](${bbox});
        nwr["name"]["leisure"](${bbox});
        nwr["name"]["shop"](${bbox});
        nwr["name"]["historic"](${bbox});
      );out center tags;`;
      const data = await fetchJson<{ elements?: OverpassElement[] }>(OVERPASS, {
        method: "POST",
        body: new URLSearchParams({ data: query }),
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      for (const element of data?.elements ?? []) {
        const name = element.tags?.name;
        const lat = element.lat ?? element.center?.lat;
        const lng = element.lon ?? element.center?.lon;
        if (!name || typeof lat !== "number" || typeof lng !== "number") continue;
        places.set(`${name}@${lat.toFixed(5)},${lng.toFixed(5)}`, { name, lat, lng });
      }
      console.log(`osm-index: ruta ${row * STEPS + column + 1}/${STEPS * STEPS}, ${places.size} platser`);
      await sleep(1000);
    }
  }

  const index = [...places.values()];
  writeFileSync(INDEX_PATH, JSON.stringify(index));
  return index;
};

/** Matchar namn mot OSM-indexet: samma namn, samma namn utan skiljetecken eller ett stavfel. */
const matchWithIndex = (names: string[], index: OsmPlace[]): Record<string, CoordinateHit> => {
  const results: Record<string, CoordinateHit> = {};
  for (const name of names) {
    const wanted = compact(name);
    if (wanted.length < 4) continue;
    let best: { hit: CoordinateHit; score: number } | undefined;
    for (const place of index) {
      const candidate = compact(place.name);
      if (candidate.length < 4) continue;
      // Strikt: samma namn, samma namn med kort ändelse ("Fotografiska museet")
      // eller ett stavfel. Lösare träffar ger för många felplacerade nålar.
      const lengthDiff = Math.abs(candidate.length - wanted.length);
      let score = 99;
      if (candidate === wanted) score = 0;
      else if (lengthDiff <= 6 && (candidate.startsWith(wanted) || wanted.startsWith(candidate))) score = 1;
      else if (
        Math.min(candidate.length, wanted.length) >= 6 &&
        Math.max(candidate.length, wanted.length) / Math.min(candidate.length, wanted.length) <= 1.8 &&
        (candidate.includes(wanted) || wanted.includes(candidate))
      )
        score = 2;
      else if (wanted.length >= 8 && editDistance(candidate, wanted) <= 2) score = 3;
      if (score === 99) continue;
      const distance = metersFromStockholm(place.lat, place.lng);
      if (!best || score < best.score || (score === best.score && distance < metersFromStockholm(best.hit.lat, best.hit.lng))) {
        best = { hit: { lat: place.lat, lng: place.lng, label: place.name }, score };
      }
    }
    if (best) results[name] = best.hit;
  }
  return results;
};

/**
 * undefined = tjänsten svarade inte (prova igen nästa körning), null = den
 * svarade men hade ingen träff (namnet är prövat).
 */
const geocodePhoton = async (name: string): Promise<CoordinateHit | null | undefined> => {
  const url = `${PHOTON}?${new URLSearchParams({
    q: `${name}, Stockholm`,
    limit: "5",
    lat: String(STOCKHOLM.lat),
    lon: String(STOCKHOLM.lng),
  })}`;
  const data = await fetchJson<{
    features?: {
      geometry: { coordinates: [number, number] };
      properties: { name?: string; countrycode?: string; osm_key?: string; type?: string; city?: string };
    }[];
  }>(url);
  if (!data) return undefined;
  await sleep(500);
  const tooCoarse = new Set(["street", "locality", "district", "city", "county", "state", "country"]);
  for (const feature of data.features ?? []) {
    const [lng, lat] = feature.geometry.coordinates;
    if (!inBounds(lat, lng)) continue;
    if (feature.properties.countrycode && feature.properties.countrycode !== "SE") continue;
    if (feature.properties.osm_key === "highway") continue;
    if (feature.properties.type && tooCoarse.has(feature.properties.type)) continue;
    return { lat, lng, label: `${feature.properties.name ?? name} – ${feature.properties.city ?? "Stockholm"}` };
  }
  return null;
};

const geocodeNominatim = async (name: string): Promise<CoordinateHit | null | undefined> => {
  const url = `${NOMINATIM}?${new URLSearchParams({
    q: `${name}, Stockholm`,
    format: "jsonv2",
    limit: "1",
    countrycodes: "se",
    viewbox: `${BOUNDS.minLng},${BOUNDS.maxLat},${BOUNDS.maxLng},${BOUNDS.minLat}`,
    bounded: "0",
  })}`;
  const hits = await fetchJson<{ lat: string; lon: string; display_name: string }[]>(url);
  if (!hits) return undefined;
  await sleep(1100);
  const hit = hits[0];
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inBounds(lat, lng)) return null;
  return { lat, lng, label: hit.display_name };
};

/** Slår upp en gatuadress (används för de platser OSM inte har namngett). */
const geocodeNominatimAddress = async (
  address: string,
): Promise<CoordinateHit | null | undefined> => {
  const url = `${NOMINATIM}?${new URLSearchParams({
    q: address,
    format: "jsonv2",
    limit: "1",
    countrycodes: "se",
  })}`;
  const hits = await fetchJson<{ lat: string; lon: string; display_name: string }[]>(url);
  if (!hits) return undefined;
  await sleep(1200);
  const hit = hits[0];
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inBounds(lat, lng)) return null;
  return { lat, lng, label: hit.display_name };
};

const cache = readCache();

// Vilka källor som redan prövats för varje namn. Utan den här cachen frågade
// varje omkörning alla namn igen, trots att svaret redan var "finns inte här".
const ATTEMPTS_PATH = "scripts/place-attempts.json";
type Source = "overpass" | "overpass-löst" | "osm-index" | "adress" | "photon" | "nominatim";
type Attempts = Record<string, Source[]>;

const readAttempts = (): Attempts => {
  if (!existsSync(ATTEMPTS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(ATTEMPTS_PATH, "utf8")) as Attempts;
  } catch {
    return {};
  }
};

const attempts = readAttempts();

const markAttempted = (names: string[], source: Source) => {
  for (const name of names) {
    const tried = attempts[name] ?? [];
    if (!tried.includes(source)) tried.push(source);
    attempts[name] = tried;
  }
  const sorted = Object.fromEntries(
    Object.entries(attempts).sort(([a], [b]) => a.localeCompare(b, "sv")),
  );
  writeFileSync(ATTEMPTS_PATH, `${JSON.stringify(sorted, null, 1)}\n`);
};

/** Namn som saknar koordinat och där källan inte redan prövats. */
const remaining = (source: Source) =>
  CURATED_VENUES.filter(
    (venue) => !cache[venue.name] && !attempts[venue.name]?.includes(source),
  ).map((venue) => venue.name);

// Första körningen: återanvänd koordinaterna som redan finns i modulen.
if (Object.keys(cache).length === 0) {
  const { CURATED_COORDINATES } = await import("../src/lib/curated-coordinates");
  for (const [name, [lat, lng]] of Object.entries(CURATED_COORDINATES)) {
    cache[name] = { lat, lng, label: "tidigare geokodad" };
  }
  if (Object.keys(cache).length > 0) writeCache(cache);
}

let pending = remaining("overpass");
console.log(`${Object.keys(cache).length} klara, ${pending.length} kvar att geokoda`);

// 1) Overpass i batchar.
for (let index = 0; index < pending.length; index += BATCH_SIZE) {
  const batch = pending.slice(index, index + BATCH_SIZE);
  const hits = await geocodeBatch(batch);
  if (!hits) {
    console.log(`overpass: inget svar för ${batch.length} namn, provar igen nästa körning`);
    continue;
  }
  for (const [name, hit] of Object.entries(hits)) cache[name] = hit;
  markAttempted(batch, "overpass");
  writeCache(cache);
  writeCoordinateModule(cache);
  console.log(`overpass: ${index + batch.length}/${pending.length} försökta, ${Object.keys(cache).length} totalt`);
  await sleep(1000);
}

// 2) Overpass igen, nu på utmärkande ord.
pending = remaining("overpass-löst");
console.log(`${pending.length} kvar efter exakt overpass-sökning`);
for (let index = 0; index < pending.length; index += 10) {
  const batch = pending.slice(index, index + 10);
  const hits = await geocodeRelaxed(batch);
  if (!hits) {
    console.log(`overpass (löst): inget svar för ${batch.length} namn, provar igen nästa körning`);
    continue;
  }
  for (const [name, hit] of Object.entries(hits)) cache[name] = hit;
  markAttempted(batch, "overpass-löst");
  writeCache(cache);
  console.log(`overpass (löst): ${Math.min(index + batch.length, pending.length)}/${pending.length}, ${Object.keys(cache).length} totalt`);
  await sleep(1200);
}
writeCoordinateModule(cache);

// 3) Lokalt OSM-index med fuzzy namnmatchning för resten.
pending = remaining("osm-index");
if (pending.length > 0) {
  const index = await loadOsmIndex();
  const hits = matchWithIndex(pending, index);
  for (const [name, hit] of Object.entries(hits)) cache[name] = hit;
  // Ett halvfärdigt index får inte låsa namnen som prövade.
  if (index.length > 1000) markAttempted(pending, "osm-index");
  writeCache(cache);
  writeCoordinateModule(cache);
  console.log(`osm-index: ${Object.keys(hits).length} av ${pending.length} matchade`);
}

// 4) Adresser för platser som inte finns i OSM under sitt namn.
const overrideHits = async (): Promise<number> => {
  if (!existsSync(OVERRIDES_PATH)) return 0;
  const overrides = JSON.parse(readFileSync(OVERRIDES_PATH, "utf8")) as Record<string, string>;
  let added = 0;
  for (const name of remaining("adress")) {
    const address = overrides[name];
    if (!address) continue;
    const hit = await geocodeNominatimAddress(address);
    if (hit === undefined) {
      console.log(`adressuppslaget svarade inte: ${name} (${address})`);
      continue;
    }
    markAttempted([name], "adress");
    if (!hit) {
      console.log(`adressen gick inte att hitta: ${name} (${address})`);
      continue;
    }
    cache[name] = hit;
    added += 1;
    writeCache(cache);
  }
  writeCoordinateModule(cache);
  console.log(`adresser: ${added} nya`);
  return added;
};
await overrideHits();

// 5) Photon och Nominatim för resten.
const photonPending = remaining("photon");
const nominatimPending = remaining("nominatim");
console.log(`${photonPending.length} kvar för photon, ${nominatimPending.length} för nominatim`);

// Kolla först vilka tjänster som svarar – annars står vi och knackar på en
// dörr som är stängd för varje namn.
const probe = async (url: string) => {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
};
const photonAlive = photonPending.length > 0 && (await probe(`${PHOTON}?q=Stockholm&limit=1`));
const nominatimAlive =
  nominatimPending.length > 0 &&
  (await probe(`${NOMINATIM}?${new URLSearchParams({ q: "Stockholm", format: "jsonv2", limit: "1" })}`));
if (photonPending.length > 0 || nominatimPending.length > 0) {
  console.log(
    `photon: ${photonAlive ? "svarar" : "nere"}, nominatim: ${nominatimAlive ? "svarar" : "nere"}`,
  );
}

// En tjänst som slutat svara ska inte prövas om och om igen för varje namn –
// tre missar i rad betyder att den är nere, och då sparas resten till nästa
// körning i stället för att varje namn ska vänta ut tre tidsgränser.
let photonActive = photonAlive;
let nominatimActive = nominatimAlive;
let photonMisses = 0;
let nominatimMisses = 0;

for (const name of new Set([...photonPending, ...nominatimPending])) {
  if (!cache[name] && photonActive) {
    const hit = await geocodePhoton(name);
    // undefined = tjänsten svarade inte, så namnet lämnas åt nästa körning.
    if (hit === undefined) {
      console.log(`photon svarade inte: ${name}`);
      photonMisses += 1;
      if (photonMisses >= 3) {
        photonActive = false;
        console.log("photon svarar inte längre – resten sparas till nästa körning");
      }
    } else {
      photonMisses = 0;
      if (hit) cache[name] = hit;
      else markAttempted([name], "photon");
    }
  }
  if (!cache[name] && nominatimActive) {
    const hit = await geocodeNominatim(name);
    if (hit === undefined) {
      console.log(`nominatim svarade inte: ${name}`);
      nominatimMisses += 1;
      if (nominatimMisses >= 3) {
        nominatimActive = false;
        console.log("nominatim svarar inte längre – resten sparas till nästa körning");
      }
    } else {
      nominatimMisses = 0;
      if (hit) cache[name] = hit;
      else markAttempted([name], "nominatim");
    }
  }
  if (cache[name]) writeCache(cache);
  else console.log(`hoppar över: ${name}`);
}

const covered = writeCoordinateModule(cache);
console.log(`klart: ${covered}/${CURATED_VENUES.length} platser har koordinater`);
const missing = CURATED_VENUES.filter((venue) => !cache[venue.name]).map((venue) => venue.name);
if (missing.length) console.log(`saknas (${missing.length}): ${missing.join(", ")}`);
