import { createFileRoute } from "@tanstack/react-router";
import { Check, Flag, Pencil, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/hander/AppShell";
import { CategoryChip, EventCover, priceLabel } from "@/components/hander/EventBits";
import { ModeratorEditor } from "@/components/hander/ModeratorEditor";
import { PLACE_TYPES, userById, type EventItem, type EventStatus } from "@/lib/hander-data";
import { formatDay, useHander } from "@/lib/hander-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Moderering – Händer" },
      { name: "description", content: "Granska, godkänn eller avvisa användarskapade event." },
      { property: "og:title", content: "Moderering – Händer" },
      { property: "og:description", content: "Admin-vy för publika event på Händer." },
    ],
  }),
  component: AdminPage,
});

type Tab = "pending" | "approved" | "rejected" | "reported";

function AdminPage() {
  const store = useHander();
  const [tab, setTab] = useState<Tab>("pending");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const pub = store.events.filter((e) => e.visibility === "public");
  const lists: Record<Tab, EventItem[]> = {
    pending: pub.filter((e) => e.status === "pending"),
    approved: pub.filter((e) => e.status === "approved"),
    rejected: pub.filter((e) => e.status === "rejected"),
    reported: pub.filter((e) => (e.reported ?? 0) > 0),
  };
  const labels: Record<Tab, string> = {
    pending: "Väntar",
    approved: "Godkända",
    rejected: "Avvisade",
    reported: "Anmälda",
  };

  const reviewEvent = editing ? (store.events.find((e) => e.id === editing) ?? null) : null;

  const statusBadge = (s: EventStatus) =>
    s === "approved"
      ? "bg-success text-success-foreground"
      : s === "pending"
        ? "bg-warning text-warning-foreground"
        : "bg-destructive text-destructive-foreground";

  return (
    <AppShell title="Moderering" subtitle="Publika event måste godkännas innan de syns">
      <div className="space-y-4 p-4">
        {store.pendingPlaces.length > 0 && (
          <section className="space-y-2 rounded-2xl border border-border bg-secondary/50 p-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Föreslagna platser ({store.pendingPlaces.length})
            </h2>
            {store.pendingPlaces.map((p) => (
              <div key={p.id} className="rounded-xl border border-border bg-card p-3">
                <p className="text-sm font-bold">
                  {PLACE_TYPES[p.type].emoji} {p.name}
                </p>
                <p className="text-xs text-muted-foreground">{p.address}</p>
                <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => store.setPlaceStatus(p.id, "approved")}
                    className="flex-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                  >
                    Godkänn
                  </button>
                  <button
                    type="button"
                    onClick={() => store.setPlaceStatus(p.id, "rejected")}
                    className="flex-1 rounded-xl bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground"
                  >
                    Avvisa
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}
        <div className="grid grid-cols-4 gap-1.5">

          {(Object.keys(lists) as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-xl px-2 py-2 text-[11px] font-bold",
                tab === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
              )}
            >
              {labels[t]}
              <span className="block text-[13px]">{lists[t].length}</span>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {lists[tab].map((e) => {
            const creator = userById(e.organizerId);
            return (
              <article
                key={e.id}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]"
              >
                <div className="flex gap-3 p-3">
                  <EventCover event={e} className="h-20 w-20 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-sm font-bold">{e.name}</h3>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          statusBadge(e.status),
                        )}
                      >
                        {e.status === "pending" ? "Granskas" : e.status === "approved" ? "Godkänd" : "Avvisad"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Skapad av {creator.name} ({creator.username})
                    </p>
                    <div className="mt-1">
                      <CategoryChip category={e.category} />
                    </div>
                    <p className="mt-1 text-xs">
                      {formatDay(e.date)} {e.start}–{e.end} · {e.place} · {priceLabel(e.price)}
                    </p>
                  </div>
                </div>
                <p className="px-3 pb-2 text-xs text-muted-foreground">{e.description}</p>
                {e.reported ? (
                  <p className="flex items-center gap-1 px-3 pb-2 text-xs font-bold text-destructive">
                    <Flag className="h-3 w-3" /> {e.reported} anmälningar
                  </p>
                ) : null}
                {e.rejectionReason && (
                  <p className="px-3 pb-2 text-xs text-destructive">Orsak: {e.rejectionReason}</p>
                )}

                {rejecting === e.id ? (
                  <div className="space-y-2 border-t border-border p-3">
                    <input
                      value={reason}
                      onChange={(ev) => setReason(ev.target.value)}
                      placeholder="Anledning till avslag"
                      className="w-full rounded-xl border border-border px-3 py-2 text-xs outline-none focus:border-primary"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setRejecting(null)}
                        className="flex-1 rounded-xl bg-secondary px-3 py-2 text-xs font-bold"
                      >
                        Avbryt
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          store.setStatus(e.id, "rejected", reason || "Uppfyller inte riktlinjerna.");
                          setRejecting(null);
                          setReason("");
                          toast("Eventet avvisades");
                        }}
                        className="flex-1 rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground"
                      >
                        Bekräfta avslag
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 border-t border-border p-3">
                    <button
                      type="button"
                      onClick={() => {
                        store.setStatus(e.id, "approved", undefined);
                        toast.success("Godkänt – eventet syns nu på kartan");
                      }}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-success px-3 py-2 text-xs font-bold text-success-foreground"
                    >
                      <Check className="h-3.5 w-3.5" /> Godkänn
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejecting(e.id)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-secondary px-3 py-2 text-xs font-bold"
                    >
                      <X className="h-3.5 w-3.5" /> Avvisa
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(e.id)}
                      className="flex items-center justify-center gap-1 rounded-xl bg-secondary px-3 py-2 text-xs font-bold"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Granska
                    </button>
                  </div>
                )}
              </article>
            );
          })}
          {lists[tab].length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">Inget i den här kön.</p>
          )}
        </div>
      </div>

      {reviewEvent && (
        <ModeratorEditor
          event={reviewEvent}
          onClose={() => setEditing(null)}
          onSave={(patch) => store.updateEvent(reviewEvent.id, patch)}
          onApprove={(patch) => {
            store.updateEvent(reviewEvent.id, { ...patch, status: "approved", rejectionReason: undefined });
            setEditing(null);
            toast.success("Godkänt – eventet syns nu på kartan och i flödet");
          }}
          onReject={(r) => {
            store.setStatus(reviewEvent.id, "rejected", r);
            setEditing(null);
            toast("Eventet avvisades");
          }}
        />
      )}
    </AppShell>
  );
}
