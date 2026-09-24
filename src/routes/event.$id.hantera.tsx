import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { BarChart3, Check, Copy, Eye, Pencil, Users, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/hander/AppShell";
import { Avatar, EventCover, CategoryChip, priceLabel } from "@/components/hander/EventBits";
import {
  CATEGORIES,
  ME,
  STAT_LABELS,
  USERS,
  userById,
  type CategoryId,
  type InviteStatus,
} from "@/lib/hander-data";
import { formatDay, useHander } from "@/lib/hander-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/event/$id/hantera")({
  head: () => ({
    meta: [
      { title: "Hantera event – Händer" },
      { name: "description", content: "Översikt, redigering och gäster för ditt event." },
    ],
  }),
  component: ManageEventPage,
});

const TABS = [
  { id: "oversikt", label: "Översikt", icon: BarChart3, tone: "#E45048" },
  { id: "redigera", label: "Redigera", icon: Pencil, tone: "#E57657" },
  { id: "gaster", label: "Gäster", icon: Users, tone: "#E7A057" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const field =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const labelCls = "text-xs font-bold uppercase tracking-wide text-muted-foreground";

function ManageEventPage() {
  const { id } = useParams({ from: "/event/$id/hantera" });
  const store = useHander();
  const [tab, setTab] = useState<TabId>("oversikt");
  const event = store.events.find((e) => e.id === id);

  if (!event) {
    return (
      <AppShell title="Hantera event">
        <p className="p-8 text-center text-sm text-muted-foreground">Eventet hittades inte.</p>
      </AppShell>
    );
  }

  if (event.organizerId !== ME) {
    return (
      <AppShell title={event.name}>
        <p className="p-8 text-center text-sm text-muted-foreground">
          Du organiserar inte det här eventet.
          <div className="mt-4">
            <Link to="/event/$id" params={{ id }} className="font-bold text-primary">
              Visa eventet →
            </Link>
          </div>
        </p>
      </AppShell>
    );
  }

  const stats = store.eventStats(event);
  const invites = event.invites ?? [];
  const organizer = userById(event.organizerId);

  return (
    <AppShell title={event.name} subtitle="Hantera ditt event">
      <div className="space-y-5 p-4">
        <EventCover event={event} className="h-36 rounded-3xl" big />

        {/* Flikrad – samma pill-stil som sektionerna på hem-sidan. */}
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2.5 text-xs font-bold transition-colors",
                tab === t.id
                  ? "border-transparent text-[#FFFDF9] shadow-[0_3px_0_rgba(42,36,33,.18)]"
                  : "border-border bg-card text-[#2A2421]",
              )}
              style={tab === t.id ? { backgroundColor: t.tone } : undefined}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "oversikt" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-[#2A2421]">
                {formatDay(event.date)} · {event.start}–{event.end}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {event.place} · {event.address}
              </p>
              <p className="mt-2 text-sm text-[#2A2421]">{event.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <CategoryChip category={event.category} />
                <span className="rounded-full bg-[#FBEBDA] px-2 py-0.5 text-[11px] font-bold text-[#8A5A22]">
                  {priceLabel(event.price, event.priceKnown)}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                    event.visibility === "private"
                      ? "bg-foreground text-background"
                      : event.status === "approved"
                        ? "bg-success text-success-foreground"
                        : event.status === "pending"
                          ? "bg-warning text-warning-foreground"
                          : "bg-destructive text-destructive-foreground",
                  )}
                >
                  {event.visibility === "private"
                    ? "Privat"
                    : event.status === "approved"
                      ? "Publicerat"
                      : event.status === "pending"
                        ? "Under granskning"
                        : "Avvisat"}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-[#FBEBDA]/60 p-4">
              <p className={labelCls}>
                <BarChart3 className="mr-1 inline h-3.5 w-3.5 text-[#E7A057]" /> Statistik
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {(Object.keys(STAT_LABELS) as (keyof typeof STAT_LABELS)[]).map((k) => (
                  <div key={k} className="rounded-xl bg-card p-2">
                    <p className="font-display text-lg font-bold text-[#2A2421]">{stats[k]}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">{STAT_LABELS[k]}</p>
                  </div>
                ))}
              </div>
            </div>

            <Link
              to="/event/$id"
              params={{ id: event.id }}
              className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-bold text-[#2A2421]"
            >
              <Eye className="h-4 w-4" /> Visa som gäst
            </Link>
          </div>
        )}

        {tab === "redigera" && <EditTab eventId={event.id} />}

        {tab === "gaster" && <GuestsTab eventId={event.id} invites={invites} />}
      </div>
    </AppShell>
  );
}

function EditTab({ eventId }: { eventId: string }) {
  return <EditForm eventId={eventId} />;
}

