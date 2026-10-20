import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [{ title: "Bekräftar inloggning – Händer" }],
  }),
  component: AuthCallback,
});

/** Landningssida för mejllänkar (bekräftelse/inloggning). Supabase-js växlar
 *  koden i URL:en till en session automatiskt (detectSessionInUrl); här väntar
 *  vi in det, med en manuell fallback för pkce-flödet. */
function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const url = new URL(window.location.href);
    const urlError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
    if (urlError) {
      setError(decodeURIComponent(urlError));
      return;
    }

    const check = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user && !cancelled) {
          toast.success("Mejlen bekräftad – du är inloggad!");
          // Tack-sidan bekräftar registreringen och länkar vidare in i appen.
          void navigate({ to: "/valkommen", replace: true });
          return true;
        }
      } catch {
        /* klienten okonfigurerad */
      }
      return false;
    };

    const run = async () => {
      if (await check()) return;
      try {
        // pkce-fallback om biblioteket inte redan växlat koden
        await supabase.auth.exchangeCodeForSession(window.location.href);
      } catch {
        /* ingen kod eller redan använd – check() avgör nedan */
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (!(await check()) && !cancelled) {
        setError("Länken verkar ogiltig eller för gammal. Prova logga in igen.");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
      {error ? (
        <>
          <p className="text-sm font-bold text-destructive">{error}</p>
          <a href="/loggain" className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">
            Till inloggningen
          </a>
        </>
      ) : (
        <>
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm font-bold">Bekräftar din mejl…</p>
        </>
      )}
    </div>
  );
}
