/**
 * Geokodning via OpenStreetMap Nominatim: adress → latitud/longitud.
 * Inga API-nycklar krävs. Alla pins i Händer bygger på riktiga koordinater.
 */

export type GeoHit = {
  /** Fullständig adressträng, t.ex. "Slakthusgatan 6, Stockholm" */
  label: string;
  /** Kort namn med ort, t.ex. "Slakthusgatan 6, Stockholm" */
  short: string;
  lat: number;
  lng: number;
};

/** Referenspunkt för avståndsberäkning tills användaren delar sin position. */
export const HOME_LOCATION = { lat: 59.3293, lng: 18.0686 };

/** Sverige ungefär (fastlandet + Gotland/Öland). */
export const SWEDEN_BOUNDS = {
  minLat: 55.0,
  maxLat: 69.1,
  minLng: 10.3,
  maxLng: 24.4,
} as const;

/** Ligger koordinaten inom Sverige? Används både vid val och vid sparning. */
export function isInSweden(point: { lat: number; lng: number }): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= SWEDEN_BOUNDS.minLat &&
    point.lat <= SWEDEN_BOUNDS.maxLat &&
    point.lng >= SWEDEN_BOUNDS.minLng &&
    point.lng <= SWEDEN_BOUNDS.maxLng
  );
}

export async function geocode(query: string, signal?: AbortSignal): Promise<GeoHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const res = await fetch(
    // addressdetails ger struktur (gata, nummer, ort) så att den visade adressen
    // får rätt kommun i stället för bara närmaste stadsdel – två gator med samma
    // namn i olika kommuner gick annars inte att skilja åt.
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&accept-language=sv&countrycodes=se&q=${encodeURIComponent(q)}`,
    { headers: { Accept: "application/json" }, ...(signal ? { signal } : {}) },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    display_name: string;
    lat: string;
    lon: string;
    address?: Record<string, string>;
  }[];
  // countrycodes=se räcker inte som skydd: leverantören kan fortfarande råka
  // returnera en punkt utanför landet. Vi kontrollerar koordinaterna också, så
  // att ett event aldrig kan sparas utanför Sverige.
  return data
    .map((d) => ({
      label: d.display_name,
      short: shortAddress(d),
      lat: Number(d.lat),
      lng: Number(d.lon),
    }))
    .filter((hit) => isInSweden(hit));
}

/** "Gata 1, Ort" från Nominatims strukturerade adress, med rimliga fallbacks. */
function shortAddress(hit: {
  display_name: string;
  address?: Record<string, string>;
}): string {
  const a = hit.address ?? {};
  const street = [
    a["road"] ?? a["pedestrian"] ?? a["footway"] ?? a["square"] ?? a["path"],
    a["house_number"],
  ]
    .filter(Boolean)
    .join(" ");
  const city = a["city"] ?? a["town"] ?? a["village"] ?? a["municipality"] ?? a["county"];
  if (street && city) return `${street}, ${city}`;
  if (street) return street;
  if (city) return city;
  return hit.display_name.split(",").slice(0, 2).join(",").trim();
}

/** Avstånd i km mellan två koordinater (haversine). */
export function distanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Number((2 * R * Math.asin(Math.sqrt(a))).toFixed(1));
}

/** Avstånd från användarens referenspunkt. */
export const distanceFromHome = (to: { lat: number; lng: number }) => distanceKm(HOME_LOCATION, to);
