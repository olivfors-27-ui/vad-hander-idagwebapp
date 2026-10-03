import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Check, Lock, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/hander/AppShell";
import { Avatar, EventCover } from "@/components/hander/EventBits";
import { userById, type InviteStatus } from "@/lib/hander-data";
import { formatDay, useHander } from "@/lib/hander-store";
import { cn } from "@/lib/utils";

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

  const host = userById(event.organizerId);
  const invites = event.invites ?? [];
  const myStatus = invites.find((i) => i.userId === store.me)?.status;
  const going = invites.filter((i) => i.status === "accepted");

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
            <p className="text-sm font-bold text-[#2A2421]">{host.name}</p>
            <p className="text-xs text-muted-foreground">bjöd in dig</p>
          </div>
        </div>

        {going.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {going.map((g) => userById(g.userId).name.split(" ")[0]).join(", ")} kommer redan.
          </p>
        )}

        {store.account ? (
          <div className="flex gap-2">
            {([
              ["accepted", "Kommer", "#3E9B5F", "rgba(62,155,95,.35)", "#EAF6EE"],
              ["maybe", "Kanske", "#D9A13B", "rgba(217,161,59,.4)", "#FBF3E2"],
              ["declined", "Kan inte", "#D9534F", "rgba(217,83,79,.35)", "#FBECEB"],
            ] as const).map(([s, lbl, tone, shadow, soft]) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  store.setInviteStatus(event.id, store.me, s);
                toast.success(
                  s === "accepted" ? "Du kommer!" : s === "maybe" ? "Svarat kanske" : "Du tackade nej",
                );
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-2xl px-3 py-3 text-xs font-bold transition-colors active:translate-y-[2px]",
                myStatus === s
                  ? "text-[#FFFDF9] shadow-[0_3px_0_var(--tw-shadow-color)]"
                  : "border border-border",
              )}
              style={
                myStatus === s
                  ? { backgroundColor: tone, "--tw-shadow-color": shadow } as React.CSSProperties
                  : { backgroundColor: soft, color: tone }
              }
            >
              {myStatus === s && <Check className="h-3.5 w-3.5" />}
              {lbl}
            </button>
            ))}
          </div>
        ) : (
          <Link
            to="/loggain"
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#627BD8] px-4 py-3.5 text-center text-sm font-bold text-[#FFFDF9] shadow-[0_3px_0_rgba(68,88,197,.3)] active:translate-y-[2px]"
          >
            Logga in för att svara
          </Link>
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
