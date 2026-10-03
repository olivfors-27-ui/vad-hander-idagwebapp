// Planer: kärnflödet "hitta något → skapa plan → dela → kompisar svarar → bestäm".
import { CATEGORY_GRADIENT, PLACE_TYPES, TODAY, TOMORROW, formatShortDay } from "./hander-data";
import type { EventItem, Place } from "./hander-data";
import { appUrl } from "./app-url";

export type PlanOption = {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  gradient: string;
  eventId?: string | undefined;
  placeId?: string | undefined;
};

/** Hur tiden är angiven: exakt klockslag, ett intervall eller en flexibel del av dagen. */
export type SlotKind = "exact" | "range" | "flex";

/** Flexibla delar av dagen. */
export const FLEX_PARTS = [
  { id: "any", label: "När som helst", emoji: "🕐" },
  { id: "morning", label: "Förmiddag", emoji: "🌅" },
  { id: "afternoon", label: "Eftermiddag", emoji: "☀️" },
  { id: "evening", label: "Kväll", emoji: "🌆" },
  { id: "late", label: "Sent på kvällen", emoji: "🌙" },
] as const;

export type FlexPartId = (typeof FLEX_PARTS)[number]["id"];

/** Ungefärlig varaktighet. */
export const DURATIONS = [
  { id: "1-2", label: "1–2 timmar" },
  { id: "2-3", label: "2–3 timmar" },
  { id: "3-4", label: "3–4 timmar" },
  { id: "4+", label: "4+ timmar" },
  { id: "unknown", label: "Vet inte än" },
] as const;

export type DurationId = (typeof DURATIONS)[number]["id"];

export type PlanSlot = {
  id: string;
  label: string;
  date?: string | undefined; // YYYY-MM-DD
  start?: string | undefined; // HH:MM
  end?: string | undefined; // HH:MM
  kind?: SlotKind | undefined;
  flex?: FlexPartId | undefined;
  duration?: DurationId | undefined;
};

const durationLabel = (d?: DurationId) =>
  d && d !== "unknown" ? DURATIONS.find((x) => x.id === d)?.label : undefined;

const withDuration = (base: string, d?: DurationId) => {
  const dl = durationLabel(d);
  return dl ? `${base} · ${dl}` : base;
};

/** Exakt klockslag, t.ex. "Fre 12 sep 19:00". */
export function makeExactSlot(date: string, start: string, duration?: DurationId): PlanSlot {
  return {
    id: uid("slot"),
    label: withDuration(`${formatShortDay(date)} ${start}`, duration),
    date,
    start,
    kind: "exact",
    duration,
  };
}

/** Tidsintervall, t.ex. "Fre 12 sep 18:00–22:00". */
export function makeRangeSlot(
  date: string,
  start: string,
  end: string,
  duration?: DurationId,
): PlanSlot {
  return {
    id: uid("slot"),
    label: withDuration(`${formatShortDay(date)} ${start}–${end}`, duration),
    date,
    start,
    end,
    kind: "range",
    duration,
  };
}

/** Flexibel tid, t.ex. "Lör 13 sep · Kväll". */
export function makeFlexSlot(date: string, flex: FlexPartId, duration?: DurationId): PlanSlot {
  const part = FLEX_PARTS.find((p) => p.id === flex);
  return {
    id: uid("slot"),
    label: withDuration(`${formatShortDay(date)} · ${part?.label ?? "När som helst"}`, duration),
    date,
    kind: "flex",
    flex,
    duration,
  };
}

/** Bakåtkompatibel hjälpare: bygger en tidslucka av datum + tidsintervall. */
export function makeSlot(date: string, start: string, end: string): PlanSlot {
  return makeRangeSlot(date, start, end);
}

/** Svar per tidsförslag: kan / kanske / kan inte. */
export type Availability = "yes" | "maybe" | "no";

export type PlanReply = {
  id: string;
  name: string;
  optionIds: string[];
  slotIds: string[]; // tider personen kan (bakåtkompatibelt)
  answers?: Record<string, Availability> | undefined;
  comment?: string | undefined;
  at: string;
};

export type Plan = {
  id: string;
  code: string;
  title: string;
  note: string;
  createdBy: string;
  createdAt: string;
  options: PlanOption[];
  slots: PlanSlot[];
  replies: PlanReply[];
  decidedOptionId?: string | undefined;
  decidedSlotId?: string | undefined;
  /** Presentation: bild/omslag för planen */
  emoji?: string | undefined;
  image?: string | undefined;
  gradient?: string | undefined;
  /** Plats som planen utgår från */
  place?: string | undefined;
  /** Om planen skapades från ett event */
  eventId?: string | undefined;
};

const PLAN_COVERS = {
  social: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=320&q=82",
  karaoke: "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=320&q=82",
  bowling: "https://images.unsplash.com/photo-1519671282429-b44660ead0a7?auto=format&fit=crop&w=320&q=82",
  outdoor: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=320&q=82",
} as const;

