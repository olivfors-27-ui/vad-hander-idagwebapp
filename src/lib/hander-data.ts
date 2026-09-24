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
  interested: string[]; // user ids
  visibility: Visibility;
  status: EventStatus;
  rejectionReason?: string | undefined;
  promoted?: boolean | undefined;
  reported?: number | undefined;
  /** Geokodad position. Saknas den får eventet ingen nål på kartan. */
  lat?: number | undefined;
  lng?: number | undefined;
  distance: number; // km
  inviteCode?: string | undefined;
  invites?: { userId: string; status: InviteStatus }[] | undefined;
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

export const USERS: User[] = [
  {
    id: "demoeventkompis1",
    name: "Demoeventkompis 1",
    username: "@demoeventkompis1",
    bio: "Testkompis som skickar demoevent.",
    avatar: "🎈",
    color: "#E57657",
    followers: 12,
    following: 3,
  },
  {
    id: "u1",
    name: "Du",
    username: "@dumig",
    bio: "Pluggar i Lindstad. Alltid sugen på något som händer.",
    avatar: "🙂",
    color: "#E57657",
    followers: 128,
    following: 96,
  },
  {
    id: "u2",
    name: "Emma Lindqvist",
    username: "@emmalind",
    bio: "Ekonom, kaffeberoende, arrangerar förfester.",
    avatar: "🦊",
    color: "#E7A057",
    followers: 842,
    following: 311,
  },
  {
    id: "u3",
    name: "Lucas Berg",
    username: "@lucasb",
    bio: "Basket & grillfester 🏀",
    avatar: "🐻",
    color: "#627BD8",
    followers: 431,
    following: 208,
  },
  {
    id: "u4",
    name: "Nora Åkesson",
    username: "@noraa",
    bio: "Konst, poesi och långa promenader.",
    avatar: "🐧",
    color: "#EAB24F",
    followers: 1290,
    following: 140,
  },
  {
    id: "u5",
    name: "Ali Hassan",
    username: "@alih",
    bio: "DJ på fritiden. Musik > allt.",
    avatar: "🎧",
    color: "#465BC4",
    followers: 2100,
    following: 402,
  },
  {
    id: "u6",
    name: "Saga Nyström",
    username: "@sagan",
    bio: "Studentkåren. Fixar kårkvällar.",
    avatar: "🐝",
    color: "#E57657",
    followers: 610,
    following: 187,
  },
  {
    id: "u7",
    name: "Campus Events",
    username: "@campusevents",
    bio: "Officiella eventarrangören på Lindstads universitet.",
    avatar: "🎪",
    color: "#E45048",
    followers: 234,
    following: 12,
    organizer: true,
    verified: true,
  },
  {
    id: "u8",
    name: "Kulturhuset Vågen",
    username: "@vagen",
    bio: "Scen, konst och klubb mitt i stan.",
    avatar: "🌊",
    color: "#465BC4",
    followers: 1875,
    following: 44,
    organizer: true,
    verified: true,
  },
];

export const userById = (id: string): User => USERS.find((u) => u.id === id) ?? (USERS[0] as User);
export const ME = "u1";
/** Personer som "du" följer från start. */
export const INITIAL_FOLLOWING = ["u2", "u3", "u5", "u7"];

const ME_USER_ID = "u1";

/** Inbjudan via länk i demon – visar hur inbjudna event ser ut för en gäst. */
const DEMO_INVITED_EVENT: EventItem = {
  id: "demoevent-1",
  name: "Demoevent 1",
  category: "fest",
  date: TODAY,
  start: "19:00",
  end: "23:00",
  place: "Demoeventplatsen",
  address: "Demovägen 1, Stockholm",
  price: 0,
  description: "Ett demoevent du är inbjuden till via länk.",
  image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=82",
  organizerId: "demoeventkompis1",
  interested: ["u2", "u5"],
  visibility: "private",
  status: "approved",
  inviteCode: "DEMOEV1",
  invites: [{ userId: ME_USER_ID, status: "invited" }],
  distance: 1.4,
};

/** Ett litet lokalt exempel så att Mina event och Inbjudna events aldrig känns tomma i testläget. */
export const EVENTS: EventItem[] = [
  DEMO_INVITED_EVENT,
  {
    id: "demo-mysig-kvall",
    name: "Mysig kväll vid vattnet",
    category: "utomhus",
    date: TODAY,
    start: "18:30",
    end: "21:00",
    place: "Mysig kväll vid vattnet",
    address: "Norr Mälarstrand, Stockholm",
    price: 0,
    description: "Ett enkelt exempel-event för att testa hur egna event visas i appen.",
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=82",
    organizerId: "u1",
    interested: ["u2", "u3"],
    visibility: "public",
    status: "approved",
    lat: 59.3298,
    lng: 18.0353,
    distance: 2.1,
  },
];

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

export const NOTIFICATIONS: Notification[] = [
  {
    id: "n2",
    kind: "follow",
    text: "Emma skapade ett nytt event: Mysig kväll vid vattnet.",
    time: "1 tim sedan",
    eventId: "demo-mysig-kvall",
  },
  {
    id: "n4",
    kind: "reminder",
    text: "⏰ Mysig kväll vid vattnet börjar 18:30 idag.",
    time: "3 tim sedan",
    eventId: "demo-mysig-kvall",
  },
  {
    id: "n5",
    kind: "social",
    text: "🎉 5 personer du följer är intresserade av Mysig kväll vid vattnet.",
    time: "igår",
    eventId: "demo-mysig-kvall",
  },
];

export type FeedItem = {
  id: string;
  userId?: string | undefined;
  text: string;
  time: string;
  eventId?: string | undefined;
};

export const FEED: FeedItem[] = [
  { id: "f1", userId: "u2", text: "Emma skapade ett event", time: "35 min", eventId: "e20" },
  { id: "f2", userId: "u3", text: "Lucas är intresserad av Studentpub", time: "1 tim", eventId: "e2" },
  { id: "f3", text: "3 personer du följer är intresserade av Live på Campus", time: "2 tim", eventId: "e1" },
  { id: "f4", userId: "u5", text: "Ali spelar på Studentfest på Vågen", time: "4 tim", eventId: "e3" },
  { id: "f5", userId: "u7", text: "Campus Events skapade ett event", time: "igår", eventId: "e18" },
  { id: "f6", text: "4 personer du följer sparade Foodtruck-festival", time: "igår", eventId: "e7" },
];

/** Solid färg per kategori – används bl.a. för kartpins. */
export const CATEGORY_COLOR: Record<CategoryId, string> = {
  musik: "#E45048",
  fest: "#E57657",
  student: "#E7A057",
  sport: "#627BD8",
  mat: "#EAB24F",
  kultur: "#465BC4",
  shopping: "#627BD8",
  plugg: "#465BC4",
  utomhus: "#627BD8",
  ovrigt: "#E57657",
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
    clicks: Math.round(views * (0.2 + ((h % 17) / 100))),
    saves: Math.round(views * 0.06) + (h % 7),
    interested: interest,
    shares: Math.round(views * 0.03) + (h % 4),
    plans: Math.max(0, Math.round(interest / 2) + (h % 3) - 1),
  };
}
