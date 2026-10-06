import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Lock, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/hander/AppShell";
import { Avatar, EventCover } from "@/components/hander/EventBits";
import { InviteReply } from "@/components/hander/InviteReply";
import { useProfileName } from "@/lib/auth";
import { ME, userById, type User } from "@/lib/hander-data";
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
  const event = store.events.find((e) => e.inviteCode?.toUpperCase() === code.toUpperCase());

  // Inbjudarens namn: sparad på eventet (organizerName) – annars hämtas
  // profilen via RLS-publicerad profiles-tabell. Hook anropas före tidig
  // return så hook-ordningen är stabil.
  const profileName = useProfileName(event?.organizerId, event?.organizerName);
  const isSelf = event ? event.organizerId === store.me : false;

  if (!event) {
    return (
      <AppShell title="Inbjudan">
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Inbjudningslänken är ogiltig eller utgången.</p>
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
    event.organizerName ??
    profileName ??
    (isSelf ? store.account?.name ?? "Du" : undefined);
  const host: User = userById(event.organizerId, hostName);
  const hostLabel = hostName ?? (isSelf ? "Du" : "Arrangör");

  const invites = event.invites ?? [];
  const myInvite = invites.find((i) => i.userId === store.me);
  const myStatus = myInvite?.status;
  const going = invites.filter((i) => i.status === "accepted");
  const goingNames = going
    .map((g) => g.name?.trim().split(" ")[0])
    .filter((n): n is string => Boolean(n));

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
            <p className="text-xs text-muted-foreground">{isSelf ? "Du bjöd in dig" : "bjöd in dig"}</p>
          </div>
        </div>

        {goingNames.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {goingNames.join(", ")} kommer redan.
          </p>
        )}

        <InviteReply
          loggedIn={Boolean(store.account)}
          accountName={store.account?.name}
          answered={myStatus}
          savedName={myInvite?.name}
          onReply={(s, name) => {
            const ok = s;
            store.setInviteStatus(event.id, store.me, ok, name);
            toast.success(
              ok === "accepted" ? "Du kommer!" : ok === "maybe" ? "Svarat kanske" : "Du tackade nej",
            );
          }}
        />

        {!store.account && (
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

        <Link
          to="/privat/$id"
          params={{ id: event.id }}
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#E57657] px-4 py-3.5 text-center text-sm font-bold text-[#FFFDF9] shadow-[0_3px_0_rgba(112,28,23,.25)] active:translate-y-[2px]"
        >
          <Users className="h-4 w-4" /> Se gästlistan
        </Link>
      </div>
    </AppShell>
  );
}
