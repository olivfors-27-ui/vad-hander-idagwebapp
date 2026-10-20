// Kontosystem: session-hantering + registrering/inloggning via Supabase Auth.
// Klienten (src/integrations/supabase/client.ts) kastar om env-variabler saknas –
// därför fångar allt här fel och exponerar ett `configured`-läge istället, så att
// appen fortsätter fungera utan konton (samma filosofi som plans-API:et).

import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { appUrl } from "@/lib/app-url";
import { ensureProfile } from "@/lib/profiles";

export type Account = {
  id: string;
  email: string;
  name: string;
  username: string;
  avatarEmoji: string;
  isModerator: boolean;
};

type ProfileFields = {
  name?: string;
  username?: string;
  avatarEmoji?: string;
  isModerator?: boolean;
};

let configBroken = false;
try {
  // Trigga proxyn: utan env-variabler kastar createSupabaseClient här.
  void supabase.auth.getSession();
} catch {
  configBroken = true;
}

/** true när Supabase-env saknas – UI:t visar då att konton är avstängda. */
export const isAuthConfigured = () => !configBroken;

const accountFrom = (user: User, profile?: ProfileFields): Account => {
  const meta = (user.user_metadata ?? {}) as { name?: string; username?: string; avatar_emoji?: string };
  const emailName = user.email?.split("@")[0];
  return {
    id: user.id,
    email: user.email ?? "",
    name: profile?.name || meta.name || emailName || "Användare",
    username: profile?.username || meta.username || emailName || "",
    avatarEmoji: profile?.avatarEmoji || meta.avatar_emoji || "🙂",
    isModerator: Boolean(profile?.isModerator),
  };
};

/** Laddar profilraden (namn, användarnamn, emoji och moderatorroll). */
export async function loadProfile(userId: string): Promise<ProfileFields> {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("name, username, avatar_emoji, is_moderator")
      .eq("id", userId)
      .maybeSingle();
    if (!data) return {};
    const row = data as {
      name: string;
      username: string;
      avatar_emoji: string;
      is_moderator: boolean;
    };
    return {
      name: row.name,
      username: row.username,
      avatarEmoji: row.avatar_emoji,
      isModerator: Boolean(row.is_moderator),
    };
  } catch {
    return {};
  }
}

/** Prenumerera på inloggningsläget. Returnerar cleanup-funktion. */
export function watchAccount(onChange: (account: Account | null) => void): () => void {
  if (configBroken) {
    onChange(null);
    return () => undefined;
  }
  let active = true;

  const apply = async (user: User | null) => {
    if (!user) {
      onChange(null);
      return;
    }
    let profile = await loadProfile(user.id);
    // Säkerhetsnät: konton som skapades innan profil-triggern fanns får en
    // publik profilrad här, så att de går att hitta och följa.
    if (!profile.username) {
      const created = await ensureProfile({
        id: user.id,
        name: profile.name ?? user.user_metadata?.["name"] ?? user.email?.split("@")[0] ?? "",
        email: user.email ?? "",
      }).catch(() => null);
      if (created) {
        profile = {
          name: created.name,
          username: created.username,
          avatarEmoji: created.avatarEmoji,
          isModerator: created.isModerator,
        };
      }
    }
    if (!active) return;
    onChange(accountFrom(user, profile));
  };

  void supabase.auth
    .getSession()
    .then(({ data }) => apply(data.session?.user ?? null))
    .catch(() => onChange(null));

  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    void apply(session?.user ?? null);
  });

  return () => {
    active = false;
    void sub.subscription.unsubscribe();
  };
}

export async function currentSession(): Promise<Session | null> {
  if (configBroken) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session;
  } catch {
    return null;
  }
}

export type AuthResult = { ok: true } | { ok: false; error: string };

/**
 * Registrera konto. `emailRedirectTo` använder appens publika bas-URL
 * (VITE_APP_URL) – aldrig localhost – och landar på /auth/callback som i sin
 * tur visar tack-sidan.
 */
export async function signUp(
  name: string,
  username: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, username, avatar_emoji: "🙂" },
        emailRedirectTo: appUrl("/auth/callback"),
      },
    });
    if (error) return { ok: false, error: swedishAuthError(error.message) };
    return { ok: true };
  } catch {
    return { ok: false, error: "Konton är inte konfigurerade ännu." };
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: swedishAuthError(error.message) };
    return { ok: true };
  } catch {
    return { ok: false, error: "Konton är inte konfigurerade ännu." };
  }
}

export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    /* redan utloggad */
  }
}

/** Översätt Supabases engelska fel till korta svenska meningar. */
function swedishAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already exists")) return "Det finns redan ett konto med den mejlen.";
  if (m.includes("invalid login")) return "Fel mejl eller lösenord.";
  if (m.includes("email not confirmed")) return "Bekräfta din mejl först – kolla inkorgen.";
  if (m.includes("password") && m.includes("least")) return "Lösenordet måste vara minst 6 tecken.";
  if (m.includes("rate limit")) return "För många försök – vänta en stund.";
  if (m.includes("valid email")) return "Ange en giltig mejladress.";
  return message;
}

/** React-hook: aktuell inloggning (null = utloggad). */
export function useAccount(): Account | null {
  const [account, setAccount] = useState<Account | null>(null);
  useEffect(() => watchAccount(setAccount), []);
  return account;
}

/**
 * Hämta visningsnamnet för ett användar-id via profil-tabellen (läsbar publikt
 * enligt RLS-politiken "Profiles are public"). Används för att säkerställa att
 * arrangör/inbjudare aldrig visas som "Okänd" för riktiga konton – även för
 * event som skapades innan organizerName sparades på eventet.
 */
export function useProfileName(userId: string | undefined, hint?: string | undefined): string | undefined {
  const [name, setName] = useState<string | undefined>(hint);
  useEffect(() => {
    if (hint) {
      setName(hint);
      return;
    }
    if (!userId) return;
    let alive = true;
    void loadProfile(userId)
      .then((profile) => {
        if (alive && profile.name) setName(profile.name);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [userId, hint]);
  return name;
}
