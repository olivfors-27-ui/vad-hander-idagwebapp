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
import { DEMO_PLAN_GRADIENT, DEMO_PLAN_NOTE, uid, type Plan, type PlanReply } from "./hander-plans";
import { fetchVisitStockholmEvents } from "./visitstockholm";
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
  events: EVENTS.map((e) => ({ ...e })),
  saved: ["e1", "e7"],
  savedPlaces: ["pl1"],
  interested: ["e2"],
  following: [...INITIAL_FOLLOWING],
  notifSettings: { nearby: true, follow: true, reminder: true, social: true, plan: true },
  readNotifications: [],
  plans: [
    {
      id: "demo-inbjudan",
      code: "DEMOEV1",
      title: "Demoevent 1",
      note: DEMO_PLAN_NOTE,
      createdBy: "Demoeventkompis 1",
      createdAt: new Date().toISOString(),
      options: [
        {
          id: "demo-inbjudan-option",
          title: "Demoevent 1",
          subtitle: "Demoeventplatsen · Idag 19:00",
          emoji: "🎉",
          gradient: "linear-gradient(135deg,#E45048,#E7A057)",
          eventId: "demoevent-1",
        },
      ],
      slots: [{ id: "demo-inbjudan-slot", label: "Idag 19:00–23:00", date: TODAY, start: "19:00", end: "23:00", kind: "range" }],
      replies: [],
      emoji: "🎉",
      gradient: DEMO_PLAN_GRADIENT,
      place: "Demoeventplatsen",
      eventId: "demoevent-1",
    },
  ],
  placeSuggestions: [],
  stats: {},
});

type Ctx = ReturnType<typeof useStoreValue>;
const StoreContext = createContext<Ctx | null>(null);

function useStoreValue() {
  const [state, setState] = useState<Persisted>(initial);
  const [hydrated, setHydrated] = useState(false);
  const [apiEvents, setApiEvents] = useState<EventItem[]>([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Persisted;
        setState((s) => {
          const storedEvents = Array.isArray(parsed.events) ? parsed.events : [];
          const mergedEvents = [...storedEvents];
          for (const demo of EVENTS) {
            if (!mergedEvents.some((event) => event.id === demo.id)) mergedEvents.push({ ...demo });
          }
          const storedPlans = Array.isArray(parsed.plans) ? parsed.plans : [];
          const demoPlan = initial().plans[0];
          const mergedPlans =
            storedPlans.some((plan) => plan.id === "demo-inbjudan") || !demoPlan
              ? storedPlans
              : [...storedPlans, demoPlan];
          const normalizedPlans = mergedPlans.map((plan) =>
            plan.id === "demo-inbjudan" ? { ...plan, note: DEMO_PLAN_NOTE } : plan,
          );
          return { ...s, ...parsed, events: mergedEvents, plans: normalizedPlans };
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
    fetchVisitStockholmEvents(controller.signal)
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

  const toggleFollow = useCallback(
    (userId: string) =>
      setState((s) => ({
        ...s,
        following: s.following.includes(userId)
          ? s.following.filter((x) => x !== userId)
          : [...s.following, userId],
      })),
    [],
  );

  const addEvent = useCallback((e: EventItem) => {
    setState((s) => ({ ...s, events: [e, ...s.events] }));
  }, []);

  const updateEvent = useCallback((id: string, p: Partial<EventItem>) => {
    setState((s) => ({
      ...s,
      events: s.events.map((e) => (e.id === id ? { ...e, ...p } : e)),
    }));
  }, []);

  const setStatus = useCallback(
    (id: string, status: EventStatus, rejectionReason?: string | undefined) =>
      updateEvent(id, { status, rejectionReason }),
    [updateEvent],
  );

  const setInviteStatus = useCallback(
    (eventId: string, userId: string, status: InviteStatus) => {
      setState((s) => ({
        ...s,
        events: s.events.map((e) => {
          if (e.id !== eventId) return e;
          const invites = e.invites ?? [];
          const exists = invites.some((i) => i.userId === userId);
          return {
            ...e,
            invites: exists
              ? invites.map((i) => (i.userId === userId ? { ...i, status } : i))
              : [...invites, { userId, status }],
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
        e.id === eventId ? { ...e, invites: (e.invites ?? []).filter((i) => i.userId !== userId) } : e,
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

  const addReply = useCallback(
    (planId: string, reply: Omit<PlanReply, "id" | "at">) => {
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
    },
    [],
  );

  const addPlaceSuggestion = useCallback(
    (p: Place) =>
      setState((s) => ({ ...s, placeSuggestions: [{ ...p, status: "pending" }, ...s.placeSuggestions] })),
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
        views: base.views + (extra.views ?? 0),
        clicks: base.clicks + (extra.clicks ?? 0),
        saves: base.saves + (extra.saves ?? 0) + mine.saves,
        interested: base.interested + mine.interested,
        shares: base.shares + (extra.shares ?? 0),
        plans: base.plans + (extra.plans ?? 0),
      };
    },
    [state.stats, state.saved, state.interested],
  );

  const publicEvents = useMemo(
    () => [
      ...state.events.filter((e) => e.visibility === "public" && e.status === "approved"),
      ...apiEvents,
    ],
    [state.events, apiEvents],
  );

  const myPrivateEvents = useMemo(
    () =>
      state.events.filter(
        (e) =>
          e.visibility === "private" &&
          (e.organizerId === ME || (e.invites ?? []).some((i) => i.userId === ME)),
      ),
    [state.events],
  );

  /** Alla permanenta platser som får visas publikt (mockdata + godkända förslag). */
  const places = useMemo(
    () => [...PLACES, ...state.placeSuggestions.filter((p) => p.status === "approved")],
    [state.placeSuggestions],
  );

  const pendingPlaces = useMemo(
    () => state.placeSuggestions.filter((p) => p.status === "pending"),
    [state.placeSuggestions],
  );

  /** Statiska mocknotiser + notiser som genereras av appens eget innehåll. */
  const notifications = useMemo<Notification[]>(() => {
    const dynamic: Notification[] = [];

    for (const plan of state.plans) {
      const mine = plan.createdBy === ME || plan.createdBy.toLowerCase() === "du";
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
  }, [state.plans, state.events, state.saved]);

  const unreadNotifications = notifications.filter(
    (n) => !state.readNotifications.includes(n.id) && (n.kind === "system" || state.notifSettings[n.kind]),
  ).length;


  return {
    ...state,
    hydrated,
    patch,
    events: [...state.events, ...apiEvents],
    publicEvents,
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
    addEvent,
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

export const TIME_RANGES: Record<Exclude<TimeFilter, "alla">, { label: string; from: number; to: number }> = {
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
    if (hasEnded(e)) return false;
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
  if (mode === "tid")
    return arr.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return arr.sort((a, b) => {
    if (!!b.promoted !== !!a.promoted) return b.promoted ? 1 : -1;
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
  if (date === `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`)
    return "Imorgon";
  return d.toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" });
}
