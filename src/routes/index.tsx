import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock, Lock, MapPin, Users } from "lucide-react";
import { useMemo } from "react";
import { AppShell } from "@/components/hander/AppShell";
import { EventCover, priceLabel, SponsoredBadge } from "@/components/hander/EventBits";
import { CATEGORY_GRADIENT, ME, USERS, categoryById, type EventItem } from "@/lib/hander-data";
import type { Plan } from "@/lib/hander-plans";
import { formatDay, hasEnded, useHander } from "@/lib/hander-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vad Händer Idag?" },
      {
        name: "description",
        content:
          "Hitta skoj i Stockholm idag. Upptäck events och aktiviteter nära dig och planera med kompisar – alla svarar utan konto.",
      },
      { property: "og:title", content: "Vad Händer Idag?" },
      {
        property: "og:description",
        content: "Hitta skoj i Stockholm idag och planera med kompisar.",
      },
    ],
  }),
  component: Home,
});

/** Diskret abstrakt kartgrafik med färgade linjer bakom toppen av sidan. */
function MapArt() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden">
      <svg
        viewBox="0 0 400 260"
        preserveAspectRatio="none"
        className="h-full w-full opacity-[0.16]"
      >
        <path
          d="M-20 60 C 80 20, 140 110, 240 70 S 380 30, 430 80"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M-20 150 C 60 120, 160 190, 260 150 S 380 120, 430 160"
          fill="none"
          stroke="var(--line-blue)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M60 -20 C 90 60, 40 160, 100 280"
          fill="none"
          stroke="var(--line-red)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M300 -20 C 280 80, 340 160, 300 280"
          fill="none"
          stroke="var(--line-yellow)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <circle cx="240" cy="70" r="9" fill="var(--primary)" />
        <circle cx="100" cy="150" r="7" fill="var(--line-blue)" />
        <circle cx="330" cy="150" r="7" fill="var(--line-red)" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
    </div>
  );
}

