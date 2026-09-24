import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, BarChart3, Check, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/hander/AppShell";
import {
  Avatar,
  CategoryChip,
  EventCover,
  priceLabel,
  SponsoredBadge,
} from "@/components/hander/EventBits";
import {
  CATEGORIES,
  ME,
  STAT_LABELS,
  userById,
  type CategoryId,
  type EventItem,
  type StatKey,
} from "@/lib/hander-data";
import { formatDay, hasEnded, useHander } from "@/lib/hander-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/arrangor")({
  head: () => ({
    meta: [
      { title: "Arrangörspanel – Händer" },
      {
        name: "description",
        content: "Hantera dina event, se intresserade och följ statistik som arrangör på Händer.",
      },
      { property: "og:title", content: "Arrangörspanel – Händer" },
      {
        property: "og:description",
        content: "Skapa och redigera event, se visningar, klick, sparningar och planer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrganizerPage,
});

const field =
  "w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

const STAT_ORDER: StatKey[] = ["views", "clicks", "saves", "interested", "shares", "plans"];

function OrganizerPage() {
  const store = useHander();
  const me = userById(ME);
  const [editing, setEditing] = useState<string | null>(null);

  const mine = store.events.filter((e) => e.organizerId === ME);
  const upcoming = mine.filter((e) => !hasEnded(e));
  const totals = mine.reduce(
    (acc, e) => {
      const s = store.eventStats(e);
      STAT_ORDER.forEach((k) => (acc[k] += s[k]));
      return acc;
    },
    { views: 0, clicks: 0, saves: 0, interested: 0, shares: 0, plans: 0 } as Record<StatKey, number>,
  );

  return (
    <AppShell title="Arrangörspanel" subtitle="Dina event, intresserade och statistik">
      <div className="space-y-5 p-4">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <Avatar user={me} size={56} />
            <div className="min-w-0 flex-1">
              <h1 className="flex items-center gap-1 font-display text-lg font-bold">
                {me.name}
                <BadgeCheck className="h-4 w-4 text-primary" />
              </h1>
              <p className="text-xs text-muted-foreground">{me.username}</p>
              <p className="mt-1 text-xs">
                <span className="font-bold">{me.followers}</span> följare ·{" "}
                <span className="font-bold">{upcoming.length}</span> kommande aktiviteter
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{me.bio}</p>
          <span className="mt-3 inline-block rounded-full bg-accent px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-foreground">
            Verifierad arrangör
          </span>
        </section>

        <section className="rounded-2xl border border-border bg-secondary/50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold">
            <BarChart3 className="h-4 w-4 text-primary" /> Statistik – alla dina event
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {STAT_ORDER.map((k) => (
              <div key={k} className="rounded-xl bg-background p-2">
                <p className="font-display text-lg font-bold">{totals[k]}</p>
                <p className="text-[10px] uppercase text-muted-foreground">{STAT_LABELS[k]}</p>
              </div>
            ))}
          </div>
        </section>

        <Link
          to="/skapa"
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-pin)]"
        >
          <Plus className="h-4 w-4" /> Skapa nytt event
        </Link>

        <section className="space-y-3">
          <h2 className="font-display text-base font-bold">Dina event ({mine.length})</h2>
          {mine.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Du har inte skapat något event än.
            </p>
          )}
          {mine.map((e) =>
            editing === e.id ? (
              <EditCard key={e.id} event={e} onDone={() => setEditing(null)} />
            ) : (
              <OrganizerEventCard key={e.id} event={e} onEdit={() => setEditing(e.id)} />
            ),
          )}
        </section>
      </div>
    </AppShell>
  );
}

function StatusBadge({ event }: { event: EventItem }) {
  if (event.visibility === "private")
    return (
      <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold uppercase text-background">
        Privat
      </span>
    );
  const map = {
    pending: ["Under granskning", "bg-warning text-warning-foreground"],
    approved: ["Publicerad", "bg-success text-success-foreground"],
    rejected: ["Avvisad", "bg-destructive text-destructive-foreground"],
  } as const;
  const [label, cls] = map[event.status];
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", cls)}>
      {label}
    </span>
  );
}

