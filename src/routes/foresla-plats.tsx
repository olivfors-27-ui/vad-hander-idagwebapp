import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AddressSearch } from "@/components/hander/AddressSearch";
import { AppShell } from "@/components/hander/AppShell";
import { distanceFromHome, type GeoHit } from "@/lib/geocode";
import { DISCOVERY_TYPES, ME, PLACE_TYPES, type PlaceType } from "@/lib/hander-data";
import { useHander } from "@/lib/hander-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/foresla-plats")({
  head: () => ({
    meta: [
      { title: "Föreslå en plats – Händer" },
      {
        name: "description",
        content:
          "Tipsa om karaoke, klättring, escape rooms eller en gömd pärla. Förslaget granskas innan det syns på kartan.",
      },
      { property: "og:title", content: "Föreslå en plats – Händer" },
      {
        property: "og:description",
        content: "Tipsa om en aktivitet som saknas på Händers karta.",
      },
    ],
  }),
  component: SuggestPlacePage,
});

const field =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const label = "text-xs font-bold uppercase tracking-wide text-muted-foreground";

function SuggestPlacePage() {
  const store = useHander();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [type, setType] = useState<PlaceType>("gomd");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<GeoHit | null>(null);
  const [open, setOpen] = useState("");
  const [price, setPrice] = useState("");
  const [contact, setContact] = useState("");

  const submit = () => {
    if (!name.trim()) {
      toast.error("Fyll i namn på platsen.");
      return;
    }
    if (!location) {
      toast.error("Sök upp och välj en riktig adress – annars kan platsen inte få en nål.");
      return;
    }
    store.addPlaceSuggestion({
      id: `pls-${Date.now().toString(36)}`,
      name: name.trim(),
      type,
      description: description.trim() || "Tipsad av en användare.",
      address: location.short,
      lat: location.lat,
      lng: location.lng,
      distance: distanceFromHome(location),
      open: open.trim() || "Okänt",
      price: price.trim() || undefined,
      contact: contact.trim() || undefined,
      suggestedBy: ME,
      status: "pending",
    });
    toast.success("Tack! Ditt förslag granskas av en moderator.");
    void navigate({ to: "/karta" });
  };

  return (
    <AppShell title="Föreslå en plats" subtitle="Något som saknas på kartan?">
      <div className="space-y-5 p-4 pb-28">
        <div className="flex gap-3 rounded-2xl border border-border bg-secondary/60 p-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
          <p className="text-xs leading-snug text-muted-foreground">
            Offentliga pins läggs främst upp av arrangörer, företag och organisationer. Ditt förslag
            publiceras inte direkt – en moderator granskar och godkänner det först.
          </p>
        </div>

        <div className="space-y-1.5">
          <p className={label}>Namn</p>
          <input
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="T.ex. Flipperklubben Källaren"
          />
        </div>

        <div className="space-y-1.5">
          <p className={label}>Typ av upptäckt</p>
          <div className="flex flex-wrap gap-2">
            {DISCOVERY_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "rounded-full min-h-9 px-3.5 py-2 text-xs font-semibold",
                  type === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground",
                )}
              >
                {PLACE_TYPES[t].emoji} {PLACE_TYPES[t].label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className={label}>Adress</p>
          <AddressSearch
            value={location}
            onSelect={setLocation}
            onClear={() => setLocation(null)}
          />
          <p className="text-[11px] text-muted-foreground">
            Nålen placeras exakt på adressens koordinater efter godkännande.
          </p>
        </div>

        <div className="space-y-1.5">
          <p className={label}>Beskrivning</p>
          <textarea
            className={cn(field, "min-h-24 resize-y")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Varför är det här värt att upptäcka?"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <p className={label}>Öppettider</p>
            <input
              className={field}
              value={open}
              onChange={(e) => setOpen(e.target.value)}
              placeholder="16–01"
            />
          </div>
          <div className="space-y-1.5">
            <p className={label}>Pris</p>
            <input
              className={field}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="150 kr/person"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <p className={label}>Kontakt eller länk</p>
          <input
            className={field}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="webbplats, mejl eller telefon"
          />
        </div>

        <button
          type="button"
          onClick={submit}
          className="w-full rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground"
        >
          Skicka in för granskning
        </button>
      </div>
    </AppShell>
  );
}
