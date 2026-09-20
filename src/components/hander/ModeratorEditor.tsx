import { Check, Eye, ImagePlus, MapPin, Pencil, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { EventCard, EventCover, EventRow, priceLabel } from "@/components/hander/EventBits";
import { PinPlacer } from "@/components/hander/PinPlacer";
import { distanceFromHome } from "@/lib/geocode";
import { CATEGORIES, MAP_CENTER, USERS, type CategoryId, type EventItem } from "@/lib/hander-data";
import { formatDay } from "@/lib/hander-store";
import { cn } from "@/lib/utils";

export const REJECT_REASONS = [
  "Felaktig adress",
  "Otillräcklig information",
  "Olämpligt innehåll",
  "Dubblett",
];

type Step = "edit" | "pin" | "preview";

/**
 * Moderatorns arbetsyta: redigera information → kontrollera platsen →
 * placera nålen → förhandsgranska → godkänna eller avvisa.
 */
export function ModeratorEditor({
  event,
  onSave,
  onApprove,
  onReject,
  onClose,
}: {
  event: EventItem;
  onSave: (patch: Partial<EventItem>) => void;
  onApprove: (patch: Partial<EventItem>) => void;
  onReject: (reason: string) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("edit");
  const [draft, setDraft] = useState<EventItem>({ ...event });
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof EventItem>(key: K, val: EventItem[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  const pin = { lat: draft.lat ?? MAP_CENTER.lat, lng: draft.lng ?? MAP_CENTER.lng };
  const patch = (): Partial<EventItem> => ({
    name: draft.name.trim() || event.name,
    description: draft.description,
    category: draft.category,
    image: draft.image,
    date: draft.date,
    start: draft.start,
    end: draft.end,
    price: draft.price,
    organizerId: draft.organizerId,
    place: draft.place,
    address: draft.address,
    lat: draft.lat,
    lng: draft.lng,
    distance: draft.lat != null && draft.lng != null ? distanceFromHome({ lat: draft.lat, lng: draft.lng }) : draft.distance,
  });

  const field = "w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary";
  const label = "text-[11px] font-bold uppercase tracking-wide text-muted-foreground";

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const steps: { id: Step; label: string; icon: typeof Pencil }[] = [
    { id: "edit", label: "Information", icon: Pencil },
    { id: "pin", label: "Placera nålen", icon: MapPin },
    { id: "preview", label: "Förhandsgranska", icon: Eye },
  ];

  const body = (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Stäng"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold">Granska event</p>
          <p className="truncate text-[11px] text-muted-foreground">{draft.name}</p>
        </div>
      </header>

      <nav className="flex gap-1.5 border-b border-border px-4 py-2">
        {steps.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold",
              step === s.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
            )}
          >
            <s.icon className="h-3.5 w-3.5" /> {s.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {step === "edit" && (
          <div className="space-y-3">
            <div>
              <p className={label}>Titel</p>
              <input className={field} value={draft.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div>
              <p className={label}>Beskrivning</p>
              <textarea
                rows={4}
                className={field}
                value={draft.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>
            <div>
              <p className={label}>Kategori</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => set("category", c.id as CategoryId)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold",
                      draft.category === c.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground",
                    )}
                  >
                    {c.emoji} {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className={label}>Bild</p>
              <div className="mt-1 flex items-center gap-3">
                <EventCover event={draft} className="h-16 w-16 rounded-xl" />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const reader = new FileReader();
                    reader.onload = () => set("image", String(reader.result));
                    reader.readAsDataURL(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1 rounded-xl bg-secondary px-3 py-2 text-xs font-bold"
                >
                  <ImagePlus className="h-3.5 w-3.5" /> Byt bild
                </button>
                {draft.image && (
                  <button
                    type="button"
                    onClick={() => set("image", undefined)}
                    className="rounded-xl bg-secondary px-3 py-2 text-xs font-bold"
                  >
                    Ta bort
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className={label}>Datum</p>
                <input type="date" className={field} value={draft.date} onChange={(e) => set("date", e.target.value)} />
              </div>
              <div>
                <p className={label}>Start</p>
                <input type="time" className={field} value={draft.start} onChange={(e) => set("start", e.target.value)} />
              </div>
              <div>
                <p className={label}>Slut</p>
                <input type="time" className={field} value={draft.end} onChange={(e) => set("end", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className={label}>Pris (kr, 0 = gratis)</p>
                <input
                  type="number"
                  min={0}
                  className={field}
                  value={draft.price}
                  onChange={(e) => set("price", Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <p className={label}>Arrangör</p>
                <select
                  className={field}
                  value={draft.organizerId}
                  onChange={(e) => set("organizerId", e.target.value)}
                >
                  {USERS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.username})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <p className={label}>Platsnamn</p>
              <input className={field} value={draft.place} onChange={(e) => set("place", e.target.value)} />
            </div>
            <div>
              <p className={label}>Adress</p>
              <input className={field} value={draft.address} onChange={(e) => set("address", e.target.value)} />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Kontrollera adressen och justera nålen i nästa steg.
              </p>
            </div>
          </div>
        )}

        {step === "pin" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Sök adress, se platsen på kartan och dra nålen till exakt rätt plats.
            </p>
            <PinPlacer
              value={pin}
              onChange={(p) => setDraft((d) => ({ ...d, lat: p.lat, lng: p.lng }))}
              onAddress={(hit) =>
                setDraft((d) => ({
                  ...d,
                  address: hit.label,
                  place: d.place || hit.short,
                  lat: hit.lat,
                  lng: hit.lng,
                }))
              }
            />
            <div className="rounded-2xl border border-border bg-card p-3 text-xs">
              <p className="font-semibold">{draft.place || "Ingen plats angiven"}</p>
              <p className="text-muted-foreground">{draft.address}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
              </p>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <section className="space-y-2">
              <p className={label}>Så ser eventkortet ut</p>
              <EventCard event={draft} />
            </section>
            <section className="space-y-2">
              <p className={label}>Så ser det ut i listan</p>
              <EventRow event={draft} />
            </section>
            <section className="space-y-2">
              <p className={label}>Nålen på kartan</p>
              <PinPlacer value={pin} onChange={() => {}} readOnly />
            </section>
            <section className="rounded-2xl border border-border bg-card p-3 text-xs">
              <p className="font-semibold">{draft.name}</p>
              <p className="text-muted-foreground">
                {formatDay(draft.date)} {draft.start}–{draft.end} · {draft.place} · {priceLabel(draft.price)}
              </p>
              <p className="mt-1 text-muted-foreground">{draft.address}</p>
            </section>
          </div>
        )}
      </div>

      <footer className="space-y-2 border-t border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {rejecting ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {REJECT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold",
                    reason === r ? "bg-destructive text-destructive-foreground" : "bg-secondary",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Anledning till avslag"
              className={field}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRejecting(false)}
                className="flex-1 rounded-xl bg-secondary px-3 py-3 text-xs font-bold"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!reason.trim()) {
                    toast.error("Ange en anledning");
                    return;
                  }
                  onReject(reason.trim());
                }}
                className="flex-1 rounded-xl bg-destructive px-3 py-3 text-xs font-bold text-destructive-foreground"
              >
                Bekräfta avslag
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onSave(patch());
                  toast.success("Ändringar sparade");
                }}
                className="flex-1 rounded-xl bg-secondary px-3 py-3 text-xs font-bold"
              >
                Spara ändringar
              </button>
              <button
                type="button"
                onClick={() => setStep(step === "edit" ? "pin" : "preview")}
                disabled={step === "preview"}
                className="flex-1 rounded-xl bg-secondary px-3 py-3 text-xs font-bold disabled:opacity-40"
              >
                Nästa steg
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (draft.lat == null || draft.lng == null) {
                    toast.error("Placera nålen innan du publicerar");
                    setStep("pin");
                    return;
                  }
                  onApprove(patch());
                }}
                className="flex flex-[2] items-center justify-center gap-1 rounded-xl bg-success px-3 py-3 text-xs font-bold text-success-foreground"
              >
                <Check className="h-4 w-4" /> Godkänn och publicera
              </button>
              <button
                type="button"
                onClick={() => setRejecting(true)}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-secondary px-3 py-3 text-xs font-bold"
              >
                <X className="h-4 w-4" /> Avvisa
              </button>
            </div>
          </>
        )}
      </footer>
    </div>
  );

  if (!mounted) return null;
  return createPortal(body, document.body);
}
