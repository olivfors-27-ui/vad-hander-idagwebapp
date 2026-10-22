import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { BarChart3, Check, Copy, Eye, Pencil, Sparkles, Users, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/hander/AppShell";
import { AddressSearch } from "@/components/hander/AddressSearch";
import { Avatar, EventCover, CategoryChip, priceLabel } from "@/components/hander/EventBits";
import {
  CATEGORIES,
  ME,
  STAT_LABELS,
  userById,
  type CategoryId,
  type EventItem,
  type InviteStatus,
  type User,
} from "@/lib/hander-data";
import { useProfileName } from "@/lib/auth";
import { saveEventErrorMessage } from "@/lib/event-admin";
import { useEventViewCounts } from "@/lib/event-views";
import { distanceFromHome, isInSweden, type GeoHit } from "@/lib/geocode";
import { formatDay, useHander } from "@/lib/hander-store";
import { appUrl } from "@/lib/app-url";
import { SPONSORSHIP, sponsorshipPriceLabel } from "@/lib/sponsorship";
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
  const viewCounts = useEventViewCounts();
  const event = store.events.find((e) => e.id === id);
  // Arrangörens visningsnamn: sparat på eventet, annars från profilen.
  const organizerName = useProfileName(event?.organizerId, event?.organizerName);

  if (!event) {
    return (
      <AppShell title="Hantera event">
        <p className="p-8 text-center text-sm text-muted-foreground">Eventet hittades inte.</p>
      </AppShell>
    );
  }

  if (event.organizerId !== ME && event.organizerId !== store.me) {
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
  const organizer = userById(event.organizerId, organizerName);

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
                    <p className="font-display text-lg font-bold text-[#2A2421]">
                      {k === "views" ? (viewCounts[event.id] ?? 0) : stats[k]}
                    </p>
                    <p className="text-[10px] uppercase text-muted-foreground">{STAT_LABELS[k]}</p>
                  </div>
                ))}
              </div>
            </div>

            {event.visibility === "public" && <SponsorshipCard event={event} />}

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
  const store = useHander();
  const event = store.events.find((e) => e.id === eventId);
  const [name, setName] = useState(event?.name ?? "");
  const [category, setCategory] = useState<CategoryId>(event?.category ?? "fest");
  const [date, setDate] = useState(event?.date ?? "");
  const [start, setStart] = useState(event?.start ?? "");
  const [end, setEnd] = useState(event?.end ?? "");
  const [place, setPlace] = useState(event?.place ?? "");
  // Den riktiga platsen (adress + koordinater), inte bara etiketten. Utgår från
  // eventets sparade position så att kartnålen kan flyttas utan att först
  // sökas upp på nytt.
  const [location, setLocation] = useState<GeoHit | null>(() =>
    event && typeof event.lat === "number" && typeof event.lng === "number"
      ? {
          label: event.address || event.place,
          short: event.address || event.place,
          lat: event.lat,
          lng: event.lng,
        }
      : null,
  );
  const [price, setPrice] = useState(String(event?.price ?? 0));
  const [description, setDescription] = useState(event?.description ?? "");
  const [saving, setSaving] = useState(false);

  if (!event) return null;

  const save = async () => {
    if (!name.trim() || !place.trim()) {
      toast.error("Eventnamn och plats behövs.");
      return;
    }
    if (start && end && end <= start) {
      toast.error("Sluttiden måste vara efter starttiden.");
      return;
    }
    if (location && !isInSweden(location)) {
      toast.error("Platsen måste ligga i Sverige. Sök upp en svensk adress.");
      return;
    }
    if (event.visibility === "public" && !location) {
      toast.error("Välj en adress i Sverige – annars kan eventet inte visas på kartan.");
      return;
    }

    const patch: Partial<EventItem> = {
      name: name.trim(),
      category,
      date,
      start,
      end,
      place: place.trim(),
      // Adressen och koordinaterna följer med, så att kartan visar rätt plats.
      address: location?.short ?? event.address,
      // Rensar man adressfältet utan att välja ny plats behålls den gamla
      // positionen – annars skulle adress och nål peka på olika ställen.
      lat: location?.lat ?? event.lat,
      lng: location?.lng ?? event.lng,
      distance: location ? distanceFromHome(location) : event.distance,
      price: Number(price) || 0,
      description: description.trim(),
      ...(event.visibility === "public" ? { status: "pending" as const } : {}),
    };

    setSaving(true);
    try {
      if (event.visibility === "public") {
        await store.updatePublicEvent(eventId, patch);
        toast.success("Ändringen skickades för granskning.");
      } else {
        store.updateEvent(eventId, patch);
        // Privata event måste även skrivas till databasen – annars ser gästerna
        // den gamla adressen. Upserten lagar äldre event som bara fanns lokalt.
        await store.persistPrivateEvent({ ...event, ...patch });
        toast.success("Eventet uppdaterat.");
      }
    } catch (error) {
      console.error("Could not save event changes", error);
      toast.error(saveEventErrorMessage(error));
    } finally {
      setSaving(false);
    }
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

      <p className={labelCls}>Adress (styr kartans nål)</p>
      <AddressSearch
        value={location}
        onSelect={setLocation}
        onClear={() => setLocation(null)}
      />
      <p className="text-[11px] text-muted-foreground">
        Bara adresser i Sverige. Välj ett förslag för att flytta nålen – platsnamnet ovan är bara
        etiketten som visas i texten.
      </p>

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
        onClick={() => void save()}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E45048] px-4 py-3 text-sm font-bold text-[#FFFDF9] shadow-[0_3px_0_rgba(112,28,23,.25)] active:translate-y-[2px] disabled:opacity-60"
      >
        <Check className="h-4 w-4" /> {saving ? "Sparar…" : "Spara ändringar"}
      </button>
    </div>
  );
}

