import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Copy, Lock } from "lucide-react";

import { useEffect } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/hander/AppShell";
import { Avatar, EventCover } from "@/components/hander/EventBits";
import { userById, type InviteStatus } from "@/lib/hander-data";
import { formatDay, useHander } from "@/lib/hander-store";
import { appUrl } from "@/lib/app-url";

export const Route = createFileRoute("/privat/$id")({
  head: () => ({
    meta: [
      { title: "Privat event – Händer" },
      {
        name: "description",
        content: "Hantera gästlista och inbjudningslänk för ditt privata event.",
      },
      { property: "og:title", content: "Privat event – Händer" },
      { property: "og:description", content: "Bjud in vänner med en länk." },
    ],
  }),
  component: PrivateEventPage,
});

const GROUPS: { id: InviteStatus; label: string }[] = [
  { id: "accepted", label: "Kommer" },
  { id: "maybe", label: "Kanske" },
  { id: "invited", label: "Inbjudna" },
  { id: "declined", label: "Kan inte" },
];

function PrivateEventPage() {
  const { id } = useParams({ from: "/privat/$id" });
  const store = useHander();
  const event = store.events.find((e) => e.id === id);
  const loadPrivateEventInvites = store.loadPrivateEventInvites;

  useEffect(() => {
    if (!event?.inviteCode) return;
    const code = event.inviteCode;
    const refresh = () => {
      void loadPrivateEventInvites(code).catch((error) => {
        console.error("Could not refresh private event replies", error);
      });
    };
    refresh();
    // Gästerna svarar ofta medan värden har fliken öppen – hämta om listan
    // när fliken får fokus igen så att nya svar syns utan omladdning.
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [event?.inviteCode, loadPrivateEventInvites]);

  if (!event) {
    return (
      <AppShell title="Privat event">
        <p className="p-8 text-center text-sm text-muted-foreground">Eventet hittades inte.</p>
      </AppShell>
    );
  }

  const invites = event.invites ?? [];
  const link = appUrl(`/join/${event.inviteCode}`);
  const isHost = event.organizerId === store.me;
  if (!isHost) {
    return (
      <AppShell title="Privat event">
        <p className="p-8 text-center text-sm text-muted-foreground">
          Endast arrangören kan visa gästlistan.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title={event.name} subtitle="Privat event – syns inte på kartan">
      <div className="space-y-5 p-4">
        <EventCover event={event} className="h-36 rounded-3xl" big />

        <div
          className="rounded-2xl p-4"
          style={{ background: "color-mix(in srgb, #E57657 9%, transparent)" }}
        >
          <p className="flex items-center gap-2 font-display text-sm font-bold text-[#2A2421]">
            <Lock className="h-4 w-4 text-[#E45048]" /> {formatDay(event.date)} · {event.start}–
            {event.end}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {event.place} · {event.address}
          </p>
          <p className="mt-2 text-sm text-[#2A2421]">{event.description}</p>
        </div>

        <div className="rounded-2xl border border-border bg-[#F7E5D5]/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Inbjudningslänk
          </p>
          <p className="mt-1 break-all font-mono text-sm font-bold text-[#2A2421]">{link}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(link);
                toast.success("Inbjudningslänk kopierad");
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#E45048] px-4 py-2.5 text-xs font-bold text-[#FFFDF9] shadow-[0_3px_0_rgba(112,28,23,.25)] active:translate-y-[2px]"
            >
              <Copy className="h-3.5 w-3.5" /> Kopiera inbjudningslänk
            </button>
            <Link
              to="/join/$code"
              params={{ code: event.inviteCode ?? "" }}
              className="rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-[#2A2421]"
            >
              Förhandsvisa
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          {GROUPS.map((g) => (
            <div key={g.id} className="rounded-xl border border-border bg-card p-2">
              <p className="font-display text-lg font-bold text-[#E45048]">
                {invites.filter((i) => i.status === g.id).length}
              </p>
              <p className="text-[10px] uppercase text-muted-foreground">{g.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {GROUPS.map((g) => {
            const list = invites.filter((i) => i.status === g.id);
            if (!list.length) return null;
            return (
              <section key={g.id} className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {g.label} ({list.length})
                </p>
                {list.map((i) => {
                  const u = userById(i.userId, i.name);
                  return (
                    <div
                      key={i.userId}
                      className="flex items-center gap-3 rounded-2xl border border-border p-3"
                    >
                      <Avatar user={u} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{i.name ?? u.name}</p>
                        {u.username !== "@okand" && (
                          <p className="truncate text-xs text-muted-foreground">{u.username}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
          {invites.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ingen inbjuden än – dela länken eller lägg till vänner nedan.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
