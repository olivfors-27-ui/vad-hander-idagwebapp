import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  EVENTS,
  FEED,
  INITIAL_FOLLOWING,
  ME,
  NOTIFICATIONS,
  PLACES,
  TODAY,
  geoOf,
  weekendDates,
  type EventItem,
  type EventStatus,
  type EventStats,
  type InviteStatus,
  type Notification,
  type Place,
  type StatKey,
  baseStats,
} from "./hander-data";
import { uid, type Plan, type PlanReply } from "./hander-plans";
import { isEventVisible } from "./event-time";
import { distanceKm } from "./geocode";

// Synlighetsregeln bor i event-time.ts (datalagret behöver den också).
export { eventVisibleUntil, isEventVisible } from "./event-time";
import { useUserLocation } from "./user-location";
import { fetchEventsWithCache } from "./visitstockholm";
import { watchAccount, type Account } from "./auth";
import {
  fetchPrivateEventGuests,
  fetchPrivateEventInvite,
  fetchPrivateEventInvites,
  savePrivateEventInvite,
  submitPrivateEventInviteReply,
} from "./private-event-invites";
import { deleteEvent as deleteEventRequest } from "./event-admin";
import {
  createPublicEvent,
  fetchMyPublicEvents,
  fetchPublicEvents,
  moderatePublicEvent,
  sponsorPublicEvent,
  updatePublicEventContent,
} from "./public-events";
import { followProfile, fetchFollowingIds, unfollowProfile } from "./profiles";
import {
  fetchPlans,
  insertPlan,
  patchPlan,
  removePlan,
  subscribePlans,
  upsertReply,
} from "./hander-plans-api";

const STORAGE_KEY = "hander-state-v2";

export type NotifSettings = {
  nearby: boolean;
  follow: boolean;
  reminder: boolean;
  social: boolean;
  plan: boolean;
};

type Persisted = {
  events: EventItem[];
  saved: string[];
  savedPlaces: string[];
  interested: string[];
  following: string[];
  notifSettings: NotifSettings;
  readNotifications: string[];
  plans: Plan[];
  /** Användarförslag på permanenta platser – syns publikt först efter godkännande. */
  placeSuggestions: Place[];
  /** Registrerad aktivitet per event (visningar, klick, delningar ...). */
  stats: Record<string, Partial<EventStats>>;
};

const initial = (): Persisted => ({
  events: [],
  saved: [],
  savedPlaces: [],
  interested: [],
  following: [],
  notifSettings: { nearby: true, follow: true, reminder: true, social: true, plan: true },
  readNotifications: [],
  plans: [],
  placeSuggestions: [],
  stats: {},
});

type Ctx = ReturnType<typeof useStoreValue>;
const StoreContext = createContext<Ctx | null>(null);

