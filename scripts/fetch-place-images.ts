/**
 * Hämtar en förhandsbild (og:image) från varje fast plats egen sajt och skriver
 * src/lib/curated-images.ts. Platser utan träff behåller sin färgade yta.
 *
 *   bun run images:places
 *
 * Svaren cachas i scripts/place-images.json, så en omkörning bara går på de
 * platser som ännu inte fått en bild. Aggregatorsajter som visitstockholm.se
 * och stockholm.se hoppas över – de skulle ge samma bild till hundratals
 * platser, och Instagram blockerar oss ändå.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { CURATED_VENUES } from "../src/lib/event-source";

const CACHE_PATH = "scripts/place-images.json";
const OUT_PATH = "src/lib/curated-images.ts";
const USER_AGENT = "HanderApp/1.0 (Stockholm event map)";
const TIMEOUT_MS = 9000;
const CONCURRENCY = 12;

/** Sidor som är startsidor för många platser – en bild där säger ingenting. */
const SKIP_HOSTS = new Set([
  "visitstockholm.se",
  "www.visitstockholm.se",
  "stockholm.se",
  "www.stockholm.se",
  "instagram.com",
  "www.instagram.com",
  "facebook.com",
  "www.facebook.com",
  "google.com",
  "www.google.com",
  "maps.google.com",
  "sv.wikipedia.org",
  "wikipedia.org",
]);

/** Bilder som uppenbart är logotyper eller platshållare. */
const BAD_IMAGE =
  /(logo|logotyp|placeholder|favicon|sprite|pixel|spacer|og[-_]image|og[-_]default|share[-_]?image|social[-_]?share|styleguide|fallback)/i;

type Cache = Record<string, string>;

const readCache = (): Cache => {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8")) as Cache;
  } catch {
    return {};
  }
};

const absoluteUrl = (raw: string, base: string): string | null => {
  try {
    const url = new URL(raw, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
};

/** Första användbara og:image/twitter:image i sidans HTML. */
const pickImage = (html: string, base: string): string | null => {
  const patterns = [
    /<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+(?:property|name)=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const raw = match?.[1]?.trim();
    if (!raw || raw.startsWith("data:")) continue;
    const url = absoluteUrl(raw, base);
    if (url && !BAD_IMAGE.test(url)) return url;
  }
  return null;
};

const fetchPage = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("html")) return null;
    return (await response.text()).slice(0, 600_000);
  } catch {
    return null;
  }
};

const isSkipped = (url: string): boolean => {
  try {
    const host = new URL(url).host.toLowerCase();
    return SKIP_HOSTS.has(host) || SKIP_HOSTS.has(host.replace(/^www\./, ""));
  } catch {
    return true;
  }
};

const writeModule = (cache: Cache) => {
  const sorted = Object.fromEntries(
    Object.entries(cache).sort(([a], [b]) => a.localeCompare(b, "sv")),
  );
  writeFileSync(
    OUT_PATH,
    `/**
 * Förhandsbilder per fast plats, genererad av scripts/fetch-place-images.ts.
 * Platser som saknas här ritas med sin kategorifärg i stället.
 */
export const CURATED_IMAGES: Record<string, string> = ${JSON.stringify(sorted, null, 2)};
`,
  );
};

const cache = readCache();
const pending = CURATED_VENUES.filter(
  (venue) => venue.url && !cache[venue.name] && !isSkipped(venue.url),
);

console.log(
  `${CURATED_VENUES.length} platser, ${Object.keys(cache).length} har bild, ${pending.length} att försöka med.`,
);

let done = 0;
let found = 0;

/** Startsidan är ofta den enda sidan som har en og:image. */
const homepageOf = (url: string): string | null => {
  try {
    const root = new URL(url);
    root.pathname = "/";
    root.search = "";
    root.hash = "";
    return root.toString() === url ? null : root.toString();
  } catch {
    return null;
  }
};

const worker = async (): Promise<void> => {
  for (;;) {
    const venue = pending.shift();
    if (!venue?.url) return;
    const html = await fetchPage(venue.url);
    let image = html ? pickImage(html, venue.url) : null;
    if (!image) {
      const home = homepageOf(venue.url);
      if (home) {
        const homeHtml = await fetchPage(home);
        if (homeHtml) image = pickImage(homeHtml, home);
      }
    }
    if (image) {
      cache[venue.name] = image;
      found++;
    }
    done++;
    if (done % 25 === 0) {
      console.log(`  ${done}/${done + pending.length} försökta, ${found} nya bilder`);
      writeFileSync(CACHE_PATH, `${JSON.stringify(sortCache(cache), null, 2)}\n`);
    }
  }
};

function sortCache(input: Cache): Cache {
  return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b, "sv")));
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

writeFileSync(CACHE_PATH, `${JSON.stringify(sortCache(cache), null, 2)}\n`);
writeModule(cache);
console.log(`Klart: ${Object.keys(cache).length} av ${CURATED_VENUES.length} platser har bild.`);
