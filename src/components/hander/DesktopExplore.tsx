import { Link, useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EventCover } from "@/components/hander/EventBits";
import { CategoryChip, SponsoredBadge } from "@/components/hander/EventBits";
import { categoryById } from "@/lib/hander-data";
import {
  defaultFilters,
  filterEvents,
  formatDay,
  isEventVisible,
  useHander,
} from "@/lib/hander-store";
import { cn } from "@/lib/utils";

type Tab = "for-dig" | "inte-personaliserad";

export function DesktopExplore({ initialQuery = "" }: { initialQuery?: string }) {
  const store = useHander();
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState<Tab>("for-dig");
  const [limit, setLimit] = useState(40);

  useEffect(() => setLimit(40), [query, tab]);

  const results = useMemo(() => {
    const all = [...store.publicEvents, ...store.myPrivateEvents].filter(isEventVisible);
    const filtered = filterEvents(all, { ...defaultFilters, query: query.trim() });
    const term = query.trim().toLowerCase();
    const matched = term
      ? filtered.filter((event) =>
          `${event.name} ${event.place} ${event.address} ${event.description} ${
            categoryById(event.category).label
          }`
            .toLowerCase()
            .includes(term),
        )
      : filtered;

    return [...matched].sort((a, b) =>
      tab === "for-dig"
        ? b.interested.length - a.interested.length || a.date.localeCompare(b.date)
        : `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`),
    );
  }, [query, store.myPrivateEvents, store.publicEvents, tab]);

  const submit = () => {
    const term = query.trim();
    void navigate({ to: "/sok", search: term ? { q: term } : {} });
  };

  return (
    <div className="hander-explore">
      <div className="hander-explore-search">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          placeholder="Sök event, plats eller person"
          aria-label="Sök event, plats eller person"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Rensa sökning"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-5 flex items-center gap-6 border-b border-border">
        {(
          [
            ["for-dig", "För dig"],
            ["inte-personaliserad", "Inte personaliserad"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={cn("hander-explore-tab", tab === id && "is-active")}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {results.length} {results.length === 1 ? "event" : "event"}
        {query ? ` för “${query}”` : ""}
      </p>

      {store.apiLoading && results.length === 0 ? (
        <div className="hander-explore-grid mt-3" aria-hidden>
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="hander-explore-tile animate-pulse bg-secondary" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="hander-feed-state mt-4">
          <p className="text-sm font-bold">Inga event matchar</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Prova en annan sökning, eller gå tillbaka till flödet.
          </p>
          <Link to="/" className="mt-3 inline-block text-sm font-bold text-primary">
            Till flödet →
          </Link>
        </div>
      ) : (
        <div className="hander-explore-grid mt-3">
          {results.slice(0, limit).map((event, index) => (
            <Link
              key={event.id}
              to="/event/$id"
              params={{ id: event.id }}
              className={cn("hander-explore-tile", index % 5 === 1 && "is-tall")}
              aria-label={`${event.name}, ${formatDay(event.date)}`}
            >
              <EventCover event={event} className="h-full w-full" />
              <span className="hander-explore-overlay" aria-hidden>
                <span className="block text-xs font-extrabold leading-tight">{event.name}</span>
                <span className="mt-0.5 block text-[11px] opacity-90">
                  {formatDay(event.date)} · {event.start}
                </span>
              </span>
              <span className="hander-explore-badges">
                {event.sponsored || event.promoted ? <SponsoredBadge tone="onMedia" /> : null}
                <span className="rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-bold">
                  {categoryById(event.category).emoji}
                </span>
              </span>
              <span className="sr-only">
                <CategoryChip category={event.category} />
              </span>
            </Link>
          ))}
        </div>
      )}

      {results.length > limit && (
        <button type="button" onClick={() => setLimit((n) => n + 40)} className="hander-load-more mt-4">
          Visa fler event
        </button>
      )}
    </div>
  );
}
