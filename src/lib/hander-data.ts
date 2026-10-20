// Mock data för Händer-prototypen. All data är fiktiv.

export type CategoryId =
  | "musik"
  | "fest"
  | "student"
  | "sport"
  | "mat"
  | "kultur"
  | "shopping"
  | "plugg"
  | "utomhus"
  | "ovrigt";

export type Category = {
  id: CategoryId;
  label: string;
  emoji: string;
};

export const CATEGORIES: Category[] = [
  { id: "musik", label: "Musik", emoji: "🎵" },
  { id: "fest", label: "Fest", emoji: "🎉" },
  { id: "student", label: "Student", emoji: "🎓" },
  { id: "sport", label: "Sport", emoji: "🏀" },
  { id: "mat", label: "Mat", emoji: "🍔" },
  { id: "kultur", label: "Kultur", emoji: "🎨" },
  { id: "shopping", label: "Shopping", emoji: "🛍" },
  { id: "plugg", label: "Plugg", emoji: "📚" },
  { id: "utomhus", label: "Utomhus", emoji: "🌳" },
  { id: "ovrigt", label: "Övrigt", emoji: "✨" },
];

export const categoryById = (id: CategoryId): Category =>
  CATEGORIES.find((c) => c.id === id) ?? (CATEGORIES[CATEGORIES.length - 1] as Category);

export type PlaceType =
  | "cafe"
  | "forening"
  | "gym"
  | "restaurang"
  | "scen"
  | "plugg"
  | "sport"
  | "karaoke"
  | "klattring"
  | "hoghojd"
  | "escape"
  | "gokart"
  | "keramik"
  | "bad"
  | "utsikt"
  | "gomd";

export const PLACE_TYPES: Record<PlaceType, { label: string; emoji: string; color: string }> = {
  cafe: { label: "Café", emoji: "☕️", color: "#B45309" },
  forening: { label: "Studentförening", emoji: "🏛", color: "#7C3AED" },
  gym: { label: "Gym", emoji: "🏋️", color: "#0F766E" },
  restaurang: { label: "Restaurang", emoji: "🍽", color: "#B91C1C" },
  scen: { label: "Scen", emoji: "🎤", color: "#DB2777" },
  plugg: { label: "Pluggplats", emoji: "📖", color: "#2563EB" },
  sport: { label: "Sportanläggning", emoji: "⚽️", color: "#15803D" },
  karaoke: { label: "Karaoke", emoji: "🎙", color: "#DB2777" },
  klattring: { label: "Klättring", emoji: "🧗", color: "#EA580C" },
  hoghojd: { label: "Höghöjdsbana", emoji: "🌲", color: "#166534" },
  escape: { label: "Escape room", emoji: "🗝", color: "#4338CA" },
  gokart: { label: "Gokart", emoji: "🏎", color: "#DC2626" },
  keramik: { label: "Keramikstudio", emoji: "🏺", color: "#A16207" },
  bad: { label: "Badplats", emoji: "🏊", color: "#0284C7" },
  utsikt: { label: "Utsiktsplats", emoji: "🌅", color: "#C2410C" },
  gomd: { label: "Gömd pärla", emoji: "💎", color: "#0891B2" },
};

/** Permanenta upptäckter – det som inte är vanliga caféer/restauranger. */
export const DISCOVERY_TYPES: PlaceType[] = [
  "karaoke",
  "klattring",
  "hoghojd",
  "escape",
  "gokart",
  "keramik",
  "bad",
  "utsikt",
  "gomd",
];

export type User = {
  id: string;
  name: string;
  username: string;
  bio: string;
  avatar: string; // emoji
  color: string; // hsl-ish token color
  followers: number;
  following: number;
  organizer?: boolean | undefined;
  verified?: boolean | undefined;
};

export type EventStatus = "pending" | "approved" | "rejected";
export type Visibility = "public" | "private";
export type InviteStatus = "invited" | "accepted" | "maybe" | "declined";