/** Stabil bild för planer som skapats innan planer fick ett eget bildfält. */
export function planImage(plan: Pick<Plan, "image" | "title" | "note">): string {
  if (plan.image?.startsWith("http")) return plan.image;
  const title = `${plan.title} ${plan.note}`.toLowerCase();
  if (title.includes("karaoke")) return PLAN_COVERS.karaoke;
  if (title.includes("bowling")) return PLAN_COVERS.bowling;
  if (title.includes("vatten") || title.includes("park") || title.includes("häng")) return PLAN_COVERS.outdoor;
  return PLAN_COVERS.social;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const randomCode = (n = 6) =>
  Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Publik, delbar länk till en plan (absolut URL som fungerar i SMS/mejl). */
export const planLink = (code: string) => appUrl(`/plan/${code}`);

export function optionFromEvent(e: EventItem): PlanOption {
  return {
    id: uid("opt"),
    title: e.name,
    subtitle: `${e.place} · ${formatShortDay(e.date)} ${e.start}`,
    emoji: "📍",
    gradient: CATEGORY_GRADIENT[e.category],
    eventId: e.id,
  };
}

export function optionFromPlace(p: Place): PlanOption {
  return {
    id: uid("opt"),
    title: p.name,
    subtitle: `${PLACE_TYPES[p.type].label} · ${p.distance} km bort`,
    emoji: PLACE_TYPES[p.type].emoji,
    gradient: CATEGORY_GRADIENT.ovrigt,
    placeId: p.id,
  };
}

export function customOption(title: string): PlanOption {
  return {
    id: uid("opt"),
    title,
    subtitle: "Eget förslag",
    emoji: "✨",
    gradient: CATEGORY_GRADIENT.ovrigt,
  };
}

export function defaultSlots(date?: string, start?: string): PlanSlot[] {
  const time = start ?? "20:00";
  const first = date ?? TODAY;
  const labels = [
    `${formatShortDay(first)} ${time}`,
    `${formatShortDay(first === TODAY ? TOMORROW : TODAY)} ${time}`,
    "Helgen, när som helst",
  ];
  return labels.map((label) => ({ id: uid("slot"), label }));
}

/** Skapar en ny tom plan, eventuellt med ett första förslag. */
export function createPlan(opts: {
  title: string;
  createdBy: string;
  note?: string;
  options?: PlanOption[];
  slots?: PlanSlot[];
  emoji?: string;
  image?: string;
  gradient?: string;
  place?: string;
  eventId?: string;
}): Plan {
  return {
    id: uid("plan"),
    code: randomCode(),
    title: opts.title,
    note: opts.note ?? "",
    createdBy: opts.createdBy,
    createdAt: new Date().toISOString(),
    options: opts.options ?? [],
    slots: opts.slots ?? defaultSlots(),
    replies: [],
    emoji: opts.emoji ?? "🎉",
    image: opts.image,
    gradient: opts.gradient ?? CATEGORY_GRADIENT.ovrigt,
    place: opts.place ?? "",
    eventId: opts.eventId,
  };
}

export function tally(plan: Plan) {
  const options: Record<string, number> = {};
  const slots: Record<string, number> = {};
  for (const r of plan.replies) {
    for (const id of r.optionIds) options[id] = (options[id] ?? 0) + 1;
    for (const id of r.slotIds) slots[id] = (slots[id] ?? 0) + 1;
  }
  return { options, slots };
}

export function topOf(counts: Record<string, number>, ids: string[]) {
  let best: string | undefined;
  let bestN = 0;
  for (const id of ids) {
    const n = counts[id] ?? 0;
    if (n > bestN) {
      best = id;
      bestN = n;
    }
  }
  return best;
}

export type SlotStat = { yes: number; maybe: number; no: number; score: number };

/** Räknar 🟢/🟡/🔴 per tid. Poäng: kan = 2, kanske = 1, kan inte = 0. */
export function slotStats(plan: Plan): Record<string, SlotStat> {
  const out: Record<string, SlotStat> = {};
  for (const s of plan.slots) out[s.id] = { yes: 0, maybe: 0, no: 0, score: 0 };
  for (const r of plan.replies) {
    for (const s of plan.slots) {
      const stat = out[s.id];
      if (!stat) continue;
      const a: Availability | undefined =
        r.answers?.[s.id] ?? (r.slotIds.includes(s.id) ? "yes" : undefined);
      if (a === "yes") {
        stat.yes += 1;
        stat.score += 2;
      } else if (a === "maybe") {
        stat.maybe += 1;
        stat.score += 1;
      } else if (a === "no") {
        stat.no += 1;
      }
    }
  }
  return out;
}

/** Tiden som funkar bäst för gänget just nu. */
export function bestSlotId(plan: Plan): string | undefined {
  const stats = slotStats(plan);
  let best: string | undefined;
  let bestScore = 0;
  for (const s of plan.slots) {
    const stat = stats[s.id];
    if (!stat) continue;
    if (stat.score > bestScore) {
      best = s.id;
      bestScore = stat.score;
    }
  }
  return best;
}

/** Kort mening om vilket alternativ som fungerar för flest, t.ex. "Lör 13 sep · Kväll fungerar för flest (4 av 5)". */
export function bestSlotSummary(plan: Plan): string | undefined {
  if (plan.replies.length === 0) return undefined;
  const id = bestSlotId(plan);
  if (!id) return undefined;
  const slot = plan.slots.find((s) => s.id === id);
  const stat = slotStats(plan)[id];
  if (!slot || !stat || stat.yes + stat.maybe === 0) return undefined;
  const extra = stat.maybe > 0 ? ` (+${stat.maybe} kanske)` : "";
  return `${slot.label} fungerar för flest – ${stat.yes} av ${plan.replies.length} kan${extra}`;
}
