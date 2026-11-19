import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, CircleHelp, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/hander/AppShell";
import { signOut } from "@/lib/auth";
import { useHander, type NotifSettings } from "@/lib/hander-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/installningar")({
  head: () => ({
    meta: [
      { title: "Inställningar – Händer" },
      { name: "description", content: "Profil, notiser och konto för ditt Händer-konto." },
      { property: "og:title", content: "Inställningar – Händer" },
    ],
  }),
  component: SettingsPage,
});

type Section = "profil" | "notiser" | "konto" | "hjalp";

const SECTIONS: { id: Section; label: string; icon: typeof UserRound }[] = [
  { id: "profil", label: "Redigera profil", icon: UserRound },
  { id: "notiser", label: "Notiser", icon: Bell },
  { id: "konto", label: "Konto", icon: ShieldCheck },
  { id: "hjalp", label: "Hjälp", icon: CircleHelp },
];

const NOTIF_ROWS: { id: keyof NotifSettings; label: string; sub: string }[] = [
  { id: "nearby", label: "Nära dig", sub: "Nya event inom 1 km" },
  { id: "follow", label: "Personer du följer", sub: "När någon du följer skapar event" },
  { id: "reminder", label: "Påminnelser", sub: "En timme innan eventet börjar" },
  { id: "social", label: "Socialt", sub: "När vänner är intresserade" },
  { id: "plan", label: "Planer", sub: "Nya planer och svar på dina planer" },
];

function SettingsPage() {
  const store = useHander();
  const [section, setSection] = useState<Section>("profil");

  return (
    <AppShell title="Inställningar">
      <div className="hander-settings">
        <nav className="hander-settings-menu" aria-label="Inställningssektioner">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              aria-current={section === id ? "true" : undefined}
              className={cn("hander-settings-item", section === id && "is-active")}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>

        <section className="min-w-0">
          {section === "profil" && (
            <>
              <h2 className="font-display text-xl font-extrabold">Redigera profil</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Namn, användarnamn och emoji visas för andra i appen.
              </p>
              <div className="mt-5 flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent text-3xl">
                  {store.account?.avatarEmoji ?? "🙂"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">
                    {store.account?.name ?? "Inte inloggad"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {store.account ? `@${store.account.username}` : "Logga in för att redigera"}
                  </p>
                </div>
                <Link
                  to={store.account ? "/profil" : "/loggain"}
                  className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                >
                  {store.account ? "Visa profil" : "Logga in"}
                </Link>
              </div>
              <dl className="mt-4 space-y-2">
                <div className="hander-settings-row">
                  <dt className="text-sm font-semibold">Visningsnamn</dt>
                  <dd className="text-sm text-muted-foreground">{store.account?.name ?? "—"}</dd>
                </div>
                <div className="hander-settings-row">
                  <dt className="text-sm font-semibold">Användarnamn</dt>
                  <dd className="text-sm text-muted-foreground">
                    {store.account ? `@${store.account.username}` : "—"}
                  </dd>
                </div>
                <div className="hander-settings-row">
                  <dt className="text-sm font-semibold">E-post</dt>
                  <dd className="truncate text-sm text-muted-foreground">
                    {store.account?.email || "—"}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                Uppgifterna ändras i kontots profil och uppdateras här automatiskt.
              </p>
            </>
          )}

          {section === "notiser" && (
            <>
              <h2 className="font-display text-xl font-extrabold">Notiser</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Välj vilka händelser som ska dyka upp i notispanelen.
              </p>
              <div className="mt-5 space-y-2">
                {NOTIF_ROWS.map((row) => {
                  const on = store.notifSettings[row.id];
                  return (
                    <div key={row.id} className="hander-settings-row">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{row.label}</p>
                        <p className="text-xs text-muted-foreground">{row.sub}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={row.label}
                        onClick={() => store.setNotifSettings({ [row.id]: !on })}
                        className={cn("hander-settings-switch", on && "is-on")}
                      >
                        <span />
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Ändringarna sparas direkt i den här webbläsaren.
              </p>
            </>
          )}

          {section === "konto" && (
            <>
              <h2 className="font-display text-xl font-extrabold">Konto</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {store.account
                  ? "Du är inloggad. Här kan du byta konto eller logga ut."
                  : "Du är inte inloggad."}
              </p>
              <div className="mt-5 space-y-2">
                <Link to="/loggain" className="hander-settings-row hover:bg-accent/40">
                  <span className="text-sm font-semibold">Byt konto</span>
                  <span className="text-xs text-muted-foreground">Till inloggning</span>
                </Link>
                {store.isModerator && (
                  <Link to="/admin" className="hander-settings-row hover:bg-accent/40">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <ShieldCheck className="h-4 w-4" /> Moderering
                    </span>
                    <span className="text-xs text-muted-foreground">Granska event</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void signOut().then(() => toast.success("Du är utloggad"));
                  }}
                  className="hander-settings-row w-full text-left hover:bg-accent/40"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <LogOut className="h-4 w-4" /> Logga ut
                  </span>
                </button>
              </div>
            </>
          )}

          {section === "hjalp" && (
            <>
              <h2 className="font-display text-xl font-extrabold">Hjälp</h2>
              <div className="mt-5 space-y-2">
                <div className="hander-settings-row block">
                  <p className="text-sm font-semibold">Hur skapar jag ett event?</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tryck på + i menyn. Du måste vara inloggad och kan skapa högst fem event per
                    dag. Publika event granskas innan de publiceras.
                  </p>
                </div>
                <div className="hander-settings-row block">
                  <p className="text-sm font-semibold">Hur bjuder jag in gäster?</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dela eventets länk. Gästen anger sitt namn och svarar ja, nej eller kanske –
                    utan konto.
                  </p>
                </div>
                <div className="hander-settings-row block">
                  <p className="text-sm font-semibold">Varför syns inte mitt event?</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Publika event visas först efter godkännande. Avslutade event döljs
                    automatiskt tre timmar efter sluttiden.
                  </p>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
