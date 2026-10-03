import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, CalendarHeart, List, MapIcon, MapPin, Share2, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/hander/AppShell";
import { AvatarStack, CategoryChip, EventRow, priceLabel } from "@/components/hander/EventBits";
import { FilterButton, FilterSheet, QuickFilters, SortBar } from "@/components/hander/FilterSheet";
import { MapCanvas, MapLegend } from "@/components/hander/MapCanvas";
import { ShareSheet } from "@/components/hander/ShareSheet";
import {
  CATEGORY_GRADIENT,
  PLACE_TYPES,
  categoryById,
  type EventItem,
  type Place,
} from "@/lib/hander-data";
import {
  defaultFilters,
  filterEvents,
  formatDay,
  sortEvents,
  useHander,
  type Filters,
  type SortMode,
} from "@/lib/hander-store";
import { cn } from "@/lib/utils";
import { appUrl } from "@/lib/app-url";

export const Route = createFileRoute("/karta")({
  head: () => ({
    meta: [
      { title: "Karta – Händer" },
      { name: "description", content: "Se events och platser nära dig på kartan." },
      { property: "og:title", content: "Karta – Händer" },
      { property: "og:description", content: "Interaktiv karta med events och platser." },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const store = useHander();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [view, setView] = useState<"karta" | "lista">("karta");
  const [sort, setSort] = useState<SortMode>("relevans");
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  const all = useMemo(
    () => [...store.publicEvents, ...store.myPrivateEvents],
    [store.publicEvents, store.myPrivateEvents],
  );
  const events = useMemo(() => sortEvents(filterEvents(all, filters), sort), [all, filters, sort]);

  return (
    <AppShell
      title="Karta"
      subtitle={
        store.apiLoading
          ? "Läser in event från Visit Stockholm…"
          : `${events.length} event nära dig`
      }
    >
      <div className="map-page-toolbar space-y-3 px-4 py-3">
        {/* Rubrik vänsterställd, i samma stil som hem-sektionerna: prick + squiggle under. */}
        <div className="map-discover-heading">
          <h2 className="map-discover-title font-display text-xl font-bold text-foreground">Upptäck</h2>
        </div>
        {/* Toggle + filter hålls på samma rad med tydlig luft mellan knapparna. */}
        <div className="map-controls flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={view === "karta"}
            aria-label={view === "karta" ? "Visa lista" : "Visa karta"}
            onClick={() => setView(view === "karta" ? "lista" : "karta")}
            className="map-view-toggle-pill flex h-11 w-[156px] shrink-0 items-center justify-between rounded-full pl-2 pr-1.5"
          >
            <span className="flex items-center justify-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold uppercase text-[#E45048]">
              {view === "karta" ? <MapIcon className="h-4 w-4 shrink-0" /> : <List className="h-4 w-4 shrink-0" />}
              <span className="w-[42px] text-left">{view}</span>
            </span>
            <span className="map-toggle-track relative flex h-7 w-11 shrink-0 items-center justify-start rounded-full px-1" aria-hidden>
              <span className="map-toggle-knob h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-transform duration-200" style={{ transform: view === "karta" ? "translateX(0)" : "translateX(16px)" }} />
            </span>
          </button>
          <FilterButton filters={filters} onOpen={() => setSheetOpen(true)} />
        </div>
        <QuickFilters filters={filters} setFilters={setFilters} />
      </div>

      {view === "karta" ? (
        <div className="px-4">
          <div className="map-shell map-shell--accent relative h-[clamp(360px,52svh,520px)] min-h-0 overflow-hidden rounded-[22px] border shadow-[var(--shadow-float)]">
            <MapCanvas
              events={events}
              places={store.places}
              zoomable
              searchable
              showPlaces
              selectedId={selected?.id ?? selectedPlace?.id ?? null}
              onSelectEvent={(e) => {
                setSelectedPlace(null);
                setSelected(e);
              }}
              onSelectPlace={(p) => {
                setSelected(null);
                setSelectedPlace(p);
              }}
            />

          </div>
          <div className="map-info-card map-info-card--blue mt-3 space-y-2 rounded-2xl border px-3.5 py-3 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold">{events.length} träffar på kartan</p>
                <p className="text-[10px] text-muted-foreground">Tryck på en pin för att se detaljer</p>
              </div>
              <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <MapLegend />
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              Eventdata från Visit Stockholm och Visit Sweden · publika källor
            </p>
            {store.apiError && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                {store.apiError} Egna event visas fortfarande.
              </p>
            )}
          </div>

          {selected && (
            <EventSheet event={selected} onClose={() => setSelected(null)} />
          )}
          {selectedPlace && (
            <PlaceSheet place={selectedPlace} onClose={() => setSelectedPlace(null)} />
          )}
        </div>
      ) : (
        <div className="map-list-view space-y-3 px-4">
          <div className="rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Lista</p>
                <p className="mt-0.5 text-sm font-semibold">{events.length} event att välja mellan</p>
              </div>
              <List className="h-5 w-5 text-primary" aria-hidden />
            </div>
          </div>
          <SortBar sort={sort} setSort={setSort} />
          {Object.entries(
            events.reduce<Record<string, EventItem[]>>((acc, e) => {
              const key = formatDay(e.date);
              (acc[key] ||= []).push(e);
              return acc;
            }, {}),
          ).map(([day, list]) => (
            <div key={day} className="space-y-2">
              <p className="pt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {day}
              </p>
              {list.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </div>
          ))}
          {events.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Inga event matchar dina filter.
            </p>
          )}
        </div>
      )}

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        setFilters={setFilters}
      />
    </AppShell>
  );
}

/** Gemensamt bottenblad – ligger alltid ovanför kartkontroller och navigation. */
function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);

  const beginDrag = (event: React.PointerEvent) => {
    startY.current = event.clientY;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const endDrag = (event: React.PointerEvent) => {
    const distance = event.clientY - startY.current;
    setDragging(false);
    if (distance < -48) setExpanded(true);
    else if (distance > 80 && expanded) setExpanded(false);
    else if (distance > 120) onClose();
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <>
      <div
        className={cn(
          "sheet-backdrop fixed inset-0 z-[55]",
          !expanded && "pointer-events-none bg-transparent",
        )}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "sheet-panel fixed inset-x-0 bottom-0 z-[60] mx-auto w-full max-w-md overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+16px)]",
          expanded ? "max-h-[82vh]" : "max-h-[44vh]",
          dragging ? "transition-none" : "transition-[max-height] duration-200",
        )}
      >
        <div
          className="sticky top-0 z-10 flex cursor-grab touch-none items-center justify-between rounded-t-3xl bg-card/95 px-4 pb-1 pt-3 backdrop-blur active:cursor-grabbing"
          onPointerDown={beginDrag}
          onPointerUp={endDrag}
          onPointerCancel={() => setDragging(false)}
        >
          <span className="mx-auto h-1.5 w-10 rounded-full bg-border" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng"
            className="absolute right-3 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 pt-2">{children}</div>
      </div>
    </>
  );
}

