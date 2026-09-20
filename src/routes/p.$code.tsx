import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PlanNotFound, PublicPlan } from "@/components/hander/PublicPlan";
import type { Plan } from "@/lib/hander-plans";
import { fetchPlanByCode, subscribePlans } from "@/lib/hander-plans-api";
import { useHander } from "@/lib/hander-store";

export const Route = createFileRoute("/p/$code")({
  head: () => ({
    meta: [
      { title: "Kan du? – en plan på Händer" },
      {
        name: "description",
        content:
          "Din kompis har skapat en plan. Se vad som gäller och svara direkt – inget konto behövs.",
      },
      { property: "og:title", content: "Kan du? – en plan på Händer" },
      {
        property: "og:description",
        content: "Svara på planen direkt i länken – ingen app och inget konto behövs.",
      },
    ],
  }),
  component: RespondPage,
});

function RespondPage() {
  const { code } = useParams({ from: "/p/$code" });
  const store = useHander();
  const local = store.plans.find((p) => p.code.toUpperCase() === code.toUpperCase());
  const [remote, setRemote] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = () => {
      fetchPlanByCode(code)
        .then((p) => {
          if (active) setRemote(p);
        })
        .catch(() => {
          /* visa lokalt om nätet strular */
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };
    setLoading(true);
    load();
    const stop = subscribePlans(load);
    return () => {
      active = false;
      stop();
    };
  }, [code]);

  const plan = local ?? remote;
  if (plan) return <PublicPlan plan={plan} />;
  if (loading) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md items-center justify-center p-8 text-sm text-muted-foreground">
        Hämtar planen …
      </div>
    );
  }
  return <PlanNotFound />;
}
