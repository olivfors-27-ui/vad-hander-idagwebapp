// Gränser och radering för event. Samma regler finns i databasen
// (20261020120000_event_interests_limits_delete.sql) – här finns bara
// konstanterna och översättningen till svenska meddelanden, så att UI:t kan
// säga till innan användaren stöter i taket.

import { supabase } from "@/integrations/supabase/client";

/** Max antal deltagare (kommer + kanske) per privat event. */
export const MAX_EVENT_GUESTS = 10;
/** Max antal event (privata + publika) per konto. */
export const MAX_EVENTS_PER_ACCOUNT = 5;

/** Raderar eventet och allt som hör till (gästsvar m.m.). Bara skaparen. */
export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_event", { p_event_id: eventId });
  if (error) throw error;
}

/** Översätter databasens gränsfel till text som kan visas för användaren. */
export function limitMessage(error: unknown): string | null {
  const text = String((error as { message?: string } | null)?.message ?? error ?? "").toLowerCase();
  if (text.includes("event_full")) return `Eventet är fullt (max ${MAX_EVENT_GUESTS} deltagare).`;
  if (text.includes("event_limit_reached")) {
    return `Du kan som mest skapa ${MAX_EVENTS_PER_ACCOUNT} event per konto.`;
  }
  return null;
}
