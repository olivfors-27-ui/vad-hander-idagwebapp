/**
 * Användarens position som referens för avstånd.
 *
 * Positionen cachas i localStorage så att avstånden stämmer direkt vid nästa
 * besök. Webbläsaren tillfrågas bara när användaren själv trycker på
 * "Min position", eller när tillåtelse redan finns sedan tidigare – appen
 * frågar aldrig vid första sidladdning.
 */
import { useCallback, useEffect, useState } from "react";

export type Coords = { lat: number; lng: number };

export type LocationStatus = "ok" | "idle" | "asking" | "denied" | "unsupported";

const STORAGE_KEY = "hander-user-location";

const isValidCoords = (value: unknown): value is Coords => {
  const c = value as Coords | null;
  return (
    !!c &&
    typeof c.lat === "number" &&
    typeof c.lng === "number" &&
    Number.isFinite(c.lat) &&
    Number.isFinite(c.lng) &&
    Math.abs(c.lat) <= 90 &&
    Math.abs(c.lng) <= 180
  );
};

/** Senast kända position, eller null om ingen finns sparad. */
export function readCachedCoords(): Coords | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Coords;
    return isValidCoords(parsed) ? { lat: parsed.lat, lng: parsed.lng } : null;
  } catch {
    return null;
  }
}

export function clearCachedCoords() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignorera */
  }
}

function storeCoords(coords: Coords) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...coords, at: Date.now() } satisfies Coords & { at: number }),
    );
  } catch {
    /* ignorera */
  }
}

/** Frågar webbläsaren om positionen. Avvisas den kastas felet vidare. */
export function getCurrentCoords(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation saknas"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: Coords = {
          lat: Number(position.coords.latitude.toFixed(5)),
          lng: Number(position.coords.longitude.toFixed(5)),
        };
        storeCoords(coords);
        resolve(coords);
      },
      (error) => reject(error),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

export function useUserLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");

  // Cachad position direkt, så avstånden är rätt innan webbläsaren svarat.
  useEffect(() => {
    const cached = readCachedCoords();
    if (!cached) return;
    setCoords(cached);
    setStatus("ok");
  }, []);

  // Redan given tillåtelse: uppdatera positionen tyst i bakgrunden.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus((current) => (current === "ok" ? current : "unsupported"));
      return;
    }
    const permissions = navigator.permissions;
    if (!permissions?.query) return;

    let cancelled = false;
    permissions
      .query({ name: "geolocation" })
      .then((permission) => {
        if (cancelled || permission.state !== "granted") return;
        return getCurrentCoords().then((next) => {
          if (cancelled) return;
          setCoords(next);
          setStatus("ok");
        });
      })
      .catch(() => {
        /* ignorera – cachen duger */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ask = useCallback(async () => {
    setStatus("asking");
    try {
      const next = await getCurrentCoords();
      setCoords(next);
      setStatus("ok");
      return next;
    } catch (error) {
      const denied = (error as GeolocationPositionError).code === 1;
      setStatus(denied ? "denied" : "idle");
      return null;
    }
  }, []);

  return { coords, status, ask };
}
