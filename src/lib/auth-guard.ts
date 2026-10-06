// Inloggningsskydd för skyddade sidor (t.ex. /skapa – skapa event kräver konto).
// Hooks-regler: alltid anropas från komponenter – aldrig från vanliga funktioner.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useHander } from "@/lib/hander-store";

/** true när kontot är inloggad. Anropas alltid från en komponent. */
export function useIsLoggedIn(): boolean {
  const { account } = useHander();
  return Boolean(account);
}

/**
 * Skyddad sida: kräver inloggat konto.
 *
 * - Returnerar kontot så att komponenten kan visa vänt-/låges-yta.
 * - Omdirigerar (replace) till /loggain?redirect=<aktuell sida> när ingen
 *   session finns – inloggade användare väntas in först (authChecked) så att
 *   ingen studsar till inloggningssidan i onödan.
 */
export function useRequireAccount(): {
  account: { id: string; name: string } | null;
  loggedIn: boolean;
  /** true när vi vet om sessionen finns eller inte (inloggad, kollad eller timeout). */
  checked: boolean;
} {
  const { account, authChecked } = useHander();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [timedOut, setTimedOut] = useState(false);
  // Sidan skyddet utgick från – sparas första gången vi omdirigerar, så att
  // ?redirect= inte skrivs om till "/loggain" när pathname byts.
  const redirectedFrom = useRef<string | null>(null);

  // Skyddsnät om sessionskrocken aldrig svarar (t.ex. nere Supabase).
  useEffect(() => {
    if (account || authChecked) return;
    const t = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, [account, authChecked]);

  const checked = Boolean(account) || authChecked || timedOut;
  const loggedIn = Boolean(account);

  useEffect(() => {
    if (!checked || loggedIn) return;
    if (pathname === "/loggain") return; // redan på inloggningssidan
    redirectedFrom.current ??= pathname;
    void navigate({
      to: "/loggain",
      replace: true,
      search: { redirect: redirectedFrom.current },
    });
  }, [checked, loggedIn, pathname, navigate]);

  return { account, loggedIn, checked };
}

/**
 * UI-guard för "skapa event":
 * - inloggade går till /skapa
 * - utloggade skickas till /loggain?redirect=/skapa
 *   (försök att skapa ett event utan konto blir alltid en inloggning)
 */
export function useGoCreate(): { loggedIn: boolean; go: () => void } {
  const { account } = useHander();
  const navigate = useNavigate();
  const go = useCallback(() => {
    void navigate(
      account
        ? { to: "/skapa" }
        : { to: "/loggain", search: { redirect: "/skapa" } },
    );
  }, [account, navigate]);
  return { loggedIn: Boolean(account), go };
}
