// Publika profiler: sökning, uppslag och följningar.
//
// Profiltabellen är läsbar för alla inloggade (och anon) enligt RLS-policyn
// "Profiles are public", men innehåller bara id, namn, användarnamn och emoji –
// aldrig mejl eller lösenordsdata.

import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  name: string;
  username: string;
  avatarEmoji: string;
  isModerator: boolean;
};

type ProfileRow = {
  id: string;
  name: string;
  username: string;
  avatar_emoji: string;
  is_moderator: boolean;
};

const toProfile = (row: ProfileRow): Profile => ({
  id: row.id,
  name: row.name?.trim() || row.username || "Användare",
  username: row.username,
  avatarEmoji: row.avatar_emoji || "🙂",
  isModerator: Boolean(row.is_moderator),
});

/** Tar bort tecken som kan bryta PostgREST:s `or`-filter. */
const safeTerm = (value: string) => value.replace(/[%,()*]/g, " ").trim();

/** Sök på användarnamn eller visningsnamn. Tom sökning ger inga träffar. */
export async function searchProfiles(query: string, excludeId?: string | null): Promise<Profile[]> {
  const term = safeTerm(query);
  if (term.length < 1) return [];
  let request = supabase
    .from("profiles")
    .select("id, name, username, avatar_emoji, is_moderator")
    .or(`username.ilike.%${term}%,name.ilike.%${term}%`)
    .order("username", { ascending: true })
    .limit(20);
  if (excludeId) request = request.neq("id", excludeId);
  const { data, error } = await request;
  if (error) throw error;
  return ((data ?? []) as ProfileRow[]).map(toProfile);
}

/** Nya konton att föreslå (alla profiler utom en själv). */
export async function fetchRecentProfiles(excludeId?: string | null): Promise<Profile[]> {
  let request = supabase
    .from("profiles")
    .select("id, name, username, avatar_emoji, is_moderator")
    .order("created_at", { ascending: false })
    .limit(25);
  if (excludeId) request = request.neq("id", excludeId);
  const { data, error } = await request;
  if (error) throw error;
  return ((data ?? []) as ProfileRow[]).map(toProfile);
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, username, avatar_emoji, is_moderator")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? toProfile(data as ProfileRow) : null;
}

export async function fetchProfileByUsername(username: string): Promise<Profile | null> {
  const clean = username.replace(/^@/, "").trim();
  if (!clean) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, username, avatar_emoji, is_moderator")
    .ilike("username", clean)
    .maybeSingle();
  if (error) throw error;
  return data ? toProfile(data as ProfileRow) : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchProfilesByIds(ids: string[]): Promise<Profile[]> {
  // Äldre lokalt sparade följningar kan innehålla id:n som inte är uuid – de
  // skulle få hela frågan att fallera, så de filtreras bort.
  const valid = Array.from(new Set(ids.filter((id) => UUID_RE.test(id))));
  if (valid.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, username, avatar_emoji, is_moderator")
    .in("id", valid);
  if (error) throw error;
  return ((data ?? []) as ProfileRow[]).map(toProfile);
}

/**
 * Säkerhetsnät om profilen skulle saknas (t.ex. konto skapat innan triggern
 * fanns). Skapar en rad med härlett användarnamn – aldrig moderator.
 */
export async function ensureProfile(account: {
  id: string;
  name: string;
  email: string;
}): Promise<Profile | null> {
  const existing = await fetchProfile(account.id).catch(() => null);
  if (existing) return existing;
  const base = (account.name || account.email.split("@")[0] || "user")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20) || "user";

  // Unikheten ligger i databasen (lower(username)). Om namnet redan är taget
  // provas ett fåtal varianter så att kontot alltid får en sökbar profil.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = attempt === 0 ? "" : String(attempt);
    const username = `${base.slice(0, 20 - suffix.length)}${suffix}`;
    const { data, error } = await supabase
      .from("profiles")
      .insert({ id: account.id, name: account.name || username, username })
      .select("id, name, username, avatar_emoji, is_moderator")
      .maybeSingle();
    if (!error) return data ? toProfile(data as ProfileRow) : null;
    const duplicate =
      error.code === "23505" || error.message.toLowerCase().includes("duplicate key");
    if (!duplicate) return null;
  }
  return null;
}

export async function fetchFollowingIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("followed_id")
    .eq("follower_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => (row as { followed_id: string }).followed_id);
}

export async function fetchFollowerIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("followed_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => (row as { follower_id: string }).follower_id);
}

export async function followProfile(followerId: string, followedId: string): Promise<void> {
  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: followerId, followed_id: followedId });
  if (error && error.code !== "23505") throw error;
}

export async function unfollowProfile(followerId: string, followedId: string): Promise<void> {
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("followed_id", followedId);
  if (error) throw error;
}
