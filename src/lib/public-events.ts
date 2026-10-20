// Publika event som skapas i appen bor i Supabase (public_events).
//
// RLS ser till att bara godkända event är läsbara för alla. Ägaren ser sina
// egna event i alla statusar och moderatorer ser allt som väntar på granskning.
// Status och sponsring kan bara ändras via RPC:erna moderate_public_event och
// sponsor_public_event – aldrig direkt från klienten.

import { supabase } from "@/integrations/supabase/client";
import type { CategoryId, EventItem, EventStatus } from "@/lib/hander-data";

export type PublicEventRow = {
  id: string;
  organizer_id: string;
  organizer_name: string;
  payload: unknown;
  status: string;
  rejection_reason: string | null;
  /** 'none' eller 'sponsored' – sponsring är en status i databasen. */
  sponsor_status: string;
  sponsored_at: string | null;
  created_at: string;
};

const asStatus = (value: string): EventStatus =>
  value === "approved" || value === "rejected" ? value : "pending";

/** Gör om en databasrad till appens EventItem utan att tappa fält. */
export function publicEventFromRow(row: PublicEventRow): EventItem {
  const payload = (row.payload ?? {}) as Partial<EventItem>;
  return {
    id: row.id,
    name: payload.name ?? "Event",
    category: (payload.category ?? "ovrigt") as CategoryId,
    date: payload.date ?? "",
    start: payload.start ?? "",
    end: payload.end ?? "",
    place: payload.place ?? "",
    address: payload.address ?? "",
    price: payload.price ?? 0,
    priceKnown: payload.priceKnown,
    description: payload.description ?? "",
    image: payload.image,
    sourceUrl: payload.sourceUrl,
    organizerId: row.organizer_id,
    organizerName: row.organizer_name || payload.organizerName,
    interested: Array.isArray(payload.interested) ? payload.interested : [],
    visibility: "public",
    status: asStatus(row.status),
    rejectionReason: row.rejection_reason ?? undefined,
    sponsored: row.sponsor_status === "sponsored",
    promoted: row.sponsor_status === "sponsored" || Boolean(payload.promoted),
    reported: payload.reported,
    lat: payload.lat,
    lng: payload.lng,
    distance: typeof payload.distance === "number" ? payload.distance : 0,
  };
}

/** Alla event som RLS ger tillgång till (godkända + egna + moderatorers). */
export async function fetchPublicEvents(): Promise<EventItem[]> {
  const { data, error } = await supabase
    .from("public_events")
    .select("id, organizer_id, organizer_name, payload, status, rejection_reason, sponsor_status, sponsored_at, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return ((data ?? []) as PublicEventRow[]).map(publicEventFromRow);
}

/** Skapar ett publikt event som alltid börjar som `pending`. */
export async function createPublicEvent(
  event: EventItem,
  organizerId: string,
  organizerName: string,
): Promise<EventItem> {
  const payload: EventItem = {
    ...event,
    organizerId,
    organizerName,
    visibility: "public",
    status: "pending",
    sponsored: false,
    promoted: false,
  };
  const { data, error } = await supabase
    .from("public_events")
    .insert({
      id: event.id,
      organizer_id: organizerId,
      organizer_name: organizerName,
      payload,
    })
    .select("id, organizer_id, organizer_name, payload, status, rejection_reason, sponsor_status, sponsored_at, created_at")
    .single();
  if (error) throw error;
  return publicEventFromRow(data as PublicEventRow);
}

/** Uppdaterar eventets innehåll (status/sponsring lämnas orörda av RLS). */
export async function updatePublicEventContent(event: EventItem): Promise<void> {
  const { error } = await supabase
    .from("public_events")
    .update({ payload: event, organizer_name: event.organizerName ?? "" })
    .eq("id", event.id);
  if (error) throw error;
}

/** Moderatorernas granskning. Kräver is_moderator i databasen. */
export async function moderatePublicEvent(
  eventId: string,
  status: EventStatus,
  reason?: string,
): Promise<void> {
  const { error } = await supabase.rpc("moderate_public_event", {
    p_event_id: eventId,
    p_status: status,
    p_reason: reason ?? null,
  });
  if (error) throw error;
}

/** Sponsring av ett eget, godkänt event. */
export async function sponsorPublicEvent(eventId: string): Promise<void> {
  const { error } = await supabase.rpc("sponsor_public_event", { p_event_id: eventId });
  if (error) throw error;
}
