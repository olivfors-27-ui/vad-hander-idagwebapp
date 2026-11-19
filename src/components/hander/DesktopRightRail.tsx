import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { EventCover, SponsoredBadge, priceLabel } from "@/components/hander/EventBits";
import { formatDay, useHander } from "@/lib/hander-store";
import type { EventItem } from "@/lib/hander-data";

const INFO = {
  om: {
    title: "Om Händer",
    body: [
      "Händer samlar events, fester och platser i Stockholm på en karta.",
      "Publika event granskas av moderatorer innan de visas. Privata event delas med en inbjudningslänk och kräver inget konto för att svara.",
    ],
  },
  hjalp: {
    title: "Hjälp",
    body: [
      "Skapa ett event med + i menyn. Du behöver vara inloggad och kan skapa högst fem event per dag.",
      "Dela en inbjudan via eventets delningsknapp. Mottagaren anger sitt namn och svarar ja, nej eller kanske.",
    ],
  },
  integritet: {
    title: "Integritet",
    body: [
      "Konto, event och gästsvar sparas i Supabase. Platsen används bara för att visa avstånd och kartposition.",
      "Unika besökare räknas en gång per person och event. Uppskattade siffror visas aldrig som faktiska.",
    ],
  },
  villkor: {
    title: "Villkor",
    body: [
      "Lägg bara upp event du har rätt att arrangera. Moderatorer kan avvisa event som bryter mot riktlinjerna.",
      "Sponsrade placeringar är märkta och kräver att eventet först godkänts.",
    ],
  },
} as const;

type InfoKey = keyof typeof INFO;

export function DesktopRightRail() {
  const store = useHander();
  const [info, setInfo] = useState<InfoKey | null>(null);

  useEffect(() => {
    if (!info) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInfo(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [info]);

  const suggested = store.publicEvents
    .filter((event) => event.status === "approved" && !event.sponsored && !event.promoted)
    .slice(0, 5);
  const sponsored = store.sponsoredEvents.slice(0, 2);

  return (
    <aside className="hander-desktop-rail" aria-label="Översikt">
      <section className="hander-rail-card flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-2xl">
          {store.account?.avatarEmoji ?? "🙂"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">
            {store.account?.name ?? "Inte inloggad"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {store.account ? `@${store.account.username}` : "Logga in för att skapa event"}
          </p>
        </div>
        {!store.account && (
          <Link to="/loggain" className="text-xs font-bold text-primary">
            Logga in
          </Link>
        )}
      </section>

      <section className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold">Förslag åt dig</h2>
          <Link to="/sok" className="text-xs font-bold text-muted-foreground hover:text-primary">
            Se alla
          </Link>
        </div>
        <div className="mt-2 space-y-1">
          {suggested.map((event) => (
            <SuggestedRow key={event.id} event={event} />
          ))}
          {suggested.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
              Inga godkända event ännu. Så snart ett event är granskat dyker det upp här.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-extrabold">Sponsrat</h2>
        <div className="mt-2 space-y-2">
          {sponsored.map((event) => (
            <Link
              key={event.id}
              to="/event/$id"
              params={{ id: event.id }}
              className="block overflow-hidden rounded-2xl border border-primary/30 bg-card"
            >
              <EventCover event={event} className="h-24" />
              <div className="space-y-1 p-3">
                <SponsoredBadge />
                <p className="line-clamp-2 text-sm font-bold leading-tight">{event.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDay(event.date)} · {event.place}
                </p>
                <p className="text-[11px] font-bold text-primary">
                  {priceLabel(event.price, event.priceKnown)}
                </p>
              </div>
            </Link>
          ))}
          {sponsored.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
              Inga sponsrade event just nu. Sponsring kräver ett godkänt event.
            </p>
          )}
        </div>
      </section>

      <footer className="mt-7 space-y-2 text-[11px] text-muted-foreground">
        <nav aria-label="Information" className="flex flex-wrap gap-x-2 gap-y-1">
          {(
            [
              ["om", "Om"],
              ["hjalp", "Hjälp"],
              ["integritet", "Integritet"],
              ["villkor", "Villkor"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setInfo(key)}
              className="hover:text-primary"
            >
              {label}
            </button>
          ))}
        </nav>
        <p>© {new Date().getFullYear()} Händer · Stockholm</p>
      </footer>

      {info && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal>
          <button
            type="button"
            aria-label="Stäng"
            className="sheet-backdrop absolute inset-0"
            onClick={() => setInfo(null)}
          />
          <div className="sheet-panel relative w-full max-w-md rounded-3xl p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-lg font-extrabold">{INFO[info].title}</h2>
              <button
                type="button"
                onClick={() => setInfo(null)}
                aria-label="Stäng"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 space-y-2 text-sm text-foreground/90">
              {INFO[info].body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function SuggestedRow({ event }: { event: EventItem }) {
  return (
    <Link
      to="/event/$id"
      params={{ id: event.id }}
      className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-secondary/60"
    >
      <EventCover event={event} className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{event.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {formatDay(event.date)} · {event.place}
        </p>
      </div>
      <span className="shrink-0 text-[11px] font-bold text-primary">Visa</span>
    </Link>
  );
}
