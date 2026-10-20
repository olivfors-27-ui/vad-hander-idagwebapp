import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Copy, Globe, ImagePlus, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/hander/AppShell";
import { AddressSearch } from "@/components/hander/AddressSearch";
import { distanceFromHome, type GeoHit } from "@/lib/geocode";
import {
  CATEGORIES,
  CATEGORY_GRADIENT,
  TODAY,
  type CategoryId,
  type EventItem,
} from "@/lib/hander-data";
import { useHander } from "@/lib/hander-store";
import { MAX_EVENTS_PER_ACCOUNT, limitMessage } from "@/lib/event-admin";
import { appUrl } from "@/lib/app-url";
import { SPONSORSHIP, sponsorshipPriceLabel } from "@/lib/sponsorship";
import { useRequireAccount } from "@/lib/auth-guard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/skapa")({
  head: () => ({
    meta: [
      { title: "Skapa event – Händer" },
      { name: "description", content: "Skapa ett publikt eller privat event på Händer." },
      { property: "og:title", content: "Skapa event – Händer" },
      { property: "og:description", content: "Publikt event granskas innan det syns på kartan." },
    ],
  }),
  component: CreatePage,
});

const code = () => crypto.randomUUID().replaceAll("-", "");

const field =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

/** Liten divider i palettfärg, mellan sektionerna på formuläret. */
function PaletteDivider({ color }: { color: string }) {
  return (
    <div
      aria-hidden
      className="h-[3px] w-full rounded-full"
      style={{ backgroundColor: color, opacity: 0.55 }}
    />
  );
}
const DIVIDER_COLORS = {
  coral: "#E57657",
  orange: "#E7A057",
  yellow: "#EAB24F",
  periwinkle: "#627BD8",
} as const;

