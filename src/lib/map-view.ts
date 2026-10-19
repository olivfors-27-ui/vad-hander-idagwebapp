// Sparar kartans senaste vy (centrum + zoom) så att kartan hamnar på exakt
// samma plats när man går in på ett event och tillbaka igen.
//
// Kartan unmountas när man navigerar bort från /karta, så vyn kan inte ligga i
// komponentens state. Vi håller den i en modulnivå-cache (överlever navigering)
// och speglar den till localStorage, så positionen finns kvar även efter en
// omladdning eller när appen startas om.

export type MapView = {
  lat: number;
  lng: number;
  zoom: number;
};

export const DEFAULT_MAP_VIEW: MapView = { lat: 59.3293, lng: 18.0686, zoom: 13 };

const STORAGE_KEY = "hander:map-view:v1";

let cached: MapView | null = null;

function isMapView(value: unknown): value is MapView {
  if (typeof value !== "object" || value === null) return false;
  const { lat, lng, zoom } = value as Record<string, unknown>;
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    Math.abs(lat) <= 90 &&
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    Math.abs(lng) <= 180 &&
    typeof zoom === "number" &&
    Number.isFinite(zoom)
  );
}

/** Läser senast sparade vy. Returnerar null om ingen giltig vy finns. */
export function readMapView(): MapView | null {
  if (cached) return cached;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isMapView(parsed)) return null;
    cached = { lat: parsed.lat, lng: parsed.lng, zoom: parsed.zoom };
    return cached;
  } catch {
    return null;
  }
}

/** Sparar aktuell vy. Tyst om storage är otillgänglig (privat läge, SSR). */
export function saveMapView(view: MapView) {
  cached = { lat: view.lat, lng: view.lng, zoom: view.zoom };
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // Minnet räcker för navigering även om storage skulle vara blockerat (privat läge).
  }
}
