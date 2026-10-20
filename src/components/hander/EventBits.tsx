import { Link } from "@tanstack/react-router";
import { Bookmark, Heart, Lock, MapPin, Share2, Sparkles, User as UserIcon, Users } from "lucide-react";
import { useEffect, useState } from "react";
import type { SyntheticEvent } from "react";
import { ShareSheet, absoluteUrl } from "@/components/hander/ShareSheet";
import {
  CATEGORY_GRADIENT,
  categoryById,
  userById,
  type EventItem,
  type User,
} from "@/lib/hander-data";
import { useGoCreate } from "@/lib/auth-guard";
import { formatDay, isHappeningNow, useHander } from "@/lib/hander-store";
import { cn } from "@/lib/utils";

export function Avatar({ user, size = 32 }: { user: User; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-background text-white"
      style={{ width: size, height: size, background: user.color }}
      title={user.name}
    >
      <UserIcon className="h-[58%] w-[58%]" strokeWidth={2.2} />
    </span>
  );
}

export function AvatarStack({ ids, max = 4 }: { ids: string[]; max?: number }) {
  const shown = ids.slice(0, max);
  return (
    <span className="flex items-center -space-x-2">
      {shown.map((id) => (
        <Avatar key={id} user={userById(id)} size={26} />
      ))}
      {ids.length > max && (
        <span className="ml-3 text-xs text-muted-foreground">+{ids.length - max}</span>
      )}
    </span>
  );
}

export function MaybeEventLink({
  eventId,
  className,
  children,
}: {
  eventId?: string | undefined;
  className?: string;
  children: React.ReactNode;
}) {
  if (eventId) {
    return (
      <Link to="/event/$id" params={{ id: eventId }} className={className}>
        {children}
      </Link>
    );
  }
  return <div className={className}>{children}</div>;
}

/** Diskret, professionell märkning för sponsrat innehåll. */
export function SponsoredBadge({
  className,
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "onMedia";
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone === "onMedia"
          ? "bg-background/90 text-muted-foreground backdrop-blur-sm"
          : "bg-secondary text-muted-foreground",
        className,
      )}
    >
      <Sparkles className="h-3 w-3 shrink-0 text-primary" />
      <span className="truncate">Sponsrat</span>
    </span>
  );
}

export function CategoryChip({ category }: { category: EventItem["category"] }) {
  const c = categoryById(category);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
      {c.emoji} {c.label}
    </span>
  );
}

export function priceLabel(price: number, priceKnown = true) {
  if (!priceKnown) return "Pris hos arrangören";
  return price === 0 ? "Gratis" : `${price} kr`;
}

export function PriceLabel({ event, className }: { event: EventItem; className?: string }) {
  const label = priceLabel(event.price, event.priceKnown);
  if (!event.priceKnown || !event.sourceUrl) {
    return <span className={className}>{label}</span>;
  }
  return (
    <a
      href={event.sourceUrl}
      target="_blank"
      rel="noreferrer"
      className={cn(className, "underline-offset-2 hover:underline")}
      onClick={(clickEvent) => clickEvent.stopPropagation()}
    >
      {label}
    </a>
  );
}

/**
 * Hämtar en riktig eventbild från arrangörens officiella sida via vår
 * serverfunktion (/api/event-image). Returnerar null tills en bild hittats
 * eller kanske gett upp – fallbacken (kategorigradient) visas tills dess.
 */
