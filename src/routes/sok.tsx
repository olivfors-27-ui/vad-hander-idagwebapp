import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/hander/AppShell";
import { Avatar, EventRow } from "@/components/hander/EventBits";
import { FilterButton, FilterSheet, QuickFilters, SortBar } from "@/components/hander/FilterSheet";
import {
  CATEGORIES,
  DISCOVERY_TYPES,
  PLACE_TYPES,
  USERS,
  categoryById,
  type CategoryId,
  type Place,
} from "@/lib/hander-data";
import {
  defaultFilters,
  filterEvents,
  sortEvents,
  useHander,
  type Filters,
  type SortMode,
} from "@/lib/hander-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sok")({
  head: () => ({
    meta: [
      { title: "Sök – Händer" },
      {
        name: "description",
        content: "Sök efter event, aktiviteter, platser, adresser, kategorier och personer.",
      },
      { property: "og:title", content: "Sök – Händer" },
      { property: "og:description", content: "Hitta exakt det du är sugen på ikväll." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const store = useHander();
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sort, setSort] = useState<SortMode>("relevans");
  const [sheetOpen, setSheetOpen] = useState(false);
  const query = q.trim().toLowerCase();

  const allEvents = useMemo(
    () => [...store.publicEvents, ...store.myPrivateEvents],
    [store.publicEvents, store.myPrivateEvents],
  );

  const events = useMemo(() => {
    const base = filterEvents(allEvents, filters);
    const matched = query
      ? base.filter((e) =>
          `${e.name} ${e.place} ${e.address} ${e.description} ${e.category} ${
            categoryById(e.category).label
          }`
            .toLowerCase()
            .includes(query),
        )
      : base;
    return sortEvents(matched, sort);
  }, [allEvents, filters, query, sort]);

  const matchPlace = (p: Place) =>
    `${p.name} ${p.description} ${p.address} ${PLACE_TYPES[p.type].label}`
      .toLowerCase()
      .includes(query);

  const activities = query
    ? store.places.filter((p) => DISCOVERY_TYPES.includes(p.type) && matchPlace(p))
    : [];
  const places = query
    ? store.places.filter((p) => !DISCOVERY_TYPES.includes(p.type) && matchPlace(p))
    : [];
  const users = query
    ? USERS.filter((u) => `${u.name} ${u.username} ${u.bio}`.toLowerCase().includes(query))
    : [];
  const cats = query
    ? CATEGORIES.filter((c) => c.label.toLowerCase().includes(query) || c.id.includes(query))
    : [];

  const toggleCat = (id: CategoryId) =>
    setFilters({
      ...filters,
      categories: filters.categories.includes(id)
        ? filters.categories.filter((x) => x !== id)
        : [...filters.categories, id],
    });

  const nothing =
    query && !events.length && !places.length && !activities.length && !users.length && !cats.length;

  return (
    <AppShell title="Sök" subtitle="Hitta något att göra!">
      <div className="space-y-5 p-4">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sök event, aktivitet, plats, adress eller person"
            className="flex-1 bg-transparent text-sm outline-none"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Rensa sökning">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FilterButton filters={filters} onOpen={() => setSheetOpen(true)} />
            <span className="text-xs text-muted-foreground">{events.length} event</span>
          </div>
          <QuickFilters filters={filters} setFilters={setFilters} />
          <SortBar sort={sort} setSort={setSort} />
        </div>

        {cats.length > 0 && (
          <Group title="Kategorier">
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCat(c.id)}
                  className={cn(
                    "rounded-full min-h-9 px-3.5 py-2 text-xs font-bold",
                    filters.categories.includes(c.id)
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-accent-foreground",
                  )}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </Group>
        )}

        <Group title={`Event (${events.length})`}>
          {events.length ? (
            <div className="space-y-2">
              {events.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Inga event matchar sökning och filter.</p>
          )}
        </Group>

        {activities.length > 0 && (
          <Group title={`Aktiviteter (${activities.length})`}>
            <div className="space-y-2">
              {activities.map((p) => (
                <PlaceRow key={p.id} place={p} />
              ))}
            </div>
          </Group>
        )}

        {places.length > 0 && (
          <Group title="Platser & adresser">
            <div className="space-y-2">
              {places.map((p) => (
                <PlaceRow key={p.id} place={p} />
              ))}
            </div>
          </Group>
        )}

        {users.length > 0 && (
          <Group title="Personer">
            <div className="space-y-2">
              {users.map((u) => (
                <Link
                  key={u.id}
                  to="/anvandare/$username"
                  params={{ username: u.username.replace("@", "") }}
                  className="flex items-center gap-3 rounded-2xl border border-border p-3"
                >
                  <Avatar user={u} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{u.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Group>
        )}

        {nothing && (
          <p className="py-10 text-center text-sm text-muted-foreground">Inga träffar för "{q}".</p>
        )}
      </div>

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        setFilters={setFilters}
      />
    </AppShell>
  );
}

function PlaceRow({ place }: { place: Place }) {
  const store = useHander();
  const saved = store.savedPlaces.includes(place.id);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
      <span className="text-xl">{PLACE_TYPES[place.type].emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{place.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {PLACE_TYPES[place.type].label} · {place.distance} km
        </p>
        <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" /> {place.address}
        </p>
      </div>
      <button
        type="button"
        onClick={() => store.toggleSavedPlace(place.id)}
        className={cn(
          "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold",
          saved ? "bg-primary text-primary-foreground" : "bg-secondary",
        )}
      >
        {saved ? "Sparad" : "Spara"}
      </button>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </section>
  );
}