export type EventItem = {
  id: string;
  name: string;
  category: CategoryId;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
  place: string;
  address: string;
  price: number; // 0 = gratis
  /** Om priset faktiskt bekräftats av källan; saknas för äldre lokal data. */
  priceKnown?: boolean | undefined;
  description: string;
  /** Egen omslagsbild (data-URL eller länk). Saknas den används kategorins gradient. */
  image?: string | undefined;
  /** Extern källa, exempelvis Visit Stockholms arrangörslänk. */
  sourceUrl?: string | undefined;
  organizerId: string;
  /**
   * Arrangörens visningsnamn från det inloggade kontot som skapade eventet.
   * Visas som "inbjudare"/arrangör – fylls alltid i vid skapande så att
   * ingen inbjudan någonsin visar "Okänd" för en riktig användare.
   */
  organizerName?: string | undefined;
  interested: string[]; // user ids
  visibility: Visibility;
  status: EventStatus;
  rejectionReason?: string | undefined;
  /** Betald sponsringsplacering. Kräver godkänt event och sparas i databasen. */
  sponsored?: boolean | undefined;
  /** Äldre fält för sponsrad placering – speglas från `sponsored`. */
  promoted?: boolean | undefined;
  reported?: number | undefined;
  /** Geokodad position. Saknas den får eventet ingen nål på kartan. */
  lat?: number | undefined;
  lng?: number | undefined;
  distance: number; // km
  inviteCode?: string | undefined;
  invites?: { userId: string; status: InviteStatus; name?: string | undefined }[] | undefined;
};

export type Place = {
  id: string;
  name: string;
  type: PlaceType;
  description: string;
  address: string;
  lat?: number | undefined;
  lng?: number | undefined;
  distance: number;
  /** Öppettider, t.ex. "12–23" */
  open: string;
  /** Prisbild, t.ex. "från 195 kr/person" */
  price?: string | undefined;
  /** Telefon, mejl eller webbadress */
  contact?: string | undefined;
  link?: string | undefined;
  /** Status för användarförslag: godkända platser visas på kartan */
  status?: EventStatus | undefined;
  suggestedBy?: string | undefined;
};

