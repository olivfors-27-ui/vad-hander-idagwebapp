import { createFileRoute, Link, useParams, useRouter } from "@tanstack/react-router";
import { X, Bookmark, Heart, MapPin, Share2, Ticket, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/hander/AppShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ShareSheet, absoluteUrl } from "@/components/hander/ShareSheet";
import {
  Avatar,
  AvatarStack,
  CategoryChip,
  EventCover,
  priceLabel,
  SponsoredBadge,
} from "@/components/hander/EventBits";
import { MapCanvas } from "@/components/hander/MapCanvas";
import { useGoCreate } from "@/lib/auth-guard";
import { useProfile } from "@/lib/auth";
import { describeDbError } from "@/lib/db-error";
import { recordEventView } from "@/lib/event-views";
import { CATEGORY_GRADIENT, ME, userById } from "@/lib/hander-data";
import { formatDay, useHander } from "@/lib/hander-store";
import { truncateDescription } from "@/lib/text";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/event/$id")({
  head: () => ({
    meta: [
      { title: "Event – Händer" },
      { name: "description", content: "Detaljer, tid, plats och vilka som ska dit." },
      { property: "og:title", content: "Event – Händer" },
      { property: "og:description", content: "Se vad som händer och vilka som är intresserade." },
    ],
  }),
  component: EventPage,
});