function CreatePage() {
  const useHanderStore = useHander();
  const { me } = useHanderStore;
  // Antal event kontot redan skapat (privata + publika). Databasen har samma
  // gräns – här bara så att användaren får veta det innan hen fyller i allt.
  const createdEventCount = useHanderStore.createdEventCount;
  const atEventLimit = createdEventCount >= MAX_EVENTS_PER_ACCOUNT;
  // Skapa event kräver inloggat konto: omdirigerar till /loggain?redirect=…
  // om ingen session finns (datalagret avvisar dessutom skrivningar).
  const { loggedIn, checked } = useRequireAccount();
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CategoryId>("fest");
  const [date, setDate] = useState(TODAY);
  const [start, setStart] = useState("20:00");
  const [end, setEnd] = useState("23:00");
  const [place, setPlace] = useState("");
  const [location, setLocation] = useState<GeoHit | null>(null);
  const [price, setPrice] = useState("0");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [created, setCreated] = useState<EventItem | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (atEventLimit) {
      toast.error(`Du kan som mest skapa ${MAX_EVENTS_PER_ACCOUNT} event per konto.`);
      return;
    }
    // Namn och plats krävs endast för publika event; privata får standardvärden.
    if (visibility === "public" && (!name.trim() || !place.trim())) {
      toast.error("Fyll i eventnamn och plats.");
      return;
    }
    // Adress krävs endast för publika event (de ska kunna visas på kartan).
    if (visibility === "public" && !location) {
      toast.error("Sök upp och välj en riktig adress – annars kan eventet inte få en nål.");
      return;
    }
    const item: EventItem = {
      // Unikt id (samma tokenformat som inbjudningskoderna) så att två event
      // som skapas samtidigt aldrig krockar i databasen.
      id: code(),
      name: name.trim(),
      category,
      date,
      start,
      end,
      place: place.trim(),
      address: location?.short ?? place.trim(),
      price: Number(price) || 0,
      description: description.trim(),
      image: image ?? undefined,
      organizerId: me,
      interested: [],
      visibility,
      // Publika event börjar alltid som pending – sponsring är först möjlig
      // efter att en moderator godkänt eventet.
      status: visibility === "public" ? "pending" : "approved",
      sponsored: false,
      promoted: false,
      lat: location?.lat,
      lng: location?.lng,
      distance: location ? distanceFromHome(location) : 0,
      inviteCode: visibility === "private" ? code() : undefined,
      invites: visibility === "private" ? [] : undefined,
    };
    if (visibility === "private") {
      try {
        const createdEvent = await useHanderStore.addPrivateEvent(
          item,
          me,
          useHanderStore.account?.name ?? "Arrangör",
        );
        setCreated(createdEvent);
      } catch (error) {
        console.error("Could not create shareable private event", error);
        toast.error(
          limitMessage(error) ??
            "Eventet kunde inte sparas. Kontrollera anslutningen och försök igen.",
        );
        return;
      }
    } else {
      try {
        const saved = await useHanderStore.addEvent(item);
        if (!saved) {
          // Datalagret avvisar skapande utan session – gäller även om UI:t kringgås.
          toast.error("Du måste vara inloggad för att skapa ett event.");
          return;
        }
      } catch (error) {
        console.error("Could not create public event", error);
        toast.error(
          limitMessage(error) ??
            "Eventet kunde inte skickas in. Kontrollera anslutningen och försök igen.",
        );
        return;
      }
      setCreated(item);
    }
    toast.success(
      visibility === "public"
        ? "Eventet har skickats för granskning."
        : "Privat event skapat – dela länken!",
    );
  };

  if (!checked || !loggedIn) {
    return (
      <AppShell title="Skapa event">
        <p className="p-8 text-center text-sm text-muted-foreground">
          {!checked ? "Kollar inloggning…" : "Logga in för att skapa ett event."}
        </p>
      </AppShell>
    );
  }

  if (created) {
    const link = appUrl(`/join/${created.inviteCode ?? ""}`);
    return (
      <AppShell title="Klart!">
        <div className="space-y-5 p-4">
          {created.image ? (
            <img
              src={created.image}
              alt={created.name}
              className="h-40 w-full rounded-3xl object-cover"
            />
          ) : (
            <div
              className="flex h-40 items-center justify-center rounded-3xl text-6xl"
              style={{ background: CATEGORY_GRADIENT[created.category] }}
            >
              {CATEGORIES.find((c) => c.id === created.category)?.emoji}
            </div>
          )}
          <h2 className="font-display text-xl font-bold">{created.name}</h2>

          {created.visibility === "public" ? (
            <div className="rounded-2xl border border-primary/40 bg-accent/50 p-4">
              <p className="text-sm font-bold text-accent-foreground">
                Eventet har skickats för granskning.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Publika event granskas innan de kan synas på kartan. Granskningstiden varierar.
              </p>
              <span className="mt-3 inline-block rounded-full bg-warning px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-warning-foreground">
                Under granskning
              </span>
            </div>
          ) : (
            <div
              className="rounded-2xl p-4"
              style={{ background: "color-mix(in srgb, #E57657 9%, transparent)" }}
            >
              <p className="font-display text-sm font-bold text-[#2A2421]">
                Privat event – syns inte på kartan.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Inbjudningslänk</p>
              <p className="mt-1 break-all font-mono text-sm font-bold text-[#2A2421]">{link}</p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(link);
                  toast.success("Inbjudningslänk kopierad");
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#E45048] px-4 py-2.5 text-xs font-bold text-[#FFFDF9] shadow-[0_3px_0_rgba(112,28,23,.25)] active:translate-y-[2px]"
              >
                <Copy className="h-3.5 w-3.5" /> Kopiera inbjudningslänk
              </button>
            </div>
          )}

          <div className="flex gap-2">
            {created.visibility === "private" ? (
              <Link
                to="/privat/$id"
                params={{ id: created.id }}
                className="flex-1 rounded-2xl bg-[#F7E5D5] px-4 py-3 text-center text-sm font-bold text-[#E45048]"
              >
                Hantera gäster
              </Link>
            ) : (
              <Link
                to="/profil"
                className="flex-1 rounded-2xl bg-secondary px-4 py-3 text-center text-sm font-bold"
              >
                Mina event
              </Link>
            )}
            <button
              type="button"
              onClick={() => setCreated(null)}
              className="flex-1 rounded-2xl bg-[#DDE3F8] px-4 py-3 text-sm font-bold text-[#3B4CAD] shadow-[0_3px_0_rgba(59,76,173,.25)] active:translate-y-[2px]"
            >
              Skapa fler
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Skapa event" subtitle="Publika event granskas innan de publiceras">
      <form onSubmit={submit} className="space-y-5 p-4">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              {
                id: "private",
                label: "Privat",
                icon: Lock,
                sub: "Endast inbjudna",
                accent: "#E45048",
                soft: "#FBD9D6",
              },
              {
                id: "public",
                label: "Publikt",
                icon: Globe,
                sub: "Alla kan upptäcka",
                accent: "#465BC4",
                soft: "#DDE3F8",
              },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setVisibility(o.id)}
              style={
                visibility === o.id ? { borderColor: o.accent, backgroundColor: o.soft } : undefined
              }
              className={cn(
                "visibility-card rounded-2xl border-[3px] p-3 text-left transition-colors",
                visibility === o.id ? "" : `visibility-card--${o.id} border-border bg-card`,
              )}
            >
              <o.icon
                className="h-4 w-4"
                style={{ color: visibility === o.id ? o.accent : undefined }}
              />
              <p className="mt-1.5 text-sm font-bold">{o.label}</p>
              <p className="text-[11px] text-muted-foreground">{o.sub}</p>
            </button>
          ))}
        </div>

        <PaletteDivider color={DIVIDER_COLORS.coral} />

        <label className="block space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Eventnamn
          </span>
          <input
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="T.ex. Förfest hos Emma"
          />
        </label>

        <PaletteDivider color={DIVIDER_COLORS.orange} />

        <div className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Kategori
          </span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={cn(
                  "rounded-full border min-h-9 px-3.5 py-2 text-xs font-semibold",
                  category === c.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card",
                )}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>

        <PaletteDivider color={DIVIDER_COLORS.yellow} />

        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-3 space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Datum
            </span>
            <input
              type="date"
              className={field}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="col-span-1 space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Start
            </span>
            <input
              type="time"
              className={field}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="col-span-1 space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Slut
            </span>
            <input
              type="time"
              className={field}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <label className="col-span-1 space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Pris (kr)
            </span>
            <input
              type="number"
              min={0}
              className={field}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
        </div>

        <PaletteDivider color={DIVIDER_COLORS.periwinkle} />

        <label className="block space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Plats
          </span>
          <input
            className={field}
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="T.ex. Kårhuset Bryggan"
          />
        </label>

        <div className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Adress{visibility === "private" ? " (frivilligt)" : ""}
          </span>
          <AddressSearch
            value={location}
            onSelect={setLocation}
            onClear={() => setLocation(null)}
          />
          {visibility === "public" ? (
            <p className="text-[11px] text-muted-foreground">
              Nålen placeras exakt på den valda adressens koordinater. Utan vald adress kan eventet
              inte visas på kartan.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Lägg till en adress om du vill att gästerna enkelt ska hitta dit.
            </p>
          )}
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Beskrivning
          </span>
          <textarea
            className={cn(field, "min-h-24 resize-none")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Berätta kort vad som händer."
          />
        </label>

        <div className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Bild
          </span>
          {image ? (
            <div className="relative overflow-hidden rounded-2xl">
              <img src={image} alt="Förhandsvisning" className="h-40 w-full object-cover" />
              <button
                type="button"
                onClick={() => setImage(null)}
                className="absolute right-2 top-2 rounded-full bg-background/90 px-3 py-1 text-[11px] font-bold"
              >
                Ta bort
              </button>
            </div>
          ) : (
            <div
              className="flex h-28 items-center justify-center rounded-2xl text-4xl"
              style={{ background: CATEGORY_GRADIENT[category] }}
            >
              {CATEGORIES.find((c) => c.id === category)?.emoji}
            </div>
          )}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 py-3 text-xs font-bold text-muted-foreground">
            <ImagePlus className="h-4 w-4" /> Ladda upp egen bild
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(ev) => {
                const file = ev.target.files?.[0];
                if (!file) return;
                if (file.size > 4_000_000) {
                  toast.error("Bilden är för stor (max 4 MB).");
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => setImage(String(reader.result));
                reader.readAsDataURL(file);
              }}
            />
          </label>
          <p className="text-[11px] text-muted-foreground">
            Utan egen bild används kategorins omslag.
          </p>
        </div>

        {visibility === "public" && (
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Synlighet
            </p>
            <p className="mt-2 text-xs text-foreground/80">
              Eventet publiceras gratis på kartan och i flödet när en moderator har godkänt det.
            </p>
            <div className="mt-2 rounded-xl bg-[#DDE3F8] p-3 text-xs text-[#3B4CAD]">
              <p className="font-bold">Sponsrad placering – {sponsorshipPriceLabel()}</p>
              <p className="mt-1 leading-relaxed">
                {SPONSORSHIP.availabilityNote} Betalning sker via Swish till{" "}
                {SPONSORSHIP.paymentNumber}.
              </p>
            </div>
          </div>
        )}

        {atEventLimit && (
          <p
            role="status"
            className="rounded-2xl bg-[#FBECEB] px-4 py-3 text-xs font-bold text-[#B03A36]"
          >
            Du har redan {createdEventCount} av {MAX_EVENTS_PER_ACCOUNT} event. Radera ett event för
            att kunna skapa ett nytt.
          </p>
        )}

        <button
          type="submit"
          disabled={!loggedIn || atEventLimit}
          className="hander-cta-button flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E45048] px-4 py-4 text-sm font-bold text-[#FFFDF9] transition-transform active:translate-y-[2px] disabled:opacity-50 disabled:pointer-events-none"
        >
          <Check className="h-4 w-4" />
          {visibility === "public" ? "Skicka för granskning" : "Skapa privat event"}
        </button>
      </form>
    </AppShell>
  );
}
