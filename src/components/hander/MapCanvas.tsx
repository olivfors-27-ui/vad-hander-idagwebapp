import { useEffect, useState } from "react";
import type { EventItem, Place } from "@/lib/hander-data";
import { cn } from "@/lib/utils";

export type GeoPoint = { lat: number; lng: number };

type LeafletMapProps = {
  events: EventItem[];
  places: Place[];
  selectedId?: string | null;
  onSelectEvent: (event: EventItem) => void;
  onSelectPlace?: (place: Place) => void;
  showPlaces?: boolean;
  zoomable?: boolean;
  searchable?: boolean;
  initialZoom?: number;
  className?: string;
};

export function MapCanvas(props: LeafletMapProps) {
  const [MapView, setMapView] = useState<React.ComponentType<LeafletMapProps> | null>(null);

  useEffect(() => {
    let active = true;
    void import("./LeafletMap").then(({ LeafletMap }) => {
      if (active) setMapView(() => LeafletMap as React.ComponentType<LeafletMapProps>);
    });
    return () => {
      active = false;
    };
  }, []);

  return MapView ? (
    <MapView
      {...props}
      showPlaces={props.showPlaces ?? true}
      zoomable={props.zoomable ?? false}
      searchable={props.searchable ?? false}
      initialZoom={props.initialZoom ?? 13}
    />
  ) : (
    <div
      className={cn("h-full w-full animate-pulse bg-[#e8eee5]", props.className)}
      role="status"
      aria-label="Laddar karta"
    />
  );
}

export function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1">
        <span className="h-3 w-3 rounded-full border-2 border-white bg-[#E45048] shadow-sm" />
        Event
      </span>
      <span className="flex items-center gap-1">
        <span className="h-3 w-3 rounded-full border-2 border-white bg-[#0F766E] shadow-sm" />
        Plats
      </span>
      <span>Tryck på en grupp för att zooma in</span>
    </div>
  );
}
