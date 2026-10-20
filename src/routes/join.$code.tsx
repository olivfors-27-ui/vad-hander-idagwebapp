import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, MapPin, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/hander/AppShell";
import { Avatar, EventCover } from "@/components/hander/EventBits";
import { InviteReply } from "@/components/hander/InviteReply";
import { useProfileName } from "@/lib/auth";
import { MAX_EVENT_GUESTS, limitMessage } from "@/lib/event-admin";
import { ME, userById, type EventItem, type User } from "@/lib/hander-data";
import type { GuestRow } from "@/lib/private-event-invites";
import { formatDay, useHander } from "@/lib/hander-store";

export const Route = createFileRoute("/join/$code")({
  head: () => ({
    meta: [
      { title: "Du är inbjuden – Händer" },
      { name: "description", content: "Svara på en inbjudan till ett privat event." },
      { property: "og:title", content: "Du är inbjuden – Händer" },
      { property: "og:description", content: "Någon har bjudit in dig till ett privat event." },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { code } = useParams({ from: "/join/$code" });
  const store = useHander();
  const [loadedEvent, setLoadedEvent] = useState<EventItem | null>(null);
  const localEvent = store.events.find((e) => e.inviteCode?.toUpperCase() === code.toUpperCase());
  const event = (localEvent?.visibility === "private" ? localEvent : loadedEvent) ?? undefined;
  const hostedEvent = event?.organizerId === store.me;
  const [inviteLoaded, setInviteLoaded] = useState(false);
  const [loadError, setLoadError] = useState<"invalid" | "unavailable" | null>(null);
  const [replying, setReplying] = useState(false);
  // Alla som är med ser varandras namn och intressen. Databasen avgör vem som
  // får läsa listan – anropet nekas tyst för den som inte svarat än.
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const loadPrivateEventGuests = store.loadPrivateEventGuests;
  // Inloggade matchas på sitt konto, utloggade på det enda svar som finns i
  // den här webbläsaren (sparat via response-token). Svaret uppdateras direkt
  // i storen efter att gästen tryckt Ja/Nej/Kanske.
  const displayInvite = hostedEvent
    ? undefined
    : store.account
      ? event?.invites?.find((invite) => invite.userId === store.account?.id)
      : event?.invites?.[0];
  const responseToken = getGuestResponseToken(code);
  const guestKey = responseToken;
  const loadPrivateEventInvite = store.loadPrivateEventInvite;

  useEffect(() => {
    let active = true;
    setInviteLoaded(false);
    setLoadError(null);
    void loadPrivateEventInvite(code, responseToken)
      .then((loaded) => {
        if (!active) return;
        if (loaded) setLoadedEvent(loaded);
        else setLoadError("invalid");
      })
      .catch((error) => {
        // Nätverksfel/migration som saknas ska inte se ut som en utgången länk.
        console.error("Could not load private event invite", error);
        if (active) setLoadError("unavailable");
      })
      .finally(() => {
        if (active) setInviteLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [code, responseToken, loadPrivateEventInvite]);

  useEffect(() => {
    let active = true;
    const token = getGuestResponseToken(code);
    void loadPrivateEventGuests(code, token)
      .then((list) => {
        if (active) setGuests(list);
      })
      .catch(() => {
        // Inte medlem än (eller utloggad utan svar) – listan är då stängd.
        if (active) setGuests([]);
      });
    return () => {
      active = false;
    };
  }, [code, loadPrivateEventGuests, store.me, store.account?.id]);

  // Inbjudarens namn: sparad på eventet (organizerName) – annars hämtas
  // profilen via RLS-publicerad profiles-tabell. Hook anropas före tidig
  // return så hook-ordningen är stabil.
  const profileName = useProfileName(event?.organizerId, event?.organizerName);
  const isSelf = event ? event.organizerId === store.me : false;

  if (!event) {
    return (
      <AppShell title="Inbjudan">
        <div className="p-8 text-center">
          {!inviteLoaded ? (
            <p className="text-sm text-muted-foreground">Hämtar inbjudan…</p>
          ) : (
            <>
              <p className="text-sm font-bold text-[#2A2421]">
                {loadError === "unavailable"
                  ? "Inbjudan kunde inte hämtas just nu."
                  : "Inbjudningslänken är ogiltig eller har gått ut."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {loadError === "unavailable"
                  ? "Kontrollera anslutningen och försök igen om en stund."
                  : "Be den som bjöd in dig om en ny länk – varje inbjudan har en egen kod."}
              </p>
              <Link to="/" className="mt-4 inline-block text-sm font-bold text-primary">
                Till Upptäck
              </Link>
            </>
          )}
        </div>
      </AppShell>
    );
  }

  // Aldrig "Okänd" för en riktig användare: organizerName → profiluppslag →
  // inloggat eget konto. "me"/legacy utan namn får en neutral etikett.
  const hostName =
    event.organizerName?.trim() ||
    profileName ||
    (isSelf ? (store.account?.name ?? "Du") : undefined);
  const host: User = userById(event.organizerId, hostName);
  const hostLabel = hostName ?? (isSelf ? "Du" : "Arrangör");

  const myStatus = displayInvite?.status;
  const participantCount = Math.max(event.guestCount ?? 0, guests.length);
  const full = participantCount >= MAX_EVENT_GUESTS;

  /** Hämtar inbjudan + gästlistan igen efter ett svar. */
  const refreshInvite = async () => {
    const token = getGuestResponseToken(code);
    try {
      await store.loadPrivateEventInvite(code, token);
    } catch (error) {
      console.error("Could not refresh invite", error);
    }
    try {
      setGuests(await loadPrivateEventGuests(code, token));
    } catch {
      setGuests([]);
    }
  };

  return (
    <AppShell title="Du är inbjuden">
      <div className="space-y-5 p-4">
        <EventCover event={event} className="h-40 rounded-3xl" big />
        <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <Lock className="h-3 w-3 text-[#E45048]" /> Privat event · {event.inviteCode}
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-[#2A2421]">{event.name}</h2>
          <p className="mt-1 text-sm text-[#8C7A6B]">
            {formatDay(event.date)} · {event.start}–{event.end}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-[#E45048]">
            <MapPin className="h-3.5 w-3.5" /> {event.place || "Plats ej angiven"}
          </p>
          {event.description && (
            <p className="mt-2 border-t border-border/60 pt-2 text-sm text-[#2A2421]">
              {event.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
          <Avatar user={host} size={40} />
          <div>
            <p className="text-sm font-bold text-[#2A2421]">{hostLabel}</p>
            <p className="text-xs text-muted-foreground">
              {isSelf ? "Du bjöd in dig" : "bjöd in dig"}
            </p>
          </div>
        </div>

        {!hostedEvent && (
          <InviteReply
            disabled={replying}
            loggedIn={Boolean(store.account)}
            accountName={store.account?.name}
            answered={myStatus}
            savedName={displayInvite?.name}
            savedInterests={displayInvite?.interests}
            full={full}
            onReply={(s, name, interests) => {
              setReplying(true);
              void store
                .replyToPrivateEvent(event.id, code, guestKey, name, interests, s)
                .then(async () => {
                  toast.success(
                    s === "accepted"
                      ? "Du kommer!"
                      : s === "maybe"
                        ? "Svarat kanske"
                        : "Du tackade nej",
                  );
                  await refreshInvite();
                })
                .catch((error) => {
                  console.error("Could not save invite reply", error);
                  toast.error(limitMessage(error) ?? "Svaret kunde inte sparas. Försök igen.");
                })
                .finally(() => setReplying(false));
            }}
          />
        )}

        {event.visibility === "private" && guests.length > 0 && (
          <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-[#2A2421]">
              <Users className="h-4 w-4 text-[#E45048]" /> Vilka är med ({participantCount} av{" "}
              {MAX_EVENT_GUESTS})
            </p>
            <div className="space-y-2">
              {guests.map((guest) => (
                <div key={guest.userId} className="rounded-xl bg-secondary/50 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base" aria-hidden>
                      🧑
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#2A2421]">
                      {guest.name ?? "Gäst"}
                      {guest.isMe ? " (du)" : ""}
                    </p>
                    <span
                      className="shrink-0 text-[11px] font-bold"
                      style={{ color: guest.status === "accepted" ? "#3E9B5F" : "#D9A13B" }}
                    >
                      {guest.status === "accepted" ? "Kommer" : "Kanske"}
                    </span>
                  </div>
                  {guest.interests && guest.interests.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {guest.interests.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 rounded-full bg-[#F7E5D5] px-2 py-0.5 text-[10px] font-bold text-[#8A4A1F]"
                        >
                          <Sparkles className="h-2.5 w-2.5" aria-hidden /> {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {full && (
              <p className="text-xs font-bold text-[#B03A36]">
                Eventet är fullt – max {MAX_EVENT_GUESTS} deltagare.
              </p>
            )}
          </section>
        )}

        {!store.account && !hostedEvent && (
          <p className="text-center text-xs text-muted-foreground">
            Har du ett konto?{" "}
            <Link
              to="/loggain"
              search={{ redirect: `/join/${code}` }}
              className="font-bold text-primary"
            >
              Logga in
            </Link>{" "}
            så svarar ditt namn automatiskt.
          </p>
        )}

        {hostedEvent && (
          <Link
            to="/privat/$id"
            params={{ id: event.id }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#E57657] px-4 py-3.5 text-center text-sm font-bold text-[#FFFDF9] shadow-[0_3px_0_rgba(112,28,23,.25)] active:translate-y-[2px]"
          >
            <Users className="h-4 w-4" /> Se gästlistan
          </Link>
        )}
      </div>
    </AppShell>
  );
}

function getGuestResponseToken(code: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(`hander-invite-response-${code.toUpperCase()}`);
  } catch {
    return null;
  }
}
