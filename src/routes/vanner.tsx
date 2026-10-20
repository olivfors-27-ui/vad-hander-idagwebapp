import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarPlus, Loader2, Search, UserCheck, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/hander/AppShell";
import { useIsLoggedIn } from "@/lib/auth-guard";
import { useHander } from "@/lib/hander-store";
import {
  fetchFollowerIds,
  fetchFollowingIds,
  fetchProfilesByIds,
  fetchRecentProfiles,
  searchProfiles,
  type Profile,
} from "@/lib/profiles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vanner")({
  head: () => ({
    meta: [
      { title: "Vänner – Händer" },
      {
        name: "description",
        content:
          "Sök upp personer via användarnamn, följ dem och bjud in gänget till ett event på Händer.",
      },
      { property: "og:title", content: "Vänner – Händer" },
      { property: "og:description", content: "Hitta personer, följ dem och planera något tillsammans." },
    ],
  }),
  component: FriendsPage,
});

/** Ljus palettvariant + mörk textton, samma familj som sektionsfärgerna. */
const TONE_SOFT = {
  red: "bg-[#FBD9D6] text-[#8E3B34]",
  pink: "bg-[#F5DCD3] text-[#8E4A38]",
  blue: "bg-[#DDE3F8] text-[#3B4CAD]",
} as const;

const AVATAR_TONES = ["bg-[#FBD9D6]", "bg-[#DDE3F8]", "bg-[#F7E5D5]", "bg-[#EAF6EE]"] as const;
const avatarTone = (id: string) => AVATAR_TONES[id.charCodeAt(0) % AVATAR_TONES.length]!;

function ProfileRow({
  person,
  isFollowing,
  onToggle,
  hint,
  tone = "pink",
}: {
  person: Profile;
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
        params={{ username: person.username }}
        className="shrink-0"
        aria-label={`Öppna ${person.name}s profil`}
      >
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl text-2xl",
            avatarTone(person.id),
          )}
          aria-hidden
        >
          {person.avatarEmoji}
        </span>
      </Link>
      <Link
        to="/anvandare/$username"
        params={{ username: person.username }}
        className="min-w-0 flex-1"
      >
        <p className="truncate text-sm font-bold text-foreground">
          {person.name}
          {person.isModerator && <span className="ml-1 text-[#465BC4]">✔</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {hint ?? `@${person.username}`}
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
  const loggedIn = useIsLoggedIn();
  const account = store.account;
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("foljer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Profile[]>([]);
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [followingProfiles, setFollowingProfiles] = useState<Profile[]>([]);
  const [followerProfiles, setFollowerProfiles] = useState<Profile[]>([]);

  const query = q.trim();

  // Alla riktiga konton att föreslå – inga demoanvändare.
  useEffect(() => {
    if (!account) {
      setSuggestions([]);
      return;
    }
    let active = true;
    void fetchRecentProfiles(account.id)
      .then((people) => {
        if (active) setSuggestions(people);
      })
      .catch(() => {
        if (active) setSuggestions([]);
      });
    return () => {
      active = false;
    };
  }, [account]);

  // Följer/följare hämtas från follows-tabellen via profil-id.
  useEffect(() => {
    if (!account) {
      setFollowingProfiles([]);
      setFollowerProfiles([]);
      return;
    }
    let active = true;
    void Promise.all([fetchFollowingIds(account.id), fetchFollowerIds(account.id)])
      .then(async ([followingIds, followerIds]) => {
        const [following, followers] = await Promise.all([
          fetchProfilesByIds(followingIds),
          fetchProfilesByIds(followerIds),
        ]);
        if (!active) return;
        setFollowingProfiles(following);
        setFollowerProfiles(followers);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [account]);

  // Sökning mot profiler (användarnamn eller visningsnamn), med kort fördröjning.
  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      void searchProfiles(query, account?.id)
        .then((people) => {
          if (!active) return;
          setResults(people);
          setError(null);
        })
        .catch(() => {
          if (active) setError("Sökningen misslyckades. Försök igen om en stund.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, account?.id]);

  const followingIds = useMemo(
    () => new Set([...followingProfiles.map((p) => p.id), ...store.following]),
    [followingProfiles, store.following],
  );

  /** Följ/avfölj och uppdatera listan direkt så att Följer-fliken stämmer. */
  const togglePerson = (person: Profile) => {
    const wasFollowing = followingIds.has(person.id);
    store.toggleFollow(person.id);
    setFollowingProfiles((prev) =>
      wasFollowing ? prev.filter((p) => p.id !== person.id) : [...prev, person],
    );
  };

  const base =
    tab === "foljer" ? followingProfiles : tab === "foljare" ? followerProfiles : suggestions;
  const list = query ? results : base;

  const empty =
    tab === "foljer"
      ? "Du följer ingen än – sök på ett användarnamn under Hitta."
      : tab === "foljare"
        ? "Ingen följer dig än."
        : "Inga andra konton hittades ännu.";

  return (
    <AppShell
      title="Vänner"
      subtitle={`${followingProfiles.length} du följer · ${followerProfiles.length} följare`}
    >
      <div className="relative space-y-6 pb-4 pt-5">
        <section className="section-zone section-zone--red relative space-y-4 pb-4">
          <div className="px-4">
            <h2 className="section-pill section-pill--red relative inline-flex items-center gap-2 px-3.5 py-2 text-sm font-bold">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#E45048]" />
              <span>Hitta och följ vänner</span>
            </h2>
          </div>

          {account ? (
            <div className="px-4">
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#E45048]" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Sök användarnamn eller namn"
                  autoComplete="off"
                  className="w-full rounded-2xl border-2 border-[#E45048] bg-white py-3 pl-10 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-[#E45048]/25"
                />
                {loading && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#E45048]" />
                )}
              </label>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Sök på @användarnamn eller visningsnamn. Mejladresser visas aldrig.
              </p>
            </div>
          ) : (
            <div className="px-4">
              <div className="rounded-2xl border border-dashed border-border p-4 text-center">
                <p className="text-sm font-bold">Logga in för att hitta vänner</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Alla konton är egna användare – inga demoprofiler.
                </p>
                <Link
                  to="/loggain"
                  search={{ redirect: "/vanner" }}
                  className="mt-3 inline-flex rounded-xl bg-[#E45048] px-4 py-2.5 text-xs font-bold text-white"
                >
                  Logga in
                </Link>
              </div>
            </div>
          )}

          {!query && account && (
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

        {account && (
          <section className="section-zone section-zone--orange relative space-y-3 pb-3">
            <div className="flex items-center justify-between px-4">
              <h2 className="section-pill section-pill--pink relative inline-flex items-center gap-2 px-3.5 py-2 text-sm font-bold">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#E57657]" />
                <span>
                  {query ? `Sökresultat (${list.length})` : TABS.find((t) => t.id === tab)?.label}
                </span>
              </h2>
            </div>

            <div className="space-y-2 px-4">
              {error && (
                <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive">
                  {error}
                </p>
              )}
              {list.map((person) => (
                <ProfileRow
                  key={person.id}
                  person={person}
                  isFollowing={followingIds.has(person.id)}
                  onToggle={() => togglePerson(person)}
                  tone={tab === "foljer" ? "pink" : tab === "foljare" ? "blue" : "red"}
                  {...(tab === "foljare" && !query ? { hint: `@${person.username} · följer dig` } : {})}
                />
              ))}
              {!loading && list.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {query ? `Ingen matchar "${q.trim()}".` : empty}
                </p>
              )}
            </div>
          </section>
        )}

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
