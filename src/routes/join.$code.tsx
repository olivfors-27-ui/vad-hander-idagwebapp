import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/hander/AppShell";
import { Avatar, EventCover } from "@/components/hander/EventBits";
import { InviteReply } from "@/components/hander/InviteReply";
import { useProfileName } from "@/lib/auth";
import { ME, userById, type EventItem, type User } from "@/lib/hander-data";
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
  const [replying, setReplying] = useState(false);
  const displayInvite = hostedEvent
    ? undefined
    : (event?.invites?.find((invite) => invite.userId === store.account?.id) ??
      (store.account ? undefined : inviteLoaded ? loadedEvent?.invites?.[0] : undefined));
  const responseToken = getGuestResponseToken(code);
  const guestKey = responseToken;

  useEffect(() => {
    let active = true;
    setInviteLoaded(false);
    void store
      .loadPrivateEventInvite(code, responseToken)
      .then((loaded) => {
        if (active && loaded) setLoadedEvent(loaded);
      })
      .catch((error) => console.error("Could not load private event invite", error))
      .finally(() => {
        if (active) setInviteLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [code, responseToken, store.loadPrivateEventInvite]);

  // Inbjudarens namn: sparad på eventet (organizerName) – annars hämtas
  // profilen via RLS-publicerad profiles-tabell. Hook anropas före tidig
  // return så hook-ordningen är stabil.
  const profileName = useProfileName(event?.organizerId, event?.organizerName);
  const isSelf = event ? event.organizerId === store.me : false;

  if (!event) {
    return (
      <AppShell title="Inbjudan">
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {inviteLoaded ? "Inbjudningslänken är ogiltig eller utgången." : "Hämtar inbjudan…"}
          </p>
          <Link to="/" className="mt-4 inline-block text-sm font-bold text-primary">
            Till Upptäck
          </Link>
        </div>
      </AppShell>
    );
  }

  // Aldrig "Okänd" för en riktig användare: organizerName → profiluppslag →
  // inloggat eget konto. "me"/legacy utan namn får en neutral etikett.
  const hostName =
    event.organizerName ?? profileName ?? (isSelf ? (store.account?.name ?? "Du") : undefined);
  const host: User = userById(event.organizerId, hostName);
  const hostLabel = hostName ?? (isSelf ? "Du" : "Arrangör");

  const invites = event.invites ?? [];
  const myStatus = displayInvite?.status;

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
            onReply={(s, name) => {
              setReplying(true);
              void store
                .replyToPrivateEvent(event.id, code, guestKey, name, s)
                .then(() => {
                  toast.success(
                    s === "accepted"
                      ? "Du kommer!"
                      : s === "maybe"
                        ? "Svarat kanske"
                        : "Du tackade nej",
                  );
                })
                .catch((error) => {
                  console.error("Could not save invite reply", error);
                  toast.error("Svaret kunde inte sparas. Försök igen.");
                })
                .finally(() => setReplying(false));
            }}
          />
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
