import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Users } from "lucide-react";
import { AppShell } from "@/components/hander/AppShell";
import { useGoCreate, useIsLoggedIn } from "@/lib/auth-guard";
import { ME, USERS } from "@/lib/hander-data";
import { planImage, type Plan } from "@/lib/hander-plans";
import { useHander } from "@/lib/hander-store";

export const Route = createFileRoute("/planer")({
  head: () => ({
    meta: [
      { title: "Dina planer – Händer" },
      {
        name: "description",
        content: "Samla förslag, dela en länk och få gänget att bestämma vad ni ska göra.",
      },
      { property: "og:title", content: "Dina planer – Händer" },
      { property: "og:description", content: "Skapa en plan och låt kompisarna svara via länk." },
    ],
  }),
  component: PlansPage,
});

const MY_NAME = USERS.find((u) => u.id === ME)?.name ?? "Du";

const isMine = (p: Plan) =>
  p.createdBy === ME || p.createdBy.trim().toLowerCase() === MY_NAME.toLowerCase();
const hasMyReply = (p: Plan) =>
  p.replies.some((r) => r.name.trim().toLowerCase() === MY_NAME.toLowerCase());
const isDone = (p: Plan) => Boolean(p.decidedOptionId || p.decidedSlotId);

function PlanCard({ plan }: { plan: Plan }) {
  const decided = plan.options.find((o) => o.id === plan.decidedOptionId);
  return (
    <Link
      to="/plan/$id"
      params={{ id: plan.id }}
      className="block overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-card)]"
    >
      <div className="h-24 w-full overflow-hidden bg-accent">
        <img src={planImage(plan)} alt="" loading="lazy" className="h-full w-full object-cover" />
      </div>
      <div className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 truncate font-display text-base font-semibold">
          <span className="truncate">{plan.title}</span>
        </p>
        <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-[11px] font-bold">
          {plan.code}
        </span>
      </div>
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="h-3 w-3" /> {plan.replies.length} svar · {plan.options.length} förslag
        {plan.place ? ` · ${plan.place}` : ""}
      </p>
      {decided ? (
        <p className="mt-2 rounded-xl bg-accent/60 px-3 py-2 text-xs font-bold text-accent-foreground">
          Beslutat: {decided.title}
        </p>
      ) : null}
      </div>
    </Link>
  );
}

function Section({ title, plans }: { title: string; plans: Plan[] }) {
  if (plans.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {plans.map((p) => (
        <PlanCard key={p.id} plan={p} />
      ))}
    </section>
  );
}

function PlansPage() {
  const store = useHander();
  // UI-guard: skapa-event-länkarna kräver inloggning.
  const loggedIn = useIsLoggedIn();
  const { go: goCreate } = useGoCreate();

  const active = store.plans.filter((p) => !isDone(p));
  const past = store.plans.filter(isDone);

  const created = active.filter(isMine);
  const joined = active.filter((p) => !isMine(p) && hasMyReply(p));
  const invited = active.filter((p) => !isMine(p) && !hasMyReply(p));

  const create = () => {
    // UI-guard: utloggade skickas till inloggningen.
    goCreate();
  };

  return (
    <AppShell title="Planer" subtitle="Dina sociala planer med kompisarna">
      <div className="space-y-5 p-4">

        {store.plans.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-6 text-center">
            <p className="text-3xl">🗺️</p>
            <p className="mt-2 font-display text-base font-bold">Inga planer än</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Hitta något på Upptäck och tryck ”Planera med kompisar”, eller skapa en tom plan.
            </p>
            <Link to="/" className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-primary">
              Till Upptäck →
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <h2 className="px-1 font-display text-lg font-bold">Alla inbjudningar</h2>
              {active.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Inga aktiva planer just nu.
                </p>
              ) : (
                <>
                  <Section title="Planer jag skapat" plans={created} />
                  <Section title="Planer jag deltar i" plans={joined} />
                  <Section title="Inbjudningar via länk" plans={invited} />
                </>
              )}
            </div>

            {past.length > 0 ? (
              <div className="space-y-4">
                <h2 className="px-1 font-display text-lg font-bold">Tidigare planer</h2>
                {past.map((p) => (
                  <PlanCard key={p.id} plan={p} />
                ))}
              </div>
            ) : null}
          </>
        )}

        {loggedIn && (
          <div className="pt-1 text-center">
            <Link to="/skapa" className="inline-flex min-h-11 items-center text-xs font-semibold text-muted-foreground underline">
              Skapa ett event i stället
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
