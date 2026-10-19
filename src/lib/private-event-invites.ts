import { supabase } from "@/integrations/supabase/client";
import type { EventItem, InviteStatus } from "@/lib/hander-data";

type InviteRow = { userId: string; name?: string; status: InviteStatus };
type GuestInvite = { event: EventItem; ownReply: InviteRow | null };
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

export async function fetchPrivateEventInvites(code: string): Promise<InviteRow[]> {
  const { data, error } = await supabase.rpc("list_private_event_invites", { p_code: code });
  if (error) throw error;
  return (data ?? []) as unknown as InviteRow[];
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
  status: Exclude<InviteStatus, "invited">,
): Promise<GuestReply> {
  const { data, error } = await supabase.rpc("reply_to_private_event_invite", {
    p_code: code,
    p_response_token: responseToken,
    p_guest_name: guestName,
    p_status: status,
  });
  if (error) throw error;
  return data as unknown as GuestReply;
}
