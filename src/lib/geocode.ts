/**
 * Geokodning via OpenStreetMap Nominatim: adress → latitud/longitud.
 * Inga API-nycklar krävs. Alla pins i Händer bygger på riktiga koordinater.
 */

export type GeoHit = {
  /** Fullständig adressträng, t.ex. "Slakthusgatan 6, Stockholm" */
  label: string;
  /** Kort namn, t.ex. "Slakthusgatan 6" */
  short: string;
  lat: number;
  lng: number;
};

/** Referenspunkt för avståndsberäkning tills användaren delar sin position. */
export const HOME_LOCATION = { lat: 59.3293, lng: 18.0686 };

export async function geocode(query: string, signal?: AbortSignal): Promise<GeoHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=sv&countrycodes=se&q=${encodeURIComponent(q)}`,
    { headers: { Accept: "application/json" }, ...(signal ? { signal } : {}) },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return data.map((d) => ({
    label: d.display_name,
    short: d.display_name.split(",").slice(0, 2).join(",").trim(),
    lat: Number(d.lat),
    lng: Number(d.lon),
  }));
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
