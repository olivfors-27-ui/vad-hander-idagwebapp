import { createFileRoute, Link } from "@tanstack/react-router";
import { RefreshCw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/hander/AppShell";
import {
  CATEGORY_GRADIENT,
  PLACE_TYPES,
  categoryById,
  PLACES,
  formatShortDay,
  type CategoryId,
  type EventItem,
  type Place,
} from "@/lib/hander-data";
import { useGoCreate } from "@/lib/auth-guard";
import { useHander } from "@/lib/hander-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/overraska")({
  head: () => ({
    meta: [
      { title: "Överraska oss – Händer" },
      {
        name: "description",
        content:
          "Vet ni att ni vill göra något men inte vad? Svara på fem snabba frågor så föreslår Händer en aktivitet.",
      },
      { property: "og:title", content: "Överraska oss – Händer" },
      {
        property: "og:description",
        content: "Fem snabba val – ett konkret förslag som ni kan göra till en plan direkt.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SurprisePage,
});

type Mood = "socialt" | "aktivt" | "kreativt" | "mat" | "musik" | "utomhus" | "ovantat";

const MOODS: { id: Mood; label: string; emoji: string }[] = [
  { id: "socialt", label: "Socialt", emoji: "🎉" },
  { id: "aktivt", label: "Aktivt", emoji: "🧗" },
  { id: "kreativt", label: "Kreativt", emoji: "🎨" },
  { id: "mat", label: "Mat", emoji: "🍔" },
  { id: "musik", label: "Musik", emoji: "🎤" },
  { id: "utomhus", label: "Utomhus", emoji: "🌳" },
  { id: "ovantat", label: "Något oväntat", emoji: "🤪" },
];

const MOOD_CATEGORIES: Record<Mood, CategoryId[]> = {
  socialt: ["fest", "student"],
  aktivt: ["sport", "utomhus"],
  kreativt: ["kultur", "plugg"],
  mat: ["mat"],
  musik: ["musik"],
  utomhus: ["utomhus", "sport"],
  ovantat: ["ovrigt", "shopping", "kultur"],
};

const MOOD_PLACES: Record<Mood, string[]> = {
  socialt: ["forening", "cafe"],
  aktivt: ["gym", "sport"],
  kreativt: ["plugg", "scen"],
  mat: ["restaurang", "cafe"],
  musik: ["scen"],
  utomhus: ["sport"],
  ovantat: ["scen", "forening", "gym"],
};

const DURATIONS = [
  { id: "1-2", label: "1–2 timmar", max: 2 },
  { id: "2-4", label: "2–4 timmar", max: 4 },
  { id: "4+", label: "4+ timmar", max: 99 },
] as const;

const BUDGETS = [
  { id: "0", label: "Gratis", max: 0 },
  { id: "100", label: "Under 100 kr", max: 99 },
  { id: "200", label: "Under 200 kr", max: 199 },
  { id: "any", label: "Spelar ingen roll", max: Infinity },
] as const;

const DISTANCES = [
  { id: "10", label: "10 min", max: 10 },
  { id: "20", label: "20 min", max: 20 },
  { id: "30", label: "30 min", max: 30 },
  { id: "any", label: "Spelar ingen roll", max: Infinity },
] as const;

type DurationId = (typeof DURATIONS)[number]["id"];
type BudgetId = (typeof BUDGETS)[number]["id"];
type DistanceId = (typeof DISTANCES)[number]["id"];

/** Grov gångtid från avstånd i km. */
const minutesAway = (km: number) => Math.max(5, Math.round(km * 11));

const hoursOf = (e: EventItem) => {
  const [sh = 0, sm = 0] = e.start.split(":").map(Number);
  const [eh = 0, em = 0] = e.end.split(":").map(Number);
  let h = eh + em / 60 - (sh + sm / 60);
  if (h <= 0) h += 24;
  return h;
};

type Suggestion = {
  key: string;
  emoji: string;
  gradient: string;
  title: string;
  kind: string;
  minutes: number;
  priceLabel: string;
  durationLabel: string;
  description: string;
  place: string;
  fresh: boolean;
  score: number;
  eventId?: string;
};

const chip = (active: boolean) =>
  cn(
    "rounded-full border px-3 py-2 text-xs font-bold transition-colors",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-card text-foreground",
  );

function SurprisePage() {
  const store = useHander();
  const { go: goCreate } = useGoCreate();

  const [people, setPeople] = useState(4);
  const [duration, setDuration] = useState<DurationId>("2-4");
  const [budget, setBudget] = useState<BudgetId>("200");
  const [distance, setDistance] = useState<DistanceId>("20");
  const [moods, setMoods] = useState<Mood[]>(["socialt"]);
  const [seed, setSeed] = useState(0);
  const [done, setDone] = useState(false);

  const toggleMood = (m: Mood) =>
    setMoods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));

  const suggestions = useMemo<Suggestion[]>(() => {
    const maxHours = DURATIONS.find((d) => d.id === duration)?.max ?? 99;
    const maxPrice = BUDGETS.find((b) => b.id === budget)?.max ?? Infinity;
    const maxMin = DISTANCES.find((d) => d.id === distance)?.max ?? Infinity;
    const cats = new Set(moods.flatMap((m) => MOOD_CATEGORIES[m]));
    const types = new Set(moods.flatMap((m) => MOOD_PLACES[m]));

    const fromEvents: Suggestion[] = store.publicEvents.map((e) => {
      const min = minutesAway(e.distance);
      const hrs = hoursOf(e);
      let score = 0;
      if (cats.has(e.category)) score += 4;
      if (e.price <= maxPrice) score += 3;
      else score -= 3;
      if (min <= maxMin) score += 2;
      else score -= 2;
      if (hrs <= maxHours + 0.5) score += 2;
      else score -= 1;
      if (moods.includes("ovantat") && !cats.has(e.category)) score += 1;
      if (people >= 6 && (e.category === "fest" || e.category === "student")) score += 1;
      if (!store.saved.includes(e.id)) score += 1;
      const cat = categoryById(e.category);
      return {
        key: e.id,
        eventId: e.id,
        emoji: cat.emoji,
        gradient: CATEGORY_GRADIENT[e.category],
        title: e.name,
        kind: `${cat.label} · ${formatShortDay(e.date)} ${e.start}`,
        minutes: min,
        priceLabel: e.price === 0 ? "Gratis" : `${e.price} kr/person`,
        durationLabel: `Ca ${Math.max(1, Math.round(hrs))} timmar`,
        description: e.description,
        place: e.place,
        fresh: !store.saved.includes(e.id) && !e.interested.includes("u1"),
        score,
      };
    });

    const fromPlaces: Suggestion[] = (PLACES as Place[]).map((p) => {
      const min = minutesAway(p.distance);
      let score = 0;
      if (types.has(p.type)) score += 4;
      if (min <= maxMin) score += 2;
      else score -= 2;
      if (maxPrice === 0) score -= 1;
      if (moods.includes("ovantat")) score += 1;
      const t = PLACE_TYPES[p.type];
      return {
        key: p.id,
        emoji: t.emoji,
        gradient: CATEGORY_GRADIENT.ovrigt,
        title: p.name,
        kind: `${t.label} · öppet ${p.open}`,
        minutes: min,
        priceLabel: maxPrice === 0 ? "Oftast billigt" : "Varierar",
        durationLabel: `Ca ${maxHours === 99 ? "4+" : maxHours} timmar`,
        description: p.description,
        place: p.address,
        fresh: !store.savedPlaces.includes(p.id),
        score,
      };
    });

    return [...fromEvents, ...fromPlaces].sort((a, b) => b.score - a.score).slice(0, 6);
  }, [store.publicEvents, store.saved, store.savedPlaces, duration, budget, distance, moods, people]);

  const pick = suggestions.length > 0 ? suggestions[seed % suggestions.length] : undefined;

  const makePlan = () => {
    // UI-guard: utan konto går försöket till inloggningen i stället.
    goCreate();
  };

  return (
    <AppShell title="Överraska oss" subtitle="Experimentell funktion">
      <div className="space-y-6 p-4">
        {!done ? (
          <>
            <p className="rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
              Vet ni att ni vill göra något – men inte vad? Svara på fem snabba frågor så väljer vi
              åt er.
            </p>

            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Antal personer
              </h2>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPeople(n)}
                    className={chip(people === n)}
                  >
                    {n === 10 ? "10+" : n}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Tid
              </h2>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDuration(d.id)}
                    className={chip(duration === d.id)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Budget per person
              </h2>
              <div className="flex flex-wrap gap-2">
                {BUDGETS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBudget(b.id)}
                    className={chip(budget === b.id)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Avstånd
              </h2>
              <div className="flex flex-wrap gap-2">
                {DISTANCES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDistance(d.id)}
                    className={chip(distance === d.id)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Stämning
              </h2>
              <div className="flex flex-wrap gap-2">
                {MOODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMood(m.id)}
                    className={chip(moods.includes(m.id))}
                  >
                    {m.emoji} {m.label}
                  </button>
                ))}
              </div>
            </section>

            <button
              type="button"
              onClick={() => {
                setSeed(0);
                setDone(true);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-sm font-bold text-primary-foreground shadow-[var(--shadow-pin)]"
            >
              <Sparkles className="h-4 w-4" /> Överraska oss
            </button>
          </>
        ) : pick ? (
          <>
            <p className="font-display text-xl font-bold">Vi hittade något åt er.</p>

            <article className="overflow-hidden rounded-3xl border border-border shadow-[var(--shadow-card)]">
              <div
                className="flex h-28 items-center justify-center text-5xl"
                style={{ backgroundImage: pick.gradient }}
                aria-hidden
              >
                {pick.emoji}
              </div>
              <div className="space-y-2 p-4">
                <h2 className="font-display text-lg font-bold">
                  {pick.emoji} {pick.title}
                </h2>
                <p className="text-xs text-muted-foreground">{pick.kind}</p>
                <ul className="flex flex-wrap gap-2 pt-1 text-xs font-bold">
                  <li className="rounded-full bg-secondary px-3 py-1">{pick.minutes} min bort</li>
                  <li className="rounded-full bg-secondary px-3 py-1">{pick.priceLabel}</li>
                  <li className="rounded-full bg-secondary px-3 py-1">{pick.durationLabel}</li>
                  <li className="rounded-full bg-secondary px-3 py-1">
                    {people === 10 ? "10+" : people} personer
                  </li>
                </ul>
                <p className="pt-1 text-sm text-muted-foreground">{pick.description}</p>
                <p className="text-xs text-muted-foreground">📍 {pick.place}</p>
                {pick.fresh ? (
                  <p className="rounded-xl bg-accent/60 px-3 py-2 text-xs font-bold text-accent-foreground">
                    Ni har inte testat detta tidigare.
                  </p>
                ) : null}
              </div>
            </article>

            <div className="space-y-2">
              <button
                type="button"
                onClick={makePlan}
                className="w-full rounded-2xl bg-primary px-4 py-4 text-sm font-bold text-primary-foreground shadow-[var(--shadow-pin)]"
              >
                Skapa plan
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSeed((s) => s + 1)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-bold"
                >
                  <RefreshCw className="h-4 w-4" /> Ge oss ett annat
                </button>
                <button
                  type="button"
                  onClick={() => setDone(false)}
                  className="flex-1 rounded-2xl border border-border px-4 py-3 text-sm font-bold"
                >
                  Ändra svaren
                </button>
              </div>
              {pick.eventId ? (
                <Link
                  to="/event/$id"
                  params={{ id: pick.eventId }}
                  className="block text-center text-xs font-bold text-primary"
                >
                  Se hela eventet →
                </Link>
              ) : null}
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-border p-6 text-center">
            <p className="text-3xl">🤔</p>
            <p className="mt-2 font-display text-base font-bold">Vi hittade inget som passar</p>
            <button
              type="button"
              onClick={() => setDone(false)}
              className="mt-3 text-sm font-bold text-primary"
            >
              Ändra svaren
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
