// Gränser och radering för event. Samma regler finns i databasen
// (20261020120000_event_interests_limits_delete.sql) – här finns konstanterna
// och raderingen, så att UI:t kan säga till innan användaren stöter i taket.
// Feltexter bor i db-error.ts.

import { supabase } from "@/integrations/supabase/client";

/** Max antal deltagare (kommer + kanske) per privat event. */
export const MAX_EVENT_GUESTS = 10;
/** Max antal event (privata + publika) per konto. */
export const MAX_EVENTS_PER_ACCOUNT = 5;

/**
 * Sant när databasen säger att raden redan är borta. Då är raderingen klar:
 * eventet kan ha skapats innan det fanns en databasrad (eller bara finnas i
 * den här webbläsaren), och det ska ändå gå att städa bort lokalt.
 */
export function isMissingRowError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  const text = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return code === "P0002" || text.includes("event not found");
}

/** Raderar eventet och allt som hör till (gästsvar m.m.). Bara skaparen. */
export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_event", { p_event_id: eventId });
  if (!error || isMissingRowError(error)) return;
  throw error;
}
