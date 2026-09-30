import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarClock, ChevronDown, Sparkles, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/hander/AppShell";
import {
  CATEGORY_GRADIENT,
  PLACES,
  PLACE_TYPES,
  TODAY,
  categoryById,
  formatShortDay,
  toISODate,
} from "@/lib/hander-data";
import type { DurationId, FlexPartId, PlanSlot } from "@/lib/hander-plans";
import {
  DURATIONS,
  FLEX_PARTS,
  createPlan,
  makeExactSlot,
  makeFlexSlot,
  makeRangeSlot,
  optionFromEvent,
  optionFromPlace,
} from "@/lib/hander-plans";
import { useHander } from "@/lib/hander-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/skapa-plan")({
  validateSearch: (search: Record<string, unknown>): { event?: string; place?: string } => ({
    ...(typeof search["event"] === "string" ? { event: search["event"] } : {}),
    ...(typeof search["place"] === "string" ? { place: search["place"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Planera med kompisar – Händer" },
      {
        name: "description",
        content:
          "Skapa en plan på 30 sekunder: välj aktivitet, datum och tider – dela sedan länken med gänget.",
      },
      { property: "og:title", content: "Planera med kompisar – Händer" },
      {
        property: "og:description",
        content: "Välj datum och tider, dela länken och låt kompisarna svara utan appen.",
      },
    ],
  }),
  component: CreatePlanPage,
});

const field =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const label = "text-xs font-bold uppercase tracking-wide text-muted-foreground";

const EMOJIS = ["🎉", "🍕", "🎬", "⚽️", "🎧", "☕️", "🏖️", "🎳", "🛹", "🎤"];
const GRADIENT_KEYS = ["fest", "musik", "sport", "mat", "kultur", "ovrigt"] as const;

const TIME_PRESETS = [
  { start: "14:00", end: "18:00", label: "Eftermiddag" },
  { start: "18:00", end: "22:00", label: "Kväll" },
  { start: "20:00", end: "00:00", label: "Sent" },
];

function nextDays(n: number) {
  const out: string[] = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    out.push(toISODate(new Date(d.getTime() + i * 86400000)));
  }
  return out;
}

function CreatePlanPage() {
  const { event: eventId, place: placeId } = Route.useSearch();
  const store = useHander();
  const navigate = useNavigate();
  const sourceEvent = eventId ? store.events.find((e) => e.id === eventId) : undefined;
  const sourcePlace = placeId ? PLACES.find((p) => p.id === placeId) : undefined;

  const [title, setTitle] = useState(
    sourceEvent
      ? `Ska vi köra ${sourceEvent.name}?`
      : sourcePlace
        ? `Ska vi köra ${sourcePlace.name}?`
        : "",
  );
  const [note, setNote] = useState(
    sourceEvent
      ? sourceEvent.description.slice(0, 140)
      : sourcePlace
        ? sourcePlace.description.slice(0, 140)
        : "",
  );
  const [place, setPlace] = useState(
    sourceEvent ? sourceEvent.place : sourcePlace ? sourcePlace.name : "",
  );
  const [emoji, setEmoji] = useState(
    sourceEvent
      ? categoryById(sourceEvent.category).emoji
      : sourcePlace
        ? PLACE_TYPES[sourcePlace.type].emoji
        : EMOJIS[0]!,
  );
  const [gradient, setGradient] = useState(
    sourceEvent ? CATEGORY_GRADIENT[sourceEvent.category] : CATEGORY_GRADIENT.fest,
  );
  const [more, setMore] = useState(false);

  const days = useMemo(() => nextDays(14), []);
  const [pickedDays, setPickedDays] = useState<string[]>([sourceEvent?.date ?? TODAY]);
  const [mode, setMode] = useState<"flex" | "range" | "exact">("flex");
  const [from, setFrom] = useState("18:00");
  const [to, setTo] = useState("22:00");
  const [exact, setExact] = useState(sourceEvent?.start ?? "19:00");
  const [duration, setDuration] = useState<DurationId>("unknown");
  const [slots, setSlots] = useState<PlanSlot[]>(() =>
    sourceEvent ? [makeRangeSlot(sourceEvent.date, sourceEvent.start, sourceEvent.end)] : [],
  );

  const toggleDay = (d: string) =>
    setPickedDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]));

  const targetDays = pickedDays.length > 0 ? pickedDays : [TODAY];

  const addSlots = (make: (d: string) => PlanSlot) => {
    setSlots((list) => {
      const next = [...list];
      for (const d of targetDays) {
        const candidate = make(d);
        const dup = next.some(
          (s) =>
            s.date === candidate.date &&
            s.kind === candidate.kind &&
            s.start === candidate.start &&
            s.end === candidate.end &&
            s.flex === candidate.flex,
        );
        if (!dup) next.push(candidate);
      }
      return next;
    });
  };

  const addFlex = (flex: FlexPartId) => addSlots((d) => makeFlexSlot(d, flex, duration));
  const addRange = () => addSlots((d) => makeRangeSlot(d, from, to, duration));
  const addExact = () => addSlots((d) => makeExactSlot(d, exact, duration));

  const sortSlots = (list: PlanSlot[]) =>
    [...list].sort((a, b) =>
      `${a.date ?? ""}${a.start ?? ""}`.localeCompare(`${b.date ?? ""}${b.start ?? ""}`),
    );
  const sortedSlots = sortSlots(slots);

  const submit = () => {
    const finalTitle =
      title.trim() || sourceEvent?.name || sourcePlace?.name || "Vad ska vi göra?";
    if (slots.length === 0) {
      toast.error("Välj minst en tid som gänget kan svara på");
      return;
    }
    const plan = createPlan({
      title: finalTitle,
      createdBy: store.me,
      note: note.trim(),
      place: place.trim(),
      emoji,
      gradient,
      slots: sortedSlots,

      ...(sourceEvent
        ? { options: [optionFromEvent(sourceEvent)], eventId: sourceEvent.id }
        : sourcePlace
          ? { options: [optionFromPlace(sourcePlace)] }
          : { options: [] }),
    });
    store.addPlan(plan);
    void navigate({ to: "/plan/$id", params: { id: plan.id }, search: { ny: true } });
  };

  return (
    <AppShell title="Planera med kompisar" subtitle="Klart på 30 sekunder">
      <div className="space-y-6 p-4 pb-28">
        {sourceEvent ? (
          <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-accent/50 p-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl"
              style={{ background: gradient }}
            >
              {emoji}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{sourceEvent.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {sourceEvent.place} · {formatShortDay(sourceEvent.date)} {sourceEvent.start}
              </p>
            </div>
          </div>
        ) : null}

        {/* 1. Vad */}
        <label className="block space-y-1.5">
          <span className={label}>1. Vad ska ni göra?</span>
          <input
            className={field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={sourceEvent ? sourceEvent.name : "T.ex. Karaoke på fredag"}
          />
        </label>

        {/* 2. När */}
        <section className="space-y-3">
          <div>
            <span className={label}>2. Vilka dagar kan passa?</span>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5 text-primary" /> Välj en eller flera dagar –
              lägg sedan till tider. Gänget röstar sedan.
            </p>
          </div>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {days.map((d) => {
              const count = slots.filter((s) => s.date === d).length;
              const active = pickedDays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={cn(
                    "relative shrink-0 rounded-2xl border px-3 py-2 text-xs font-bold",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card",
                  )}
                >
                  {formatShortDay(d)}
                  {count > 0 ? (
                    <span className="ml-1 rounded-full bg-accent px-1.5 text-[10px] text-accent-foreground">
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Typ av tid */}
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "flex", label: "Flexibel" },
                { id: "range", label: "Intervall" },
                { id: "exact", label: "Exakt tid" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={cn(
                  "rounded-2xl border px-2 py-2.5 text-xs font-bold",
                  mode === m.id ? "border-primary bg-accent/70" : "border-border bg-card",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === "flex" ? (
            <div className="flex flex-wrap gap-2">
              {FLEX_PARTS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addFlex(p.id)}
                  className="rounded-full border border-border bg-card min-h-10 px-3.5 text-xs font-bold"
                >
                  {p.emoji} {p.label}
                </button>
              ))}
            </div>
          ) : mode === "range" ? (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className={label}>Tidigast</span>
                  <input
                    type="time"
                    className={field}
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label className="space-y-1">
                  <span className={label}>Senast</span>
                  <input
                    type="time"
                    className={field}
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {TIME_PRESETS.map((t) => (
                  <button
                    key={t.start}
                    type="button"
                    onClick={() => {
                      setFrom(t.start);
                      setTo(t.end);
                    }}
                    className="rounded-full border border-border min-h-9 px-3 text-xs font-bold"
                  >
                    {t.label} {t.start}–{t.end}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={addRange}
                className="w-full rounded-2xl bg-secondary px-3 py-3 text-xs font-bold"
              >
                Lägg till {from}–{to}
              </button>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
              <label className="block space-y-1">
                <span className={label}>Klockslag</span>
                <input
                  type="time"
                  className={field}
                  value={exact}
                  onChange={(e) => setExact(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {["17:00", "18:00", "19:00", "20:00"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setExact(t)}
                    className="rounded-full border border-border min-h-9 px-3 text-xs font-bold"
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={addExact}
                className="w-full rounded-2xl bg-secondary px-3 py-3 text-xs font-bold"
              >
                Lägg till {exact}
              </button>
            </div>
          )}

          {/* Varaktighet */}
          <div className="space-y-2">
            <span className={label}>Ungefär hur länge?</span>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDuration(d.id)}
                  className={cn(
                    "rounded-full border min-h-9 px-3.5 text-xs font-bold",
                    duration === d.id ? "border-primary bg-accent/70" : "border-border bg-card",
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {slots.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {sortedSlots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSlots((list) => list.filter((x) => x.id !== s.id))}
                  className="rounded-full border border-primary bg-accent/60 min-h-9 px-3.5 py-2 text-xs font-bold"
                >
                  {s.label} ✕
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-secondary/70 p-3 text-xs text-muted-foreground">
              Välj minst ett alternativ, t.ex. fredag kväll eller 18:00–22:00.
            </p>
          )}
        </section>


        {/* 3. Detaljer (valfritt) */}
        <section className="rounded-3xl border border-border">
          <button
            type="button"
            onClick={() => setMore((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3.5 text-sm font-bold"
          >
            Lägg till plats, text & bild (valfritt)
            <ChevronDown className={cn("h-4 w-4 transition-transform", more && "rotate-180")} />
          </button>
          {more ? (
            <div className="space-y-4 border-t border-border p-4">
              <label className="block space-y-1.5">
                <span className={label}>Plats</span>
                <input
                  className={field}
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="T.ex. Södermalm, Stockholm"
                />
              </label>

              <label className="block space-y-1.5">
                <span className={label}>Kort beskrivning</span>
                <textarea
                  className={cn(field, "min-h-20 resize-none")}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Vi vill hitta på något på fredag"
                />
              </label>

              <div className="space-y-2">
                <span className={label}>Bild</span>
                <div
                  className="flex h-20 items-center justify-center rounded-2xl"
                  style={{ background: gradient }}
                >
                  <span className="text-3xl">{emoji}</span>
                </div>
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-xl",
                        emoji === e ? "border-primary bg-accent/60" : "border-border",
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                  {GRADIENT_KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-label={`Färg ${k}`}
                      onClick={() => setGradient(CATEGORY_GRADIENT[k])}
                      className={cn(
                        "h-9 w-14 shrink-0 rounded-xl border-2",
                        gradient === CATEGORY_GRADIENT[k] ? "border-primary" : "border-transparent",
                      )}
                      style={{ background: CATEGORY_GRADIENT[k] }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Du får en delbar länk – kompisarna
          svarar utan appen.
        </p>

        <Link to="/planer" className="flex min-h-11 items-center justify-center text-center text-xs font-bold text-primary">
          Se dina planer →
        </Link>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-md border-t border-border bg-background/95 p-3 backdrop-blur-md">
        <button
          type="button"
          onClick={submit}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-sm font-bold text-primary-foreground shadow-[var(--shadow-pin)]"
        >
          <Users className="h-4 w-4" /> Skapa plan & få länk
        </button>
      </div>
    </AppShell>
  );
}
