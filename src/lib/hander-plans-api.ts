// Planer sparas i Lovable Cloud så att delade länkar fungerar på andra enheter.
import { supabase } from "@/integrations/supabase/client";
import type { Availability, Plan, PlanOption, PlanReply, PlanSlot } from "./hander-plans";

const hasSupabaseConfig = Boolean(
  import.meta.env["VITE_SUPABASE_URL"] && import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
);

const noCloudPlan = () => [] as Plan[];

type PlanRow = {
  id: string;
  code: string;
  title: string;
  note: string;
  created_by: string;
  options: unknown;
  slots: unknown;
  emoji: string | null;
  gradient: string | null;
  place: string | null;
  event_id: string | null;
  decided_option_id: string | null;
  decided_slot_id: string | null;
  created_at: string;
};

type ReplyRow = {
  id: string;
  plan_id: string;
  name: string;
  option_ids: unknown;
  slot_ids: unknown;
  answers: unknown;
  comment: string;
  created_at: string;
};

function toPlan(row: PlanRow, replies: ReplyRow[]): Plan {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    note: row.note ?? "",
    createdBy: row.created_by,
    createdAt: row.created_at,
    options: (row.options as PlanOption[]) ?? [],
    slots: (row.slots as PlanSlot[]) ?? [],
    replies: replies
      .filter((r) => r.plan_id === row.id)
      .map((r) => ({
        id: r.id,
        name: r.name,
        optionIds: (r.option_ids as string[]) ?? [],
        slotIds: (r.slot_ids as string[]) ?? [],
        answers: (r.answers as Record<string, Availability>) ?? {},
        comment: r.comment ?? "",
        at: r.created_at,
      })),
    decidedOptionId: row.decided_option_id ?? undefined,
    decidedSlotId: row.decided_slot_id ?? undefined,
    emoji: row.emoji ?? undefined,
    gradient: row.gradient ?? undefined,
    place: row.place ?? undefined,
    eventId: row.event_id ?? undefined,
  };
}

function planToRow(plan: Plan) {
  return {
    id: plan.id,
    code: plan.code,
    title: plan.title,
    note: plan.note ?? "",
    created_by: plan.createdBy,
    options: plan.options,
    slots: plan.slots,
    emoji: plan.emoji ?? null,
    gradient: plan.gradient ?? null,
    place: plan.place ?? null,
    event_id: plan.eventId ?? null,
    decided_option_id: plan.decidedOptionId ?? null,
    decided_slot_id: plan.decidedSlotId ?? null,
  };
}

/** Hämtar alla planer med svar. */
export async function fetchPlans(): Promise<Plan[]> {
  if (!hasSupabaseConfig) return noCloudPlan();

  const [{ data: plans, error }, { data: replies }] = await Promise.all([
    supabase.from("plans").select("*").order("created_at", { ascending: false }),
    supabase.from("plan_replies").select("*").order("created_at", { ascending: true }),
  ]);
  if (error) throw error;
  const rows = (plans ?? []) as unknown as PlanRow[];
  const reps = (replies ?? []) as unknown as ReplyRow[];
  return rows.map((r) => toPlan(r, reps));
}

/** Hämtar en plan via delningskod – används av mottagaren utan konto. */
export async function fetchPlanByCode(code: string): Promise<Plan | null> {
  if (!hasSupabaseConfig) return null;

  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .ilike("code", code)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as PlanRow;
  const { data: replies } = await supabase
    .from("plan_replies")
    .select("*")
    .eq("plan_id", row.id)
    .order("created_at", { ascending: true });
  return toPlan(row, (replies ?? []) as unknown as ReplyRow[]);
}

export async function insertPlan(plan: Plan) {
  if (!hasSupabaseConfig) return;

  const { error } = await supabase.from("plans").insert(planToRow(plan) as never);
  if (error) throw error;
}

export async function patchPlan(plan: Plan) {
  if (!hasSupabaseConfig) return;

  const { error } = await supabase
    .from("plans")
    .update(planToRow(plan) as never)
    .eq("id", plan.id);
  if (error) throw error;
}

export async function removePlan(id: string) {
  if (!hasSupabaseConfig) return;

  const { error } = await supabase.from("plans").delete().eq("id", id);
  if (error) throw error;
}

/** Ett svar per namn och plan – nytt svar ersätter det gamla. */
export async function upsertReply(planId: string, reply: Omit<PlanReply, "id" | "at">) {
  if (!hasSupabaseConfig) return;

  const name = reply.name.trim();
  await supabase
    .from("plan_replies")
    .delete()
    .eq("plan_id", planId)
    .ilike("name", name);
  const { error } = await supabase.from("plan_replies").insert({
    plan_id: planId,
    name,
    option_ids: reply.optionIds ?? [],
    slot_ids: reply.slotIds ?? [],
    answers: reply.answers ?? {},
    comment: reply.comment ?? "",
  } as never);
  if (error) throw error;
}

/** Lyssnar på ändringar i planer och svar (live-uppdatering). */
export function subscribePlans(onChange: () => void) {
  if (!hasSupabaseConfig) return () => undefined;

  const channel = supabase
    .channel(`hander-plans-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "plans" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "plan_replies" }, onChange)
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
