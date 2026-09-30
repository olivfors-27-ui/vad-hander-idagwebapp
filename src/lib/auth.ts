// Kontosystem: session-hantering + registrering/inloggning via Supabase Auth.
// Klienten (src/integrations/supabase/client.ts) kastar om env-variabler saknas –
// därför fångar allt här fel och exponerar ett `configured`-läge istället, så att
// appen fortsätter fungera utan konton (samma filosofi som plans-API:et).

import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Account = {
  id: string;
  email: string;
  name: string;
  avatarEmoji: string;
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

const accountFrom = (user: User, profileName?: string, profileEmoji?: string): Account => {
  const meta = (user.user_metadata ?? {}) as { name?: string; avatar_emoji?: string };
  return {
    id: user.id,
    email: user.email ?? "",
    name: profileName || meta.name || user.email?.split("@")[0] || "Användare",
    avatarEmoji: profileEmoji || meta.avatar_emoji || "🙂",
  };
};

/** Laddar profilraden (namn + emoji) för en användare. */
export async function loadProfile(userId: string): Promise<{ name?: string; avatarEmoji?: string }> {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("name, avatar_emoji")
      .eq("id", userId)
      .maybeSingle();
    if (!data) return {};
    return { name: (data as { name: string }).name, avatarEmoji: (data as { avatar_emoji: string }).avatar_emoji };
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
    const profile = await loadProfile(user.id);
    if (!active) return;
    onChange(accountFrom(user, profile.name, profile.avatarEmoji));
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

/** Registrera konto. `emailRedirectTo` styr vart mejllänken landar (/auth/callback). */
export async function signUp(name: string, email: string, password: string): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, avatar_emoji: "🙂" },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