function SectionHead({
  title,
  to,
  dot = "var(--section-orange)",
  badge,
  tone = "orange",
}: {
  title: string;
  to?: string | undefined;
  dot?: string | undefined;
  badge?: string | undefined;
  tone?: "red" | "pink" | "coral" | "orange" | "amber" | "yellow" | "blue" | "periwinkle";
}) {
  const toneClass = `section-pill section-pill--${tone}`;
  const actionClass = `section-action section-action--${tone}`;
  const badgeClass = `section-badge section-badge--${tone}`;
  return (
    <div className="flex items-center justify-between gap-2 px-4">
      <h2 className={`flex min-w-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold text-[#2A2421] ${toneClass}`}>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
        <span className="truncate">{title}</span>
        {badge ? (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeClass}`}>
            {badge}
          </span>
        ) : null}
      </h2>
      {to ? (
        <Link
          to={to}
          className={`-mr-2 flex min-h-9 shrink-0 items-center gap-1 px-2 text-xs font-bold ${actionClass}`}
        >
          Se alla <ArrowRight className="h-3 w-3" />
        </Link>
      ) : null}
    </div>
  );
}

/** Stort, mörk-gradient-kort för populära aktiviteter. */
function PopularCard({ event }: { event: EventItem }) {
  const c = categoryById(event.category);
  return (
    <Link
      to="/event/$id"
      params={{ id: event.id }}
      aria-label={`Visa ${event.name}`}
      className="popular-event-card relative block w-60 shrink-0 overflow-hidden rounded-3xl border-[7px] border-[#E45048] bg-[#FFFFFF] shadow-[var(--shadow-card)] transition-transform active:scale-[0.98]"
    >
      <EventCover event={event} className="h-44" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
      <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-bold text-foreground">
        {c.emoji} {c.label}
      </span>
      <div className="absolute inset-x-3 bottom-3 text-background">
        <p className="font-display text-base font-bold leading-tight">{event.name}</p>
        <p className="mt-1 flex items-center gap-1 text-[11px] opacity-90">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{event.place}</span>
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold opacity-90">
          <Clock className="h-3 w-3 shrink-0" /> {formatDay(event.date)} · {event.start}
        </p>
      </div>
    </Link>
  );
}

/** Sponsrat kort: framlyft men diskret märkt, och aldrig avklippt text. */
function SponsoredCard({ event }: { event: EventItem }) {
  const c = categoryById(event.category);
  return (
    <Link
      to="/event/$id"
      params={{ id: event.id }}
      aria-label={`Sponsrat: ${event.name}`}
      className="sponsored-event-card flex w-full flex-col overflow-hidden rounded-3xl border border-primary/25 bg-card shadow-[var(--shadow-card)] ring-1 ring-primary/10 transition-transform active:scale-[0.99]"
    >
        <EventCover event={event} className="relative h-28 shrink-0 sm:h-32" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3.5">
        <p className="font-display text-base font-bold leading-tight sm:text-lg">{event.name}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{event.place}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Clock className="h-3 w-3 shrink-0" /> {formatDay(event.date)} · {event.start}
          </span>
        </p>
        <p className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full bg-secondary px-2 py-0.5 font-bold text-secondary-foreground">
            {c.emoji} {c.label}
          </span>
          <span className="font-bold text-primary">{priceLabel(event.price)}</span>
        </p>
      </div>
    </Link>
  );
}

const MY_NAME = USERS.find((u) => u.id === ME)?.name ?? "Du";

const PLAN_COVERS = {
  social: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=320&q=82",
  karaoke: "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=320&q=82",
  bowling: "https://images.unsplash.com/photo-1519671282429-b44660ead0a7?auto=format&fit=crop&w=320&q=82",
  outdoor: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=320&q=82",
} as const;

function planCover(plan: Plan) {
  // Äldre sparade planer kan sakna bild eller ha ett gammalt emoji-värde i image.
  if (plan.image?.startsWith("http")) return plan.image;
  const title = `${plan.title} ${plan.note}`.toLowerCase();
  if (title.includes("karaoke")) return PLAN_COVERS.karaoke;
  if (title.includes("bowling")) return PLAN_COVERS.bowling;
  if (title.includes("testplan") || title.includes("social") || title.includes("gänget")) return PLAN_COVERS.social;
  if (title.includes("vatten") || title.includes("park") || title.includes("häng")) return PLAN_COVERS.outdoor;
  return PLAN_COVERS.social;
}

const isDone = (p: Plan) => Boolean(p.decidedOptionId || p.decidedSlotId);
const isMine = (p: Plan) =>
  p.createdBy === ME || p.createdBy.trim().toLowerCase() === MY_NAME.toLowerCase();

function PlanInviteRow({ plan, event }: { plan: Plan; event?: EventItem }) {
  const slot = plan.slots[0];
  const title = event?.name ?? plan.title;
  const date = event ? `${formatDay(event.date)} · ${event.start}–${event.end}` : slot?.label;
  const place = event?.place ?? plan.place;
  return (
    <Link
      to="/plan/$id"
      params={{ id: plan.id }}
      aria-label={`Öppna inbjudan ${title}`}
      className="invite-event-card group block overflow-hidden rounded-2xl border-[7px] border-[#E7A057] bg-[#FFFFFF] shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5 active:scale-[.99]"
    >
      <div className="relative h-[116px] overflow-hidden">
        <img
          src={event?.image ?? planCover(plan)}
          alt={title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <span className="absolute inset-0 bg-gradient-to-r from-black/78 via-black/40 to-black/8" aria-hidden />
        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-[#E7A057]/70 bg-[#FFFDF9]/95 px-2.5 py-1 text-[10px] font-bold text-[#8A5A22] shadow-sm">
          <Users className="h-3 w-3" /> {plan.replies.length} svar
        </span>
      </div>
      <div className="space-y-1 rounded-b-xl p-3.5">
        <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Lock className="h-3 w-3 text-[#E45048]" /> Privat event
        </p>
        <p className="font-display text-[15px] font-bold leading-tight text-[#2A2421]">{title}</p>
        {date ? <p className="text-sm text-[#8C7A6B]">{date}</p> : null}
        {place ? <p className="text-sm font-semibold text-[#E45048]">{place}</p> : null}
        {event?.description ? (
          <p className="border-t border-border/60 pt-2 text-sm text-[#2A2421]">{event.description}</p>
        ) : plan.note ? (
          <p className="border-t border-border/60 pt-2 text-sm text-[#2A2421]">{plan.note}</p>
        ) : null}
      </div>
    </Link>
  );
}

function OrganizedRow({ event }: { event: EventItem }) {
  const status =
    event.status === "approved"
      ? { label: "Publicerat", cls: "bg-white/85 text-[#26347F]" }
      : event.status === "pending"
        ? { label: "Väntar på godkännande", cls: "bg-white/85 text-[#26347F]" }
        : { label: "Avvisat", cls: "bg-white/85 text-[#642631]" };
  return (
    <Link
      to="/event/$id/hantera"
      params={{ id: event.id }}
      aria-label={`Öppna organiserat event ${event.name}`}
      className="organized-event-card group relative block h-[116px] overflow-hidden rounded-2xl border-[7px] border-[#EAB24F] bg-[#FFFFFF] shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5 active:scale-[.99]"
    >
      <EventCover event={event} className="absolute inset-0 h-full w-full" />
      <span className="absolute inset-0 bg-gradient-to-r from-black/72 via-black/32 to-black/5" aria-hidden />
      <span className="absolute inset-x-3 bottom-3 min-w-0 pr-24 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.5)]">
        <span className="block truncate text-sm font-semibold">{event.name}</span>
        <span className="mt-0.5 block truncate text-[11px] font-medium text-white/85">
          {formatDay(event.date)} · {event.start} · {event.interested.length} intresserade
        </span>
      </span>
      <span className={`absolute right-3 top-3 rounded-full border border-[#465BC4]/70 px-2.5 py-1 text-[10px] font-semibold shadow-sm ${status.cls}`}>
        {status.label}
      </span>
    </Link>
  );
}

function Home() {
  const { publicEvents, events, plans } = useHander();

  const popular = useMemo(
    () =>
      publicEvents
        .filter((e) => !e.promoted && !hasEnded(e))
        .sort((a, b) => b.interested.length - a.interested.length)
        .slice(0, 8),
    [publicEvents],
  );
  const sponsored = useMemo(
    () => publicEvents.filter((e) => e.promoted && !hasEnded(e)).slice(0, 2),
    [publicEvents],
  );
  const activePlans = useMemo(() => plans.filter((p) => !isDone(p)).slice(0, 4), [plans]);
  const invitedCount = activePlans.filter((p) => !isMine(p)).length;
  const organized = useMemo(
    () => events.filter((e) => e.organizerId === ME).slice(0, 4),
    [events],
  );

  return (
    <AppShell title="Vad Händer Idag?" subtitle="Hitta skoj i Stockholm idag">
      <div className="relative space-y-7 pb-4 pt-5">
        {/* Sektion 1 – Mest populära */}
        <section className="section-zone section-zone--red relative space-y-3">
          <SectionHead title="Mest populära nära dig" to="/sok" dot="var(--section-red)" tone="red" />
          <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
            {popular.map((e) => (
              <PopularCard key={e.id} event={e} />
            ))}
            <span className="w-px shrink-0" aria-hidden />
          </div>
        </section>

        {/* Sektion 2 – Sponsrat */}
        {sponsored.length > 0 && (
          <section className="section-zone section-zone--pink relative space-y-3">
            <SectionHead title="Sponsrade events" dot="var(--section-pink)" tone="pink" />
            <div className="grid grid-cols-1 gap-3 px-4 sm:grid-cols-2">
              {sponsored.map((e) => (
                <SponsoredCard key={e.id} event={e} />
              ))}
            </div>
          </section>
        )}

        {/* Sektion 3 – Dina organiserade event */}
        <section className="section-zone section-zone--coral relative space-y-3">
          <SectionHead title="Dina organiserade event" to="/arrangor" dot="#E57657" tone="coral" />
          <div className="space-y-2 px-4">
            {organized.length > 0 ? (
              organized.map((e) => <OrganizedRow key={e.id} event={e} />)
            ) : (
              <Link
                to="/skapa"
                className="block rounded-2xl border border-dashed border-border p-4 text-center"
              >
                <p className="text-sm font-bold">Du organiserar inga event ännu</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Skapa ditt första event med +-knappen →
                </p>
              </Link>
            )}
          </div>
        </section>

        {/* Sektion 4 – Inbjudna events / planer */}
        <section className="section-zone section-zone--orange relative space-y-3">
          <SectionHead
            title="Inbjudna events"
            to="/planer"
            dot="#E7A057"
            tone="orange"
            badge={invitedCount > 0 ? `${invitedCount} nya` : undefined}
          />
          <div className="space-y-2 px-4">
            {activePlans.length > 0 ? (
              activePlans.map((p) => (
                <PlanInviteRow
                  key={p.id}
                  plan={p}
                  event={p.eventId ? events.find((e) => e.id === p.eventId) : undefined}
                />
              ))
            ) : (
              <Link
                to="/skapa"
                className="block rounded-2xl border border-dashed border-border p-4 text-center"
              >
                <p className="text-sm font-bold">Inga aktiva inbjudningar än</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Skapa en plan och bjud in kompisgänget →
                </p>
              </Link>
            )}
          </div>
        </section>
      </div>

    </AppShell>
  );
}
