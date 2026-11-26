/**
 * Kontrollerar att varje bild i scripts/place-images.json svarar med en riktig
 * bild (image/*) och skriver om cachen utan de som är blockerade eller trasiga,
 * så att ingen plats visar en tom yta. Kör om efter varje bildhämtning:
 *
 *   bun run verify:images
 *
 * Först HEAD, sedan en liten GET (Range) – en del servrar nekar HEAD men
 * levererar bilden ändå.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const CACHE_PATH = "scripts/place-images.json";
const OUT_PATH = "src/lib/curated-images.ts";
const USER_AGENT = "HanderApp/1.0 (Stockholm event map)";
const TIMEOUT_MS = 12000;
const CONCURRENCY = 10;

type Cache = Record<string, string>;

const readCache = (): Cache => {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8")) as Cache;
  } catch {
    return {};
  }
};

const sortCache = (input: Cache): Cache =>
  Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b, "sv")));

const writeModule = (cache: Cache) => {
  writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);
  writeFileSync(
    OUT_PATH,
    `/**
 * Förhandsbilder per fast plats, genererad av scripts/fetch-place-images.ts.
 * Platser som saknas här ritas med sin kategorifärg i stället.
 */
export const CURATED_IMAGES: Record<string, string> = ${JSON.stringify(cache, null, 2)};
`,
  );
};

/** Sant när URL:en svarar 200 med en bild. */
const servesImage = async (url: string): Promise<boolean> => {
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          "user-agent": USER_AGENT,
          accept: "image/*,*/*;q=0.8",
          ...(method === "GET" ? { range: "bytes=0-2047" } : {}),
        },
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const type = (response.headers.get("content-type") ?? "").toLowerCase();
      if (response.ok && type.startsWith("image/")) return true;
      // Svarade den med HTML eller ett fel går vi vidare till GET.
    } catch {
      // Nätverksfel eller timeout – prova GET innan vi dömer ut länken.
    }
  }
  return false;
};

const cache = readCache();
const entries = Object.entries(cache);
const queue = [...entries];
const broken: string[] = [];

const worker = async (): Promise<void> => {
  for (;;) {
    const entry = queue.shift();
    if (!entry) return;
    const [name, url] = entry;
    if (!(await servesImage(url))) broken.push(name);
  }
};

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const brokenSet = new Set(broken);
const clean = sortCache(
  Object.fromEntries(entries.filter(([name]) => !brokenSet.has(name))),
);

writeModule(clean);

console.log(`Kontrollerade ${entries.length} bildlänkar.`);
console.log(`Föll bort: ${broken.length} (kvar: ${Object.keys(clean).length})`);
for (const name of broken.sort((a, b) => a.localeCompare(b, "sv"))) {
  console.log(`  - ${name} → ${cache[name]?.slice(0, 80)}`);
}