export function useOfficialEventImage(event: Pick<EventItem, "id" | "image" | "sourceUrl">) {
  const [image, setImage] = useState<string | undefined>(event.image);
  const sourceUrl = event.sourceUrl;
  useEffect(() => {
    if (image || !sourceUrl) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/event-image?url=${encodeURIComponent(sourceUrl)}`);
        if (!response.ok) return;
        const payload = (await response.json()) as { image?: string };
        if (!cancelled && payload.image) setImage(payload.image);
      } catch {
        // Ingen bild – neutral fallback visas.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [image, sourceUrl]);
  return image;
}

export function EventCover({
  event,
  className,
  big,
}: {
  event: EventItem;
  className?: string;
  big?: boolean;
}) {
  const c = categoryById(event.category);
  const image = useOfficialEventImage(event);
  const handleImageError = (imageEvent: SyntheticEvent<HTMLImageElement>) => {
    imageEvent.currentTarget.style.display = "none";
    imageEvent.currentTarget.parentElement?.classList.add("event-cover-image-failed");
  };
  if (image) {
    return (
      <div className={cn("relative overflow-hidden bg-secondary", className)}>
        <img
          src={image}
          alt={event.name}
          loading="lazy"
          onError={handleImageError}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }
  return (
    <div
      className={cn("relative flex items-center justify-center overflow-hidden", className)}
      style={{ background: CATEGORY_GRADIENT[event.category] }}
    >
      <span className={big ? "text-6xl" : "text-3xl"}>{c.emoji}</span>
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_60%)]" />
    </div>
  );
}

/** Kompakt kort som används i listor och karuseller. */
export function EventCard({ event, compact }: { event: EventItem; compact?: boolean }) {
  const { saved, interested, toggleSaved, toggleInterested, interestedCount, followingInterested, track } =
    useHander();
  // UI-guard: "Planera med kompisar" kräver inloggning.
  const { go: goCreate } = useGoCreate();
  const [shareOpen, setShareOpen] = useState(false);
  const isSaved = saved.includes(event.id);
  const isInterested = interested.includes(event.id);
  const follows = followingInterested(event);
  const live = isHappeningNow(event);

  return (
    <article
      className={cn(
        "event-card-unified-border overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)]",
        (event.sponsored || event.promoted) ? "border-primary/50 bg-accent/40" : "border-border",
        compact ? "w-56 shrink-0" : "w-full",
      )}
    >
      <Link
        to="/event/$id"
        params={{ id: event.id }}
        className="block"
        aria-label={`Visa ${event.name}`}
        onClick={() => track(event.id, "clicks")}
      >
        <div className="relative">
          <EventCover event={event} className={compact ? "h-24" : "h-28"} />
          <div className="absolute left-2 top-2 flex max-w-[calc(100%-1rem)] flex-wrap gap-1">
            {(event.sponsored || event.promoted) && <SponsoredBadge tone="onMedia" />}
            {live && (
              <span className="rounded-full bg-success px-2 py-0.5 text-[10px] font-bold text-success-foreground">
                PÅGÅR NU
              </span>
            )}
            {event.visibility === "private" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-foreground/80 px-2 py-0.5 text-[10px] font-bold text-background">
                <Lock className="h-3 w-3" /> Privat
              </span>
            )}
          </div>
          <span className="absolute bottom-2 right-2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-bold">
            <PriceLabel event={event} />
          </span>
        </div>
        <div className="space-y-1.5 p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-[15px] font-bold leading-tight">{event.name}</h3>
          </div>
          <CategoryChip category={event.category} />
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" /> {event.place} · {event.distance} km
          </p>
          <p className="text-xs font-semibold text-foreground">
            {formatDay(event.date)} · {event.start}–{event.end}
          </p>
          {event.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{event.description}</p>
          )}
          {!compact && event.visibility === "public" && (
            <p className="text-xs text-muted-foreground">
              {interestedCount(event)} {interestedCount(event) === 1 ? "person är" : "personer är"} intresserade
              {follows.length > 0 && ` · ${follows.length} du följer`}
            </p>
          )}
        </div>
      </Link>
      {!compact && (
        <div className="space-y-2 border-t border-border px-3 py-2">
          <div className="flex gap-2">
            <Link
              to="/event/$id"
              params={{ id: event.id }}
              onClick={() => track(event.id, "clicks")}
              className="flex-1 rounded-xl bg-secondary px-3 py-2 text-center text-xs font-bold text-secondary-foreground"
            >
              Visa event
            </Link>
            <button
              type="button"
              onClick={() => toggleInterested(event.id)}
              className={cn(
                "flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold transition-colors",
                isInterested
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              <Heart className={cn("h-3.5 w-3.5", isInterested && "fill-current")} /> Intresserad
            </button>
            <button
              type="button"
              onClick={() => toggleSaved(event.id)}
              aria-label="Spara"
              className={cn(
                "rounded-xl px-3 py-2 transition-colors",
                isSaved ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
              )}
            >
              <Bookmark className={cn("h-3.5 w-3.5", isSaved && "fill-current")} />
            </button>
            <button
              type="button"
              onClick={() => {
                track(event.id, "shares");
                setShareOpen(true);
              }}
              aria-label="Dela"
              className="rounded-xl bg-secondary px-3 py-2 text-secondary-foreground"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              track(event.id, "plans");
              goCreate();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-accent-foreground"
          >
            <Users className="h-3.5 w-3.5" /> Planera med kompisar
          </button>
        </div>
      )}

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        preview={{
          tagline: "Kolla in det här! 👀",
          title: event.name,
          emoji: "📍",
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

/** Rad i listvyn (tid till vänster). */
export function EventRow({ event }: { event: EventItem }) {
  const { followingInterested } = useHander();
  const follows = followingInterested(event);
  return (
    <Link
      to="/event/$id"
      params={{ id: event.id }}
      className={cn(
        "event-row-unified-border flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-[var(--shadow-card)] transition-colors hover:bg-secondary/60",
        (event.sponsored || event.promoted) ? "border-primary/40 bg-accent/25" : "border-border",
      )}
    >
      <div className="w-12 shrink-0 text-center">
        <p className="font-display text-sm font-bold">{event.start}</p>
        <p className="text-[10px] text-muted-foreground">{formatDay(event.date)}</p>
      </div>
      <EventCover event={event} className="h-12 w-12 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{event.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {categoryById(event.category).emoji} {event.place} · {event.distance} km
        </p>
        {(event.sponsored || event.promoted) && <SponsoredBadge className="mt-1" />}
        {follows.length > 0 && (
          <p className="text-[11px] font-semibold text-primary">
            {follows.length} du följer är intresserade
          </p>
        )}
      </div>
      <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-[11px] font-bold">
        <PriceLabel event={event} />
      </span>
    </Link>
  );
}