function ActionRow({
  saved,
  onSave,
  onShare,
  planSearch,
  moreTo,
}: {
  saved: boolean;
  onSave: () => void;
  onShare: () => void;
  planSearch: { event?: string; place?: string };
  moreTo: React.ReactNode;
}) {
  return (
    <div className="map-sheet-actions sticky bottom-0 z-10 mt-4 space-y-2 bg-card/95 pb-2 pt-2 backdrop-blur">
      <Link
        to="/skapa"
        className="map-sheet-primary flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold"
      >
        <CalendarHeart className="h-4 w-4" /> Planera med kompisar
      </Link>
      <div className="flex gap-2">
        {moreTo}
        <button
          type="button"
          onClick={onSave}
          aria-label={saved ? "Ta bort från sparat" : "Spara"}
          className={cn(
            "map-sheet-secondary flex items-center gap-1.5 rounded-2xl px-4 py-3 text-xs font-bold",
          )}
        >
          <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
          {saved ? "Sparad" : "Spara"}
        </button>
        <button
          type="button"
          onClick={onShare}
          aria-label="Dela"
          className="map-sheet-secondary flex items-center gap-1.5 rounded-2xl px-4 py-3 text-xs font-bold"
        >
          <Share2 className="h-4 w-4" /> Dela
        </button>
      </div>
    </div>
  );
}

const origin = () => (typeof window === "undefined" ? "https://hander.app" : window.location.origin);

