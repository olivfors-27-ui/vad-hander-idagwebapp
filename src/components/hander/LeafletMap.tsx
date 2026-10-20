import L, { divIcon, point, type LatLngExpression } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { CircleMarker, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import "leaflet.markercluster";
import {
  BookOpen,
  GraduationCap,
  Music2,
  Palette,
  PartyPopper,
  ShoppingBag,
  Utensils,
  Volleyball,
  Trees,
  Sparkles,
  Crosshair,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { CATEGORY_COLOR, PLACE_TYPES, geoOf, type EventItem, type Place } from "@/lib/hander-data";
import { isHappeningNow, useHander } from "@/lib/hander-store";
import { DEFAULT_MAP_VIEW, readMapView, saveMapView } from "@/lib/map-view";
import { cn } from "@/lib/utils";
import type { GeoPoint } from "./MapCanvas";

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const CATEGORY_ICON = {
  musik: Music2,
  fest: PartyPopper,
  student: GraduationCap,
  sport: Volleyball,
  mat: Utensils,
  kultur: Palette,
  shopping: ShoppingBag,
  plugg: BookOpen,
  utomhus: Trees,
  ovrigt: Sparkles,
} as const;
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
const eventPin = (
  category: EventItem["category"],
  color: string,
  live: boolean,
  selected: boolean,
) => {
  const Icon = CATEGORY_ICON[category] ?? Sparkles;
  const iconHtml = renderToStaticMarkup(<Icon size={17} strokeWidth={2.4} aria-hidden="true" />);
  return divIcon({
    className: "hander-leaflet-pin",
    html: `<span class="hander-pin-dot${selected ? " is-selected" : ""}" role="img" aria-label="${escapeHtml(category)}" style="position:relative;display:grid;width:38px;height:38px;place-items:center;border:3px solid #fff;border-radius:50% 50% 50% 8px;background:${color};color:#fff;box-shadow:0 2px 8px #17202a88;transform:rotate(-45deg);--pin-icon-size:17px;${selected ? "outline:3px solid #394fc4;outline-offset:2px;" : ""}"><span aria-hidden="true" style="display:grid;place-items:center;transform:rotate(45deg)">${iconHtml}</span>${live ? '<i aria-hidden="true" style="position:absolute;top:-3px;right:-3px;width:10px;height:10px;border:2px solid #fff;border-radius:50%;background:#22c55e"></i>' : ""}</span>`,
    iconSize: [42, 48],
    iconAnchor: [21, 46],
  });
};
const placePin = (color: string) =>
  divIcon({
    className: "hander-leaflet-place",
    html: `<span class="hander-place-dot" style="display:block;width:25px;height:25px;border:3px solid #fff;border-radius:50%;background:${color};box-shadow:0 2px 7px #17202a88"></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
const clusterIcon = (cluster: { getChildCount: () => number }) => {
  const count = cluster.getChildCount();
  const size = count > 99 ? 48 : 42;
  return divIcon({
    html: `<span class="hander-cluster-label" style="display:grid;width:100%;height:100%;place-items:center;border:3px solid #fff;border-radius:50%;background:#394fc4;color:#fff;font-size:13px;font-weight:800;box-shadow:0 2px 8px #17202a88">${count}</span>`,
    className: "hander-leaflet-cluster",
    iconSize: point(size, size),
  });
};

function MapLayers({
  events,
  selectedId,
  onSelectEvent,
}: {
  events: EventItem[];
  selectedId: string | null | undefined;
  onSelectEvent: (event: EventItem) => void;
}) {
  const map = useMap();
  useEffect(() => {
    const cluster = new L.MarkerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 70,
      iconCreateFunction: clusterIcon,
    });
    const markers = events.flatMap((event) => {
      const geo = geoOf(event);
      if (!geo) return [];
      const color =
        event.visibility === "private" ? "#64748b" : (CATEGORY_COLOR[event.category] ?? "#E45048");
      const marker = L.marker([geo.lat, geo.lng], {
        icon: eventPin(event.category, color, isHappeningNow(event), selectedId === event.id),
        title: event.name,
        alt: event.name,
        keyboard: true,
      });
      marker.on("click", () => onSelectEvent(event));
      return [marker];
    });
    cluster.addLayers(markers);
    map.addLayer(cluster);
    return () => {
      map.removeLayer(cluster);
      cluster.clearLayers();
    };
  }, [events, map, onSelectEvent, selectedId]);
  return null;
}

function MapControls({ center }: { center: GeoPoint }) {
  const map = useMap();
  const container = map.getContainer();
  const controlRoot = container.querySelector<HTMLElement>(".leaflet-control-container");
  // Samma position som avstånden räknas från. Knappen frågar bara om
  // tillåtelse när användaren själv trycker – aldrig vid sidladdning.
  const { userLocation, locationStatus, askForLocation } = useHander();
  const locating = locationStatus === "asking";

  const goToUser = async () => {
    const target = userLocation ?? (await askForLocation());
    if (!target) {
      toast.error("Kunde inte hämta din position. Avstånden räknas från Stockholm.");
      return;
    }
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  };

  return controlRoot
    ? createPortal(
        <div className="leaflet-controls">
          <button
            type="button"
            aria-label="Zooma in"
            onClick={() => map.zoomIn()}
            className="leaflet-control-button"
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zooma ut"
            onClick={() => map.zoomOut()}
            className="leaflet-control-button"
          >
            −
          </button>
          <button
            type="button"
            aria-label="Visa min position"
            title="Visa min position"
            aria-busy={locating}
            disabled={locating || locationStatus === "unsupported"}
            onClick={() => void goToUser()}
            className="leaflet-control-button disabled:opacity-50"
          >
            <Crosshair className={cn("h-4 w-4", locating && "animate-spin")} />
          </button>
          <button
            type="button"
            aria-label="Återställ kartan"
            title="Återställ kartan"
            onClick={() => map.setView([center.lat, center.lng], 13)}
            className="leaflet-control-button"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>,
        controlRoot,
      )
    : null;
}

function InvalidateMapSize() {
  const map = useMap();
  useEffect(() => {
    // invalidateSize() behåller kartans geografiska centrum (pan: true) även när
    // ytan ändrar storlek. Leaflets inbyggda resize-hantering använder pan: false
    // och flyttar då centrum med halva storleksskillnaden – det var det som gjorde
    // att en återställd vy drev några pixlar. Därför är trackResize avstängt på
    // MapContainer och vi följer ytans storlek med en ResizeObserver i stället.
    const resize = () => map.invalidateSize();
    const frame = requestAnimationFrame(resize);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => resize());
    observer?.observe(map.getContainer());
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [map]);
  return null;
}

/** Låter föräldern få tag i kartinstansen utan att själv ligga i kartans kontext. */
function MapBridge({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

/** Sparar vyn när användaren panorerar/zoomar så att den kan återställas vid återkomst. */
function MapViewMemory() {
  const map = useMap();
  useEffect(() => {
    const saved = readMapView();
    // Vi sparar bara när ANVÄNDAREN flyttat kartan. Att spara vid mount skulle
    // läsa av getCenter() medan kartytan fortfarande kan ändra storlek, vilket
    // gjorde att vyn drev några pixlar för varje gång man gick in och ut ur ett event.
    let userDriven = false;
    let applying = false;

    const markUser = () => {
      if (!applying) userDriven = true;
    };
    const persist = () => {
      if (!userDriven) return;
      userDriven = false;
      const c = map.getCenter();
      saveMapView({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    };

    const frame = requestAnimationFrame(() => {
      if (saved) {
        applying = true;
        map.setView([saved.lat, saved.lng], saved.zoom, { animate: false });
        applying = false;
      }
      // Lyssna först efter att MapContainers egen startvy satts – annars skulle
      // den räknas som en användarändring och sparas av misstag.
      map.on("dragstart", markUser);
      map.on("zoomstart", markUser);
      map.on("moveend", persist);
      map.on("zoomend", persist);
    });

    return () => {
      cancelAnimationFrame(frame);
      map.off("dragstart", markUser);
      map.off("zoomstart", markUser);
      map.off("moveend", persist);
      map.off("zoomend", persist);
    };
  }, [map]);
  return null;
}

/**
 * Platssökning ovanpå kartan. Renderas som syskon till kartcontainern (inte i
 * Leaflets hörncontainer, som är 0×0 och därför klämde ihop sökfältet) och har
 * därför alltid full bredd. Bara EN sökikon: den vänstra ikonen ÄR knappen som
 * startar sökningen – tidigare fanns både en dekorativ ikon och en separat
 * submit-knapp med samma ikon, vilket gav två förstoringsglas.
 */
function MapSearch({ map, top }: { map: L.Map; top: number }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = async () => {
    const term = query.trim();
    if (term.length < 2 || searching) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        limit: "1",
        "accept-language": "sv",
        q: term,
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Geocoding request failed: ${response.status}`);
      const results = (await response.json()) as {
        lat: string;
        lon: string;
        display_name: string;
      }[];
      const hit = results[0];
      if (!hit) {
        toast.info("Hittade ingen plats. Prova med en annan sökning.");
        return;
      }
      const lat = Number(hit.lat);
      const lng = Number(hit.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng))
        throw new Error("Invalid location result");
      map.flyTo([lat, lng], 16);
      setQuery(hit.display_name.split(",")[0] ?? term);
    } catch (error) {
      console.error("Map address search failed", error);
      toast.error("Platsökningen misslyckades. Kontrollera anslutningen och försök igen.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <form
      className="leaflet-search"
      role="search"
      style={{ top }}
      onSubmit={(event) => {
        event.preventDefault();
        void search();
      }}
    >
      <button
        type="submit"
        aria-label="Sök"
        // Ikonen är alltid klickbar: med för kort sökord flyttas fokus till
        // fältet i stället för att knappen ser inaktiv ut.
        onClick={(event) => {
          if (query.trim().length < 2) {
            event.preventDefault();
            inputRef.current?.focus();
          }
        }}
        className="leaflet-search-icon"
      >
        {searching ? (
          <span
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-r-transparent"
            aria-hidden="true"
          />
        ) : (
          <Search className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        )}
      </button>
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Sök adress eller plats"
        aria-label="Sök adress eller plats"
        autoComplete="off"
        enterKeyHint="search"
      />
      {query && (
        <button
          type="button"
          aria-label="Rensa sökning"
          className="leaflet-search-icon"
          onClick={() => setQuery("")}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}

export function LeafletMap({
  events,
  places,
  selectedId,
  onSelectEvent,
  onSelectPlace,
  showPlaces,
  zoomable,
  searchable,
  initialZoom,
  searchTop,
  bottomInset,
  className,
}: {
  events: EventItem[];
  places: Place[];
  selectedId?: string | null;
  onSelectEvent: (event: EventItem) => void;
  onSelectPlace?: (place: Place) => void;
  showPlaces: boolean;
  zoomable: boolean;
  searchable: boolean;
  initialZoom: number;
  /** Avstånd från kartans överkant till sökfältet – håller undan för filterraden. */
  searchTop: number;
  /** Extra utrymme nedtill (t.ex. bakom en flytande tabbar) för kontroller/credits. */
  bottomInset: number;
  className?: string;
}) {
  const [map, setMap] = useState<L.Map | null>(null);
  // Samma position som avstånden räknas från – visas som en punkt när den finns.
  const { userLocation } = useHander();
  // LeafletMap laddas bara på klienten (dynamisk import i MapCanvas), så vyn kan
  // läsas direkt i första rendern och kartan startar på rätt plats utan att hoppa.
  const savedView = useMemo(() => readMapView(), []);
  const firstEventGeo = events.length === 1 ? geoOf(events[0]!) : null;
  const fallbackCenter = firstEventGeo ?? DEFAULT_MAP_VIEW;
  const view = savedView
    ? savedView
    : { lat: fallbackCenter.lat, lng: fallbackCenter.lng, zoom: initialZoom };
  const center: LatLngExpression = [view.lat, view.lng];
  const placeItems = showPlaces
    ? places.flatMap((place) => {
        const geo = geoOf(place);
        const type = PLACE_TYPES[place.type];
        return geo && type ? [{ place, geo, type }] : [];
      })
    : [];

  return (
    <div
      className={cn("relative h-full w-full", className)}
      style={{ "--map-controls-bottom": `${28 + bottomInset}px` } as React.CSSProperties}
    >
      <MapContainer
        center={center}
        zoom={view.zoom}
        minZoom={10}
        maxZoom={19}
        scrollWheelZoom={zoomable}
        dragging={zoomable}
        doubleClickZoom={zoomable}
        touchZoom={zoomable}
        zoomControl={false}
        trackResize={false}
        style={{ height: "100%", width: "100%" }}
        className="h-full w-full"
        preferCanvas
      >
        <MapLayers events={events} selectedId={selectedId} onSelectEvent={onSelectEvent} />
        <TileLayer
          url={TILE_URL}
          maxZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {placeItems.map(({ place, geo, type }) => (
          <Marker
            key={place.id}
            position={[geo.lat, geo.lng]}
            icon={placePin(type.color)}
            title={place.name}
            alt={place.name}
            eventHandlers={{ click: () => onSelectPlace?.(place) }}
          />
        ))}
        {userLocation && (
          <>
            {/* Mjuk halo runt punkten så den syns även över täta kluster. */}
            <CircleMarker
              center={[userLocation.lat, userLocation.lng]}
              radius={22}
              interactive={false}
              pathOptions={{
                color: "#2F7DFA",
                weight: 1,
                opacity: 0.3,
                fillColor: "#2F7DFA",
                fillOpacity: 0.12,
              }}
            />
            <CircleMarker
              center={[userLocation.lat, userLocation.lng]}
              radius={7}
              interactive={false}
              pathOptions={{
                color: "#FFFFFF",
                weight: 3,
                opacity: 1,
                fillColor: "#2F7DFA",
                fillOpacity: 1,
              }}
            />
          </>
        )}
        <MapControls center={DEFAULT_MAP_VIEW} />
        <InvalidateMapSize />
        <MapViewMemory />
        <MapBridge onReady={setMap} />
      </MapContainer>
      {searchable && map && <MapSearch map={map} top={searchTop} />}
      <span
        className="pointer-events-none absolute right-1 z-[500] rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-slate-700"
        style={{ bottom: 4 + bottomInset }}
      >
        © OpenStreetMap contributors
      </span>
    </div>
  );
}
