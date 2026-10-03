import { Link } from "@tanstack/react-router";
import { CalendarClock, Check, MapPin, PartyPopper, Share2, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/hander/AppShell";
import { ShareSheet, absoluteUrl } from "@/components/hander/ShareSheet";
import { userById } from "@/lib/hander-data";
import type { Availability, Plan } from "@/lib/hander-plans";
import { planLink, slotStats, tally, topOf } from "@/lib/hander-plans";
import { useHander } from "@/lib/hander-store";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

const CHOICES: { value: Availability; label: string; dot: string; active: string }[] = [
  { value: "yes", label: "Jag kan", dot: "🟢", active: "border-primary bg-accent/70" },
  { value: "maybe", label: "Kanske", dot: "🟡", active: "border-primary bg-accent/40" },
  { value: "no", label: "Jag kan inte", dot: "🔴", active: "border-border bg-card" },
];

export function PlanNotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center justify-center p-8 text-center">
      <div>
        <p className="text-3xl">🔍</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Länken är ogiltig eller så är planen borttagen.
        </p>
        <Link to="/" className="mt-4 inline-block text-sm font-bold text-primary">
          Upptäck vad som händer
        </Link>
      </div>
    </div>
  );
}

/**
 * Publik vy för en delad plan. Kräver varken konto eller app –
 * vem som helst kan se planen och svara med sitt namn.
 */
