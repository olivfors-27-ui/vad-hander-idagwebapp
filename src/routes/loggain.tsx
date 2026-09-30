import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, LogIn, Mail } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/hander/AppShell";
import { isAuthConfigured, signIn, signOut, signUp, useAccount } from "@/lib/auth";

export const Route = createFileRoute("/loggain")({
  head: () => ({
    meta: [
      { title: "Logga in – Händer" },
      { name: "description", content: "Logga in eller skapa konto på Händer." },
    ],
  }),
  component: LoginPage,
});

type Mode = "login" | "register";

function LoginPage() {
  const navigate = useNavigate();
  const account = useAccount();
  const configured = isAuthConfigured();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Fyll i mejl och lösenord.");
      return;
    }
    if (mode === "register" && password.length < 6) {
      setError("Lösenordet måste vara minst 6 tecken.");
      return;
    }
    setBusy(true);
    const result = mode === "login" ? await signIn(email.trim(), password) : await signUp(name.trim(), email.trim(), password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (mode === "register") {
      toast.success("Konto skapat! Kolla din inkorg och bekräfta mejlen, sen kan du logga in.");
    } else {
      toast.success("Inloggad – kul att se dig!");
      void navigate({ to: "/profil" });
    }
  };

  return (
    <AppShell title={mode === "login" ? "Logga in" : "Skapa konto"} subtitle="Häng på det som händer">
      <div className="mx-auto w-full max-w-sm space-y-4 p-4 pb-28">
        {account ? (
          <div className="space-y-4 rounded-3xl border border-border bg-card p-5 text-center">
            <div className="text-5xl">{account.avatarEmoji}</div>
            <div>
              <p className="text-base font-bold">{account.name}</p>
              <p className="text-xs text-muted-foreground">{account.email}</p>
            </div>
            <p className="text-xs text-muted-foreground">Du är redan inloggad.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void navigate({ to: "/profil" })}
                className="flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-pin)]"
              >
                Till profilen
              </button>
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex-1 rounded-2xl border border-border bg-accent px-4 py-3 text-sm font-bold"
              >
                Logga ut
              </button>
            </div>
          </div>
        ) : (
          <>
            {!configured && (
              <div className="rounded-2xl border border-border bg-accent/60 p-4 text-xs leading-relaxed text-muted-foreground">
                Konton är inte kopplade ännu på den här installationen. Ägaren behöver lägga in
                Supabase-nycklar i Cloudflare-inställningarna.
              </div>
            )}

            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-accent p-1">
              {(["login", "register"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError(null);
                  }}
                  className={
                    mode === m
                      ? "rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground"
                      : "rounded-xl px-3 py-2.5 text-xs font-bold text-muted-foreground"
                  }
                >
                  {m === "login" ? "Logga in" : "Skapa konto"}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-3 rounded-3xl border border-border bg-card p-5">
              {mode === "register" && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold">Visningsnamn</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="T.ex. Olle"
                    autoComplete="nickname"
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                  />
                </label>
              )}
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold">Mejl</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="du@exempel.se"
                  autoComplete="email"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold">Lösenord</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "Minst 6 tecken" : "Ditt lösenord"}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </label>

              {error && (
                <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-xs font-bold text-destructive">{error}</p>
              )}

              <button
                type="submit"
                disabled={busy || !configured}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-sm font-bold text-primary-foreground shadow-[var(--shadow-pin)] disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : mode === "login" ? <LogIn className="size-4" /> : <Mail className="size-4" />}
                {busy ? "Ett ögonblick…" : mode === "login" ? "Logga in" : "Skapa konto"}
              </button>

              <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                {mode === "register"
                  ? "Du får ett mejl med en bekräftelselänk. Efter det loggar du in som vanligt."
                  : "Har du inget konto? Byt till \"Skapa konto\" ovan."}
              </p>
            </form>
          </>
        )}
      </div>
    </AppShell>
  );
}
