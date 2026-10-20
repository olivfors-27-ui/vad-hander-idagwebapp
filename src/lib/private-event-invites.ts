import { supabase } from "@/integrations/supabase/client";
import type { EventItem, InviteStatus } from "@/lib/hander-data";

export type InviteRow = {
  userId: string;
  name?: string;
  status: InviteStatus;
  interests?: string[];
};
/** Gäst i den lista som alla som är med i eventet får se. */
export type GuestRow = InviteRow & { isMe?: boolean };
type GuestInvite = { event: EventItem; ownReply: InviteRow | null; guestCount?: number };
type GuestReply = { reply: InviteRow; responseToken: string | null };

export async function fetchPrivateEventInvite(
  code: string,
  responseToken: string | null,
): Promise<GuestInvite | null> {
  const { data, error } = await supabase.rpc("get_private_event_invite", {
    p_code: code,
    p_response_token: responseToken,
  });
  if (error) throw error;
  return data as unknown as GuestInvite | null;
}

/** Värdens fullständiga gästlista (inkl. inbjudna och nej). */
export async function fetchPrivateEventInvites(code: string): Promise<InviteRow[]> {
  const { data, error } = await supabase.rpc("list_private_event_invites", { p_code: code });
  if (error) throw error;
  return (data ?? []) as unknown as InviteRow[];
}

/**
 * Gästlistan som alla som är med får se (namn, status och intressen).
 * Kräver att man svarat på inbjudan – annars avvisar databasen anropet.
 */
export async function fetchPrivateEventGuests(
  code: string,
  responseToken: string | null,
): Promise<GuestRow[]> {
  const { data, error } = await supabase.rpc("list_private_event_guests", {
    p_code: code,
    p_response_token: responseToken,
  });
  if (error) throw error;
  return (data ?? []) as unknown as GuestRow[];
}

export async function savePrivateEventInvite(event: EventItem, organizerId: string): Promise<void> {
  const { error } = await supabase.from("private_events").upsert(
    {
      id: event.id,
      invite_code: event.inviteCode,
      organizer_id: organizerId,
      payload: event,
    } as never,
    { onConflict: "id" },
  );
  if (error) throw error;
}

export async function submitPrivateEventInviteReply(
  code: string,
  responseToken: string | null,
  guestName: string,
  interests: string[],
  status: Exclude<InviteStatus, "invited">,
): Promise<GuestReply> {
  const { data, error } = await supabase.rpc("reply_to_private_event_invite", {
    p_code: code,
    p_response_token: responseToken,
    p_guest_name: guestName,
    p_status: status,
    p_interests: interests,
  });
  if (error) throw error;
  return data as unknown as GuestReply;
}
