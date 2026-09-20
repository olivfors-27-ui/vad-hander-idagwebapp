import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Bell, Sparkles } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/hander/AppShell";
import { Avatar, EventRow } from "@/components/hander/EventBits";
import { ME, USERS, userById } from "@/lib/hander-data";
import { hasEnded, useHander } from "@/lib/hander-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profil")({
  head: () => ({
    meta: [
      { title: "Min profil – Händer" },
      { name: "description", content: "Dina event, sparade favoriter och personer du följer." },
      { property: "og:title", content: "Min profil – Händer" },
      { property: "og:description", content: "Håll koll på dina event och vänner på Händer." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const store = useHander();
  const me = userById(ME);
  const [tab, setTab] = useState<"kommande" | "mina">("kommande");

  // Kommande = event jag följer (intresserad av), Mina event = event jag organiserar.
  const upcoming = store.events.filter(
    (e) => !hasEnded(e) && (store.interested.includes(e.id) || e.interested.includes(ME)),
  );
  const mine = store.events.filter((e) => e.organizerId === ME);
  const followingUsers = USERS.filter((u) => store.following.includes(u.id));

  return (
    <AppShell title="Profil" subtitle={`${store.following.length} du följer · ${me.followers} följare`}>
      <div className="space-y-5 p-4">
        <div className="flex items-center gap-4">
          <Avatar user={me} size={64} />
          <div className="flex-1">
            <h2 className="font-display text-lg font-bold">{me.name}</h2>
            <p className="text-xs text-muted-foreground">{me.username}</p>
            <p className="mt-1 text-xs">
              <span className="font-bold">{me.followers}</span> följare ·{" "}
              <span className="font-bold">{store.following.length}</span> följer
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{me.bio}</p>

        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/foljer"
            className="rounded-2xl bg-[#F7E5D5] px-3 py-3 text-center text-xs font-bold text-[#E45048] shadow-[0_3px_0_rgba(112,28,23,.18)] active:translate-y-[2px]"
          >
            👥 Följer-flöde
          </Link>
          <Link
            to="/notiser"
            className="rounded-2xl bg-[#DDE3F8] px-3 py-3 text-center text-xs font-bold text-[#3B4CAD] shadow-[0_3px_0_rgba(59,76,173,.18)] active:translate-y-[2px]"
          >
            <Bell className="mx-auto mb-1 h-4 w-4" /> Notiser
          </Link>
        </div>

        <Link
          to="/arrangor"
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#E57657] px-4 py-3.5 text-center text-sm font-bold text-[#FFFDF9] shadow-[0_3px_0_rgba(112,28,23,.25)] active:translate-y-[2px]"
        >
          <BarChart3 className="h-4 w-4" /> Arrangörspanel – event & statistik
        </Link>

        <div className="flex rounded-full bg-[#F7E5D5] p-1">
          {(
            [
              ["kommande", "Kommande"],
              ["mina", "Mina event"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex-1 rounded-full px-2 py-2 text-[11px] font-bold uppercase transition-colors",
                tab === id
                  ? "bg-[#E57657] text-[#FFFDF9] shadow-[0_2px_0_rgba(112,28,23,.2)]"
                  : "text-[#8C7A6B]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {tab === "kommande" &&
            (upcoming.length ? (
              upcoming.map((e) => <EventRow key={e.id} event={e} />)
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Inget kommande än – hitta något på kartan!
              </p>
            ))}

          {tab === "mina" &&
            (mine.length ? (
              mine.map((e) => (
                <Link
                  key={e.id}
                  to="/event/$id/hantera"
                  params={{ id: e.id }}
                  className="block space-y-1"
                >
                  <EventRow event={e} />
                  <p className="pl-2 text-[11px] font-bold uppercase tracking-wide">
                    {e.status === "approved" && <span className="text-success">Godkänt</span>}
                    {e.status === "pending" && (
                      <span className="text-warning-foreground">Under granskning</span>
                    )}
                    {e.status === "rejected" && (
                      <span className="text-destructive">Avvisad · {e.rejectionReason}</span>
                    )}
                    {e.promoted && (
                      <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground">
                        <Sparkles className="h-3 w-3 text-primary" /> Sponsrat
                      </span>
                    )}
                  </p>
                </Link>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Du har inte skapat några event än.
              </p>
            ))}
        </div>

        <div>
          <h3 className="mb-2 font-display text-base font-bold">Du följer</h3>
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
            {followingUsers.map((u) => (
              <Link
                key={u.id}
                to="/anvandare/$username"
                params={{ username: u.username.replace("@", "") }}
                className="w-24 shrink-0 rounded-2xl border border-border p-3 text-center"
              >
                <Avatar user={u} size={40} />
                <p className="mt-1 truncate text-xs font-bold">{u.name.split(" ")[0]}</p>
                <p className="truncate text-[10px] text-muted-foreground">{u.username}</p>
              </Link>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={store.reset}
          className="w-full rounded-2xl bg-[#E7A057] px-4 py-3 text-xs font-bold text-[#FFFDF9] shadow-[0_3px_0_rgba(138,90,34,.3)] active:translate-y-[2px]"
        >
          Återställ demodata
        </button>
      </div>
    </AppShell>
  );
}
