import { Crosshair, MapPin, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AddressSearch } from "@/components/hander/AddressSearch";
import type { GeoHit } from "@/lib/geocode";
import { cn } from "@/lib/utils";

const MIN_ZOOM = 10;
const MAX_ZOOM = 19;
const TILE = 256;
const TILE_FILTER = "grayscale(0.6) saturate(0.45) brightness(1.12) contrast(0.85) sepia(0.16)";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const worldX = (lng: number) => (lng + 180) / 360;
const worldY = (lat: number) => {
  const s = Math.sin((clamp(lat, -85, 85) * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};
const lngOf = (wx: number) => wx * 360 - 180;
const latOf = (wy: number) => {
  const n = Math.PI - 2 * Math.PI * wy;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

export type LatLng = { lat: number; lng: number };

/**
 * Moderatorns kartverktyg: sök adress, panorera, zooma och dra nålen
 * till exakt rätt plats. Ger tillbaka latitude/longitude vid varje ändring.
 */
export function PinPlacer({
  value,
  onChange,
  onAddress,
  readOnly = false,
  className,
}: {
  value: LatLng;
  onChange: (p: LatLng) => void;
  onAddress?: (hit: GeoHit) => void;
  readOnly?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(16);
  const [center, setCenter] = useState<LatLng>(value);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry?.contentRect;
      if (r) setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const worldSize = TILE * Math.pow(2, zoom);
  const originX = worldX(center.lng) * worldSize - size.w / 2;
  const originY = worldY(center.lat) * worldSize - size.h / 2;
  const project = (p: LatLng) => ({
    x: worldX(p.lng) * worldSize - originX,
    y: worldY(p.lat) * worldSize - originY,
  });
  const unproject = (x: number, y: number) => ({
    lat: latOf(clamp((y + originY) / worldSize, 0.0001, 0.9999)),
    lng: lngOf((x + originX) / worldSize),
  });

  const state = useRef({ zoom, center, size, worldSize, originX, originY });
  state.current = { zoom, center, size, worldSize, originX, originY };

  const mode = useRef<"none" | "pan" | "pin">("none");
  const last = useRef({ x: 0, y: 0 });

  const onPointerDown = (e: React.PointerEvent, kind: "pan" | "pin") => {
    if (readOnly && kind === "pin") return;
    if (kind === "pin") e.stopPropagation();
    ref.current?.setPointerCapture(e.pointerId);
    mode.current = kind;
    last.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (mode.current === "none") return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    const s = state.current;
    if (mode.current === "pan") {
      setCenter((c) => ({
        lat: latOf(clamp(worldY(c.lat) - dy / s.worldSize, 0.0001, 0.9999)),
        lng: lngOf(worldX(c.lng) - dx / s.worldSize),
      }));
    } else {
      const px = worldX(value.lng) * s.worldSize - s.originX + dx;
      const py = worldY(value.lat) * s.worldSize - s.originY + dy;
      onChange({
        lat: latOf(clamp((py + s.originY) / s.worldSize, 0.0001, 0.9999)),
        lng: lngOf((px + s.originX) / s.worldSize),
      });
    }
  };

  const endPointer = () => {
    mode.current = "none";
  };

  const zoomBy = useCallback((dir: 1 | -1) => {
    setZoom((z) => clamp(z + dir, MIN_ZOOM, MAX_ZOOM));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      setZoom((z) => clamp(z - dy * 0.004, MIN_ZOOM, MAX_ZOOM));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Tiles
  const z = Math.round(zoom);
  const scale = Math.pow(2, zoom - z);
  const tileWorld = TILE * Math.pow(2, z);
  const tOriginX = worldX(center.lng) * tileWorld * scale - size.w / 2;
  const tOriginY = worldY(center.lat) * tileWorld * scale - size.h / 2;
  const n = Math.pow(2, z);
  const x0 = Math.floor(tOriginX / (TILE * scale));
  const y0 = Math.floor(tOriginY / (TILE * scale));
  const x1 = Math.floor((tOriginX + size.w) / (TILE * scale));
  const y1 = Math.floor((tOriginY + size.h) / (TILE * scale));
  const tiles: { key: string; url: string; left: number; top: number }[] = [];
  for (let tx = x0; tx <= x1; tx++) {
    for (let ty = y0; ty <= y1; ty++) {
      if (ty < 0 || ty >= n) continue;
      const wx = ((tx % n) + n) % n;
      tiles.push({
        key: `${z}/${tx}/${ty}`,
        url: `https://tile.openstreetmap.org/${z}/${wx}/${ty}.png`,
        left: tx * TILE * scale - tOriginX,
        top: ty * TILE * scale - tOriginY,
      });
    }
  }

  const pin = project(value);

  return (
    <div className="space-y-2">
      {!readOnly && (
      <AddressSearch
        value={null}
        placeholder="Sök adress"
        onClear={() => {}}
        onSelect={(hit) => {
          onChange({ lat: hit.lat, lng: hit.lng });
          setCenter({ lat: hit.lat, lng: hit.lng });
          setZoom(17);
          onAddress?.(hit);
        }}
      />
      )}

      <div
        ref={ref}
        onPointerDown={(e) => onPointerDown(e, "pan")}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        className={cn(
          "relative h-64 touch-none select-none overflow-hidden rounded-2xl border border-border bg-secondary",
          className,
        )}
      >
        <div className="absolute inset-0" style={{ filter: TILE_FILTER }}>
          {tiles.map((t) => (
            <img
              key={t.key}
              src={t.url}
              alt=""
              draggable={false}
              className="absolute"
              style={{
                left: t.left,
                top: t.top,
                width: TILE * scale + 1,
                height: TILE * scale + 1,
              }}
            />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-background/20" />

        {/* Nålen – dras med pekaren */}
        <button
          type="button"
          aria-label="Dra nålen till rätt plats"
          onPointerDown={(e) => onPointerDown(e, "pin")}
          className="absolute z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-full cursor-grab items-end justify-center active:cursor-grabbing"
          style={{ left: pin.x, top: pin.y }}
        >
          <span className="flex h-9 w-9 rotate-45 items-center justify-center rounded-full rounded-br-none bg-primary shadow-[var(--shadow-float)] ring-2 ring-white">
            <MapPin className="h-4 w-4 -rotate-45 text-primary-foreground" />
          </span>
        </button>

        {!readOnly && (
        <div className="absolute right-2 top-2 z-20 flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
          <button
            type="button"
            onClick={() => zoomBy(1)}
            aria-label="Zooma in"
            className="flex h-9 w-9 items-center justify-center"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => zoomBy(-1)}
            aria-label="Zooma ut"
            className="flex h-9 w-9 items-center justify-center border-t border-border"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCenter(value)}
            aria-label="Centrera på nålen"
            className="flex h-9 w-9 items-center justify-center border-t border-border"
          >
            <Crosshair className="h-4 w-4" />
          </button>
        </div>
        )}

        <p className="absolute bottom-2 left-2 z-20 rounded-lg bg-card/90 px-2 py-1 font-mono text-[10px] text-muted-foreground">
          {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
      </div>
      {!readOnly && (
      <p className="text-[11px] text-muted-foreground">
        Dra nålen för att finjustera. Panorera med fingret, zooma med knapparna.
      </p>
      )}
    </div>
  );
}