function EventSheet({ event, onClose }: { event: EventItem; onClose: () => void }) {
  const store = useHander();
  const [share, setShare] = useState(false);
  const cat = categoryById(event.category);
  const url = `${origin()}/event/${event.id}`;

  return (
    <>
      <Sheet onClose={onClose}>
        <div
          className="map-sheet-card map-sheet-card--red"
        >
          {event.image ? (
            <div
              className="map-sheet-cover"
              style={{ backgroundImage: `url(${event.image})` }}
            >
              <span>{priceLabel(event.price, event.priceKnown)}</span>
            </div>
          ) : (
            <div
              className="map-sheet-cover"
              style={{ background: CATEGORY_GRADIENT[event.category] }}
            >
              <span>{priceLabel(event.price, event.priceKnown)}</span>
            </div>
          )}
          <div className="space-y-4 p-4">
            <h3 className="font-display text-2xl font-bold leading-tight">{event.name}</h3>
            <CategoryChip category={event.category} />
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-secondary/70 p-3">
                <p className="text-[11px] font-bold uppercase text-muted-foreground">När</p>
                <p className="text-sm font-bold">{formatDay(event.date)}</p>
                <p className="text-sm">{event.start}–{event.end}</p>
              </div>
              <div className="rounded-2xl bg-secondary/70 p-3">
                <p className="text-[11px] font-bold uppercase text-muted-foreground">Pris</p>
                <p className="text-sm font-bold text-primary">{priceLabel(event.price, event.priceKnown)}</p>
                <p className="text-xs text-muted-foreground">Betalas på plats</p>
              </div>
            </div>
            <div className="rounded-2xl border border-border p-3">
              <p className="flex items-center gap-2 text-sm font-bold">
                <MapPin className="h-4 w-4 text-primary" /> {event.place}
              </p>
              <p className="ml-6 text-xs text-muted-foreground">
                {event.address} · {event.distance} km bort
              </p>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{event.description}</p>
            <div className="flex items-center gap-2">
              <AvatarStack ids={event.interested} />
              <span className="text-xs text-muted-foreground">
                {store.interestedCount(event)}{" "}
                {store.interestedCount(event) === 1 ? "person är" : "personer är"} intresserade
              </span>
            </div>
          </div>
        </div>

        <ActionRow
          saved={store.saved.includes(event.id)}
          onSave={() => store.toggleSaved(event.id)}
          onShare={() => setShare(true)}
          planSearch={{ event: event.id }}
          moreTo={
            <Link
              to="/event/$id"
              params={{ id: event.id }}
              className="map-sheet-ghost flex-1 rounded-2xl px-4 py-3 text-center text-xs font-bold"
            >
              Visa mer
            </Link>
          }
        />
      </Sheet>
      <ShareSheet
        open={share}
        onClose={() => setShare(false)}
        preview={{
          tagline: "Kolla vad som händer! 👀",
          title: event.name,
          emoji: cat.emoji,
          gradient: CATEGORY_GRADIENT[event.category],
          meta: `${formatDay(event.date)} ${event.start} · ${event.place}`,
          cta: "Öppna eventet",
          url,
          displayUrl: appUrl(`/event/${event.id}`),
          shareText: `${event.name} – ${formatDay(event.date)} ${event.start} på ${event.place}`,
        }}
      />
    </>
  );
}

function PlaceSheet({ place, onClose }: { place: Place; onClose: () => void }) {
  const store = useHander();
  const [share, setShare] = useState(false);
  const meta = PLACE_TYPES[place.type];
  const url = `${origin()}/karta?plats=${place.id}`;

  return (
    <>
      <Sheet onClose={onClose}>
        <div className="map-sheet-card map-sheet-card--blue">
          <div
            className="map-sheet-cover"
            style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}99)` }}
          >
            <span>{meta.label}</span>
          </div>
          <div className="space-y-1 p-3.5">
            <h3 className="font-display text-xl font-bold leading-tight">{place.name}</h3>
            <p className="text-sm text-muted-foreground">{place.description}</p>
          </div>
        </div>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted-foreground">Plats</dt>
            <dd className="min-w-0">{place.address}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted-foreground">Avstånd</dt>
            <dd>{place.distance} km bort</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted-foreground">Öppettider</dt>
            <dd>{place.open}</dd>
          </div>
          {place.price && (
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-muted-foreground">Pris</dt>
              <dd className="font-bold text-primary">{place.price}</dd>
            </div>
          )}
          {place.contact && (
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-muted-foreground">Kontakt</dt>
              <dd className="min-w-0 break-words">{place.contact}</dd>
            </div>
          )}
          {place.link && (
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-muted-foreground">Länk</dt>
              <dd className="min-w-0 break-all">
                <a href={place.link} target="_blank" rel="noreferrer" className="text-primary underline">
                  {place.link.replace(/^https?:\/\//, "")}
                </a>
              </dd>
            </div>
          )}
        </dl>

        <ActionRow
          saved={store.savedPlaces.includes(place.id)}
          onSave={() => store.toggleSavedPlace(place.id)}
          onShare={() => setShare(true)}
          planSearch={{ place: place.id }}
          moreTo={
            place.link ? (
              <a
                href={place.link}
                target="_blank"
                rel="noreferrer"
                className="map-sheet-ghost flex-1 rounded-2xl px-4 py-3 text-center text-xs font-bold"
              >
                Visa mer
              </a>
            ) : null
          }
        />
      </Sheet>
      <ShareSheet
        open={share}
        onClose={() => setShare(false)}
        preview={{
          tagline: "Visste ni att det här finns? 👀",
          title: place.name,
          emoji: meta.emoji,
          gradient: `linear-gradient(135deg, ${meta.color}, ${meta.color}99)`,
          meta: `${meta.label} · ${place.address}`,
          cta: "Se på kartan",
          url,
          displayUrl: appUrl(`/plats/${place.id}`),
          shareText: `${place.name} – ${meta.label} på ${place.address}`,
        }}
      />
    </>
  );
}
