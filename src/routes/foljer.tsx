import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/hander/AppShell";
import { Avatar, EventCard, MaybeEventLink } from "@/components/hander/EventBits";
import { USERS, userById } from "@/lib/hander-data";
import { isEventVisible, useHander } from "@/lib/hander-store";

export const Route = createFileRoute("/foljer")({
  head: () => ({
    meta: [
      { title: "Följer – Händer" },
      { name: "description", content: "Se vad dina vänner och arrangörer du följer gör." },
      { property: "og:title", content: "Följer – Händer" },
      { property: "og:description", content: "Socialt flöde med events från folk du följer." },
    ],
  }),
  component: FeedPage,
});

/** Diskreta icke-palettaccenter för profilbilder, valda deterministiskt per användare. */
const AVATAR_BORDER_COLORS = ["#2FA3A0", "#7B61C9", "#D97706", "#0E7490", "#B45309", "#4D7C0F"] as const;
const avatarBorder = (id: string) =>
  AVATAR_BORDER_COLORS[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_BORDER_COLORS.length];

function FeedPage() {
  const store = useHander();
  const fromFollowing = store.publicEvents.filter(
    (e) => store.following.includes(e.organizerId) && isEventVisible(e),
  );
  const suggestions = USERS.filter((u) => u.id !== "u1" && !store.following.includes(u.id));

  return (
    <AppShell title="Följer" subtitle={`${store.following.length} personer`}>
      <div className="space-y-6 py-4">
        <section className="space-y-2 px-4">
          {store.feed.map((f) => (
            <MaybeEventLink
              key={f.id}
              eventId={f.eventId}
              className="feed-row flex items-stretch gap-3"
            >
              {/* Profilen sitter separat till vänster, utanför den vita rektangeln. */}
              <span className="flex shrink-0 items-center">
                {f.userId ? (
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] bg-background text-sm"
                    style={{ borderColor: avatarBorder(f.userId) }}
                  >
                    <Avatar user={userById(f.userId)} size={30} />
                  </span>
                ) : (
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] bg-accent text-sm"
                    style={{ borderColor: avatarBorder(f.id) }}
                  >
                    👥
                  </span>
                )}
              </span>
              <span className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl bg-card px-3.5 py-3">
                <span className="min-w-0 flex-1 truncate text-sm">{f.text}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{f.time}</span>
              </span>
            </MaybeEventLink>
          ))}
        </section>

        {fromFollowing.length > 0 && (
          <section className="space-y-3">
            <h2 className="px-4 font-display text-base font-bold">Event från dem du följer</h2>
            <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
              {fromFollowing.map((e) => (
                <EventCard key={e.id} event={e} compact />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="px-4 font-display text-base font-bold">Föreslagna att följa</h2>
          <div className="space-y-2 px-4">
            {suggestions.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                <Avatar user={u} size={40} />
                <Link
                  to="/anvandare/$username"
                  params={{ username: u.username.replace("@", "") }}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate text-sm font-bold">
                    {u.name} {u.verified && "✔️"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.username} · {u.followers} följare
                  </p>
                </Link>
                <button
                  type="button"
                  onClick={() => store.toggleFollow(u.id)}
                  className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
                >
                  Följ
                </button>
              </div>
            ))}
            {suggestions.length === 0 && (
              <p className="text-sm text-muted-foreground">Du följer redan alla i demon.</p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
