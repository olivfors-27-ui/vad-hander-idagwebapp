import { Loader2, Locate, Minus, Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORY_COLOR,
  MAP_CENTER,
  PLACE_TYPES,
  categoryById,
  geoOf,
  type EventItem,
  type Place,
} from "@/lib/hander-data";
import { isHappeningNow } from "@/lib/hander-store";
import { cn } from "@/lib/utils";

const MIN_ZOOM = 10;
const MAX_ZOOM = 18;
const TILE = 256;
const TILE_URL = (z: number, x: number, y: number) => {
  const servers = ["a", "b", "c", "d"];
  const server = servers[Math.abs(x + y) % servers.length];
  return `https://${server}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`;
};
// Neutraliserar standardkartan till en lugn, ljus stadskarta:
// kraftigt avmättad, ljusare och varmare – färgerna lever i pinsen istället.
const TILE_FILTER = "saturate(0.72) brightness(1.06) contrast(0.92) sepia(0.06)";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Web Mercator: normaliserade världskoordinater 0-1. */
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

export type GeoPoint = { lat: number; lng: number };

type SearchHit = { label: string; lat: number; lng: number };

export function MapCanvas({
  events,
  places,
  selectedId,
  onSelectEvent,
  onSelectPlace,
  showPlaces = true,
  zoomable = false,
  searchable = false,
  initialZoom = 13,
  className,
}: {
  events: EventItem[];
  places: Place[];
  selectedId?: string | null;
  onSelectEvent: (e: EventItem) => void;
  onSelectPlace?: (p: Place) => void;
  showPlaces?: boolean;
  zoomable?: boolean;
  searchable?: boolean;
  initialZoom?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(initialZoom);
  const [center, setCenter] = useState<GeoPoint>(MAP_CENTER);
  const [home, setHome] = useState<GeoPoint>(MAP_CENTER);

  useLayoutEffect(() => {
    const el = containerRef.current;
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

  const stateRef = useRef({ zoom, center, size });
  stateRef.current = { zoom, center, size };

  /** Geo → pixel i containern. */
  const project = useCallback(
    (lat: number, lng: number) => ({
      x: worldX(lng) * worldSize - originX,
      y: worldY(lat) * worldSize - originY,
    }),
    [worldSize, originX, originY],
  );

  /** Zoomar och håller den geografiska punkten under (px, py) stilla. */
  const applyZoom = useCallback((next: number, px: number, py: number) => {
    const s = stateRef.current;
    if (!s.size.w) return;
    const nz = clamp(next, MIN_ZOOM, MAX_ZOOM);
    if (nz === s.zoom) return;
    const ws = TILE * Math.pow(2, s.zoom);
    const nws = TILE * Math.pow(2, nz);
    // världspunkt (0-1) under pekaren före zoom
    const wx = (worldX(s.center.lng) * ws - s.size.w / 2 + px) / ws;
    const wy = (worldY(s.center.lat) * ws - s.size.h / 2 + py) / ws;
    // nytt centrum så att samma punkt ligger kvar under pekaren
    const ncx = (wx * nws - px + s.size.w / 2) / nws;
    const ncy = (wy * nws - py + s.size.h / 2) / nws;
    setZoom(nz);
    setCenter({ lat: latOf(ncy), lng: lngOf(ncx) });
  }, []);

  const panBy = useCallback((dxPx: number, dyPx: number) => {
    const s = stateRef.current;
    const ws = TILE * Math.pow(2, s.zoom);
    setCenter((c) => ({
      lat: latOf(clamp(worldY(c.lat) - dyPx / ws, 0.0001, 0.9999)),
      lng: lngOf(worldX(c.lng) - dxPx / ws),
    }));
  }, []);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number; cx: number; cy: number } | null>(null);
  const dragged = useRef(false);

  /**
   * Mjuk zoom: wheel/pinch/knappar uppdaterar ett målvärde, en rAF-loop
   * easar den faktiska zoomnivån mot målet så att inga hopp syns.
   */
  const anim = useRef<{ target: number; px: number; py: number; raf: number | null }>({
    target: zoom,
    px: 0,
    py: 0,
    raf: null,
  });

  const animateZoomTo = useCallback(
    (target: number, px: number, py: number) => {
      const a = anim.current;
      a.target = clamp(target, MIN_ZOOM, MAX_ZOOM);
      a.px = px;
      a.py = py;
      if (a.raf != null) return;
      const step = () => {
        const cur = stateRef.current.zoom;
        const diff = a.target - cur;
        if (Math.abs(diff) < 0.003) {
          if (diff !== 0) applyZoom(a.target, a.px, a.py);
          a.raf = null;
          return;
        }
        applyZoom(cur + diff * 0.3, a.px, a.py);
        a.raf = requestAnimationFrame(step);
      };
      a.raf = requestAnimationFrame(step);
    },
    [applyZoom],
  );

  useEffect(
    () => () => {
      if (anim.current.raf != null) cancelAnimationFrame(anim.current.raf);
    },
    [],
  );

  const zoomButton = useCallback(
    (dir: 1 | -1) => {
      const s = stateRef.current;
      animateZoomTo(
        Math.round(anim.current.target) + dir,
        s.size.w / 2,
        s.size.h / 2,
      );
    },
    [animateZoomTo],
  );

  const reset = useCallback(() => {
    anim.current.target = initialZoom;
    setZoom(initialZoom);
    setCenter(home);
  }, [initialZoom, home]);

  useEffect(() => {
    if (!zoomable) return;
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const r = el.getBoundingClientRect();
      animateZoomTo(
        anim.current.target - dy * (e.ctrlKey ? 0.012 : 0.0035),
        e.clientX - r.left,
        e.clientY - r.top,
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomable, animateZoomTo]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!zoomable) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        dist: Math.hypot(a!.x - b!.x, a!.y - b!.y),
        zoom: stateRef.current.zoom,
        cx: (a!.x + b!.x) / 2,
        cy: (a!.y + b!.y) / 2,
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!zoomable) return;
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();

    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      dragged.current = true;
      applyZoom(
        pinch.current.zoom + Math.log2(dist / pinch.current.dist),
        pinch.current.cx - r.left,
        pinch.current.cy - r.top,
      );
      return;
    }
    if (pointers.current.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (Math.abs(dx) + Math.abs(dy) > 2 && !dragged.current) {
        dragged.current = true;
        // Fånga pekaren först när det faktiskt är en dragning, annars
        // omdirigeras klick från pins till kartcontainern.
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* ignoreras */
        }
      }
      panBy(dx, dy);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
    if (pointers.current.size < 2) pinch.current = null;
  };

  const guard = (fn: () => void) => () => {
    if (dragged.current) return;
    fn();
  };

  /** Rutnät av kartrutor som täcker vyn. */
  const tiles = useMemo(() => {
    if (!size.w || !size.h) return [];
    const tz = clamp(Math.round(zoom), 0, 19);
    const scale = Math.pow(2, zoom - tz);
    const ts = TILE * scale;
    const max = Math.pow(2, tz);
    const x0 = Math.floor(originX / ts);
    const x1 = Math.floor((originX + size.w) / ts);
    const y0 = Math.max(0, Math.floor(originY / ts));
    const y1 = Math.min(max - 1, Math.floor((originY + size.h) / ts));
    const out: { key: string; url: string; left: number; top: number; size: number }[] = [];
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const tx = ((x % max) + max) % max;
        out.push({
          key: `${tz}/${x}/${y}`,
          url: TILE_URL(tz, tx, y),
          left: x * ts - originX,
          top: y * ts - originY,
          size: ts,
        });
      }
    }
    return out;
  }, [size, zoom, originX, originY]);

  /** Markörer krymper något vid låg zoom så att kartan inte dränks. */
  const markerScale = zoom >= 15 ? 1 : zoom >= 13 ? 0.9 : 0.78;
  const me = project(home.lat, home.lng);

  // ── Sök efter adress/plats ──
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setHits([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=sv&q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" } },
      );
      const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
      setHits(
        data.map((d) => ({ label: d.display_name, lat: Number(d.lat), lng: Number(d.lon) })),
      );
    } catch {
      setHits([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!searchable) return;
    const t = setTimeout(() => void runSearch(query), 450);
    return () => clearTimeout(t);
  }, [query, searchable, runSearch]);

  const goTo = (hit: SearchHit) => {
    setCenter({ lat: hit.lat, lng: hit.lng });
    setHome({ lat: hit.lat, lng: hit.lng });
    setZoom(15);
    setHits([]);
    setQuery(hit.label.split(",")[0] ?? hit.label);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full w-full overflow-hidden bg-secondary",
        zoomable && "touch-none",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Kartrutor */}
      {tiles.map((t) => (
        <img
          key={t.key}
          src={t.url}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute select-none"
          style={{
            left: t.left,
            top: t.top,
            width: t.size,
            height: t.size,
            filter: TILE_FILTER,
          }}
        />
      ))}

      {/* Varm toning ovanför rutorna – dämpar kartan ytterligare, pins ligger ovanför */}
      <div className="pointer-events-none absolute inset-0 z-[5] bg-background/25" aria-hidden />

      {size.w > 0 && (
        <>
          {/* Du är här */}
          <div
            className="pointer-events-none absolute z-10"
            style={{ left: me.x, top: me.y, transform: "translate(-50%,-50%)" }}
          >
            <span className="absolute left-1/2 top-1/2 block h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/40 pulse-ring" />
            <span className="relative block h-4 w-4 rounded-full border-2 border-background bg-primary shadow-[var(--shadow-pin)]" />
          </div>

          {/* Permanenta upptäckter – liten rund markör i typfärg med vit ikon */}
          {showPlaces &&
            places.map((p) => {
              const g = geoOf(p);
              if (!g) return null;
              const pt = project(g.lat, g.lng);
              const meta = PLACE_TYPES[p.type];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={guard(() => onSelectPlace?.(p))}
                  style={{
                    left: pt.x,
                    top: pt.y,
                    transform: `translate(-50%,-50%) scale(${markerScale})`,
                    background: meta.color,
                  }}
                  className={cn(
                    "absolute z-10 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-white text-[13px] leading-none transition-transform hover:scale-110",
                    selectedId === p.id && "ring-2 ring-primary ring-offset-2",
                  )}
                  aria-label={`${meta.label}: ${p.name}`}
                >
                  <span className="block h-2.5 w-2.5 rounded-full bg-white/90" aria-hidden />
                </button>
              );
            })}

          {/* Temporära events – kompakt droppformad pin i kategorins färg */}
          {events.map((e) => {
            const cat = categoryById(e.category);
            const live = isHappeningNow(e);
            const selected = selectedId === e.id;
            const g = geoOf(e);
            if (!g) return null;
            const pt = project(g.lat, g.lng);
            return (
              <button
                key={e.id}
                type="button"
                onClick={guard(() => onSelectEvent(e))}
                style={{ left: pt.x, top: pt.y }}
                className="absolute z-20 animate-pin-pop"
                aria-label={e.name}
              >
                {/* nålens spets sitter exakt på (left, top) */}
                <span
                  className="block"
                  style={{
                    transform: `translate(-50%,-100%) scale(${markerScale * (selected ? 1.15 : 1)})`,
                    transformOrigin: "bottom center",
                  }}
                >
                  <span
                    className={cn(
                      "relative flex h-9 w-9 items-center justify-center rounded-full rounded-bl-sm border-[3px] border-white text-[15px] leading-none",
                      e.promoted ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                    )}
                    style={{
                      background:
                        e.visibility === "private"
                          ? "linear-gradient(135deg,#4B5563,#9CA3AF)"
                          : CATEGORY_COLOR[e.category],
                    }}
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-white/90" aria-hidden />
                    {live && (
                      <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-[#22C55E]" />
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </>
      )}

      {searchable && (
        <div className="absolute inset-x-3 top-3 z-30">
          <div className="flex h-11 items-center gap-2 rounded-full bg-white px-4 shadow-[var(--shadow-card)]">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              placeholder="Sök adress eller plats"
              aria-label="Sök adress eller plats"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {searching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
            {query && !searching && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setHits([]);
                }}
                aria-label="Rensa sökning"
                className="shrink-0 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {hits.length > 0 && (
            <ul className="mt-1 max-h-56 overflow-y-auto rounded-2xl bg-white shadow-[var(--shadow-float)]">
              {hits.map((h) => (
                <li key={`${h.lat},${h.lng}`}>
                  <button
                    type="button"
                    onClick={() => goTo(h)}
                    className="block w-full px-4 py-2.5 text-left text-xs leading-snug hover:bg-secondary"
                  >
                    {h.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {zoomable && (
        <div className="pointer-events-auto absolute bottom-6 right-3 z-30 flex flex-col gap-1 rounded-full bg-white p-1 shadow-[var(--shadow-card)]">
          <button
            type="button"
            onClick={() => zoomButton(1)}
            aria-label="Zooma in"
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => zoomButton(-1)}
            aria-label="Zooma ut"
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={reset}
            aria-label="Återställ kartan"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
          >
            <Locate className="h-4 w-4" />
          </button>
        </div>
      )}

      <span className="pointer-events-none absolute bottom-0 right-0 z-10 bg-white/70 px-1 text-[9px] leading-tight text-muted-foreground">
        © OpenStreetMap · © CARTO
      </span>
    </div>
  );
}

export function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1">
        <span
          className="inline-block h-3 w-3 rounded-full rounded-bl-[2px] border border-white shadow-sm"
          style={{ background: CATEGORY_COLOR.musik }}
        />
        Tillfälligt event
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-full border border-white bg-[#0F766E] shadow-sm" />
        Permanent upptäckt
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-success" />
        Pågår nu
      </span>
    </div>
  );
}
