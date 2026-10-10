import L, { divIcon, point, type LatLngExpression } from "leaflet";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import "leaflet.markercluster";
import { Locate, Search, X } from "lucide-react";
import { CATEGORY_COLOR, PLACE_TYPES, geoOf, type EventItem, type Place } from "@/lib/hander-data";
import { isHappeningNow } from "@/lib/hander-store";
import { cn } from "@/lib/utils";
import type { GeoPoint } from "./MapCanvas";

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const eventPin = (color: string, live: boolean, selected: boolean) =>
  divIcon({
    className: "hander-leaflet-pin",
    html: `<span class="hander-pin-dot${selected ? " is-selected" : ""}" style="position:relative;display:grid;width:34px;height:34px;place-items:center;border:3px solid #fff;border-radius:50% 50% 50% 4px;background:${color};box-shadow:0 2px 8px #17202a88;transform:rotate(-45deg);${selected ? "outline:3px solid #394fc4;outline-offset:2px;" : ""}"><span aria-hidden="true" style="width:9px;height:9px;border-radius:50%;background:#fff"></span>${live ? '<i aria-hidden="true" style="position:absolute;top:-4px;right:-4px;width:11px;height:11px;border:2px solid #fff;border-radius:50%;background:#22c55e"></i>' : ""}</span>`,
    iconSize: [34, 42],
    iconAnchor: [17, 40],
  });
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
      maxClusterRadius: 46,
      iconCreateFunction: clusterIcon,
    });
    const markers = events.flatMap((event) => {
      const geo = geoOf(event);
      if (!geo) return [];
      const color =
        event.visibility === "private" ? "#64748b" : (CATEGORY_COLOR[event.category] ?? "#E45048");
      const marker = L.marker([geo.lat, geo.lng], {
        icon: eventPin(color, isHappeningNow(event), selectedId === event.id),
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
  const searchRoot = map.getContainer().querySelector<HTMLElement>(".leaflet-top.leaflet-left");
  return searchRoot
    ? createPortal(
        <div className="leaflet-search">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && query.trim()) {
                const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=sv&q=${encodeURIComponent(query.trim())}`;
                void fetch(url, { headers: { Accept: "application/json" } })
                  .then((response) => response.json())
                  .then((results: { lat: string; lon: string }[]) => {
                    const hit = results[0];
                    if (hit) map.flyTo([Number(hit.lat), Number(hit.lon)], 15);
                  })
                  .catch(() => undefined);
              }
            }}
            placeholder="Sök adress eller plats"
            aria-label="Sök adress eller plats"
          />
          {query && (
            <button type="button" aria-label="Rensa sökning" onClick={() => setQuery("")}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>,
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