function EditForm({ eventId }: { eventId: string }) {
  const { updateEvent } = useHander();
  const store = useHander();
  const event = store.events.find((e) => e.id === eventId);
  const [name, setName] = useState(event?.name ?? "");
  const [category, setCategory] = useState<CategoryId>(event?.category ?? "fest");
  const [date, setDate] = useState(event?.date ?? "");
  const [start, setStart] = useState(event?.start ?? "");
  const [end, setEnd] = useState(event?.end ?? "");
  const [place, setPlace] = useState(event?.place ?? "");
  const [price, setPrice] = useState(String(event?.price ?? 0));
  const [description, setDescription] = useState(event?.description ?? "");

  if (!event) return null;

  const save = () => {
    if (!name.trim() || !place.trim()) {
      toast.error("Eventnamn och plats behövs.");
      return;
    }
    updateEvent(eventId, {
      name: name.trim(),
      category,
      date,
      start,
      end,
      place: place.trim(),
      price: Number(price) || 0,
      description: description.trim(),
      ...(event.visibility === "public" ? { status: "pending" as const } : {}),
    });
    toast.success(
      event.visibility === "public" ? "Ändringen skickades för granskning." : "Eventet uppdaterat.",
    );
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <p className={labelCls}>Eventnamn</p>
      <input className={field} value={name} onChange={(e) => setName(e.target.value)} />

      <p className={labelCls}>Kategori</p>
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[11px] font-semibold",
              category === c.id
                ? "border-transparent bg-[#E57657] text-[#FFFDF9]"
                : "border-border bg-card text-[#2A2421]",
            )}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-3">
          <p className={cn(labelCls, "mb-1")}>Datum</p>
          <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <p className={cn(labelCls, "mb-1")}>Start</p>
          <input type="time" className={field} value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <p className={cn(labelCls, "mb-1")}>Slut</p>
          <input type="time" className={field} value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div>
          <p className={cn(labelCls, "mb-1")}>Pris</p>
          <input type="number" min={0} className={field} value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>

      <p className={labelCls}>Plats</p>
      <input className={field} value={place} onChange={(e) => setPlace(e.target.value)} />

      <p className={labelCls}>Beskrivning</p>
      <textarea
        className={cn(field, "min-h-20 resize-none")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      {event.visibility === "public" && (
        <p className="text-[11px] text-muted-foreground">
          Ändringar i publika event skickas till granskning igen.
        </p>
      )}

      <button
        type="button"
        onClick={save}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E45048] px-4 py-3 text-sm font-bold text-[#FFFDF9] shadow-[0_3px_0_rgba(112,28,23,.25)] active:translate-y-[2px]"
      >
        <Check className="h-4 w-4" /> Spara ändringar
      </button>
    </div>
  );
}

function GuestsTab({
  eventId,
  invites,
}: {
  eventId: string;
  invites: { userId: string; status: InviteStatus }[];
}) {
  const store = useHander();
  const event = store.events.find((e) => e.id === eventId);
  if (!event) return null;

  const groups: { id: InviteStatus; label: string; tone: string }[] = [
    { id: "accepted", label: "Kommer", tone: "#E57657" },
    { id: "maybe", label: "Kanske", tone: "#E7A057" },
    { id: "invited", label: "Inbjudna", tone: "#E45048" },
    { id: "declined", label: "Kan inte", tone: "#EAB24F" },
  ];
  const link = `HANDER.APP/JOIN/${event.inviteCode ?? ""}`;
  const notInvited = USERS.filter((u) => u.id !== ME && !invites.some((i) => i.userId === u.id));

  return (
    <div className="space-y-4">
      {event.visibility === "private" && (
        <div className="rounded-2xl border border-border bg-[#FBEBDA]/60 p-4">
          <p className={labelCls}>Inbjudningslänk</p>
          <p className="mt-1 break-all font-mono text-sm font-bold text-[#2A2421]">{link}</p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(link);
              toast.success("Inbjudningslänk kopierad");
            }}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#E45048] px-4 py-2.5 text-xs font-bold text-[#FFFDF9] shadow-[0_3px_0_rgba(112,28,23,.25)] active:translate-y-[2px]"
          >
            <Copy className="h-3.5 w-3.5" /> Kopiera länk
          </button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 text-center">
        {groups.map((g) => (
          <div key={g.id} className="rounded-xl border border-border bg-card p-2">
            <p className="font-display text-lg font-bold" style={{ color: g.tone }}>
              {invites.filter((i) => i.status === g.id).length}
            </p>
            <p className="text-[10px] uppercase text-muted-foreground">{g.label}</p>
          </div>
        ))}
      </div>

      {groups.map((g) => {
        const list = invites.filter((i) => i.status === g.id);
        if (!list.length) return null;
        return (
          <section key={g.id} className="space-y-2">
            <p className={labelCls}>
              {g.label} ({list.length})
            </p>
            {list.map((i) => {
              const u = userById(i.userId);
              return (
                <div key={i.userId} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                  <Avatar user={u} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{u.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.username}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Ta bort ${u.name}`}
                    onClick={() => {
                      store.removeInvite(eventId, i.userId);
                      toast(`${u.name} togs bort`);
                    }}
                    className="rounded-xl bg-[#F7E5D5] p-2 text-[#E45048]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </section>
        );
      })}

      {invites.length === 0 && (
        <p className="text-sm text-muted-foreground">Ingen inbjuden än – dela länken ovan.</p>
      )}

      <div className="space-y-2">
        <p className={labelCls}>Bjud in från appen</p>
        {notInvited.map((u) => (
          <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <Avatar user={u} size={32} />
            <p className="flex-1 truncate text-sm">{u.name}</p>
            <button
              type="button"
              onClick={() => {
                store.setInviteStatus(eventId, u.id, "invited");
                toast.success(`${u.name} inbjuden`);
              }}
              className="rounded-full bg-[#E57657] px-3 py-1.5 text-[11px] font-bold text-[#FFFDF9]"
            >
              Bjud in
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
