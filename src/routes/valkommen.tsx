import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Home, LogIn } from "lucide-react";
import { AppShell } from "@/components/hander/AppShell";
import { useAccount } from "@/lib/auth";

export const Route = createFileRoute("/valkommen")({
  head: () => ({
    meta: [
      { title: "Tack för att du har registrerat dig – Händer" },
      {
        name: "description",
        content: "Ditt konto är bekräftat. Logga in och börja hitta det som händer.",
      },
      { property: "og:title", content: "Tack för att du har registrerat dig – Händer" },
    ],
  }),
  component: WelcomePage,
});

/**
 * Landningssida efter e-postbekräftelsen. Supabase-klienten växlar länken till
 * en session automatiskt, så sidan kan bekräfta både kontot och inloggningen.
 */
function WelcomePage() {
  const account = useAccount();

  return (
    <AppShell title="Välkommen" subtitle="Ditt konto är bekräftat">
      <div className="mx-auto w-full max-w-sm space-y-5 p-4 pb-28 pt-8">
        <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
          <CheckCircle2 className="mx-auto h-14 w-14 text-[#3E9B5F]" strokeWidth={1.8} />
          <h2 className="mt-3 font-display text-xl font-bold leading-tight text-[#2A2421]">
            Tack för att du har registrerat dig!
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Ditt konto är verifierat och klart att använda. Nu kan du skapa event, bjuda in
            vänner och hitta det som händer i Stockholm.
          </p>
          {account && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#EAF6EE] px-3 py-1.5 text-xs font-bold text-[#2F7C4B]">
              Inloggad som {account.name}
              {account.username ? ` (@${account.username})` : ""}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Link
            to={account ? "/" : "/loggain"}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E45048] px-4 py-4 text-sm font-bold text-[#FFFDF9] shadow-[0_3px_0_rgba(112,28,23,.25)] active:translate-y-[2px]"
          >
            {account ? <Home className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            {account ? "Till startsidan" : "Logga in"}
          </Link>
          {account ? (
            <Link
              to="/profil"
              className="block rounded-2xl bg-[#DDE3F8] px-4 py-3 text-center text-sm font-bold text-[#3B4CAD]"
            >
              Till din profil
            </Link>
          ) : (
            <Link
              to="/"
              className="block rounded-2xl bg-secondary px-4 py-3 text-center text-sm font-bold text-secondary-foreground"
            >
              Till startsidan
            </Link>
          )}
        </div>

        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          Om du inte hittar mejlet kan du logga in igen – då skickas en ny bekräftelselänk.
        </p>
      </div>
    </AppShell>
  );
}
