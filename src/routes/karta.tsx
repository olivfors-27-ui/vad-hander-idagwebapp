import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bookmark,
  Building2,
  CalendarHeart,
  Layers,
  List,
  Map as MapIcon,
  MapPin,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/hander/AppShell";
import { AvatarStack, CategoryChip, EventRow, priceLabel } from "@/components/hander/EventBits";
import { FilterButton, FilterSheet, QuickFilters, SortBar } from "@/components/hander/FilterSheet";
import { MapCanvas } from "@/components/hander/MapCanvas";
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
import { useIsLoggedIn } from "@/lib/auth-guard";
import { cn } from "@/lib/utils";
import { appUrl } from "@/lib/app-url";

export const Route = createFileRoute("/karta")({
  head: () => ({
    meta: [
      { title: "Karta – Tagalong" },
      { name: "description", content: "Se events och platser nära dig på kartan." },
      { property: "og:title", content: "Karta – Tagalong" },
      { property: "og:description", content: "Interaktiv karta med events och platser." },
    ],
  }),
  component: MapPage,
});

/** Vy-växlarens två lägen. */
type MapView = "karta" | "lista";
/** Vad som ska visas: tillfälliga event, fasta platser eller båda. */
type ContentMode = "event" | "plats" | "bada";

function MapPage() {
  const store = useHander();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [view, setView] = useState<MapView>("karta");
  const [mode, setMode] = useState<ContentMode>("bada");
  const [sort, setSort] = useState<SortMode>("relevans");
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [overlayHeight, setOverlayHeight] = useState(112);

  const all = useMemo(
    () => [...store.publicEvents, ...store.myPrivateEvents],
    [store.publicEvents, store.myPrivateEvents],
  );
  const events = useMemo(() => sortEvents(filterEvents(all, filters), sort), [all, filters, sort]);

  const showEvents = mode !== "plats";
  const showPlaces = mode !== "event";
  const places = store.places;

  // Filteroverlayn ligger ovanpå kartan. Vi mäter dess höjd så att sökfältet i
  // kartan läggs precis under filtren i stället för att hamna bakom dem.
  useEffect(() => {
    if (view !== "karta") return;
    const node = overlayRef.current;
    if (!node) return;
    const measure = () => setOverlayHeight(Math.ceil(node.getBoundingClientRect().height));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [view]);

  return (
    <AppShell
      title="Karta"
      subtitle={
        store.apiLoading
          ? "Läser in event från Visit Stockholm…"
          : mode === "plats"
            ? `${places.length} fasta platser`
            : mode === "bada"
              ? `${events.length} event · ${places.length} platser`
              : `${events.length} event nära dig`
      }
    >
      {/* Verktygsraden hör bara till listvyn – i kartvyn ligger filtren som overlay
          ovanpå kartan i stället och tar ingen plats i layouten. */}
      {view === "lista" && (
        <div className="map-page-toolbar space-y-3 px-4 py-3">
          {/* Rubrik vänsterställd, i samma stil som hem-sektionerna: prick + squiggle under. */}
          <div className="map-discover-heading">
            <h2 className="map-discover-title font-display text-xl font-bold text-foreground">
              Upptäck
            </h2>
          </div>
          {/* Samma växlare som i kartvyn, följd av innehållsvalen och filtret. */}
          <div className="map-controls flex flex-wrap items-center gap-2">
            <ViewSwitch view={view} onChange={setView} />
            <ContentModeSwitch mode={mode} onChange={setMode} />
            <FilterButton filters={filters} onOpen={() => setSheetOpen(true)} />
          </div>
          <QuickFilters filters={filters} setFilters={setFilters} />
        </div>
      )}

      {view === "karta" ? (
        /* Helskärm: kartan täcker hela fliken (även bakom den flytande tabbaren)
           och filtren ligger som ett overlay högst upp i stället för att ta plats. */
        /* z-0 gör kartan till en egen stacking context: alla Leaflet-lager (panes
           och kontroller har z-index 400–700) stannar då under appens egna ytor,
           så att t.ex. filterbladet hamnar ovanpå kartan i stället för bakom. */
        <div className="absolute inset-0 z-0 overflow-hidden bg-[#e8eee5]">
          <div className="absolute inset-0">
            <MapCanvas
              events={showEvents ? events : []}
              places={places}
              zoomable
              searchable
              showPlaces={showPlaces}
              selectedId={selected?.id ?? selectedPlace?.id ?? null}
              searchTop={overlayHeight + 8}
              bottomInset={96}
              onSelectEvent={(event) => {
                void navigate({ to: "/event/$id", params: { id: event.id } });
              }}
              onSelectPlace={(p) => {
                setSelected(null);
                setSelectedPlace(p);
              }}
            />
          </div>

          {/* Filteroverlay. pointer-events-none på ramen så att kartan går att
              panorera i glappet mellan ytorna; själva korten fångar egna klick. */}
          <div
            ref={overlayRef}
            className="pointer-events-none absolute inset-x-0 top-0 z-[600] flex flex-col gap-2 px-3 pb-2"
            style={{ paddingTop: "max(10px, env(safe-area-inset-top))" }}
          >
            <div className="pointer-events-auto space-y-2 rounded-3xl border border-white/70 bg-white/80 p-2 shadow-[0_12px_30px_-18px_rgba(23,32,42,0.55)] backdrop-blur-xl">
              <div className="flex flex-wrap items-center gap-2">
                <ViewSwitch view={view} onChange={setView} />
                <ContentModeSwitch mode={mode} onChange={setMode} />
                <FilterButton filters={filters} onOpen={() => setSheetOpen(true)} />
              </div>
              <QuickFilters filters={filters} setFilters={setFilters} />
            </div>
          </div>

          {/* Liten kreditrad ovanför tabbaren – ersätter det gamla infokortet. */}
          <div
            className="pointer-events-none absolute inset-x-0 z-[550] flex px-3"
            style={{ bottom: "calc(92px + env(safe-area-inset-bottom))" }}
          >
            <span className="rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-semibold text-foreground/60 shadow-sm backdrop-blur">
              {showEvents ? `${events.length} event` : ""}
              {showEvents && showPlaces ? " · " : ""}
              {showPlaces ? `${places.length} platser` : ""} · Eventdata från Visit Stockholm
            </span>
          </div>

          {/* Kort hint när Platser-läget är valt men datan ännu är tom. */}
          {showPlaces && !showEvents && places.length === 0 && (
            <div
              className="pointer-events-none absolute inset-x-0 z-[550] flex justify-center px-3"
              style={{ bottom: "calc(132px + env(safe-area-inset-bottom))" }}
            >
              <span className="max-w-[22rem] rounded-2xl border border-border/60 bg-white/95 px-3 py-2 text-center text-[11px] font-semibold text-foreground/80 shadow-[0_8px_20px_-12px_rgba(23,32,42,0.45)] backdrop-blur">
                Inga fasta platser än – föreslå en plats så granskas den och dyker upp här.
              </span>
            </div>
          )}

        </div>
      ) : (
        <div className="map-list-view space-y-3 px-4">
          <div className="rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Lista</p>
                <p className="mt-0.5 text-sm font-semibold">
                  {showEvents && showPlaces
                    ? `${events.length} event och ${places.length} platser`
                    : showEvents
                      ? `${events.length} event att välja mellan`
                      : `${places.length} fasta platser`}
                </p>
              </div>
              <List className="h-5 w-5 text-primary" aria-hidden />
            </div>
          </div>
          {showEvents && <SortBar sort={sort} setSort={setSort} />}
          {showEvents &&
            Object.entries(
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
          {showEvents && events.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Inga event matchar dina filter.
            </p>
          )}

          {showPlaces && (
            <div className="space-y-2">
              <p className="pt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Fasta platser
              </p>
              {places.length === 0 && (
                <p className="rounded-2xl border border-dashed border-border bg-card px-3 py-4 text-sm text-muted-foreground">
                  Inga fasta platser än. Föreslå en plats så granskas den och dyker upp här.
                </p>
              )}
              {places.map((place) => (
                <PlaceRow
                  key={place.id}
                  place={place}
                  onOpen={() => setSelectedPlace(place)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {selectedPlace && (
        <PlaceSheet place={selectedPlace} onClose={() => setSelectedPlace(null)} />
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

/**
 * Samma knapp i list- och kartvyn: en pill som växlar mellan lägena och visar
 * vilket läge man är i. Tidigare hade kartvyn en egen fyrkantig ikonknapp.
 */
function ViewSwitch({ view, onChange }: { view: MapView; onChange: (view: MapView) => void }) {
  const showingMap = view === "karta";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={showingMap}
      aria-label={showingMap ? "Visa lista" : "Visa karta"}
      onClick={() => onChange(showingMap ? "lista" : "karta")}
      className="map-view-toggle-pill flex h-11 w-[156px] shrink-0 items-center justify-between rounded-full pl-2 pr-1.5"
    >
      <span className="flex items-center justify-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold uppercase text-[#E45048]">
        {showingMap ? (
          <MapIcon className="h-4 w-4 shrink-0" />
        ) : (
          <List className="h-4 w-4 shrink-0" />
        )}
        <span className="w-[42px] text-left">{showingMap ? "karta" : "lista"}</span>
      </span>
      <span
        className="map-toggle-track relative flex h-7 w-11 shrink-0 items-center justify-start rounded-full px-1"
        aria-hidden
      >
        <span
          className="map-toggle-knob h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-transform duration-200"
          style={{ transform: showingMap ? "translateX(0px)" : "translateX(16px)" }}
        />
      </span>
    </button>
  );
}

/** Innehållsval: bara tillfälliga event, bara fasta platser eller båda. */
const CONTENT_MODES: {
  id: ContentMode;
  label: string;
  icon: typeof Sparkles;
  color: string;
}[] = [
  { id: "event", label: "Event", icon: Sparkles, color: "#E45048" },
  { id: "plats", label: "Platser", icon: Building2, color: "#0F766E" },
  { id: "bada", label: "Båda", icon: Layers, color: "#394fc4" },
];

function ContentModeSwitch({
  mode,
  onChange,
}: {
  mode: ContentMode;
  onChange: (mode: ContentMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Vad som visas"
      className="no-scrollbar flex shrink-0 items-center gap-1.5 overflow-x-auto"
    >
      {CONTENT_MODES.map(({ id, label, icon: Icon, color }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(id)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors",
              active ? "text-white shadow-[var(--shadow-card)]" : "border border-border bg-card text-foreground",
            )}
            style={active ? { backgroundColor: color, color: "#ffffff", fontWeight: 700 } : undefined}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Rad för en fast plats i listvyn. */
function PlaceRow({ place, onOpen }: { place: Place; onOpen: () => void }) {
  const meta = PLACE_TYPES[place.type];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-[var(--shadow-card)] transition-colors hover:bg-secondary/60"
    >
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{ backgroundColor: `${meta.color}1f` }}
        aria-hidden
      >
        {meta.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{place.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {meta.label} · {place.address} · {place.distance} km
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-[11px] font-bold">
        {place.open}
      </span>
    </button>
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
          "sheet-backdrop fixed inset-0 z-[700]",
          !expanded && "pointer-events-none bg-transparent",
        )}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "sheet-panel fixed inset-x-0 bottom-0 z-[710] mx-auto w-full max-w-md overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+16px)]",
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
  // UI-guard: "Planera med kompisar" kräver inloggning.
  const loggedIn = useIsLoggedIn();
  return (
    <div className="map-sheet-actions sticky bottom-0 z-10 mt-4 space-y-2 bg-card/95 pb-2 pt-2 backdrop-blur">
      {loggedIn && (
        <Link
          to="/skapa"
          className="map-sheet-primary flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold"
        >
          <CalendarHeart className="h-4 w-4" /> Planera med kompisar
        </Link>
      )}
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
