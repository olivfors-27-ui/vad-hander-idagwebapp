/**
 * Rensar cachen från svaga namnmatchningar (felplacerade nålar) och skriver om
 * koordinatmodulen. Körs före en ny geokodningsomgång:
 *
 *   bun run verify:places
 */
import { existsSync, readFileSync } from "node:fs";
import { readCache, writeCache, writeCoordinateModule } from "./build-place-coordinates";

// Adresser vi själva slagit upp för platser som saknas i OSM under sitt namn.
const overridesPath = "scripts/place-overrides.json";
const overrides: Record<string, string> = existsSync(overridesPath)
  ? (JSON.parse(readFileSync(overridesPath, "utf8")) as Record<string, string>)
  : {};

const compact = (value: string) =>
  value
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9åäöéü]+/gi, "")
    .trim();

const editDistance = (a: string, b: string): number => {
  if (Math.abs(a.length - b.length) > 4) return 99;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
};

/** Namnvarianter, samma uppdelning som geokodningen gör ("A & B", "A i B"). */
const nameVariants = (name: string): string[] => [
  name,
  ...name.split(/\s+(?:&|och|i|på|vid|under|med)\s+/i).map((part) => part.trim()),
];

const acceptable = (name: string, label: string) =>
  nameVariants(name).some((variant) => acceptableName(variant, label));

const acceptableName = (name: string, label: string) => {
  // Adressuppslag är verifierade för hand och ska alltid behållas.
  if (overrides[name]) return true;
  const wanted = compact(name);
  // Adressuppslag har gatuadress som label och kan inte jämföras på namn.
  if (label.includes(",") && /\d/.test(label)) return true;
  // Koordinater som kom från eventdatan eller den tidigare geokodningen.
  if (label === "tidigare geokodad") return true;
  const candidate = compact(label.split("–")[0] ?? label);
  if (!candidate || !wanted) return true;
  if (candidate === wanted) return true;
  const lengthDiff = Math.abs(candidate.length - wanted.length);
  if (lengthDiff <= 6 && (candidate.startsWith(wanted) || wanted.startsWith(candidate))) return true;
  if (
    Math.min(candidate.length, wanted.length) >= 6 &&
    Math.max(candidate.length, wanted.length) / Math.min(candidate.length, wanted.length) <= 1.8 &&
    (candidate.includes(wanted) || wanted.includes(candidate))
  )
    return true;
  if (wanted.length >= 8 && editDistance(candidate, wanted) <= 2) return true;
  return false;
};

const cache = readCache();
const kept: typeof cache = {};
const dropped: string[] = [];
for (const [name, hit] of Object.entries(cache)) {
  if (acceptable(name, hit.label)) kept[name] = hit;
  else dropped.push(`${name} (${hit.label})`);
}

writeCache(kept);
writeCoordinateModule(kept);
console.log(`behåller ${Object.keys(kept).length}, släpper ${dropped.length}`);
if (dropped.length) console.log(dropped.join("\n"));