function EventPage() {
  const { id } = useParams({ from: "/event/$id" });
  const store = useHander();
  // UI-guard: "Planera med kompisar" kräver inloggning.
  const { go: goCreate } = useGoCreate();
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const event = store.events.find((e) => e.id === id);
  // Arrangörens riktiga profil. Eventet sparar organizerName, men äldre event
  // och inbjudningar kan sakna det – då hämtas namnet från profiles (publikt
  // läsbar enligt RLS) i stället för att falla tillbaka på "Okänd användare".
  const organizerProfile = useProfile(event?.organizerId);

  // En person räknas en gång per event – databasen dedupliserar på besökare,
  // så en omrendering eller en ny sidladdning ändrar aldrig siffran.
  const eventId = event?.id;
  useEffect(() => {
    if (!eventId) return;
    void recordEventView(eventId);
  }, [eventId]);

  if (!event) {
    return (
      <AppShell title="Event">
        <div className="p-8 text-center text-sm text-muted-foreground">
          Eventet finns inte längre.
          <div className="mt-4">
            <Link to="/" className="font-bold text-primary">
              Till Upptäck
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const organizerName = event.organizerName?.trim() || organizerProfile?.name;
  const organizer =
    event.organizerId === "visit-stockholm"
      ? {
          ...userById(ME),
          name: "Visit Stockholm",
          username: "@visitstockholm",
          bio: "Officiell eventdata från Visit Stockholm.",
          verified: true as const,
        }
      : userById(event.organizerId, organizerName);
  // Profilens användarnamn om det finns – annars blir länken "@okand" och leder
  // till en tom profilsida. Då visas arrangören utan länk i stället.
  const organizerUsername =
    event.organizerId === "visit-stockholm"
      ? "@visitstockholm"
      : organizerProfile?.username
        ? `@${organizerProfile.username}`
        : null;
  const follows = store.followingInterested(event);
  const isInterested = store.interested.includes(event.id);
  const isSaved = store.saved.includes(event.id);
  const isOwner = Boolean(store.account) && event.organizerId === store.me;

  const removeEvent = async () => {
    setDeleting(true);
    try {
      await store.deleteEvent(event.id);
      toast.success("Eventet har tagits bort");
      void router.navigate({ to: "/profil" });
    } catch (error) {
      console.error("Could not delete event", error);
      toast.error(describeDbError(error));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell title="Event" subtitle="Eventdetaljer">
      <div className="event-page relative">
        <EventCover event={event} className="h-56" big />
        <button
          type="button"
          onClick={() => {
            if (router.history.canGoBack()) router.history.back();
            else void router.navigate({ to: "/" });
          }}
          className="absolute left-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-background/90 shadow-[var(--shadow-card)]"
          aria-label="Stäng event"
        >
          <X className="h-5 w-5" />
        </button>
        {(event.sponsored || event.promoted) && (
          <SponsoredBadge tone="onMedia" className="absolute right-4 top-4 max-w-[45%]" />
        )}
      </div>

      <div className="event-page space-y-5 p-4 pb-44">
        <div>
          {event.status !== "approved" && (
            <span
              className={cn(
                "mb-2 inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase",
                event.status === "pending"
                  ? "bg-warning text-warning-foreground"
                  : "bg-destructive text-destructive-foreground",
              )}
            >
              {event.status === "pending" ? "Under granskning" : "Avvisad"}
            </span>
          )}
          <h1 className="font-display text-2xl font-bold">{event.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CategoryChip category={event.category} />
            {event.visibility === "private" && (
              <span className="rounded-full bg-foreground px-2 py-0.5 text-[11px] font-bold text-background">
                Privat
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-secondary/70 p-3">
            <p className="text-[11px] font-bold uppercase text-muted-foreground">När</p>
            <p className="text-sm font-bold">{formatDay(event.date)}</p>
            <p className="text-sm">
              {event.start}–{event.end}
            </p>
          </div>
          <div className="rounded-2xl bg-secondary/70 p-3">
            <p className="text-[11px] font-bold uppercase text-muted-foreground">Pris</p>
            {event.priceKnown ? (
              <p className="text-sm font-bold text-primary">{priceLabel(event.price, event.priceKnown)}</p>
            ) : event.sourceUrl ? (
              <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-primary underline underline-offset-2">
                Se pris hos arrangören
              </a>
            ) : (
              <p className="text-sm font-bold text-primary">Pris hos arrangören</p>
            )}
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Ticket className="h-3 w-3" /> Priset kan variera
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border p-3">
          <p className="flex items-center gap-2 text-sm font-bold">
            <MapPin className="h-4 w-4 text-primary" /> {event.place}
          </p>
          <p className="ml-6 text-xs text-muted-foreground">
            {event.address} · {event.distance} km bort
          </p>
          <div className="mt-3 h-32 overflow-hidden rounded-xl">
            <MapCanvas events={[event]} places={[]} showPlaces={false} onSelectEvent={() => {}} />
          </div>
        </div>

        <p className="text-sm leading-relaxed text-foreground/90">
          {truncateDescription(event.description)}
        </p>
        {event.sourceUrl && (
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex text-xs font-bold text-primary underline underline-offset-2"
          >
            Läs mer hos arrangören
          </a>
        )}

        <p className="rounded-2xl bg-accent/50 px-4 py-3 text-xs text-muted-foreground">
          <span className="font-bold text-accent-foreground">Sugen?</span> Tryck ”Planera med
          kompisar” här nedanför – du får en länk att skicka i gruppchatten där alla svarar utan
          appen.
        </p>




        {organizerUsername ? (
          <Link
            to="/anvandare/$username"
            params={{ username: organizerUsername.replace("@", "") }}
            className="flex items-center gap-3 rounded-2xl border border-border p-3"
          >
            <Avatar user={organizer} size={40} />
            <div className="flex-1">
              <p className="text-sm font-bold">
                {organizer.name} {organizer.verified && "✔️"}
              </p>
              <p className="text-xs text-muted-foreground">
                Arrangör · {organizer.followers} följare
              </p>
            </div>
            <span className="text-xs font-bold text-primary">Visa profil</span>
          </Link>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
            <Avatar user={organizer} size={40} />
            <div className="flex-1">
              <p className="text-sm font-bold">
                {organizer.name} {organizer.verified && "✔️"}
              </p>
              <p className="text-xs text-muted-foreground">Arrangör</p>
            </div>
          </div>
        )}

        {event.visibility === "public" && (
          <div className="space-y-2 rounded-2xl bg-accent/50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold">
              <Users className="h-4 w-4 text-primary" />
              {store.interestedCount(event)}{" "}
              {store.interestedCount(event) === 1 ? "person är" : "personer är"} intresserade
            </p>
            <AvatarStack ids={event.interested} max={6} />
            <div className="border-t border-border/60 pt-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Personer du följer
              </p>
              {follows.length ? (
                <div className="mt-1 flex items-center gap-2">
                  <AvatarStack ids={follows} />
                  <p className="text-sm">
                    {follows.length} {follows.length === 1 ? "person" : "personer"} du följer är
                    intresserade.
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  Ingen du följer har anmält intresse än.
                </p>
              )}
            </div>
          </div>
        )}

        {event.visibility === "private" && (
          <Link
            to="/privat/$id"
            params={{ id: event.id }}
            className="block rounded-2xl bg-secondary p-4 text-sm font-bold"
          >
            Hantera gästlista & inbjudningslänk →
          </Link>
        )}

        {isOwner && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-card px-4 py-3 text-sm font-bold text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Ta bort event
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ta bort eventet?</AlertDialogTitle>
                <AlertDialogDescription>
                  ”{event.name}” tas bort för alla. Deltagare, gästsvar och inbjudningar raderas
                  också. Det går inte att ångra.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Avbryt</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleting}
                  onClick={(e) => {
                    e.preventDefault();
                    void removeEvent();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? "Tar bort…" : "Ta bort event"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="event-actions-dock fixed inset-x-0 bottom-16 z-30 mx-auto max-w-md space-y-2 border-t border-border bg-background/95 p-3 backdrop-blur-md">
        <button
          type="button"
          onClick={() => {
            store.track(event.id, "plans");
            goCreate();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-pin)]"
        >
          <Users className="h-4 w-4" /> Planera med kompisar
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => store.toggleInterested(event.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold",
              isInterested
                ? "bg-accent text-accent-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            <Heart className={cn("h-4 w-4", isInterested && "fill-current")} />
            {isInterested ? "Intresserad" : "Intresserad?"}
          </button>
          <button
            type="button"
            aria-label="Spara"
            onClick={() => store.toggleSaved(event.id)}
            className={cn(
              "rounded-2xl px-4 py-2.5",
              isSaved ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground",
            )}
          >
            <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
          </button>
          <button
            type="button"
            aria-label="Dela"
            onClick={() => {
              store.track(event.id, "shares");
              setShareOpen(true);
            }}
            className="rounded-2xl bg-secondary px-4 py-2.5 text-secondary-foreground"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>


      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        preview={{
          tagline: "Kolla in det här! 👀",
          title: event.name,
          emoji: "📍",
          gradient: CATEGORY_GRADIENT[event.category],
          meta: `${formatDay(event.date)} ${event.start} · ${event.place}`,
          cta: "Tryck för att se eventet i Händer.",
          url: absoluteUrl(`/event/${event.id}`),
          displayUrl: absoluteUrl(`/event/${event.id}`),
          shareText: `Kolla in ${event.name} – ${formatDay(event.date)} ${event.start} på ${event.place}!`,
        }}
      />
    </AppShell>
  );
}