function useStoreValue() {
  const [state, setState] = useState<Persisted>(initial);
  // Användarens riktiga position är referens för alla avstånd. Saknas den
  // (nekad åtkomst, äldre webbläsare) behålls avståndet som sparades när
  // eventet skapades.
  const {
    coords: userLocation,
    status: locationStatus,
    ask: askForLocation,
  } = useUserLocation();
  const [hydrated, setHydrated] = useState(false);
  const [apiEvents, setApiEvents] = useState<EventItem[]>([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  // Publika event skapade i appen – hämtas från Supabase. RLS ger godkända
  // event till alla, egna till ägaren och allt till moderatorer.
  // cloudEvents är bara de som fortfarande ska synas publikt (databasvyn
  // visible_public_events). myCloudEvents är ägarens egna, inklusive avslutade.
  const [cloudEvents, setCloudEvents] = useState<EventItem[]>([]);
  const [myCloudEvents, setMyCloudEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Persisted;
        setState((s) => {
          const storedEvents = Array.isArray(parsed.events) ? parsed.events : [];
          const storedPlans = Array.isArray(parsed.plans) ? parsed.plans : [];
          // Ingen demodata slås på igen – gamla demo-id:n ignoreras.
          const cleanEvents = storedEvents.filter((e) => !e.id.startsWith("demo"));
          const cleanPlans = storedPlans.filter((p) => !p.id.startsWith("demo"));
          return { ...s, ...parsed, events: cleanEvents, plans: cleanPlans };
        });
      }
    } catch {
      /* ignorera */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignorera */
    }
  }, [state, hydrated]);

  useEffect(() => {
    const controller = new AbortController();
    setApiLoading(true);
    fetchEventsWithCache(controller.signal)
      .then((events) => {
        setApiEvents(events);
        setApiError(null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setApiError("Kunde inte läsa in eventkällorna just nu.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setApiLoading(false);
      });
    return () => controller.abort();
  }, []);

  // Planer bor i molnet så att delade länkar fungerar på andra enheter.
  const refreshPlans = useCallback(async () => {
    try {
      const plans = await fetchPlans();
      setState((s) => ({ ...s, plans }));
    } catch {
      /* offline – behåll det vi har */
    }
  }, []);

  useEffect(() => {
    void refreshPlans();
    return subscribePlans(() => {
      void refreshPlans();
    });
  }, [refreshPlans]);

  // Inloggning: håll reda på kontot och använd dess id som "me"-identitet.
  // Utan konto (eller utan Supabase-konfig) faller allt tillbaka på demo-identiteten.
  // authChecked blir true när första sessionklockan svarat (inloggad eller inte),
  // så att skyddade sidor kan vänta in en eventuell inloggning innan de avvisar.
  const [account, setAccount] = useState<Account | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(
    () =>
      watchAccount((a) => {
        setAccount(a);
        setAuthChecked(true);
      }),
    [],
  );
  const me = account?.id ?? ME;

  const refreshCloudEvents = useCallback(async () => {
    try {
      setCloudEvents(await fetchPublicEvents());
    } catch {
      /* offline – behåll det vi redan har */
    }
    try {
      setMyCloudEvents(await fetchMyPublicEvents());
    } catch {
      /* offline – behåll det vi redan har */
    }
  }, []);

  useEffect(() => {
    void refreshCloudEvents();
  }, [refreshCloudEvents, account?.id]);

  // Följningar bor i databasen så att de finns kvar mellan enheter. Lokala
  // följningar behålls som fallback tills svaret kommit.
  useEffect(() => {
    if (!account) return;
    let active = true;
    void fetchFollowingIds(account.id)
      .then((ids) => {
        if (!active) return;
        // Databasen är källan: gamla lokala demo-id:n ska inte ligga kvar.
        setState((s) => ({ ...s, following: ids }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [account]);

  // Reparera äldre event: när vi vet vilket konto som är inloggat fylls
  // organizerName i på egna event som skapades innan namnet sparades –
  // då visas "inbjudare"/aldrig "Okänd" för skaparen på egen enhet.
  useEffect(() => {
    if (!account) return;
    setState((s) => {
      let changed = false;
      const events = s.events.map((e) => {
        if (e.organizerId === account.id && e.organizerName !== account.name) {
          changed = true;
          return { ...e, organizerName: account.name };
        }
        return e;
      });
      return changed ? { ...s, events } : s;
    });
  }, [account]);

  const patch = useCallback((p: Partial<Persisted>) => setState((s) => ({ ...s, ...p })), []);

  const toggleSaved = useCallback(
    (id: string) =>
      setState((s) => ({
        ...s,
        saved: s.saved.includes(id) ? s.saved.filter((x) => x !== id) : [...s.saved, id],
      })),
    [],
  );

  const toggleSavedPlace = useCallback(
    (id: string) =>
      setState((s) => ({
        ...s,
        savedPlaces: s.savedPlaces.includes(id)
          ? s.savedPlaces.filter((x) => x !== id)
          : [...s.savedPlaces, id],
      })),
    [],
  );

  const toggleInterested = useCallback(
    (id: string) =>
      setState((s) => ({
        ...s,
        interested: s.interested.includes(id)
          ? s.interested.filter((x) => x !== id)
          : [...s.interested, id],
      })),
    [],
  );

  /** Följ/avfölj – sparas i Supabase för inloggade, annars bara lokalt. */
  const toggleFollow = useCallback(
    (userId: string) => {
      if (account && userId === account.id) return;
      const following = state.following.includes(userId);
      setState((s) => ({
        ...s,
        following: following
          ? s.following.filter((x) => x !== userId)
          : [...s.following, userId],
      }));
      if (!account) return;
      const request = following
        ? unfollowProfile(account.id, userId)
        : followProfile(account.id, userId);
      void request.catch(() => undefined);
    },
    [account, state.following],
  );

  /**
   * Skapar ett event. Publika event skrivs till public_events och börjar alltid
   * som `pending` – granskning sker i databasen, inte bara i UI:t.
   */
  const addEvent = useCallback(
    async (e: EventItem): Promise<boolean> => {
      if (!account) return false;
      const organizerName = e.organizerName ?? account.name;
      if (e.visibility === "public") {
        const saved = await createPublicEvent(
          { ...e, organizerId: account.id, organizerName },
          account.id,
          organizerName,
        );
        setCloudEvents((prev) => [saved, ...prev.filter((x) => x.id !== saved.id)]);
        setMyCloudEvents((prev) => [saved, ...prev.filter((x) => x.id !== saved.id)]);
        return true;
      }
      const created: EventItem = { ...e, organizerId: account.id, organizerName };
      setState((s) => ({ ...s, events: [created, ...s.events] }));
      return true;
    },
    [account],
  );

  const loadPrivateEventInvite = useCallback(async (code: string, responseToken: string | null) => {
    const result = await fetchPrivateEventInvite(code, responseToken);
    if (!result) return null;
    const event = {
      ...result.event,
      guestCount: result.guestCount ?? result.event.guestCount,
      invites: result.ownReply ? [result.ownReply] : [],
    };
    setState((s) => {
      const existing = s.events.find((stored) => stored.id === event.id);
      const loaded =
        existing && !result.ownReply ? { ...event, invites: existing.invites ?? [] } : event;
      return {
        ...s,
        events: existing
          ? s.events.map((stored) => (stored.id === event.id ? loaded : stored))
          : [loaded, ...s.events],
      };
    });
    return event;
  }, []);

  const loadPrivateEventInvites = useCallback(async (code: string) => {
    const invites = await fetchPrivateEventInvites(code);
    setState((s) => ({
      ...s,
      events: s.events.map((event) =>
        event.inviteCode?.toUpperCase() === code.toUpperCase()
          ? {
              ...event,
              guestCount: invites.filter((i) => i.status === "accepted" || i.status === "maybe")
                .length,
              invites,
            }
          : event,
      ),
    }));
    return invites;
  }, []);

  /** Gästlistan (namn, status, intressen) som alla som är med i eventet ser. */
  const loadPrivateEventGuests = useCallback(
    async (code: string, responseToken: string | null) =>
      fetchPrivateEventGuests(code, responseToken),
    [],
  );

  const addPrivateEvent = useCallback(
    async (event: EventItem, organizerId: string, organizerName: string) => {
      const created = { ...event, organizerId, organizerName };
      await savePrivateEventInvite(created, organizerId);
      setState((s) => ({ ...s, events: [created, ...s.events] }));
      return created;
    },
    [],
  );

  const replyToPrivateEvent = useCallback(
    async (
      eventId: string,
      code: string,
      responseToken: string | null,
      guestName: string,
      interests: string[],
      status: Exclude<InviteStatus, "invited">,
    ) => {
      const result = await submitPrivateEventInviteReply(
        code,
        responseToken,
        guestName,
        interests,
        status,
      );
      const updatedReply = result.reply;
      if (result.responseToken) {
        try {
          localStorage.setItem(
            `hander-invite-response-${code.toUpperCase()}`,
            result.responseToken,
          );
        } catch {
          // The server response remains saved; only cross-reload convenience is unavailable.
        }
      }
      if (eventId) {
        setState((s) => ({
          ...s,
          events: s.events.map((event) => {
            if (event.id !== eventId) return event;
            const existing = event.invites ?? [];
            const updated = existing.filter((old) => old.userId !== updatedReply.userId);
            return {
              ...event,
              invites: existing.length > 1 ? updated.concat(updatedReply) : [updatedReply],
            };
          }),
        }));
      }
      return updatedReply;
    },
    [],
  );

  /** Raderar eventet i databasen (bara skaparen) och rensar lokal state. */
  const deleteEvent = useCallback(async (id: string) => {
    await deleteEventRequest(id);
    setState((s) => ({
      ...s,
      events: s.events.filter((event) => event.id !== id),
      saved: s.saved.filter((savedId) => savedId !== id),
      interested: s.interested.filter((interestedId) => interestedId !== id),
    }));
    setCloudEvents((prev) => prev.filter((event) => event.id !== id));
    setMyCloudEvents((prev) => prev.filter((event) => event.id !== id));
  }, []);

  const updateEvent = useCallback((id: string, p: Partial<EventItem>) => {
    setState((s) => ({
      ...s,
      events: s.events.map((e) => (e.id === id ? { ...e, ...p } : e)),
    }));
  }, []);

  /**
   * Sparar ett privat event i databasen. Utan detta skulle en ändring bara
   * finnas i den här webbläsaren – gästerna ser den aldrig. Upsert reparerar
   * samtidigt äldre event som skapades innan private_events fanns.
   */
  const persistPrivateEvent = useCallback(
    async (event: EventItem) => {
      if (!account) throw new Error("Inte inloggad");
      await savePrivateEventInvite(event, account.id);
      setMyCloudEvents((prev) =>
        prev.some((stored) => stored.id === event.id)
          ? prev.map((stored) => (stored.id === event.id ? event : stored))
          : prev,
      );
    },
    [account],
  );

  const setStatus = useCallback(
    (id: string, status: EventStatus, rejectionReason?: string | undefined) =>
      updateEvent(id, { status, rejectionReason }),
    [updateEvent],
  );

  /** Moderatorernas godkännande/avslag – kontrolleras av RPC:n i databasen. */
  const reviewPublicEvent = useCallback(
    async (id: string, status: EventStatus, reason?: string) => {
      if (cloudEvents.some((e) => e.id === id)) {
        await moderatePublicEvent(id, status, reason);
        setCloudEvents((prev) =>
          prev.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status,
                  rejectionReason:
                    status === "rejected" ? (reason ?? "Uppfyller inte riktlinjerna.") : undefined,
                }
              : e,
          ),
        );
        return;
      }
      // Äldre event som bara finns lokalt (skapade före public_events).
      setStatus(id, status, reason);
    },
    [cloudEvents, setStatus],
  );

  /** Sponsring efter godkännande. Pris och betalning sköts av användaren. */
  const sponsorEvent = useCallback(async (id: string) => {
    await sponsorPublicEvent(id);
    setCloudEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, sponsored: true, promoted: true } : e)),
    );
  }, []);

  /** Moderatorns redigering av ett publikt event (endast innehållet). */
  const updatePublicEvent = useCallback(
    async (id: string, patch: Partial<EventItem>) => {
      // Egna event kan ha försvunnit ur den publika vyn (avslutade) men finns
      // fortfarande i myCloudEvents – arrangören ska kunna redigera dem ändå.
      const current = myCloudEvents.find((e) => e.id === id) ?? cloudEvents.find((e) => e.id === id);
      if (!current) {
        updateEvent(id, patch);
        return;
      }
      const next: EventItem = { ...current, ...patch };
      await updatePublicEventContent(next);
      setCloudEvents((prev) => prev.map((e) => (e.id === id ? next : e)));
      setMyCloudEvents((prev) => prev.map((e) => (e.id === id ? next : e)));
    },
    [cloudEvents, myCloudEvents, updateEvent],
  );

  const setInviteStatus = useCallback(
    (eventId: string, userId: string, status: InviteStatus, guestName?: string | undefined) => {
      setState((s) => ({
        ...s,
        events: s.events.map((e) => {
          if (e.id !== eventId) return e;
          const invites = e.invites ?? [];
          const exists = invites.some((i) => i.userId === userId);
          // Namnet gästen skrev vid svar sparas på inbjudan så att värdens
          // gästlista visar riktigt namn – bevaras om ett nytt svar saknar namn.
          const name = guestName?.trim() || invites.find((i) => i.userId === userId)?.name;
          return {
            ...e,
            invites: exists
              ? invites.map((i) => (i.userId === userId ? { ...i, status, name } : i))
              : [...invites, { userId, status, name }],
          };
        }),
      }));
    },
    [],
  );

  const removeInvite = useCallback((eventId: string, userId: string) => {
    setState((s) => ({
      ...s,
      events: s.events.map((e) =>
        e.id === eventId
          ? { ...e, invites: (e.invites ?? []).filter((i) => i.userId !== userId) }
          : e,
      ),
    }));
  }, []);

  const setNotifSettings = useCallback(
    (p: Partial<NotifSettings>) =>
      setState((s) => ({ ...s, notifSettings: { ...s.notifSettings, ...p } })),
    [],
  );

  const markNotificationsRead = useCallback(
    (ids?: string[]) =>
      setState((s) => ({
        ...s,
        readNotifications: Array.from(
          new Set([...s.readNotifications, ...(ids ?? NOTIFICATIONS.map((n) => n.id))]),
        ),
      })),
    [],
  );

  // ---------- Planer ----------

  const addPlan = useCallback((plan: Plan) => {
    setState((s) => ({ ...s, plans: [plan, ...s.plans] }));
    void insertPlan(plan).catch(() => {
      /* sparas lokalt tills nätet är tillbaka */
    });
  }, []);

  const updatePlan = useCallback((id: string, p: Partial<Plan>) => {
    setState((s) => {
      const next = s.plans.map((pl) => (pl.id === id ? { ...pl, ...p } : pl));
      const updated = next.find((pl) => pl.id === id);
      if (updated) void patchPlan(updated).catch(() => {});
      return { ...s, plans: next };
    });
  }, []);

  const deletePlan = useCallback((id: string) => {
    setState((s) => ({ ...s, plans: s.plans.filter((pl) => pl.id !== id) }));
    void removePlan(id).catch(() => {});
  }, []);

  const addReply = useCallback((planId: string, reply: Omit<PlanReply, "id" | "at">) => {
    void upsertReply(planId, reply).catch(() => {});
    setState((s) => ({
      ...s,
      plans: s.plans.map((pl) =>
        pl.id === planId
          ? {
              ...pl,
              replies: [
                ...pl.replies.filter(
                  (r) => r.name.trim().toLowerCase() !== reply.name.trim().toLowerCase(),
                ),
                { ...reply, id: uid("rep"), at: new Date().toISOString() },
              ],
            }
          : pl,
      ),
    }));
  }, []);

  const addPlaceSuggestion = useCallback(
    (p: Place) =>
      setState((s) => ({
        ...s,
        placeSuggestions: [{ ...p, status: "pending" }, ...s.placeSuggestions],
      })),
    [],
  );

  const setPlaceStatus = useCallback(
    (id: string, status: EventStatus) =>
      setState((s) => ({
        ...s,
        placeSuggestions: s.placeSuggestions.map((p) => (p.id === id ? { ...p, status } : p)),
      })),
    [],
  );

  /** Registrera en händelse för arrangörsstatistiken. */
  const track = useCallback((eventId: string, key: StatKey, amount = 1) => {
    // Visningar räknas bara i databasen (unika besökare). Att räkna dem lokalt
    // gav en uppblåst siffra vid varje sidladdning och omrendering.
    if (key === "views") return;
    setState((s) => {
      const cur = s.stats[eventId] ?? {};
      return {
        ...s,
        stats: { ...s.stats, [eventId]: { ...cur, [key]: (cur[key] ?? 0) + amount } },
      };
    });
  }, []);

  const reset = useCallback(() => setState(initial()), []);

  const interestedCount = useCallback(
    (e: EventItem) => e.interested.length + (state.interested.includes(e.id) ? 1 : 0),
    [state.interested],
  );

  /** Personer du följer som är intresserade av eventet. */
  const followingInterested = useCallback(
    (e: EventItem) => e.interested.filter((u) => state.following.includes(u)),
    [state.following],
  );

  /** Basstatistik + det som registrerats i appen. */
  const eventStats = useCallback(
    (e: EventItem): EventStats => {
      const extra = state.stats[e.id] ?? {};
      const base = baseStats(e);
      const mine = {
        saves: state.saved.includes(e.id) ? 1 : 0,
        interested: state.interested.includes(e.id) ? 1 : 0,
      };
      return {
        // Antalet unika besökare hämtas från databasen (event_view_counts) –
        // aldrig från lokal statistik eller påhittade basvärden.
        views: 0,
        clicks: base.clicks + (extra.clicks ?? 0),
        saves: base.saves + (extra.saves ?? 0) + mine.saves,
        interested: base.interested + mine.interested,
        shares: base.shares + (extra.shares ?? 0),
        plans: base.plans + (extra.plans ?? 0),
      };
    },
    [state.stats, state.saved, state.interested],
  );

  /** Räknar om avståndet från användarens position när den är känd. */
  const withDistance = useCallback(
    <T extends { lat?: number | undefined; lng?: number | undefined; distance: number }>(
      item: T,
    ): T => {
      if (!userLocation) return item;
      const geo = geoOf(item);
      if (!geo) return item;
      const distance = distanceKm(userLocation, geo);
      return distance === item.distance ? item : { ...item, distance };
    },
    [userLocation],
  );

  // Allt appen känner till: lokala (privata) event, publika event från
  // databasen (både de som syns och ägarens egna) och event från Visit
  // Stockholm – utan dubbletter.
  const allEvents = useMemo(() => {
    const seen = new Set<string>();
    return [...state.events, ...cloudEvents, ...myCloudEvents, ...apiEvents]
      .filter((event) => {
        if (seen.has(event.id)) return false;
        seen.add(event.id);
        return true;
      })
      .map(withDistance);
  }, [state.events, cloudEvents, myCloudEvents, apiEvents, withDistance]);

  // Publika ytor (karta, listor, sök) visar bara event som inte är avslutade.
  // Databasen filtrerar redan de egna eventen; här fångas även event från
  // Visit Stockholm med samma regel.
  const publicEvents = useMemo(
    () =>
      allEvents.filter(
        (e) => e.visibility === "public" && e.status === "approved" && isEventVisible(e),
      ),
    [allEvents],
  );

  const sponsoredEvents = useMemo(
    () => publicEvents.filter((e) => e.sponsored || e.promoted),
    [publicEvents],
  );

  /** Egna event, inklusive de som väntar på granskning eller avvisats. */
  const myEvents = useMemo(
    () => allEvents.filter((e) => e.organizerId === me),
    [allEvents, me],
  );

  /** Moderatorernas kö – endast synlig för dem tack vare RLS. */
  const pendingPublicEvents = useMemo(
    () => cloudEvents.filter((e) => e.visibility === "public" && e.status === "pending"),
    [cloudEvents],
  );

  const myPrivateEvents = useMemo(
    () =>
      state.events.filter(
        (e) =>
          e.visibility === "private" &&
          (e.organizerId === me || (e.invites ?? []).some((i) => i.userId === me)),
      ),
    [state.events, me],
  );

  /** Alla permanenta platser som får visas publikt (mockdata + godkända förslag). */
  const places = useMemo(
    () =>
      [...PLACES, ...state.placeSuggestions.filter((p) => p.status === "approved")].map(
        withDistance,
      ),
    [state.placeSuggestions, withDistance],
  );

  const pendingPlaces = useMemo(
    () => state.placeSuggestions.filter((p) => p.status === "pending"),
    [state.placeSuggestions],
  );

  /** Statiska mocknotiser + notiser som genereras av appens eget innehåll. */
  const notifications = useMemo<Notification[]>(() => {
    const dynamic: Notification[] = [];

    for (const plan of state.plans) {
      const mine =
        plan.createdBy === me || plan.createdBy === ME || plan.createdBy.toLowerCase() === "du";
      if (mine && plan.replies.length > 0) {
        const last = plan.replies[plan.replies.length - 1];
        dynamic.push({
          id: `pl-reply-${plan.id}-${plan.replies.length}`,
          kind: "plan",
          text: `💬 ${last?.name ?? "Någon"} svarade på din plan "${plan.title}".`,
          time: "nyss",
        });
      }
      if (!mine) {
        dynamic.push({
          id: `pl-new-${plan.id}`,
          kind: "plan",
          text: `🗓️ ${plan.createdBy} skapade planen "${plan.title}".`,
          time: "nyligen",
        });
      }
    }

    for (const e of state.events) {
      if (!state.saved.includes(e.id)) continue;
      if (e.date !== TODAY || hasEnded(e)) continue;
      dynamic.push({
        id: `save-soon-${e.id}`,
        kind: "reminder",
        text: `⏰ Sparat: ${e.name} börjar ${e.start} idag.`,
        time: "idag",
        eventId: e.id,
      });
    }

    return [...dynamic, ...NOTIFICATIONS];
  }, [state.plans, state.events, state.saved, me]);

  const unreadNotifications = notifications.filter(
    (n) =>
      !state.readNotifications.includes(n.id) &&
      (n.kind === "system" || state.notifSettings[n.kind]),
  ).length;

  return {
    ...state,
    hydrated,
    patch,
    account,
    authChecked,
    userLocation,
    locationStatus,
    askForLocation,
    me,
    events: allEvents,
    publicEvents,
    sponsoredEvents,
    myEvents,
    pendingPublicEvents,
    isModerator: Boolean(account?.isModerator),
    refreshCloudEvents,
    reviewPublicEvent,
    sponsorEvent,
    updatePublicEvent,
    myPrivateEvents,
    apiEvents,
    apiLoading,
    apiError,
    places,
    pendingPlaces,
    unreadNotifications,
    toggleSaved,
    toggleSavedPlace,
    toggleInterested,
    toggleFollow,
    persistPrivateEvent,
    // Skapa event kräver inloggat konto (datalager-skydd – speglar kravet i
    // UI och på sidan /skapa). Utan session skrivs inget in.
    addEvent,
    loadPrivateEventInvite,
    loadPrivateEventInvites,
    addPrivateEvent,
    replyToPrivateEvent,
    loadPrivateEventGuests,
    deleteEvent,
    /** Antal event kontot har skapat (privata + publika) – max 5 tillåts. */
    createdEventCount: myEvents.length,
    updateEvent,
    setStatus,
    setInviteStatus,
    removeInvite,
    setNotifSettings,
    markNotificationsRead,
    addPlaceSuggestion,
    setPlaceStatus,
    addPlan,
    updatePlan,
    deletePlan,
    addReply,
    reset,
    interestedCount,
    followingInterested,
    track,
    eventStats,
    feed: FEED,
    notifications,
  };
}