const pad = (n: number) => String(n).padStart(2, "0");
export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const base = new Date();
base.setHours(12, 0, 0, 0);
const dayOffset = (n: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

export const TODAY = dayOffset(0);
export const TOMORROW = dayOffset(1);

/** Nästa lördag och söndag (helg). */
export function weekendDates(): string[] {
  const out: string[] = [];
  for (let i = 0; i < 8; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const day = d.getDay();
    if (day === 6 || day === 0) out.push(toISODate(d));
  }
  return out.slice(0, 2);
}

/** Ingen demodata: en ny användare börjar helt tomt. Kontakter skapas via riktiga konton. */
export const USERS: User[] = [];

const UNKNOWN_USER: User = {
  id: "unknown",
  name: "Okänd användare",
  username: "@okand",
  bio: "",
  avatar: "👤",
  color: "#8C7A6B",
  followers: 0,
  following: 0,
};

/** Slå upp användare; okända id:n (t.ex. riktiga konton) får en neutral fallback. */
export const userById = (id: string, displayName?: string): User => {
  if (!id || id === ME) {
    return { ...UNKNOWN_USER, id: ME, name: displayName ?? "Okänd användare" };
  }
  const match = USERS.find((u) => u.id === id);
  if (match) return match;
  return {
    ...UNKNOWN_USER,
    id,
    name: displayName ?? UNKNOWN_USER.name,
    avatar: displayName ? "🧑" : UNKNOWN_USER.avatar,
  };
};
export const ME = "me";
/** Ingen följs från start. */
export const INITIAL_FOLLOWING: string[] = [];

/** Ingen demodata: events skapas av riktiga användare eller hämtas från riktiga källor. */
export const EVENTS: EventItem[] = [];

/** Inga demoplatser. Platser läggs till via förslag med riktig adress. */
export const PLACES: Place[] = [];

/** Startvy för kartan (Stockholm) tills användarens position är känd. */
export const MAP_CENTER = { lat: 59.3293, lng: 18.0686 };

/** Har objektet giltiga geografiska koordinater? Endast då får det en nål. */
export const hasGeo = (item: { lat?: number | undefined; lng?: number | undefined }): boolean =>
  typeof item.lat === "number" &&
  typeof item.lng === "number" &&
  Number.isFinite(item.lat) &&
  Number.isFinite(item.lng);

/** Koordinater för ett event/en plats. Returnerar null utan giltig geokodning. */
export const geoOf = (item: { lat?: number | undefined; lng?: number | undefined }) =>
  hasGeo(item) ? { lat: item.lat as number, lng: item.lng as number } : null;

export type Notification = {
  id: string;
  kind: "nearby" | "follow" | "reminder" | "social" | "plan" | "system";
  text: string;
  time: string;
  eventId?: string | undefined;
};

/** Ingen mockad notisdata. */
export const NOTIFICATIONS: Notification[] = [];

export type FeedItem = {
  id: string;
  userId?: string | undefined;
  text: string;
  time: string;
  eventId?: string | undefined;
};

/** Ingen mockad flödesdata. */
export const FEED: FeedItem[] = [];

/** Solid färg per kategori – används bl.a. för kartpins. */
export const CATEGORY_COLOR: Record<CategoryId, string> = {
  musik: "#D4A017", // guld
  fest: "#E66A9B", // rosa
  student: "#3157C8", // blå
  sport: "#E4473D", // röd
  mat: "#278A52", // grön
  kultur: "#7938B8", // lila
  shopping: "#737780", // grå
  plugg: "#E87524", // orange
  utomhus: "#62BDEB", // ljusblå
  ovrigt: "#242424", // svart
};

/** Färgtema per kategori för omslagsbilder. */
export const CATEGORY_GRADIENT: Record<CategoryId, string> = {
  musik: "linear-gradient(135deg,#E57657,#EAB24F)",
  fest: "linear-gradient(135deg,#E45048,#E7A057)",
  student: "linear-gradient(135deg,#E7A057,#EAB24F)",
  sport: "linear-gradient(135deg,#627BD8,#627BD8)",
  mat: "linear-gradient(135deg,#E57657,#EAB24F)",
  kultur: "linear-gradient(135deg,#465BC4,#E57657)",
  shopping: "linear-gradient(135deg,#627BD8,#D7DDF5)",
  plugg: "linear-gradient(135deg,#465BC4,#D7DDF5)",
  utomhus: "linear-gradient(135deg,#627BD8,#D7DDF5)",
  ovrigt: "linear-gradient(135deg,#E57657,#F7E5D5)",
};

/** Kort dagsetikett, t.ex. "Idag", "Imorgon", "fre 29 aug". */
export function formatShortDay(date: string): string {
  if (date === TODAY) return "Idag";
  if (date === TOMORROW) return "Imorgon";
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" });
}

// ---------- Statistik för arrangörer ----------

export type StatKey = "views" | "clicks" | "saves" | "interested" | "shares" | "plans";

export type EventStats = Record<StatKey, number>;

export const STAT_LABELS: Record<StatKey, string> = {
  views: "Visningar",
  clicks: "Klick",
  saves: "Sparningar",
  interested: "Intresserade",
  shares: "Delningar",
  plans: "Planer skapade",
};

const hashString = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return h;
};

/** Deterministisk basstatistik så prototypen visar trovärdiga siffror. */
export function baseStats(e: EventItem): EventStats {
  const h = hashString(e.id);
  const interest = e.interested.length;
  const views = 60 + (h % 540) + interest * 18;
  return {
    views,
    clicks: Math.round(views * (0.2 + (h % 17) / 100)),
    saves: Math.round(views * 0.06) + (h % 7),
    interested: interest,
    shares: Math.round(views * 0.03) + (h % 4),
    plans: Math.max(0, Math.round(interest / 2) + (h % 3) - 1),
  };
}
