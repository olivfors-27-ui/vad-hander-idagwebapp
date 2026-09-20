import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { AppShell } from "@/components/hander/AppShell";
import { MaybeEventLink } from "@/components/hander/EventBits";
import { useHander, type NotifSettings } from "@/lib/hander-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notiser")({
  head: () => ({
    meta: [
      { title: "Notiser – Händer" },
      { name: "description", content: "Påminnelser om event nära dig och vad dina vänner gör." },
      { property: "og:title", content: "Notiser – Händer" },
      { property: "og:description", content: "Missa inget som händer runt hörnet." },
    ],
  }),
  component: NotificationsPage,
});

const SETTINGS: { id: keyof NotifSettings; label: string; sub: string }[] = [
  { id: "nearby", label: "Nära dig", sub: "Nya event inom 1 km" },
  { id: "follow", label: "Personer du följer", sub: "När någon skapar event" },
  { id: "reminder", label: "Påminnelser", sub: "1 timme innan start" },
  { id: "social", label: "Socialt", sub: "När vänner är intresserade" },
  { id: "plan", label: "Planer", sub: "Nya planer och svar på dina planer" },
];

/** Emoji per notistyp, visas i röd cirkel till vänster. */
const KIND_EMOJI: Record<string, string> = {
  plan: "💬",
  reminder: "⏰",
  nearby: "📍",
  follow: "👥",
  social: "🎉",
  system: "ℹ️",
};

function NotificationsPage() {
  const store = useHander();

  // Endast notiser som handlar om saker användaren visat intresse för,
  // sparat, planer man är med i, eller personer/event man följer.
  const interestedNames = useMemo(() => {
    const all = [...store.publicEvents, ...store.myPrivateEvents];
    return new Set(
      [...store.saved, ...store.interested]
        .map((id) => all.find((e) => e.id === id)?.name.toLowerCase())
        .filter(Boolean) as string[],
    );
  }, [store.publicEvents, store.myPrivateEvents, store.saved, store.interested]);

  const visible = store.notifications.filter((n) => {
    if (n.kind === "system") return true;
    if (!store.notifSettings[n.kind as keyof NotifSettings]) return false;
    // Planer och påminnelser om sparade event är alltid relevanta.
    if (n.kind === "plan" || (n.kind === "reminder" && n.eventId)) return true;
    // Övriga: bara om de gäller ett event användaren sparat/är intresserad av
    // eller har en direkt eventlänk (riktigt event i appen).
    if (n.eventId) {
      const ev = [...store.publicEvents, ...store.myPrivateEvents].find((e) => e.id === n.eventId);
      if (ev) return store.saved.includes(ev.id) || store.interested.includes(ev.id) || interestedNames.size > 0;
    }
    return interestedNames.size > 0 || n.kind === "follow";
  });

  useEffect(() => {
    store.markNotificationsRead(store.notifications.map((n) => n.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell title="Notiser & Mer" subtitle={`${visible.length} senaste notiser`}>
      <div className="space-y-6 p-4">
        <section className="space-y-2">
          {visible.map((n) => (
            <MaybeEventLink
              key={n.id}
              eventId={n.eventId}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)]"
            >
              {/* Emoji i röd cirkel till vänster, i stället för prick. */}
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E45048] text-sm">
                {KIND_EMOJI[n.kind] ?? "🔔"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{n.text}</p>
                <p className="text-[11px] text-muted-foreground">{n.time}</p>
              </div>
              {n.eventId && <span className="shrink-0 text-[11px] font-bold text-[#E45048]">Visa →</span>}
            </MaybeEventLink>
          ))}
          {visible.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Inga notiser med dina inställningar.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-bold">Inställningar</h2>
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
            {SETTINGS.map((s) => {
              const on = store.notifSettings[s.id];
              return (
                <div key={s.id} className="flex items-center gap-3 p-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.sub}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={s.label}
                    onClick={() => store.setNotifSettings({ [s.id]: !on })}
                    className={cn(
                      "relative h-6 w-11 shrink-0 rounded-full transition-colors before:absolute before:-inset-x-2 before:-inset-y-3 before:content-['']",
                      on ? "bg-[#E45048]" : "bg-border",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all",
                        on ? "left-[22px]" : "left-0.5",
                      )}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