function OrganizerEventCard({ event, onEdit }: { event: EventItem; onEdit: () => void }) {
  const store = useHander();
  const stats = store.eventStats(event);
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex gap-3 p-3">
        <EventCover event={event} className="h-16 w-16 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
            <h3 className="truncate font-display text-sm font-bold">{event.name}</h3>
            <div className="shrink-0">
              <StatusBadge event={event} />
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDay(event.date)} · {event.start}–{event.end} · {event.place}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <CategoryChip category={event.category} />
            <span className="text-[11px] font-bold">{priceLabel(event.price, event.priceKnown)}</span>
            {event.promoted && <SponsoredBadge />}
          </div>
        </div>
      </div>
      {event.status === "rejected" && event.rejectionReason && (
        <p className="mx-3 mb-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Avvisad: {event.rejectionReason}
        </p>
      )}
      <div className="grid grid-cols-3 gap-px border-t border-border bg-border text-center">
        {STAT_ORDER.map((k) => (
          <div key={k} className="bg-card px-2 py-2">
            <p className="font-display text-sm font-bold">{stats[k]}</p>
            <p className="text-[9px] uppercase text-muted-foreground">{STAT_LABELS[k]}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-border p-3">
        <Link
          to="/event/$id"
          params={{ id: event.id }}
          className="flex-1 rounded-xl bg-secondary px-3 py-2 text-center text-xs font-bold"
        >
          Visa event
        </Link>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-accent-foreground"
        >
          <Pencil className="h-3.5 w-3.5" /> Redigera
        </button>
      </div>
    </article>
  );
}

function EditCard({ event, onDone }: { event: EventItem; onDone: () => void }) {
  const { updateEvent } = useHander();
  const [name, setName] = useState(event.name);
  const [category, setCategory] = useState<CategoryId>(event.category);
  const [date, setDate] = useState(event.date);
  const [start, setStart] = useState(event.start);
  const [end, setEnd] = useState(event.end);
  const [place, setPlace] = useState(event.place);
  const [price, setPrice] = useState(String(event.price));
  const [description, setDescription] = useState(event.description);
  const [promoted, setPromoted] = useState(Boolean(event.promoted));

  const save = () => {
    if (!name.trim() || !place.trim()) {
      toast.error("Eventnamn och plats behövs.");
      return;
    }
    updateEvent(event.id, {
      name: name.trim(),
      category,
      date,
      start,
      end,
      place: place.trim(),
      price: Number(price) || 0,
      promoted: event.visibility === "public" ? promoted : false,
      description: description.trim(),
      ...(event.visibility === "public" ? { status: "pending" as const } : {}),
    });
    toast.success(
      event.visibility === "public"
        ? "Ändringen skickades för granskning."
        : "Eventet uppdaterat.",
    );
    onDone();
  };

  return (
    <div className="space-y-3 rounded-2xl border border-primary/40 bg-card p-3 shadow-[var(--shadow-card)]">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Redigera event
      </p>
      <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
              category === c.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card",
            )}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input type="date" className={cn(field, "col-span-3")} value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="time" className={field} value={start} onChange={(e) => setStart(e.target.value)} />
        <input type="time" className={field} value={end} onChange={(e) => setEnd(e.target.value)} />
        <input type="number" min={0} className={field} value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <input className={field} value={place} onChange={(e) => setPlace(e.target.value)} />
      <textarea
        className={cn(field, "min-h-20 resize-none")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      {event.visibility === "public" && (
        <>
          <div className="rounded-xl border border-border p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Placering
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPromoted(false)}
                className={cn(
                  "rounded-xl border p-2.5 text-left text-xs",
                  !promoted ? "border-primary bg-accent/60" : "border-border",
                )}
              >
                <p className="font-bold">GRATIS</p>
                <p className="text-muted-foreground">Vanlig synlighet.</p>
              </button>
              <button
                type="button"
                onClick={() => setPromoted(true)}
                className={cn(
                  "rounded-xl border p-2.5 text-left text-xs",
                  promoted ? "border-primary bg-accent/60" : "border-border",
                )}
              >
                <p className="flex flex-wrap items-center gap-1.5 font-bold">
                  SPONSRAD {promoted && <SponsoredBadge />}
                </p>
                <p className="text-muted-foreground">
                  Egen sektion, framlyft kort och topplacering.
                </p>
              </button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Ändringar i publika event skickas till granskning igen.
          </p>
        </>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
        >
          <Check className="h-3.5 w-3.5" /> Spara
        </button>
        <button
          type="button"
          onClick={onDone}
          className="flex items-center gap-1 rounded-xl bg-secondary px-3 py-2 text-xs font-bold"
        >
          <X className="h-3.5 w-3.5" /> Avbryt
        </button>
      </div>
    </div>
  );
}
