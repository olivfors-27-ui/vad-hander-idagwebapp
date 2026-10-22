import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { BadgeCheck, BarChart3, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/hander/AppShell";
import { EventRow } from "@/components/hander/EventBits";
import { ME, type User } from "@/lib/hander-data";
import { isEventVisible, useHander } from "@/lib/hander-store";
import { fetchFollowerIds, fetchFollowingIds, fetchProfileByUsername, type Profile } from "@/lib/profiles";
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

const profileToUser = (profile: Profile, counts: { followers: number; following: number }): User => ({
  id: profile.id,
  name: profile.name,
  username: `@${profile.username}`,
  bio: "",
  avatar: profile.avatarEmoji,
  color: "#8C7A6B",
  followers: counts.followers,
  following: counts.following,
  organizer: true,
  verified: profile.isModerator,
});

function UserPage() {
  const { username } = useParams({ from: "/anvandare/$username" });
  const store = useHander();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"kommande" | "sparade">("kommande");

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchProfileByUsername(username)
      .then(async (found) => {
        if (!active) return;
        setProfile(found);
        if (!found) return;
        const [followers, following] = await Promise.all([
          fetchFollowerIds(found.id).catch(() => []),
          fetchFollowingIds(found.id).catch(() => []),
        ]);
        if (active) setCounts({ followers: followers.length, following: following.length });
      })
      .catch(() => {
        if (active) setProfile(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [username]);

  const user = useMemo(() => (profile ? profileToUser(profile, counts) : null), [profile, counts]);

  if (loading) {
    return (
      <AppShell title="Profil">
        <p className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Hämtar profilen…
        </p>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell title="Profil">
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Användaren hittades inte.</p>
          <Link to="/vanner" className="mt-3 inline-block text-sm font-bold text-primary">
            Sök personer →
          </Link>
        </div>
      </AppShell>
    );
  }

  const isSelf = profile?.id === store.account?.id || profile?.id === ME;
  const isFollowing = store.following.includes(user.id);
  const toggleFollow = () => {
    const next = !isFollowing;
    store.toggleFollow(user.id);
    setCounts((current) => ({
      ...current,
      followers: Math.max(0, current.followers + (next ? 1 : -1)),
    }));
  };
  const created = store.events.filter(
    (e) =>
      e.organizerId === user.id &&
      e.visibility === "public" &&
      e.status === "approved" &&
      isEventVisible(e),
  );
  const interestedIn = store.events.filter(
    (e) => e.interested.includes(user.id) && e.visibility === "public" && isEventVisible(e),
  );
  const totalInterested = created.reduce((a, e) => a + e.interested.length, 0);

  return (
    <AppShell title={user.name}>
      <div className="space-y-5 p-4">
        <div className="flex items-center gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-accent text-4xl">
            {profile?.avatarEmoji || "🙂"}
          </span>
          <div className="flex-1">
            <h2 className="flex items-center gap-1 font-display text-lg font-bold">
              {user.name}
              {profile?.isModerator && <BadgeCheck className="h-4 w-4 text-primary" />}
            </h2>
            <p className="text-xs text-muted-foreground">@{profile?.username}</p>
            <p className="mt-1 text-xs">
              <span className="font-bold">{counts.followers}</span> följare ·{" "}
              <span className="font-bold">{counts.following}</span> följer
            </p>
          </div>
        </div>

        {!isSelf && (
          <button
            type="button"
            onClick={toggleFollow}
            className={cn(
              "w-full rounded-2xl px-4 py-3 text-sm font-bold",
              isFollowing
                ? "bg-secondary text-secondary-foreground"
                : "bg-primary text-primary-foreground shadow-[var(--shadow-pin)]",
            )}
          >
            {isFollowing ? "Slutar följa" : "Följ"}
          </button>
        )}

        <div className="rounded-2xl border border-border bg-secondary/50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold">
            <BarChart3 className="h-4 w-4 text-primary" /> Arrangörsstatistik
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="Event" value={created.length} />
            <Stat label="Intresserade" value={totalInterested} />
            <Stat label="Följare" value={counts.followers} />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Arrangörsprofil – event och statistik som visas här är offentligt tillgängliga.
          </p>
        </div>

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
                  ? "bg-[#E57657] text-[#FFFDF9] shadow-[0_3px_0_rgba(112,28,23,.2)]"
                  : "bg-[#F7E5D5] text-[#8C7A6B]",
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
