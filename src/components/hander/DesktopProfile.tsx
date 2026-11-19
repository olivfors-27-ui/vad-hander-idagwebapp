import { Link } from "@tanstack/react-router";
import { Bookmark, CalendarDays, Heart, Mail, PencilLine, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { EventCover } from "@/components/hander/EventBits";
import { ME, userById, type EventItem } from "@/lib/hander-data";
import { formatDay, hasEnded, useHander } from "@/lib/hander-store";
import { cn } from "@/lib/utils";

type Tab = "mina" | "sparat" | "kommande" | "inbjudna";

const TABS: { id: Tab; label: string; icon: typeof CalendarDays }[] = [
  { id: "mina", label: "Mina event", icon: CalendarDays },
  { id: "sparat", label: "Sparat", icon: Bookmark },
  { id: "kommande", label: "Kommande", icon: Heart },
  { id: "inbjudna", label: "Inbjudna", icon: Mail },
];

export function DesktopProfile() {
  const store = useHander();
  const [tab, setTab] = useState<Tab>("mina");
  const [archive, setArchive] = useState(false);

  const meId = store.me;
  const mine = store.myEvents.filter(
    (event) => event.organizerId === meId || event.organizerId === ME,
  );
  const saved = store.events.filter((event) => store.saved.includes(event.id));
  const upcoming = store.events.filter(
    (event) =>
      !hasEnded(event) && (store.interested.includes(event.id) || event.interested.includes(meId)),
  );
  const invited = store.plans
    .map((plan) => (plan.eventId ? store.events.find((event) => event.id === plan.eventId) : undefined))
    .filter((event): event is EventItem => Boolean(event));

  const lists: Record<Tab, EventItem[]> = { mina: mine, sparat: saved, kommande: upcoming, inbjudna: invited };
  const list = lists[tab].filter((event) => archive || !hasEnded(event));
  const me = userById(ME);

  if (!store.authChecked) {
    return (
      <div className="hander-profile" aria-busy>
        <div className="hander-profile-head">
          <span className="h-28 w-28 animate-pulse rounded-full bg-secondary" />
          <div className="flex-1 space-y-3">
            <span className="block h-5 w-48 animate-pulse rounded-full bg-secondary" />
            <span className="block h-3 w-32 animate-pulse rounded-full bg-secondary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hander-profile">
      <header className="hander-profile-head">
        <span className="hander-profile-avatar" aria-hidden>
          {store.account?.avatarEmoji ?? me.avatar}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-extrabold tracking-tight">
              {store.account?.name ?? "Din profil"}
            </h1>
            {store.account?.isModerator && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#DDE3F8] px-2 py-0.5 text-[10px] font-bold uppercase text-[#3B4CAD]">
                <ShieldCheck className="h-3 w-3" /> Moderator
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {store.account ? `@${store.account.username}` : "Logga in för att spara och skapa event"}
          </p>

          <dl className="mt-3 flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-1.5">
              <dt className="text-muted-foreground">Event</dt>
              <dd className="font-extrabold">{mine.length}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-muted-foreground">Sparat</dt>
              <dd className="font-extrabold">{store.saved.length}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-muted-foreground">Följer</dt>
              <dd className="font-extrabold">{store.following.length}</dd>
            </div>
          </dl>

          {store.account ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/installningar" className="hander-profile-button">
                <PencilLine className="h-4 w-4" /> Redigera profil
              </Link>
              <button
                type="button"
                onClick={() => setArchive((open) => !open)}
                aria-pressed={archive}
                className={cn("hander-profile-button", archive && "is-active")}
              >
                {archive ? "Dölj arkiv" : "Visa arkiv"}
              </button>
              {store.isModerator && (
                <Link to="/admin" className="hander-profile-button">
                  <ShieldCheck className="h-4 w-4" /> Granska
                </Link>
              )}
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/loggain" className="hander-profile-badge">
                Logga in
              </Link>
            </div>
          )}
        </div>
      </header>

      <div className="hander-profile-tabs" role="tablist" aria-label="Profilens innehåll">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn("hander-profile-tab", tab === id && "is-active")}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="hander-feed-state mt-4">
          <p className="text-sm font-bold">
            {tab === "mina" && "Du har inte skapat några event än"}
            {tab === "sparat" && "Inget sparat än"}
            {tab === "kommande" && "Inget kommande inbokat"}
            {tab === "inbjudna" && "Inga inbjudningar än"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {archive ? "Arkivet är tomt." : "Hitta något i flödet eller på kartan."}
          </p>
          <Link to="/" className="mt-3 inline-block text-sm font-bold text-primary">
            Till flödet →
          </Link>
        </div>
      ) : (
        <div className="hander-profile-grid">
          {list.map((event) => (
            <Link
              key={event.id}
              to={event.organizerId === meId ? "/event/$id/hantera" : "/event/$id"}
              params={{ id: event.id }}
              className="hander-profile-tile group"
              aria-label={`${event.name}, ${formatDay(event.date)}`}
            >
              <EventCover event={event} className="h-full w-full" />
              <span className="hander-profile-tile-overlay" aria-hidden>
                <span className="block truncate text-xs font-extrabold">{event.name}</span>
                <span className="mt-0.5 block text-[11px] opacity-90">
                  {formatDay(event.date)} · {event.start}
                </span>
              </span>
              {hasEnded(event) && (
                <span className="absolute left-2 top-2 rounded-full bg-foreground/80 px-2 py-0.5 text-[10px] font-bold text-background">
                  Avslutat
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
