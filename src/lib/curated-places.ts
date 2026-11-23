import { CURATED_COORDINATES } from "./curated-coordinates";
import { CURATED_VENUES } from "./event-source";
import type { Place, PlaceType } from "./hander-data";

/**
 * Fast plats = ställe man kan gå till när som helst. Listan i event-source.ts
 * är källan; här blir varje geokodad post en riktig plats med nål på kartan.
 */
const TYPE_BY_CATEGORY: Record<string, PlaceType> = {
  musik: "scen",
  fest: "scen",
  kultur: "scen",
  mat: "restaurang",
  sport: "sport",
  student: "forening",
  utomhus: "utsikt",
  shopping: "gomd",
  ovrigt: "gomd",
};

const slug = (name: string): string =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const CURATED_PLACES: Place[] = CURATED_VENUES.map((venue) => {
  const coords = CURATED_COORDINATES[venue.name];
  const type = TYPE_BY_CATEGORY[venue.category ?? "ovrigt"] ?? "gomd";
  return {
    id: `fast-${slug(venue.name)}`,
    name: venue.name,
    type,
    description: "",
    address: "Stockholm",
    // Saknas koordinater får platsen ingen nål, men den finns kvar i listvyn.
    ...(coords ? { lat: coords[0], lng: coords[1] } : {}),
    distance: 0,
    // Fasta platser är öppna att gå till – ingen bokad tid.
    open: "Alla tider",
    ...(venue.url ? { link: venue.url, contact: venue.url } : {}),
    status: "approved" as const,
  };
});
