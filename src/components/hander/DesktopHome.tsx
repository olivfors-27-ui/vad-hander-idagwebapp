import { Link } from "@tanstack/react-router";
import { Bookmark, CalendarDays, Clock, Heart, MapPin, Share2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { EventCover, priceLabel } from "@/components/hander/EventBits";
import { ShareSheet, absoluteUrl } from "@/components/hander/ShareSheet";
import {
  CATEGORY_GRADIENT,
  categoryById,
  userById,
  weekendDates,
  type EventItem,
} from "@/lib/hander-data";
import { formatDay, isEventVisible, isHappeningNow, useHander } from "@/lib/hander-store";
import { isTemporaryEvent } from "@/lib/event-source";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 5;

type Bubble = "allt" | "live" | "helg" | "gratis" | "populart";

/** Kort relativ tid för "publicerad"-raden. */
function timeAgo(iso?: string | undefined): string {
  if (!iso) return "nyligen";
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "nyligen";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "nyss";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} tim`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;
  return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

export function DesktopHome() {
  const store = useHander();
  const [bubble, setBubble] = useState<Bubble>("allt");
  const [sponsoredBubble, setSponsoredBubble] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const feed = useMemo(() => {
    const all = store.publicEvents.filter(isEventVisible);
    const weekend = new Set(weekendDates());
    switch (bubble) {
      case "live":
        return all.filter((event) => isHappeningNow(event));
      case "helg":
        return all.filter((event) => weekend.has(event.date));
      case "gratis":
        return all.filter((event) => event.price === 0 && event.priceKnown !== false);
      case "populart":
        return [...all].sort((a, b) => b.interested.length - a.interested.length);
      default:
        return all;
    }
  }, [bubble, store.publicEvents]);

  const sponsored = useMemo(() => store.sponsoredEvents.filter(isEventVisible), [store.sponsoredEvents]);

  const shown = useMemo(() => {
    if (sponsoredBubble) {
      const event = sponsored.find((item) => item.id === sponsoredBubble);
      return event ? [event] : [];
    }
    return feed.slice(0, visible);
  }, [feed, sponsored, sponsoredBubble, visible]);

  const selectBubble = (next: Bubble) => {
    setSponsoredBubble(null);
    setBubble(next);
    setVisible(PAGE_SIZE);
  };


  const loading = !store.hydrated && store.publicEvents.length === 0;

  return (
    <div className="hander-home">
      <header className="hander-home-head">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Vad Händer Idag?</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Hitta skoj i Stockholm idag</p>
        </div>
        <Link
          to="/skapa"
          className="hander-home-create"
          aria-label="Skapa event"
          title="Skapa event"
        >
          <Sparkles className="h-4 w-4" /> Skapa
        </Link>
      </header>

      <div className="hander-bubbles" aria-label="Snabbfilter">
        <BubbleButton
          label="Just nu"
          emoji="📍"
          gradient="linear-gradient(135deg,#E45048,#E7A057)"
          active={!sponsoredBubble && bubble === "live"}
          onClick={() => selectBubble("live")}
        />
        <BubbleButton
          label="I helgen"
          emoji="🎉"
          gradient="linear-gradient(135deg,#465BC4,#627BD8)"
          active={!sponsoredBubble && bubble === "helg"}
          onClick={() => selectBubble("helg")}
        />
        <BubbleButton
          label="Gratis"
          emoji="🎟"
          gradient="linear-gradient(135deg,#E7A057,#EAB24F)"
          active={!sponsoredBubble && bubble === "gratis"}
          onClick={() => selectBubble("gratis")}
        />
        <BubbleButton
          label="Populärt"
          emoji="🔥"
          gradient="linear-gradient(135deg,#E57657,#EAB24F)"
          active={!sponsoredBubble && bubble === "populart"}
          onClick={() => selectBubble("populart")}
        />
        {sponsored.slice(0, 3).map((event) => (
          <BubbleButton
            key={event.id}
            label={event.name}
            emoji={categoryById(event.category).emoji}
            image={event.image}
            gradient={CATEGORY_GRADIENT[event.category]}
            sponsored
            active={sponsoredBubble === event.id}
            onClick={() => {
              setSponsoredBubble(event.id);
              setVisible(PAGE_SIZE);
            }}
          />
        ))}
        {sponsoredBubble && (
          <button
            type="button"
            onClick={() => selectBubble("allt")}
            className="shrink-0 self-center rounded-full bg-secondary px-3 py-1.5 text-xs font-bold"
          >
            Visa allt
          </button>
        )}
      </div>

      <div className="hander-feed">
        {loading && <FeedSkeleton />}

        {!loading && store.apiError && store.publicEvents.length === 0 && (
          <div className="hander-feed-state">
            <p className="text-sm font-bold">Kunde inte hämta event</p>
            <p className="mt-1 text-xs text-muted-foreground">{store.apiError}</p>
          </div>
        )}

        {!loading && !store.apiError && shown.length === 0 && (
          <div className="hander-feed-state">
            <p className="text-sm font-bold">Inget att visa här än</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {sponsoredBubble
                ? "Det sponsrade eventet visas inte längre."
                : "Prova ett annat filter, eller skapa något själv."}
            </p>
            <Link to="/skapa" className="mt-3 inline-block text-sm font-bold text-primary">
              Skapa event →
            </Link>
          </div>
        )}

        {shown.map((event) => (
          <FeedCard key={event.id} event={event} />
        ))}

        {!sponsoredBubble && feed.length > shown.length && (
          <button
            type="button"
            onClick={() => setVisible((count) => count + PAGE_SIZE)}
            className="hander-load-more"
          >
            Visa fler event
          </button>
        )}
      </div>
    </div>
  );
}

function BubbleButton({
  label,
  emoji,
  image,
  gradient,
  active,
  sponsored,
  onClick,
}: {
  label: string;
  emoji?: string;
  image?: string | undefined;
  gradient: string;
  active: boolean;
  sponsored?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("hander-bubble", active && "is-active")}
      title={label}
    >
      <span className="hander-bubble-ring" style={{ background: sponsored ? "#E57657" : gradient }}>
        <span className="hander-bubble-inner">
          {image ? (
            <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden>{emoji}</span>
          )}
        </span>
      </span>
      <span className="hander-bubble-label">{label}</span>
    </button>
  );
}

function FeedCard({ event }: { event: EventItem }) {
  const store = useHander();
  const [shareOpen, setShareOpen] = useState(false);
  const isInterested = store.interested.includes(event.id);
  const isSaved = store.saved.includes(event.id);
  const category = categoryById(event.category);
  const organizer = userById(event.organizerId, event.organizerName);
  const organizerName =
    event.organizerId === "visit-stockholm"
      ? "Visit Stockholm"
      : event.organizerName?.trim() || organizer.name;
  const temporary = isTemporaryEvent(event);

  return (
    <article className="hander-feed-card">
      <header className="flex items-center gap-3 px-4 py-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-background text-white"
          style={{ background: organizer.color }}
          aria-hidden
        >
          <span className="text-lg">{organizer.avatar}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold leading-tight">{organizerName}</p>
          {temporary && <span className="sr-only">Temporärt event från Visit Stockholm.</span>}
          <p className="truncate text-[11px] text-muted-foreground">
            {category.emoji} {category.label} · {timeAgo(event.createdAt)}
          </p>
        </div>
        {(event.sponsored || event.promoted) && (
          <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-foreground">
            Sponsrat
          </span>
        )}
      </header>

      <Link to="/event/$id" params={{ id: event.id }} aria-label={`Öppna ${event.name}`}>
        <EventCover event={event} className="aspect-[4/3] w-full" />
      </Link>

      <div className="space-y-3 p-4">
        <div>
          <Link
            to="/event/$id"
            params={{ id: event.id }}
            className="font-display text-lg font-extrabold leading-tight hover:text-primary"
          >
            {event.name}
          </Link>
          {event.description && (
            <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-foreground/85">
              {event.description}
            </p>
          )}
        </div>

        <dl className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
            <dt className="sr-only">Datum och tid</dt>
            <dd>
              {formatDay(event.date)} · {event.start}
              {event.end ? `–${event.end}` : ""}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            <dt className="sr-only">Plats</dt>
            <dd className="min-w-0">
              <span className="font-semibold">{event.place}</span>
              {event.address ? (
                <span className="text-muted-foreground"> · {event.address}</span>
              ) : null}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-primary" />
            <dt className="sr-only">Pris</dt>
            <dd className="font-bold text-primary">{priceLabel(event.price, event.priceKnown)}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => store.toggleInterested(event.id)}
            aria-pressed={isInterested}
            className={cn("hander-action", isInterested && "is-on")}
          >
            <Heart className={cn("h-4 w-4", isInterested && "fill-current")} /> Intresserad
          </button>
          <button
            type="button"
            onClick={() => store.toggleSaved(event.id)}
            aria-pressed={isSaved}
            aria-label={isSaved ? "Ta bort från sparat" : "Spara event"}
            className={cn("hander-action", isSaved && "is-on")}
          >
            <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} /> Spara
          </button>
          <button
            type="button"
            onClick={() => {
              store.track(event.id, "shares");
              setShareOpen(true);
            }}
            className="hander-action"
            aria-label={`Dela ${event.name}`}
          >
            <Share2 className="h-4 w-4" /> Dela
          </button>
          <Link
            to="/event/$id"
            params={{ id: event.id }}
            className="ml-auto text-sm font-bold text-primary"
          >
            Öppna
          </Link>
        </div>
      </div>

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        preview={{
          tagline: "Kolla in det här! 👀",
          title: event.name,
          emoji: category.emoji,
          gradient: CATEGORY_GRADIENT[event.category],
          meta: `${formatDay(event.date)} ${event.start} · ${event.place}`,
          cta: "Tryck för att se eventet i Händer.",
          url: absoluteUrl(`/event/${event.id}`),
          displayUrl: absoluteUrl(`/event/${event.id}`),
          shareText: `Kolla in ${event.name} – ${formatDay(event.date)} ${event.start} på ${event.place}!`,
        }}
      />
    </article>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      {[0, 1].map((key) => (
        <div key={key} className="hander-feed-card animate-pulse">
          <div className="flex items-center gap-3 p-4">
            <span className="h-10 w-10 rounded-full bg-secondary" />
            <span className="h-3 w-32 rounded-full bg-secondary" />
          </div>
          <div className="aspect-[4/3] w-full bg-secondary" />
          <div className="space-y-2 p-4">
            <span className="block h-4 w-2/3 rounded-full bg-secondary" />
            <span className="block h-3 w-full rounded-full bg-secondary" />
          </div>
        </div>
      ))}
    </div>
  );
}
