/**
 * Bygger src/lib/curated-coordinates.ts av den cachade geokodningen.
 * Kör om efter att geokodningen fyllt på fler platser:
 *   bun run build:places
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { CURATED_VENUES } from "../src/lib/event-source";

export type CoordinateHit = {
  lat: number;
  lng: number;
  /** Adressen OpenStreetMap svarade med, för felsökning. */
  label: string;
};

export const CACHE_PATH = "scripts/place-coordinates.json";
const OUT_PATH = "src/lib/curated-coordinates.ts";

export const readCache = (): Record<string, CoordinateHit> => {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8")) as Record<string, CoordinateHit>;
  } catch {
    return {};
  }
};

export const writeCache = (cache: Record<string, CoordinateHit>) => {
  const sorted = Object.fromEntries(
    Object.entries(cache).sort(([a], [b]) => a.localeCompare(b, "sv")),
  );
  writeFileSync(CACHE_PATH, `${JSON.stringify(sorted, null, 1)}\n`);
};

export const writeCoordinateModule = (cache = readCache()) => {
  const rows = CURATED_VENUES.filter((venue) => cache[venue.name])
    .map((venue) => {
      const hit = cache[venue.name] as CoordinateHit;
      return `  ${JSON.stringify(venue.name)}: [${hit.lat.toFixed(5)}, ${hit.lng.toFixed(5)}],`;
    })
    .join("\n");

  const file = `/**
 * Koordinater för de kuraterade platserna, genererade från OpenStreetMap och
 * Visit Stockholms eventdata. Filen skrivs om av geokodningsjobbet – redigera
 * inte för hand.
 *
 *   bun run geocode:places   # fyller på saknade koordinater
 *   bun run build:places     # skriver om den här filen från cachen
 */
export const CURATED_COORDINATES: Record<string, [number, number]> = {
${rows}
};
`;

  writeFileSync(OUT_PATH, file);
  const covered = CURATED_VENUES.filter((venue) => cache[venue.name]).length;
  console.log(`${covered}/${CURATED_VENUES.length} platser har koordinater`);
  return covered;
};

if (import.meta.main) writeCoordinateModule();