export function HanderProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue();
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useHander() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useHander måste användas inuti HanderProvider");
  return ctx;
}

// ---------- Filter ----------

export type DateFilter = "alla" | "nu" | "idag" | "helg";
export type PriceFilter = "alla" | "gratis" | "under100";
export type VisibilityFilter = "alla" | "public" | "private";
export type TimeFilter = "alla" | "morgon" | "eftermiddag" | "kvall" | "sent";
export type SortMode = "relevans" | "avstand" | "tid" | "popularitet";

export const TIME_RANGES: Record<
  Exclude<TimeFilter, "alla">,
  { label: string; from: number; to: number }
> = {
  morgon: { label: "Morgon (06–12)", from: 6 * 60, to: 12 * 60 },
  eftermiddag: { label: "Eftermiddag (12–17)", from: 12 * 60, to: 17 * 60 },
  kvall: { label: "Kväll (17–23)", from: 17 * 60, to: 23 * 60 },
  sent: { label: "Sent (23–06)", from: 23 * 60, to: 30 * 60 },
};

export type Filters = {
  categories: string[];
  date: DateFilter;
  time: TimeFilter;
  price: PriceFilter;
  visibility: VisibilityFilter;
  maxDistance: number;
  query: string;
};

export const defaultFilters: Filters = {
  categories: [],
  date: "alla",
  time: "alla",
  price: "alla",
  visibility: "alla",
  maxDistance: 25,
  query: "",
};