export function PublicPlan({ plan }: { plan: Plan }) {
  const store = useHander();
  const creator = userById(plan.createdBy);

  const [name, setName] = useState("");
  const [answers, setAnswers] = useState<Record<string, Availability>>({});
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const stats = slotStats(plan);
  const counts = tally(plan);
  const leadingOption =
    plan.decidedOptionId ??
    topOf(
      counts.options,
      plan.options.map((o) => o.id),
    );
  const closed = Boolean(plan.decidedSlotId || plan.decidedOptionId);
  const decided = plan.decidedOptionId
    ? plan.options.find((o) => o.id === plan.decidedOptionId)
    : undefined;
  const decidedSlot = plan.decidedSlotId
    ? plan.slots.find((s) => s.id === plan.decidedSlotId)
    : undefined;
  const firstOption = plan.options[0];
  const coverGradient = plan.gradient ?? firstOption?.gradient ?? "var(--accent)";
  const displayNote = plan.note;

  const submit = () => {
    if (!name.trim()) {
      toast.error("Skriv ditt namn först.");
      return;
    }
    if (Object.keys(answers).length === 0) {
      toast.error("Välj Kan, Kanske eller Kan inte på minst en tid.");
      return;
    }
    const slotIds = Object.entries(answers)
      .filter(([, v]) => v === "yes")
      .map(([k]) => k);
    const chosenOptions =
      plan.options.length === 1 && firstOption ? [firstOption.id] : optionIds;
    store.addReply(plan.id, {
      name: name.trim(),
      optionIds: chosenOptions,
      slotIds,
      answers,
      comment: comment.trim(),
    });
    setSent(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.success("Tack! Ditt svar är skickat.");
  };

  return (
    <AppShell title="Du är inbjuden" subtitle="Svara på planen">
    <div className={cn("min-h-screen w-full bg-background", sent || closed ? "pb-10" : "pb-32")}>
      {/* Bild / omslag */}
      <div
        className="flex h-40 items-center justify-center"
        style={{ background: coverGradient }}
      >
        <span className="text-6xl">{plan.emoji ?? firstOption?.emoji ?? "🎉"}</span>
      </div>

      <header className="space-y-2 px-4 py-4">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">
          Vad Händer? - Inbjudan
        </p>
        <h1 className="font-display text-2xl font-bold leading-tight">{plan.title}</h1>
        {displayNote ? <p className="text-sm text-muted-foreground">{displayNote}</p> : null}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {plan.place ? (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" /> {plan.place}
            </span>
          ) : null}
          {plan.slots[0] ? (
            <span className="flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4 text-primary" />
              {plan.slots.length === 1 ? plan.slots[0].label : `${plan.slots.length} tidsförslag`}
            </span>
          ) : null}
          <span className="flex items-center gap-1.5">
            <User className="h-4 w-4 text-primary" />
            {creator.name === "Du" ? "En kompis bjöd in dig" : `${creator.name} bjöd in dig`}
          </span>
        </div>
        {!closed ? (            <p className="rounded-2xl border border-border bg-accent/70 px-3 py-2 text-xs text-accent-foreground">
              Svara direkt här – du behöver varken konto eller app.
            </p>
        ) : null}
      </header>


      <div className="space-y-6 px-4">
        {closed ? (
          <div className="space-y-1 rounded-3xl border border-primary/40 bg-accent/60 p-5 text-center">
            <p className="text-3xl">🎉</p>
            <p className="flex items-center justify-center gap-2 font-display text-lg font-bold">
              <PartyPopper className="h-4 w-4 text-primary" /> Planen är bestämd!
            </p>
            <p className="text-base font-bold">{decided?.title ?? plan.title}</p>
            <p className="text-sm text-muted-foreground">
              {decidedSlot ? decidedSlot.label : "Tid ej satt"}
            </p>
            {plan.place ? (
              <p className="text-sm text-muted-foreground">{plan.place}</p>
            ) : null}
          </div>
        ) : null}

        {/* Vad gruppen röstar på */}
        {plan.options.length === 1 && firstOption ? (
          <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg"
              style={{ background: firstOption.gradient }}
            >
              {firstOption.emoji}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Aktivitet
              </span>
              <span className="block truncate text-sm font-bold">{firstOption.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {firstOption.subtitle}
              </span>
            </span>
          </section>
        ) : plan.options.length > 1 ? (
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Det här röstar gänget på
            </h2>
            {plan.options.map((o) => {
              const n = counts.options[o.id] ?? 0;
              const active = optionIds.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={sent}
                  onClick={() =>
                    setOptionIds((cur) =>
                      cur.includes(o.id) ? cur.filter((x) => x !== o.id) : [...cur, o.id],
                    )
                  }
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border p-3 text-left",
                    active ? "border-primary bg-accent/60" : "border-border bg-card",
                  )}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                    style={{ background: o.gradient }}
                  >
                    {o.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{o.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {o.subtitle}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-1 text-[11px] font-bold",
                      leadingOption === o.id && n > 0
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground",
                    )}
                  >
                    {n} {n === 1 ? "röst" : "röster"}
                  </span>
                </button>
              );
            })}
          </section>
        ) : null}

        {!sent && !closed ? (
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Ditt namn
            </span>
            <input
              className={field}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="T.ex. Elias"
            />
          </label>
        ) : null}

        {/* Kan du? */}
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold">
            {closed ? "Så svarade gänget" : "Kan du?"}
          </h2>
          {plan.slots.map((s) => {
            const stat = stats[s.id] ?? { yes: 0, maybe: 0, no: 0, score: 0 };
            const mine = answers[s.id];
            return (
              <div
                key={s.id}
                className={cn(
                  "space-y-2 rounded-3xl border border-border bg-card p-3",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold uppercase tracking-wide">{s.label}</p>

                </div>
                <p className="text-xs font-semibold text-muted-foreground">
                  🟢 {stat.yes} kan · 🟡 {stat.maybe} kanske · 🔴 {stat.no} kan inte
                </p>
                {!sent && !closed ? (
                  <div className="grid grid-cols-3 gap-2">
                    {CHOICES.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setAnswers((a) => ({ ...a, [s.id]: c.value }))}
                        className={cn(
                          "rounded-2xl border px-2 py-2.5 text-[11px] font-bold leading-tight",
                          mine === c.value ? c.active : "border-border bg-card",
                        )}
                      >
                        <span className="block text-base">{c.dot}</span>
                        {c.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>

        {closed ? null : sent ? (
          <div className="space-y-3 rounded-3xl border border-border p-5 text-center">
            <p className="text-3xl">🙌</p>
            <p className="font-display text-lg font-bold">Tack {name.split(" ")[0]}!</p>
            <p className="text-sm text-muted-foreground">
              Ditt svar är sparat. {plan.replies.length}{" "}
              {plan.replies.length === 1 ? "person har" : "personer har"} svarat hittills.
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-xs font-bold text-primary"
            >
              Ändra mitt svar
            </button>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-bold"
            >
              <Share2 className="h-4 w-4" /> Skicka vidare till fler
            </button>
          </div>
        ) : (
          <div className="space-y-2 rounded-3xl border border-border bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Något att lägga till?
            </p>
            <textarea
              className={cn(field, "min-h-20 resize-none")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Skriv en hälsning, fråga eller extra info till gänget …"
            />
            <p className="text-[11px] text-muted-foreground">
              Syns för värden och alla som svarat på inbjudan.
            </p>
          </div>
        )}
      </div>

      {!sent && !closed ? (
        <div className="flex justify-center p-4">
          <button
            type="button"
            onClick={submit}
            className="hander-cta-button flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-sm font-bold text-primary-foreground active:translate-y-[2px]"
          >
            <Check className="h-4 w-4" /> Skicka svar
          </button>
        </div>
      ) : null}

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        preview={{
          tagline: "Vi borde göra något! 👀",
          title: plan.title,
          emoji: plan.emoji ?? firstOption?.emoji ?? "🎉",
          gradient: coverGradient,
          meta: [plan.slots[0]?.label, plan.place].filter(Boolean).join(" · ") || undefined,
          cta: "Tryck för att se planen och svara.",
          url: absoluteUrl(`/plan/${plan.code}`),
          displayUrl: planLink(plan.code),
          shareText: displayNote || `Vi borde göra något! Kolla planen "${plan.title}" och svara.`,
        }}
      />
    </div>
    </AppShell>
  );
}
