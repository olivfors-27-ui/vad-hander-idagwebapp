import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarPlus, Search, UserCheck, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/hander/AppShell";
import { useIsLoggedIn } from "@/lib/auth-guard";
import { ME, USERS, type User } from "@/lib/hander-data";
import { useHander } from "@/lib/hander-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vanner")({
  head: () => ({
    meta: [
      { title: "Vänner – Händer" },
      {
        name: "description",
        content:
          "Sök efter personer, följ vänner, se dina följare och bjud in gänget till en plan på Händer.",
      },
      { property: "og:title", content: "Vänner – Händer" },
      {
        property: "og:description",
        content: "Hitta personer, följ dem och planera något tillsammans.",
      },
    ],
  }),
  component: FriendsPage,
});

/** Mockade följare: personer som följer dig i demon. */
const FOLLOWER_IDS = ["u2", "u4", "u6", "u7", "u8"];

/** Exempelbilder istället för emoji, samma stil som eventkorten på hem. */
const USER_COVERS: Record<string, string> = {
  u1: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80",
  u2: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
  u3: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=200&q=80",
  u4: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=200&q=80",
  u5: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=200&q=80",
  u6: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=200&q=80",
  u7: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=200&q=80",
  u8: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=200&q=80",
};

const userCover = (id: string) => USER_COVERS[id] ?? USER_COVERS["u1"];

/** Ljus palettvariant + mörk textton, samma familj som sektionsfärgerna. */
const TONE_SOFT = {
  red: "bg-[#FBD9D6] text-[#8E3B34]",
  pink: "bg-[#F5DCD3] text-[#8E4A38]",
  blue: "bg-[#DDE3F8] text-[#3B4CAD]",
} as const;

function UserRow({
  user,
  isFollowing,
  onToggle,
  hint,
  tone = "pink",
}: {
  user: User;
  isFollowing: boolean;
  onToggle: () => void;
  hint?: string;
  tone?: "red" | "pink" | "blue";
}) {
  const toneClasses = {
    red: "friend-row--red",
    pink: "friend-row--pink",
    blue: "friend-row--blue",
  } as const;

  return (
    <div
      className={cn(
        "friend-row flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-[var(--shadow-card)]",
        toneClasses[tone],
      )}
    >
      <Link
        to="/anvandare/$username"
        params={{ username: user.username.replace("@", "") }}
        className="shrink-0"
        aria-label={`Öppna ${user.name}s profil`}
      >
        <img
          src={userCover(user.id)}
          alt=""
          loading="lazy"
          style={{ backgroundColor: user.color }}
          className="h-12 w-12 rounded-xl object-cover"
        />
      </Link>
      <Link
        to="/anvandare/$username"
        params={{ username: user.username.replace("@", "") }}
        className="min-w-0 flex-1"
      >
        <p className="truncate text-sm font-bold text-foreground">
          {user.name}
          {user.verified && <span className="ml-1 text-[#465BC4]">✔</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {hint ?? `${user.username} · ${user.followers} följare`}
        </p>
      </Link>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-full px-3.5 py-2 text-xs font-bold transition-colors",
          isFollowing ? TONE_SOFT[tone] : "bg-[#E45048] text-white",
        )}
      >
        {isFollowing ? (
          <>
            <UserCheck className="h-3.5 w-3.5" /> Följer
          </>
        ) : (
          <>
            <UserPlus className="h-3.5 w-3.5" /> Följ
          </>
        )}
      </button>
    </div>
  );
}

type Tab = "foljer" | "foljare" | "hitta";

const TABS: { id: Tab; label: string }[] = [
  { id: "foljer", label: "Följer" },
  { id: "foljare", label: "Följare" },
  { id: "hitta", label: "Hitta" },
];

function FriendsPage() {
  const store = useHander();
  // UI-guard: skapa-event-knappen visas bara för inloggade.
  const loggedIn = useIsLoggedIn();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("foljer");

  const others = useMemo(() => USERS.filter((u) => u.id !== ME), []);
  const query = q.trim().toLowerCase();

  const following = others.filter((u) => store.following.includes(u.id));
  const followers = others.filter((u) => FOLLOWER_IDS.includes(u.id));
  const suggestions = others
    .filter((u) => !store.following.includes(u.id))
    .sort((a, b) => b.followers - a.followers);

  const base = tab === "foljer" ? following : tab === "foljare" ? followers : suggestions;
  const list = query
    ? others.filter(
        (u) => u.name.toLowerCase().includes(query) || u.username.toLowerCase().includes(query),
      )
    : base;

  const empty =
    tab === "foljer"
      ? "Du följer ingen än – kolla in fliken Hitta."
      : tab === "foljare"
        ? "Ingen följer dig än."
        : "Du följer redan alla i demon.";

  return (
    <AppShell
      title="Vänner"
      subtitle={`${following.length} du följer · ${followers.length} följare`}
    >
      <div className="relative space-y-6 pb-4 pt-5">
        <section className="section-zone section-zone--red relative space-y-4 pb-4">
          <div className="px-4">
            <h2 className="section-pill section-pill--red relative inline-flex items-center gap-2 px-3.5 py-2 text-sm font-bold">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#E45048]" />
              <span>Hitta och följ vänner</span>
            </h2>
          </div>

          <div className="px-4">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#E45048]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Sök efter personer"
                className="w-full rounded-2xl border-2 border-[#E45048] bg-white py-3 pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-[#E45048]/25"
              />
            </label>
          </div>

          {!query && (
            <div className="flex gap-2 px-4">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex-1 rounded-full px-3 py-2 text-sm font-bold transition-colors",
                    tab === t.id
                      ? "bg-[#E45048] text-white shadow-[0_3px_0_rgba(112,28,23,.3)]"
                      : TONE_SOFT.red,
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="section-zone section-zone--orange relative space-y-3 pb-3">
          <div className="flex items-center justify-between px-4">
            <h2 className="section-pill section-pill--pink relative inline-flex items-center gap-2 px-3.5 py-2 text-sm font-bold">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#E57657]" />
              <span>{query ? `Sökresultat (${list.length})` : TABS.find((t) => t.id === tab)?.label}</span>
            </h2>
          </div>

          <div className="space-y-2 px-4">
          {list.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              isFollowing={store.following.includes(u.id)}
              onToggle={() => store.toggleFollow(u.id)}
              tone={tab === "foljer" ? "pink" : tab === "foljare" ? "blue" : "red"}
              {...(tab === "foljare" && !query && !store.following.includes(u.id)
                ? { hint: `${u.username} · följer dig` }
                : {})}
            />
          ))}
          {list.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {query ? `Ingen matchar "${q}".` : empty}
            </p>
          )}
          </div>
        </section>

        <div className="space-y-2 px-4">
          {loggedIn && (
            <Link
              to="/skapa"
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#E45048] px-4 py-3.5 text-center text-sm font-bold text-white shadow-[0_3px_0_rgba(112,28,23,.25)]"
            >
              <CalendarPlus className="h-4 w-4" /> Planera något med gänget
            </Link>
          )}
          <Link
            to="/foljer"
            className="block rounded-2xl bg-[#DDE3F8] px-4 py-3 text-center text-sm font-bold text-[#3B4CAD]"
          >
            Se vad de du följer är intresserade av →
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
