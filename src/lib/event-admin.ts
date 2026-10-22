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

/**
 * Förklarar varför en radering misslyckades. Databasen är källan: koden och
 * meddelandet loggas i konsolen, här blir det begriplig svenska.
 */
export function deleteEventErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  const text = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  if (code === "42501" || text.includes("not signed in")) {
    return "Du är inte inloggad. Logga in och försök igen.";
  }
  if (code === "P0002" || text.includes("event not found")) {
    return "Eventet finns inte kvar i databasen.";
  }
  if (text.includes("permission denied") || text.includes("row-level security")) {
    return "Du har inte behörighet att ta bort det här eventet.";
  }
  return "Eventet kunde inte tas bort. Försök igen.";
}

/** Begripligt felmeddelande när en ändring inte kunde sparas. */
export function saveEventErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  const text = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  if (code === "23514") {
    return "Kontrollera tiderna (slut efter start) och att platsen ligger i Sverige.";
  }
  if (code === "42501" || text.includes("row-level security") || text.includes("permission denied")) {
    return "Du har inte behörighet att ändra det här eventet.";
  }
  if (text.includes("event_limit_reached")) {
    return `Du kan som mest skapa ${MAX_EVENTS_PER_ACCOUNT} event per konto.`;
  }
  return "Ändringen kunde inte sparas. Försök igen.";
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