export function activeFilterCount(f: Filters) {
  let n = f.categories.length;
  if (f.date !== "alla") n++;
  if (f.time !== "alla") n++;
  if (f.price !== "alla") n++;
  if (f.visibility !== "alla") n++;
  if (f.maxDistance < 25) n++;
  return n;
}

const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Har eventet redan slutat? Temporära pins försvinner efter sluttid. */
export function hasEnded(e: EventItem, now = new Date()) {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  if (e.date > today) return false;
  if (e.date < today) return true;
  const end = minutes(e.end);
  const start = minutes(e.start);
  // sluttid tidigare på dygnet än starttid = eventet går över midnatt
  if (end < start) return false;
  return now.getHours() * 60 + now.getMinutes() > end;
}

export function isHappeningNow(e: EventItem, now = new Date()) {
  if (e.date !== TODAY) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const s = minutes(e.start);
  const en = minutes(e.end);
  return en < s ? cur >= s || cur <= en : cur >= s && cur <= en;
}

export function filterEvents(events: EventItem[], f: Filters) {
  const weekend = weekendDates();
  return events.filter((e) => {
    // Samma regel som databasvyn: eventet syns till 3 h efter slut (4 h efter
    // start utan sluttid), inte bara fram till sluttiden.
    if (!isEventVisible(e)) return false;
    if (f.categories.length && !f.categories.includes(e.category)) return false;
    if (f.date === "idag" && e.date !== TODAY) return false;
    if (f.date === "nu" && !isHappeningNow(e)) return false;
    if (f.date === "helg" && !weekend.includes(e.date)) return false;
    if (f.time !== "alla") {
      const r = TIME_RANGES[f.time];
      let start = minutes(e.start);
      if (f.time === "sent" && start < 6 * 60) start += 24 * 60;
      if (start < r.from || start >= r.to) return false;
    }
    if (f.price === "gratis" && e.price !== 0) return false;
    if (f.price === "under100" && e.price >= 100) return false;
    if (f.visibility !== "alla" && e.visibility !== f.visibility) return false;
    if (e.distance > f.maxDistance) return false;
    if (f.query) {
      const q = f.query.toLowerCase();
      const hay = `${e.name} ${e.place} ${e.category} ${e.description}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function sortEvents(events: EventItem[], mode: SortMode = "relevans") {
  const arr = [...events];
  if (mode === "avstand") return arr.sort((a, b) => a.distance - b.distance);
  if (mode === "popularitet") return arr.sort((a, b) => b.interested.length - a.interested.length);
  if (mode === "tid") return arr.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return arr.sort((a, b) => {
    const aSponsored = Boolean(a.sponsored || a.promoted);
    const bSponsored = Boolean(b.sponsored || b.promoted);
    if (aSponsored !== bSponsored) return bSponsored ? 1 : -1;
    const t = (a.date + a.start).localeCompare(b.date + b.start);
    if (t !== 0) return t;
    return b.interested.length - a.interested.length;
  });
}

export function formatDay(date: string) {
  if (date === TODAY) return "Idag";
  const d = new Date(date + "T12:00:00");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (
    date ===
    `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`
  )
    return "Imorgon";
  return d.toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" });
}
