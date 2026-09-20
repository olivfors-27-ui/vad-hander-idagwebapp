import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { BadgeCheck, BarChart3 } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/hander/AppShell";
import { Avatar, EventRow } from "@/components/hander/EventBits";
import { USERS } from "@/lib/hander-data";
import { hasEnded, useHander } from "@/lib/hander-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/anvandare/$username")({
  head: () => ({
    meta: [
      { title: "Profil – Händer" },
      { name: "description", content: "Se events och sparade favoriter från en användare." },
      { property: "og:title", content: "Profil – Händer" },
      { property: "og:description", content: "Följ arrangörer och vänner på Händer." },
    ],
  }),
  component: UserPage,
});

function UserPage() {
  const { username } = useParams({ from: "/anvandare/$username" });
  const store = useHander();
  const [tab, setTab] = useState<"kommande" | "sparade">("kommande");
  const user = USERS.find((u) => u.username.replace("@", "") === username);

  if (!user) {
    return (
      <AppShell title="Profil">
        <p className="p-8 text-center text-sm text-muted-foreground">Användaren hittades inte.</p>
      </AppShell>
    );
  }

  const isFollowing = store.following.includes(user.id);
  const created = store.events.filter(
    (e) => e.organizerId === user.id && e.visibility === "public" && e.status === "approved" && !hasEnded(e),
  );
  const interestedIn = store.events.filter(
    (e) => e.interested.includes(user.id) && e.visibility === "public" && !hasEnded(e),
  );
  const totalInterested = created.reduce((a, e) => a + e.interested.length, 0);

  return (
    <AppShell title={user.name}>
      <div className="space-y-5 p-4">
        <div className="flex items-center gap-4">
          <Avatar user={user} size={64} />
          <div className="flex-1">
            <h2 className="flex items-center gap-1 font-display text-lg font-bold">
              {user.name}
              {user.verified && <BadgeCheck className="h-4 w-4 text-primary" />}
            </h2>
            <p className="text-xs text-muted-foreground">{user.username}</p>
            <p className="mt-1 text-xs">
              <span className="font-bold">{user.followers}</span> följare ·{" "}
              <span className="font-bold">{user.following}</span> följer
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{user.bio}</p>

        <button
          type="button"
          onClick={() => store.toggleFollow(user.id)}
          className={cn(
            "w-full rounded-2xl px-4 py-3 text-sm font-bold",
            isFollowing
              ? "bg-secondary text-secondary-foreground"
              : "bg-primary text-primary-foreground shadow-[var(--shadow-pin)]",
          )}
        >
          {isFollowing ? "Slutar följa" : "Följ"}
        </button>

        {user.organizer && (
          <div className="rounded-2xl border border-border bg-secondary/50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold">
              <BarChart3 className="h-4 w-4 text-primary" /> Arrangörsstatistik
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat label="Event" value={created.length} />
              <Stat label="Intresserade" value={totalInterested} />
              <Stat label="Följare" value={user.followers} />
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Verifierad arrangör – kan skapa publika och privata event samt promota event.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          {(
            [
              ["kommande", "Kommande"],
              ["sparade", "Intresserad av"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex-1 rounded-full px-3 py-2 text-[11px] font-bold uppercase",
                tab === id
                  ? "bg-[#2A2421] text-[#FFFDF9] shadow-[0_3px_0_rgba(42,36,33,.2)]"
                  : "bg-[#2A2421] text-[#FFFDF9]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {(tab === "kommande" ? created : interestedIn).map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
          {(tab === "kommande" ? created : interestedIn).length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Inget att visa här än.</p>
          )}
        </div>

        <Link to="/foljer" className="block text-center text-xs font-bold text-[#2A2421]">
          Se allt från personer du följer →
        </Link>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-background p-2">
      <p className="font-display text-lg font-bold">{value}</p>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
    </div>
  );
}