function GuestsTab({
  eventId,
  invites,
}: {
  eventId: string;
  invites: {
    userId: string;
    status: InviteStatus;
    name?: string | undefined;
    interests?: string[] | undefined;
  }[];
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
  const link = appUrl(`/join/${event.inviteCode ?? ""}`);
  const notInvited: User[] = [];

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
              // Namnet sparas på svaret tillsammans med kontot – använd det i
              // stället för att slå upp en okänd uuid (som blev "Okänd användare").
              const u = userById(i.userId, i.name);
              return (
                <div key={i.userId} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                  <Avatar user={u} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{i.name ?? u.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {i.status === "accepted" ? "Kommer" : i.status === "maybe" ? "Kanske" : i.status === "declined" ? "Kan inte" : "Inbjuden"}
                    </p>
                    {i.interests && i.interests.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {i.interests.map((tag) => (
                          <span
                            key={tag}
                            className="flex items-center gap-1 rounded-full bg-[#F7E5D5] px-2 py-0.5 text-[10px] font-bold text-[#8A4A1F]"
                          >
                            <Sparkles className="h-2.5 w-2.5" aria-hidden /> {tag}
                          </span>
                        ))}
                      </div>
                    )}
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

/**
 * Sponsring: pris och betalningsinstruktion visas innan användaren bekräftar.
 * Sponsring är bara möjlig för godkända event – backend kontrollerar samma sak
 * i RPC:n sponsor_public_event.
 */
function SponsorshipCard({ event }: { event: EventItem }) {
  const store = useHander();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const approved = event.status === "approved";
  const sponsored = Boolean(event.sponsored || event.promoted);

  if (sponsored) {
    return (
      <div className="rounded-2xl border border-[#465BC4]/40 bg-[#DDE3F8] p-4 text-[#3B4CAD]">
        <p className="flex items-center gap-2 text-sm font-bold">
          <Sparkles className="h-4 w-4" /> Sponsrat event
        </p>
        <p className="mt-1 text-xs leading-relaxed">
          Eventet visas i fliken Sponsrat på startsidan och är märkt som sponsrat i listor och på
          kartan.
        </p>
      </div>
    );
  }

  const confirm = async () => {
    setBusy(true);
    try {
      await store.sponsorEvent(event.id);
      setConfirming(false);
      toast.success("Sponsring aktiverad – eventet syns nu i Sponsrat");
    } catch (error) {
      console.error("Could not sponsor event", error);
      toast.error("Sponsringen kunde inte aktiveras. Försök igen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Sponsring</p>
      <p className="text-sm font-bold text-[#2A2421]">
        Sponsrad placering – {sponsorshipPriceLabel()}
      </p>
      <button
        type="button"
        disabled={!approved || busy}
        onClick={() => setConfirming(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#465BC4] px-4 py-3 text-sm font-bold text-[#FFFDF9] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" />
        {approved ? `Sponsra för ${sponsorshipPriceLabel()}` : "Sponsring är låst"}
      </button>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {SPONSORSHIP.availabilityNote}
      </p>

      {confirming && (
        <div className="space-y-2 rounded-xl bg-[#DDE3F8] p-3 text-xs text-[#3B4CAD]">
          <p className="font-bold">
            Betala {sponsorshipPriceLabel()} via Swish till {SPONSORSHIP.paymentNumber}
          </p>
          <p className="leading-relaxed">
            Ange eventets namn som meddelande. När betalningen är gjord trycker du på knappen nedan
            så markeras eventet som sponsrat.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#3B4CAD]"
            >
              Avbryt
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirm()}
              className="flex-[2] rounded-xl bg-[#465BC4] px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {busy ? "Aktiverar…" : "Jag har betalat – aktivera"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
