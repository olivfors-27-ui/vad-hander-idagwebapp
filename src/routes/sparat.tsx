import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/hander/AppShell";
import { EventRow } from "@/components/hander/EventBits";
import { DISCOVERY_TYPES, PLACE_TYPES, type Place } from "@/lib/hander-data";
import { formatDay, hasEnded, useHander } from "@/lib/hander-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sparat")({
  head: () => ({
    meta: [
      { title: "Sparat – Händer" },
      {
        name: "description",
        content: "Dina sparade event, aktiviteter, upptäckter och favoritplatser.",
      },
      { property: "og:title", content: "Sparat – Händer" },
      { property: "og:description", content: "Allt du sparat på Händer, samlat." },
    ],
  }),
  component: SavedPage,
});

type Tab = "event" | "aktiviteter" | "platser";

const TAB_LABEL: Record<Tab, string> = {
  event: "Event",
  aktiviteter: "Aktiviteter",
  platser: "Platser",
};

function SavedPage() {
  const store = useHander();
  const [tab, setTab] = useState<Tab>("event");

  const savedEvents = store.events
    .filter((e) => store.saved.includes(e.id) && !hasEnded(e))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const pastEvents = store.events.filter((e) => store.saved.includes(e.id) && hasEnded(e));
  const saved = store.places.filter((p) => store.savedPlaces.includes(p.id));
  const savedActivities = saved.filter((p) => DISCOVERY_TYPES.includes(p.type));
  const savedPlaces = saved.filter((p) => !DISCOVERY_TYPES.includes(p.type));

  const counts: Record<Tab, number> = {
    event: savedEvents.length,
    aktiviteter: savedActivities.length,
    platser: savedPlaces.length,
  };

  return (
    <AppShell
      title="Sparat"
      subtitle={`${savedEvents.length} event · ${savedActivities.length} aktiviteter · ${savedPlaces.length} platser`}
    >
      <div className="relative space-y-6 pb-4 pt-5">
        <section className="section-zone section-zone--orange relative space-y-4 pb-4">
          <div className="px-4">
            <h2 className="section-pill section-pill--red relative inline-flex items-center gap-2 px-3.5 py-2 text-sm font-bold">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#E45048]" />
              <span>Dina sparade saker</span>
            </h2>
          </div>
          <div className="flex gap-2 px-4">
            {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 rounded-full px-2 py-2 text-xs font-bold transition-colors",
                  tab === t
                    ? "bg-[#E7A057] text-[#2A2421] shadow-[0_3px_0_rgba(139,86,42,.24)]"
                    : "bg-[#F7E5D5] text-[#70452A]",
                )}
              >
                {TAB_LABEL[t]} ({counts[t]})
              </button>
            ))}
          </div>
        </section>

        {tab === "event" && (
          <div className="space-y-4">
            {savedEvents.length ? (
              <section className="section-zone section-zone--red space-y-3 pb-3">
                <h2 className="section-pill section-pill--red relative mx-4 inline-flex items-center gap-2 px-3.5 py-2 text-sm font-bold">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#E45048]" />
                  Kommande
                </h2>
                {savedEvents.map((e) => (
                  <div key={e.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <EventRow event={e} />
                    </div>
                    <RemoveButton label="Ta bort event" onClick={() => store.toggleSaved(e.id)} />
                  </div>
                ))}
              </section>
            ) : (
              <Empty text="Du har inga sparade event än." tone="orange" />
            )}

            {pastEvents.length > 0 && (
              <section className="section-zone section-zone--coral space-y-3 pb-3">
                <h2 className="section-pill section-pill--coral relative mx-4 inline-flex items-center gap-2 px-3.5 py-2 text-sm font-bold">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#E57657]" />
                  Passerade
                </h2>
                {pastEvents.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 opacity-70"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{e.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDay(e.date)} · {e.place}
                      </p>
                    </div>
                    <RemoveButton label="Ta bort event" onClick={() => store.toggleSaved(e.id)} />
                  </div>
                ))}
              </section>
            )}
          </div>
        )}

        {tab === "aktiviteter" &&
          (savedActivities.length ? (
            <section className="section-zone section-zone--orange space-y-3 pb-3">
              <h2 className="section-pill section-pill--orange relative mx-4 inline-flex items-center gap-2 px-3.5 py-2 text-sm font-bold">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#E7A057]" />
                Aktiviteter
              </h2>
              <div className="space-y-2 px-4">
                {savedActivities.map((p) => (
                  <SavedPlaceRow key={p.id} place={p} tone="pink" />
                ))}
              </div>
            </section>
          ) : (
            <Empty text="Inga sparade aktiviteter eller upptäckter än." tone="pink" />
          ))}

        {tab === "platser" &&
          (savedPlaces.length ? (
            <section className="section-zone section-zone--yellow space-y-3 pb-3">
              <h2 className="section-pill section-pill--yellow relative mx-4 inline-flex items-center gap-2 px-3.5 py-2 text-sm font-bold">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#EAB24F]" />
                Platser
              </h2>
              <div className="space-y-2 px-4">
                {savedPlaces.map((p) => (
                  <SavedPlaceRow key={p.id} place={p} tone="blue" />
                ))}
              </div>
            </section>
          ) : (
            <Empty text="Inga sparade platser än." tone="blue" />
          ))}
      </div>
    </AppShell>
  );
}

function SavedPlaceRow({ place, tone = "pink" }: { place: Place; tone?: "pink" | "blue" }) {
  const store = useHander();
  const toneClasses = tone === "blue"
    ? "border-[#465BC4] shadow-[0_3px_0_rgba(39,51,140,.22),0_8px_16px_rgba(39,51,140,.10)]"
    : "border-[#E57657] shadow-[0_3px_0_rgba(166,44,64,.22),0_8px_16px_rgba(166,44,64,.10)]";
  // Raderna behåller palettfärgerna; endast sektionen följer bandets ordning.
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border-[3px] bg-white p-3", toneClasses)}>
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white", tone === "blue" ? "bg-[#465BC4]" : "bg-[#E57657]")}>
        <MapPin className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{place.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {PLACE_TYPES[place.type].label} · {place.distance} km · Öppet {place.open}
        </p>
        <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" /> {place.address}
        </p>
      </div>
      <RemoveButton label="Ta bort plats" onClick={() => store.toggleSavedPlace(place.id)} />
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="shrink-0 rounded-xl bg-[#F7E5D5] p-3 text-[#E45048]"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function Empty({ text, tone = "orange" }: { text: string; tone?: "orange" | "red" | "pink" | "blue" }) {
  const colors = {
    orange: "border-[#E7A057] text-[#8B562A]",
    red: "border-[#E45048] text-[#963D39]",
    pink: "border-[#E57657] text-[#9B4B45]",
    blue: "border-[#465BC4] text-[#3349A8]",
  } as const;
  return (
    <div className={cn("rounded-3xl border-2 border-dashed bg-white p-10 text-center", colors[tone])}>
      <p className="text-sm">{text}</p>
      <Link to="/karta" className="mt-3 inline-block text-sm font-bold text-[#E45048]">
        Utforska kartan →
      </Link>
    </div>
  );
}
