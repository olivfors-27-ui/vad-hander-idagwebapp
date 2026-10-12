import L, { divIcon, point, type LatLngExpression } from "leaflet";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
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
  Locate,
  Search,
  X,
} from "lucide-react";
import { CATEGORY_COLOR, PLACE_TYPES, geoOf, type EventItem, type Place } from "@/lib/hander-data";
import { isHappeningNow } from "@/lib/hander-store";
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
            aria-label="Återställ kartan"
            onClick={() => map.setView([center.lat, center.lng], 13)}
            className="leaflet-control-button"
          >
            <Locate className="h-4 w-4" />
          </button>
        </div>,
        controlRoot,
      )
    : null;
}

function InvalidateMapSize() {
  const map = useMap();
  useEffect(() => {
    const frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    return () => cancelAnimationFrame(frame);
  }, [map]);
  return null;
}

function SearchBox() {
  const map = useMap();
  const [query, setQuery] = useSearchState();
  const [searching, setSearching] = useState(false);
  const searchRoot = map.getContainer().querySelector<HTMLElement>(".leaflet-top.leaflet-left");

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

  return searchRoot
    ? createPortal(
        <form
          className="leaflet-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
        >
          {searching ? (
            <span
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-r-transparent"
              aria-hidden="true"
            />
          ) : (
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Sök adress eller plats"
            aria-label="Sök adress eller plats"
            autoComplete="off"
          />
          {query && (
            <button type="button" aria-label="Rensa sökning" onClick={() => setQuery("")}>
              <X className="h-4 w-4" />
            </button>
          )}
          <button type="submit" aria-label="Sök" disabled={searching || query.trim().length < 2}>
            <Search className="h-4 w-4" />
          </button>
        </form>,
        searchRoot,
      )
    : null;
}

function useSearchState(): [string, (value: string) => void] {
  const [query, setQuery] = useState("");
  return [query, setQuery];
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
  className?: string;
}) {
  const defaultCenter = { lat: 59.3293, lng: 18.0686 };
  const firstEventGeo = events.length === 1 ? geoOf(events[0]!) : null;
  const centerPoint = firstEventGeo ?? defaultCenter;
  const center: LatLngExpression = [centerPoint.lat, centerPoint.lng];
  const placeItems = showPlaces
    ? places.flatMap((place) => {
        const geo = geoOf(place);
        const type = PLACE_TYPES[place.type];
        return geo && type ? [{ place, geo, type }] : [];
      })
    : [];

  return (
    <div className={cn("relative h-full w-full", className)}>
      <MapContainer
        center={center}
        zoom={initialZoom}
        minZoom={10}
        maxZoom={19}
        scrollWheelZoom={zoomable}
        dragging={zoomable}
        doubleClickZoom={zoomable}
        touchZoom={zoomable}
        zoomControl={false}
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
        <MapControls center={defaultCenter} />
        <InvalidateMapSize />
        {searchable && <SearchBox />}
      </MapContainer>
      <span className="pointer-events-none absolute bottom-1 right-1 z-[500] rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-slate-700">
        © OpenStreetMap contributors
      </span>
    </div>
  );
}
