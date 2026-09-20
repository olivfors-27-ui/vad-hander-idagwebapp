import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  CalendarClock,
  Check,
  Copy,
  MapPin,
  PartyPopper,
  Plus,
  Share2,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/hander/AppShell";
import { PlanNotFound, PublicPlan } from "@/components/hander/PublicPlan";
import { ShareSheet, absoluteUrl } from "@/components/hander/ShareSheet";
import { DEMO_PLAN_GRADIENT, bestSlotId, bestSlotSummary, customOption, planLink, slotStats, tally, topOf, uid } from "@/lib/hander-plans";
import { useHander } from "@/lib/hander-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/plan/$id")({
  validateSearch: (search: Record<string, unknown>): { ny?: true } =>
    search["ny"] === true || search["ny"] === "true" ? { ny: true } : {},
  head: () => ({
    meta: [
      { title: "Din plan – Händer" },
      {
        name: "description",
        content: "Samla förslag, dela länken med kompisgänget och bestäm vad ni ska göra.",
      },
      { property: "og:title", content: "Din plan – Händer" },
      { property: "og:description", content: "Kompisarna svarar via länk – ni bestämmer ihop." },
    ],
  }),
  component: PlanPage,
});

const field =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";


function PlanPage() {
  const { id } = useParams({ from: "/plan/$id" });
  const { ny } = Route.useSearch();
  const store = useHander();
  const plan = store.plans.find((p) => p.id === id);
  const [optionInput, setOptionInput] = useState("");
  const [slotInput, setSlotInput] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

  // Delade länkar ser ut som /plan/AB72KQ – då visas den publika vyn (inget konto behövs).
  const byCode = store.plans.find((p) => p.code.toUpperCase() === id.toUpperCase());

  if (!plan) {
    if (byCode) return <PublicPlan plan={byCode} />;
    return <PlanNotFound />;
  }

  // Inbjuden (inte skaparen) ser gästvyn – samma som den delade länken, utan redigering.
  const MY_NAME = "Du";
  const isHost =
    plan.createdBy === MY_NAME || plan.createdBy.trim().toLowerCase() === "du";
  if (!isHost && !ny) {
    return <PublicPlan plan={plan} />;
  }

  const link = planLink(plan.code);
  const counts = tally(plan);
  const topOption = topOf(counts.options, plan.options.map((o) => o.id));
  const stats = slotStats(plan);
  const topSlot = plan.decidedSlotId ?? bestSlotId(plan) ?? topOf(counts.slots, plan.slots.map((s) => s.id));
  const smartSummary = bestSlotSummary(plan);
  const decided = plan.decidedOptionId
    ? plan.options.find((o) => o.id === plan.decidedOptionId)
    : undefined;
  const decidedSlot = plan.decidedSlotId
    ? plan.slots.find((s) => s.id === plan.decidedSlotId)
    : undefined;
  const coverGradient =
    plan.id === "demo-inbjudan" ? DEMO_PLAN_GRADIENT : plan.gradient ?? "var(--accent)";

  const share = () => {
    navigator.clipboard?.writeText(absoluteUrl(`/plan/${plan.code}`));
    toast.success("Länken är kopierad – klistra in i gruppchatten!");
  };

  return (
    <AppShell title={plan.title} subtitle={`${plan.replies.length} ${plan.replies.length === 1 ? "svar" : "svar"} · kod ${plan.code}`}>
      <div className="space-y-6 p-4">
        {decided ? (
          <div className="rounded-3xl border-2 border-primary bg-accent p-4">
            <p className="font-display text-lg font-bold text-accent-foreground">
              🎉 Planen är bestämd!
            </p>
            <p className="mt-1 text-sm font-bold">
              {decided.emoji} {decided.title}
            </p>
            <p className="text-xs text-muted-foreground">
              {decidedSlot ? decidedSlot.label : "Tid ej satt"}
              {plan.place ? ` · ${plan.place}` : ""}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Dela länken igen så ser alla vad ni bestämde.
            </p>
          </div>
        ) : null}

        {ny ? (
          <div className="flex items-center gap-3 rounded-3xl border border-primary/40 bg-accent/60 p-4">
            <PartyPopper className="h-6 w-6 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="font-display text-base font-bold">Din plan är skapad!</p>
              <p className="text-xs text-muted-foreground">
                Dela länken så kan gänget svara direkt – utan appen.
              </p>
            </div>
          </div>
        ) : null}

        <div
          className="flex h-28 items-center justify-center rounded-3xl"
          style={{ background: coverGradient }}
        >
          <span className="text-5xl">{plan.emoji ?? "🎉"}</span>
        </div>
        {plan.place ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 text-primary" /> {plan.place}
          </p>
        ) : null}

        <div className="rounded-3xl border border-primary/40 bg-accent/50 p-4">
          <p className="text-sm font-bold text-accent-foreground">Dela med gänget</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Kompisarna kan svara direkt i länken – utan att ladda ner appen.
          </p>
          <p className="mt-3 break-all font-mono text-sm font-bold">{link}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={share}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground"
            >
              <Copy className="h-3.5 w-3.5" /> Kopiera länk
            </button>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-xs font-bold"
            >
              <Share2 className="h-3.5 w-3.5" /> {plan.replies.length > 0 ? "Dela igen" : "Dela plan"}
            </button>
          </div>
          <Link
            to="/p/$code"
            params={{ code: plan.code }}
            className="mt-2 block text-center text-xs font-bold text-primary"
          >
            Förhandsgranska vad kompisarna ser →
          </Link>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Vad gäller det?
          </span>
          <input
            className={field}
            value={plan.title}
            onChange={(e) => store.updatePlan(plan.id, { title: e.target.value })}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Meddelande till gänget
          </span>
          <textarea
            className={cn(field, "min-h-20 resize-none")}
            value={plan.note}
            placeholder="T.ex. Vi kör något ikväll – rösta på vad!"
            onChange={(e) => store.updatePlan(plan.id, { note: e.target.value })}
          />
        </label>

        {/* Förslag */}
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 font-display text-base font-bold">
            <Sparkles className="h-4 w-4 text-primary" /> Förslag ({plan.options.length})
          </h2>
          {plan.options.map((o) => {
            const n = counts.options[o.id] ?? 0;
            return (
              <div
                key={o.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3",
                  plan.decidedOptionId === o.id ? "border-primary bg-accent/60" : "border-border",
                )}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                  style={{ background: o.gradient }}
                >
                  {o.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{o.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{o.subtitle}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-1 text-[11px] font-bold",
                    topOption === o.id && n > 0
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {n} {n === 1 ? "röst" : "röster"}
                </span>
                <button
                  type="button"
                  aria-label={`Ta bort ${o.title}`}
                  onClick={() =>
                    store.updatePlan(plan.id, {
                      options: plan.options.filter((x) => x.id !== o.id),
                    })
                  }
                  className="shrink-0 text-muted-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          <div className="flex gap-2">
            <input
              className={field}
              value={optionInput}
              placeholder="Lägg till eget förslag"
              onChange={(e) => setOptionInput(e.target.value)}
            />
            <button
              type="button"
              onClick={() => {
                if (!optionInput.trim()) return;
                store.updatePlan(plan.id, {
                  options: [...plan.options, customOption(optionInput.trim())],
                });
                setOptionInput("");
              }}
              className="rounded-2xl bg-secondary px-4 text-sm font-bold"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <Link
            to="/"
            className="block rounded-2xl border border-dashed border-border p-3 text-center text-xs font-bold text-primary"
          >
            Hitta fler förslag på Upptäck →
          </Link>
        </section>

        {/* Tider */}
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 font-display text-base font-bold">
            <CalendarClock className="h-4 w-4 text-primary" /> När passar det?
          </h2>
          {smartSummary ? (
            <p className="rounded-2xl border border-primary/40 bg-accent/40 p-3 text-xs font-bold text-accent-foreground">
              ⭐ {smartSummary}
            </p>
          ) : null}
          {plan.slots.map((s) => {
            const stat = stats[s.id] ?? { yes: 0, maybe: 0, no: 0, score: 0 };
            const isBest = topSlot === s.id && stat.score > 0 && plan.replies.length > 0;
            return (
              <div
                key={s.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3",
                  plan.decidedSlotId === s.id
                    ? "border-primary bg-accent/60"
                    : isBest
                      ? "border-primary/60 bg-accent/40"
                      : "border-border",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                    <span className="truncate">{s.label}</span>
                    {isBest ? (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                        ⭐ Bästa alternativet
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    🟢 {stat.yes} kan · 🟡 {stat.maybe} kanske · 🔴 {stat.no} kan inte
                  </p>
                  {plan.replies.length > 0 ? (
                    <p className="mt-1 text-xs font-bold text-primary">
                      {stat.yes} av {plan.replies.length} kan denna tid
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label={`Ta bort ${s.label}`}
                  onClick={() =>
                    store.updatePlan(plan.id, { slots: plan.slots.filter((x) => x.id !== s.id) })
                  }
                  className="text-muted-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          <div className="flex gap-2">
            <input
              className={field}
              value={slotInput}
              placeholder="T.ex. Lördag 19:00"
              onChange={(e) => setSlotInput(e.target.value)}
            />
            <button
              type="button"
              onClick={() => {
                if (!slotInput.trim()) return;
                store.updatePlan(plan.id, {
                  slots: [...plan.slots, { id: uid("slot"), label: slotInput.trim() }],
                });
                setSlotInput("");
              }}
              className="rounded-2xl bg-secondary px-4 text-sm font-bold"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* Svar */}
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 font-display text-base font-bold">
            <Users className="h-4 w-4 text-primary" /> Svar ({plan.replies.length})
          </h2>
          {plan.replies.length === 0 ? (
            <p className="rounded-2xl bg-secondary/70 p-3 text-sm text-muted-foreground">
              Inga svar än. Dela länken så börjar gänget rösta.
            </p>
          ) : (
            plan.replies.map((r) => (
              <div key={r.id} className="rounded-2xl bg-secondary/70 p-3">
                <p className="text-sm font-bold">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.optionIds
                    .map((oid) => plan.options.find((o) => o.id === oid)?.title)
                    .filter(Boolean)
                    .join(", ") || "Inget förslag valt"}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  {plan.slots.map((s) => {
                    const a = r.answers?.[s.id] ?? (r.slotIds.includes(s.id) ? "yes" : undefined);
                    if (!a) return null;
                    return (
                      <span key={s.id} className="text-xs text-muted-foreground">
                        {a === "yes" ? "🟢" : a === "maybe" ? "🟡" : "🔴"} {s.label}
                      </span>
                    );
                  })}
                </div>
                {r.comment ? <p className="mt-1 text-sm">”{r.comment}”</p> : null}
              </div>
            ))
          )}
        </section>

        {/* Avsluta planen */}
        <section className="space-y-3 rounded-3xl border border-border p-4">
          <h2 className="font-display text-base font-bold">
            {decided ? "Planen är bestämd" : "Avsluta planen"}
          </h2>
          {decided ? (
            <div className="rounded-2xl bg-accent/60 p-3">
              <p className="text-sm font-bold text-accent-foreground">
                🎉 {decided.emoji} {decided.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {decidedSlot ? decidedSlot.label : "Tid ej satt"}
                {plan.place ? ` · ${plan.place}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Det här alternativet valde gruppen.
              </p>
              <button
                type="button"
                onClick={() =>
                  store.updatePlan(plan.id, {
                    decidedOptionId: undefined,
                    decidedSlotId: undefined,
                  })
                }
                className="mt-2 text-xs font-bold text-primary"
              >
                Öppna planen igen
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Avsluta planen när gänget svarat – det alternativ som flest kan väljs automatiskt.
            </p>
          )}
          <button
            type="button"
            disabled={!!decided || (!topOption && plan.options.length === 0)}
            onClick={() => {
              const optionId = topOption ?? plan.options[0]?.id;
              const slotId = topSlot ?? plan.slots[0]?.id;
              if (!optionId) return;
              store.updatePlan(plan.id, { decidedOptionId: optionId, decidedSlotId: slotId });
              toast.success("Planen är bestämd! Dela länken igen så ser alla.");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-sm font-bold text-primary-foreground shadow-[var(--shadow-pin)] disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {decided ? "Planen är avslutad" : "Avsluta planen – bestäm det flest kan"}
          </button>
        </section>

        <button
          type="button"
          onClick={() => {
            store.deletePlan(plan.id);
            toast.success("Planen togs bort");
          }}
          className="w-full rounded-2xl bg-secondary px-4 py-3 text-xs font-bold text-muted-foreground"
        >
          Ta bort planen
        </button>
      </div>

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        preview={{
          tagline: "Vi borde göra något! 👀",
          title: plan.title,
          emoji: plan.emoji ?? plan.options[0]?.emoji ?? "🎉",
          gradient: coverGradient,
          meta: [plan.slots[0]?.label, plan.place].filter(Boolean).join(" · ") || undefined,
          cta: "Tryck för att se planen och svara.",
          url: absoluteUrl(`/plan/${plan.code}`),
          displayUrl: link,
          shareText: plan.note || `Vi borde göra något! Kolla planen "${plan.title}" och svara.`,
        }}
      />
    </AppShell>
  );
}
