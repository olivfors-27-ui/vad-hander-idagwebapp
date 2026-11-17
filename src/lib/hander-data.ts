// Mock data för Tagalong-prototypen. All data är fiktiv.

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
  | "gomd"
  | "museum"
  | "park"
  | "sevardhet"
  | "aktivitet";

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
  museum: { label: "Museum", emoji: "🏛️", color: "#6D28D9" },
  park: { label: "Park", emoji: "🌳", color: "#166534" },
  sevardhet: { label: "Sevärdhet", emoji: "📍", color: "#0369A1" },
  aktivitet: { label: "Aktivitet", emoji: "🎯", color: "#B45309" },
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
  invites?:
    | {
        userId: string;
        status: InviteStatus;
        name?: string | undefined;
        /** Vad gästen angav för intressen – syns för alla som är med. */
        interests?: string[] | undefined;
      }[]
    | undefined;
  /** Antal deltagare (kommer + kanske) på ett privat event. */
  guestCount?: number | undefined;
};

/** Arrangörs-id för event som hämtats från Visit Stockholms öppna API. */
export const STOCKHOLM_API_ORGANIZER = "visit-stockholm";

/** True för event som kommer från Stockholms stads event-API. */
export const isStockholmApiEvent = (event: Pick<EventItem, "organizerId">) =>
  event.organizerId === STOCKHOLM_API_ORGANIZER;

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

/**
 * Fasta Stockholmplatser som alltid finns på kartan – grundutbudet vid sidan av
 * platserna som hämtas från Visit Stockholms API (src/lib/visitstockholm-places.ts)
 * och de förslag användare skickar in. Avståndet räknas nedan när kartans
 * mittpunkt är känd.
 */
const CURATED_PLACES: Place[] = [
  // Museer
  { id: "p-vasamuseet", name: "Vasamuseet", type: "museum", description: "Regalskeppet Vasa från 1628 – världens mest besökta museum för ett enda skepp.", address: "Galärvarvsvägen 14, Djurgården", lat: 59.3279, lng: 18.0913, distance: 0, open: "10–17" },
  { id: "p-fotografiska", name: "Fotografiska", type: "museum", description: "Fotografiets hus vid Stadsgårdskajen med utställningar, bar och utsikt över Slussen.", address: "Stadsgårdshamnen 22", lat: 59.318, lng: 18.0847, distance: 0, open: "10–23" },
  { id: "p-moderna", name: "Moderna Museet", type: "museum", description: "Modern och samtida konst på Skeppsholmen, med skulpturpark utanför.", address: "Exercisplan 4, Skeppsholmen", lat: 59.3259, lng: 18.0841, distance: 0, open: "10–18" },
  { id: "p-nationalmuseum", name: "Nationalmuseum", type: "museum", description: "Sveriges största konstmuseum, nyrenoverat vid Blasieholmen.", address: "Södra Blasieholmshamnen 2", lat: 59.3285, lng: 18.0781, distance: 0, open: "11–17" },
  { id: "p-nordiska", name: "Nordiska museet", type: "museum", description: "Svensk kulturhistoria från 1500-talet till idag i det stora slottet på Djurgården.", address: "Djurgårdsvägen 6-16", lat: 59.3293, lng: 18.0944, distance: 0, open: "10–17" },
  { id: "p-tekniska", name: "Tekniska museet", type: "museum", description: "Uppfinningar, rymd och data – med Experimentverkstaden för den som vill prova själv.", address: "Museivägen 7", lat: 59.3327, lng: 18.1189, distance: 0, open: "10–17" },
  { id: "p-naturhistoriska", name: "Naturhistoriska riksmuseet", type: "museum", description: "Dinosaurier, valar och Cosmonova i Frescati.", address: "Frescativägen 40", lat: 59.3688, lng: 18.0535, distance: 0, open: "10–18" },
  { id: "p-skansen", name: "Skansen", type: "museum", description: "Friluftsmuseum med djur, gamla gårdar och hela Stockholm i utsikt.", address: "Djurgårdsslätten 49-51", lat: 59.3266, lng: 18.1053, distance: 0, open: "10–18" },

  // Parker
  { id: "p-djurgarden", name: "Kungliga Djurgården", type: "park", description: "Ön med museer, grönområden och promenadstråk längs vattnet.", address: "Djurgården", lat: 59.3268, lng: 18.1, distance: 0, open: "Dygnet runt" },
  { id: "p-hagaparken", name: "Hagaparken", type: "park", description: "Engelsk park med kungliga byggnader, kafé och långa grusgångar.", address: "Hagaparken, Solna", lat: 59.3627, lng: 18.0347, distance: 0, open: "Dygnet runt" },
  { id: "p-tantolunden", name: "Tantolunden", type: "park", description: "Söderns stora park med koloniträdgårdar, boulebana och badvik.", address: "Tantolunden, Södermalm", lat: 59.3131, lng: 18.0498, distance: 0, open: "Dygnet runt" },
  { id: "p-ralambshov", name: "Rålambshovsparken", type: "park", description: "Gräsplaner, strand och kvällssol vid Mälaren på Kungsholmen.", address: "Rålambshovsparken, Kungsholmen", lat: 59.3286, lng: 18.0251, distance: 0, open: "Dygnet runt" },
  { id: "p-langholmen", name: "Långholmen", type: "park", description: "Före detta fängelseö som nu är bad, picknick och promenad.", address: "Långholmen, Södermalm", lat: 59.32, lng: 18.033, distance: 0, open: "Dygnet runt" },
  { id: "p-vitabergsparken", name: "Vitabergsparken", type: "park", description: "Söders gröna vardagsrum vid Sofia kyrka med kvällssol och picknick.", address: "Vitabergsparken, Södermalm", lat: 59.312, lng: 18.09, distance: 0, open: "Dygnet runt" },

  // Utsikter
  { id: "p-monteliusvagen", name: "Monteliusvägen", type: "utsikt", description: "400 meter gångstig med Söders bästa vy mot Stadshuset och Riddarholmen.", address: "Monteliusvägen, Södermalm", lat: 59.3207, lng: 18.0605, distance: 0, open: "Dygnet runt" },
  { id: "p-skinnarviksberget", name: "Skinnarviksberget", type: "utsikt", description: "Klipphällarna på Söder – solnedgång, picknick och hela staden nedanför.", address: "Skinnarviksberget, Södermalm", lat: 59.3199, lng: 18.0508, distance: 0, open: "Dygnet runt" },
  { id: "p-fjallgatan", name: "Fjällgatan", type: "utsikt", description: "Klassisk vy över Slussen, Skeppsholmen och Djurgården.", address: "Fjällgatan, Södermalm", lat: 59.3173, lng: 18.0855, distance: 0, open: "Dygnet runt" },

  // Bad
  { id: "p-langholmsbadet", name: "Långholmens strandbad", type: "bad", description: "Sandstrand på Långholmens norra sida med brygga och gräsmatta.", address: "Långholmsmuren, Södermalm", lat: 59.3212, lng: 18.0305, distance: 0, open: "Dygnet runt" },
  { id: "p-smedsuddsbadet", name: "Smedsuddsbadet", type: "bad", description: "Familjevänlig badplats på Kungsholmen med sandstrand och gräs.", address: "Smedsuddsvägen, Kungsholmen", lat: 59.3305, lng: 18.0165, distance: 0, open: "Dygnet runt" },
  { id: "p-fredhallsbadet", name: "Fredhällsbadet", type: "bad", description: "Klippbad och strand på västra Kungsholmen med vy mot Lilla Essingen.", address: "Fredhäll, Kungsholmen", lat: 59.3303, lng: 17.9962, distance: 0, open: "Dygnet runt" },

  // Sevärdheter
  { id: "p-stadshuset", name: "Stockholms stadshus", type: "sevardhet", description: "Tegelbyggnaden vid Mälaren med Nobelfesten i Blå hallen och tornet med stadsvy.", address: "Hantverkargatan 1", lat: 59.3275, lng: 18.0545, distance: 0, open: "10–16" },
  { id: "p-slottet", name: "Kungliga slottet", type: "sevardhet", description: "Kungligt slott i Gamla stan med museum, slottskyrka och högvaktsavlösning.", address: "Slottsbacken 1", lat: 59.3264, lng: 18.0723, distance: 0, open: "10–16" },
  { id: "p-stortorget", name: "Stortorget", type: "sevardhet", description: "Gamla stans hjärta med färgade hus, julkmarknad och kaféer runt knuten.", address: "Stortorget, Gamla stan", lat: 59.3251, lng: 18.0707, distance: 0, open: "Dygnet runt" },
  { id: "p-riddarholmen", name: "Riddarholmen", type: "sevardhet", description: "Tyst ö med kyrka och adelspalats, bäst i kvällsljus över vattnet.", address: "Riddarholmen, Gamla stan", lat: 59.3247, lng: 18.0646, distance: 0, open: "Dygnet runt" },
  { id: "p-grona-lund", name: "Gröna Lund", type: "sevardhet", description: "Tivoli på Djurgården med åkattraktioner och konserter på Gröna scen.", address: "Lilla Allmänna Gränd 9", lat: 59.3235, lng: 18.0973, distance: 0, open: "Se hemsidan" },

  // Scener
  { id: "p-konserthuset", name: "Konserthuset", type: "scen", description: "Hötorgsscen där Nobelprisceremonin hålls och Konserthusets orkester spelar.", address: "Hötorget 8", lat: 59.335, lng: 18.0629, distance: 0, open: "Se hemsidan" },
  { id: "p-dramaten", name: "Dramaten", type: "scen", description: "Kungliga Dramatiska Teatern vid Nybroplan – klassiker och nyskrivet.", address: "Nybroplan", lat: 59.3331, lng: 18.0767, distance: 0, open: "Se hemsidan" },

  // Caféer och mat
  { id: "p-vetekatten", name: "Vete-Katten", type: "cafe", description: "Klassikt konditori på Kungsgatan med prinsesstårta och dubbla salonger.", address: "Kungsgatan 55", lat: 59.3341, lng: 18.0583, distance: 0, open: "7–19" },
  { id: "p-pelikan", name: "Pelikan", type: "restaurang", description: "Svensk husmanskost i gammaldags ölstuga på Blekingegatan.", address: "Blekingegatan 40, Södermalm", lat: 59.3106, lng: 18.0762, distance: 0, open: "16–23" },
  { id: "p-ostermalms-saluhall", name: "Östermalms saluhall", type: "restaurang", description: "Anrik saluhall från 1888 med delikatesser, fisk och lunchdiskar.", address: "Östermalmstorg", lat: 59.336, lng: 18.078, distance: 0, open: "10–18" },
  { id: "p-john-scott-s-kungsgatan", name: "John Scott's Kungsgatan", type: "restaurang", description: "Bar och mat.", address: "Stockholm", lat: 59.3356438, lng: 18.0646837, distance: 0, open: "Se hemsidan", link: "https://www.johnscotts.se" },
  { id: "p-birka-bowling-darts", name: "Birka Bowling & Darts", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.3402881, lng: 18.0350905, distance: 0, open: "Se hemsidan", link: "https://www.birkabowling.se" },
  { id: "p-ballbreakers", name: "Ballbreakers", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.354529, lng: 17.9448095, distance: 0, open: "Se hemsidan", link: "https://www.ballbreaker.se" },
  { id: "p-pharmarium", name: "Pharmarium", type: "restaurang", description: "Bar och mat.", address: "Stockholm", lat: 59.3248943, lng: 18.071062, distance: 0, open: "Se hemsidan", link: "https://www.pharmarium.se" },
  { id: "p-20hundra5", name: "20hundra5", type: "restaurang", description: "Bar och mat.", address: "Stockholm", lat: 59.3440587, lng: 18.03962950000005, distance: 0, open: "Se hemsidan", link: "https://www.noll5.se" },
  { id: "p-crum-heaven", name: "Crum Heaven", type: "cafe", description: "Café och fika.", address: "Stockholm", lat: 59.3165715, lng: 18.0716961, distance: 0, open: "Se hemsidan", link: "https://www.instagram.com/crumheaven/" },
  { id: "p-bistro-bananas", name: "Bistro Bananas", type: "restaurang", description: "Bar och mat.", address: "Stockholm", lat: 59.3118405, lng: 18.0750633, distance: 0, open: "Se hemsidan", link: "https://www.bistrobananas.se" },
  { id: "p-tilt-bar", name: "Tilt Bar", type: "restaurang", description: "Bar och mat.", address: "Stockholm", lat: 59.3461299, lng: 18.0508333, distance: 0, open: "Se hemsidan", link: "https://www.tiltbar.se" },
  { id: "p-taysta-mordgator", name: "Taysta Mordgåtor", type: "escape", description: "Escape room och mordmysterier.", address: "Stockholm", lat: 59.354529, lng: 17.9448095, distance: 0, open: "Se hemsidan", link: "https://www.taysta.se" },
  { id: "p-escape-stories", name: "Escape Stories", type: "escape", description: "Escape room och mordmysterier.", address: "Stockholm", lat: 59.3345663, lng: 18.0554929, distance: 0, open: "Se hemsidan", link: "https://www.escapestories.com" },
  { id: "p-fox-in-a-box", name: "Fox in a Box", type: "escape", description: "Escape room och mordmysterier.", address: "Stockholm", lat: 59.3340933, lng: 18.065166, distance: 0, open: "Se hemsidan", link: "https://www.foxinabox.se" },
  { id: "p-questrooms", name: "Questrooms", type: "escape", description: "Escape room och mordmysterier.", address: "Stockholm", lat: 59.354529, lng: 17.9448095, distance: 0, open: "Se hemsidan", link: "https://www.questrooms.se" },
  { id: "p-stockholm-ghost-walk", name: "Stockholm Ghost Walk", type: "sevardhet", description: "Sevärdhet och evenemangsplats.", address: "Stockholm", lat: 59.3256984, lng: 18.07187880000004, distance: 0, open: "Se hemsidan", link: "https://www.stockholmghostwalk.com" },
  { id: "p-punk-royale", name: "Punk Royale", type: "restaurang", description: "Bar och mat.", address: "Stockholm", lat: 59.3154532, lng: 18.0876205, distance: 0, open: "Se hemsidan", link: "https://www.punkroyale.com" },
  { id: "p-norra-brunn", name: "Norra Brunn", type: "scen", description: "Scen med liveprogram.", address: "Stockholm", lat: 59.3454038, lng: 18.0579164, distance: 0, open: "Se hemsidan", link: "https://www.norrabrunncomedy.se" },
  { id: "p-pang-pang-brewery", name: "Pang Pang Brewery", type: "restaurang", description: "Bar och mat.", address: "Stockholm", lat: 59.2377215, lng: 17.9794115, distance: 0, open: "Se hemsidan", link: "https://www.pangpangbrewery.se" },
  { id: "p-kappa-bar", name: "Kappa Bar", type: "restaurang", description: "Bar och mat.", address: "Stockholm", lat: 59.3457157, lng: 18.0536007, distance: 0, open: "Se hemsidan", link: "https://www.kappabar.se" },
  { id: "p-science-fiction-bokhandeln", name: "Science Fiction Bokhandeln", type: "gomd", description: "Butik med nisch.", address: "Stockholm", lat: 59.32404709999999, lng: 18.0705265, distance: 0, open: "Se hemsidan", link: "https://www.sfbok.se" },
  { id: "p-stuntgruppen", name: "Stuntgruppen", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.354529, lng: 17.9448095, distance: 0, open: "Se hemsidan", link: "https://www.stuntgruppen.se" },
  { id: "p-hornstulls-marknad", name: "Hornstulls marknad", type: "sevardhet", description: "Sevärdhet och evenemangsplats.", address: "Stockholm", lat: 59.3144127, lng: 18.0327921, distance: 0, open: "Se hemsidan", link: "https://www.hornstullsmarknad.se" },
  { id: "p-k-karaoke", name: "K Karaoke", type: "karaoke", description: "Karaoke med scener och egna rum.", address: "Stockholm", lat: 59.3416517, lng: 18.0467082, distance: 0, open: "Se hemsidan", link: "https://www.kkaraoke.se" },
  { id: "p-moyagi-karaoke", name: "Moyagi Karaoke", type: "karaoke", description: "Karaoke med scener och egna rum.", address: "Stockholm", lat: 59.3416517, lng: 18.0467082, distance: 0, open: "Se hemsidan", link: "https://www.moyagi.com" },
  { id: "p-bouldering-stockholm", name: "Bouldering Stockholm", type: "klattring", description: "Klättring och bouldering.", address: "Stockholm", lat: 59.2896483, lng: 18.0821129, distance: 0, open: "Se hemsidan", link: "https://www.boulderingstockholm.se" },
  { id: "p-vrex-city", name: "VRex City", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.33215999999999, lng: 18.0653693, distance: 0, open: "Se hemsidan", link: "https://www.vrex.se" },
  { id: "p-stockholmsmassan", name: "Stockholmsmässan", type: "sevardhet", description: "Sevärdhet och evenemangsplats.", address: "Stockholm", lat: 59.2787201, lng: 18.0153846, distance: 0, open: "Se hemsidan", link: "https://www.stockholmsmassan.se" },
  { id: "p-keramiken", name: "Keramiken", type: "keramik", description: "Keramik, hantverk och skapande – boka plats och prova själv.", address: "Stockholm", lat: 59.3408396, lng: 18.0279012, distance: 0, open: "Se hemsidan", link: "https://www.keramiken.se" },
  { id: "p-drejverkstaden", name: "Drejverkstaden", type: "keramik", description: "Keramik, hantverk och skapande – boka plats och prova själv.", address: "Stockholm", lat: 59.354529, lng: 17.9448095, distance: 0, open: "Se hemsidan", link: "https://www.drejverkstaden.se" },
  { id: "p-atelje-faff", name: "Atelje FAFF", type: "keramik", description: "Keramik, hantverk och skapande – boka plats och prova själv.", address: "Stockholm", lat: 59.3267118, lng: 18.1083506, distance: 0, open: "Se hemsidan" },
  { id: "p-kulturama", name: "Kulturama", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.3020611, lng: 18.0974454, distance: 0, open: "Se hemsidan", link: "https://www.kulturama.se" },
  { id: "p-sthlm-ljusstoperi", name: "STHLM Ljusstöperi", type: "keramik", description: "Keramik, hantverk och skapande – boka plats och prova själv.", address: "Stockholm", lat: 59.3319837, lng: 18.0625551, distance: 0, open: "Se hemsidan", link: "https://www.sthlmljusstoperi.se" },
  { id: "p-maffia-comedy-club", name: "Maffia Comedy Club", type: "scen", description: "Scen med liveprogram.", address: "Stockholm", lat: 59.3483544, lng: 18.0490603, distance: 0, open: "Se hemsidan", link: "https://www.maffiacomedy.se" },
  { id: "p-stockholms-improvisationsteater", name: "Stockholms Improvisationsteater", type: "scen", description: "Scen med liveprogram.", address: "Stockholm", lat: 59.3418272, lng: 18.0415186, distance: 0, open: "Se hemsidan", link: "https://www.impro.a.se" },
  { id: "p-improstudion", name: "Improstudion", type: "scen", description: "Scen med liveprogram.", address: "Stockholm", lat: 59.354529, lng: 17.9448095, distance: 0, open: "Se hemsidan", link: "https://www.improvisationsstudion.se" },
  { id: "p-golfbaren", name: "Golfbaren", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.3329885, lng: 18.0036116, distance: 0, open: "Se hemsidan", link: "https://www.golfbaren.se" },
  { id: "p-dance-factory", name: "Dance Factory", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.2451325, lng: 18.2275306, distance: 0, open: "Se hemsidan", link: "https://www.dancefactory.se" },
  { id: "p-danshuset", name: "Danshuset", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.4480217, lng: 17.9567716, distance: 0, open: "Se hemsidan", link: "https://www.danshuset.se" },
  { id: "p-fryshuset", name: "Fryshuset", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.3011252, lng: 18.0883711, distance: 0, open: "Se hemsidan", link: "https://www.fryshuset.se" },
  { id: "p-tolv-stockholm", name: "Tolv Stockholm", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.2914205, lng: 18.0831635, distance: 0, open: "Se hemsidan", link: "https://www.tolvstockholm.se" },
  { id: "p-ugglan-boule-bar", name: "Ugglan Boule & Bar", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.3119051, lng: 18.0820319, distance: 0, open: "Se hemsidan", link: "https://www.ugglanboulebar.se" },
  { id: "p-hey-sthlm", name: "HEY STHLM", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.3426154, lng: 18.0523637, distance: 0, open: "Se hemsidan", link: "https://www.heysthlm.se" },
  { id: "p-roq", name: "RoQ", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.3424802, lng: 18.0523735, distance: 0, open: "Se hemsidan", link: "https://www.roq.se" },
  { id: "p-la-botanica-gamezone", name: "La Botanica GameZone", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.3707839, lng: 18.0011903, distance: 0, open: "Se hemsidan", link: "https://www.labotanica.se" },
  { id: "p-alphabar", name: "Alphabar", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.3059977, lng: 17.9867864, distance: 0, open: "Se hemsidan", link: "https://www.alphaspel.se" },
  { id: "p-kungsbiljarden", name: "Kungsbiljarden", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.3318366, lng: 18.0513748, distance: 0, open: "Se hemsidan", link: "https://www.kungsbiljarden.se" },
  { id: "p-boulebar", name: "Boulebar", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.3286055, lng: 18.0272989, distance: 0, open: "Se hemsidan", link: "https://www.boulebar.se" },
  { id: "p-swing-by-golfbaren", name: "SWING by Golfbaren", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.3450534, lng: 18.0549697, distance: 0, open: "Se hemsidan", link: "https://www.golfbaren.se/swing" },
  { id: "p-lucky-bowl", name: "Lucky Bowl", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.3332768, lng: 18.0326549, distance: 0, open: "Se hemsidan", link: "https://www.luckybowl.se" },
  { id: "p-biljardpalatset", name: "Biljardpalatset", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.3357484, lng: 18.033854, distance: 0, open: "Se hemsidan", link: "https://www.biljardpalatset.se" },
  { id: "p-classic-pinball", name: "Classic Pinball", type: "gomd", description: "Butik med nisch.", address: "Stockholm", lat: 59.3184635, lng: 18.0480458, distance: 0, open: "Se hemsidan", link: "https://www.classicpinball.se" },
  { id: "p-jolo-biljard", name: "Jolo Biljard", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.3411649, lng: 18.0484285, distance: 0, open: "Se hemsidan", link: "https://www.jolobiljard.se" },
  { id: "p-downtown-camper-spelrummet", name: "Downtown Camper Spelrummet", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.3312579, lng: 18.0655598, distance: 0, open: "Se hemsidan", link: "https://www.scandichotels.se/downtowncamper" },
  { id: "p-hop-vine", name: "Hop & Vine", type: "restaurang", description: "Bar och mat.", address: "Stockholm", lat: 59.3339643, lng: 18.0652326, distance: 0, open: "Se hemsidan", link: "https://www.hopandvine.se" },
  { id: "p-the-ship", name: "The Ship", type: "restaurang", description: "Bar och mat.", address: "Stockholm", lat: 59.3338694, lng: 18.0325179, distance: 0, open: "Se hemsidan", link: "https://www.theship.se" },
  { id: "p-laserdome", name: "Laserdome", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.4666513, lng: 18.1261778, distance: 0, open: "Se hemsidan", link: "https://www.laserdome.se" },
  { id: "p-bodyflight-stockholm", name: "Bodyflight Stockholm", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.351885, lng: 17.9667726, distance: 0, open: "Se hemsidan", link: "https://www.bodyflight.se" },
  { id: "p-klattercentret", name: "Klättercentret", type: "klattring", description: "Klättring och bouldering.", address: "Stockholm", lat: 59.4204622, lng: 17.9153109, distance: 0, open: "Se hemsidan", link: "https://www.klattercentret.se" },
  { id: "p-moumo", name: "Moumo", type: "klattring", description: "Klättring och bouldering.", address: "Stockholm", lat: 59.3119428, lng: 18.0738235, distance: 0, open: "Se hemsidan", link: "https://www.moumo.se" },
  { id: "p-gasverket-klattring", name: "Gasverket Klättring", type: "klattring", description: "Klättring och bouldering.", address: "Stockholm", lat: 59.4204622, lng: 17.9153109, distance: 0, open: "Se hemsidan", link: "https://www.klattercentret.se/gasverket" },
  { id: "p-aventyrsbanan", name: "Äventyrsbanan", type: "hoghojd", description: "Höghöjdsbana och äventyrsbana.", address: "Stockholm", lat: 59.2808155, lng: 18.1832658, distance: 0, open: "Se hemsidan", link: "https://www.aventyrsbanan.se" },
  { id: "p-hammarbybacken", name: "Hammarbybacken", type: "sport", description: "Sport och träning.", address: "Stockholm", lat: 59.2998580932617, lng: 18.1098499298096, distance: 0, open: "Se hemsidan", link: "https://www.skistar.com/sv/hammarbybacken" },
  { id: "p-jumpyard", name: "JumpYard", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.2673533, lng: 17.9092163, distance: 0, open: "Se hemsidan", link: "https://www.jumpyard.se" },
  { id: "p-yoump", name: "Yoump", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.2655847, lng: 17.9093136, distance: 0, open: "Se hemsidan", link: "https://www.yoump.se" },
  { id: "p-tactical-sports-paintball", name: "Tactical Sports Paintball", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.4665674, lng: 17.8152482, distance: 0, open: "Se hemsidan", link: "https://www.tacticalsports.se" },
  { id: "p-stockholm-action-center", name: "Stockholm Action Center", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.3505198, lng: 18.0716542, distance: 0, open: "Se hemsidan", link: "https://www.stockholmactioncenter.se" },
  { id: "p-sundsta-motorsport", name: "Sundsta Motorsport", type: "gokart", description: "Gokart och motorsport på bana.", address: "Stockholm", lat: 59.0158054, lng: 17.8196792, distance: 0, open: "Se hemsidan", link: "https://www.sundsta.se" },
  { id: "p-skojphoj", name: "SkojpHoj", type: "hoghojd", description: "Höghöjdsbana och äventyrsbana.", address: "Stockholm", lat: 59.354529, lng: 17.9448095, distance: 0, open: "Se hemsidan", link: "https://www.skojphoj.se" },
  { id: "p-eriksdalsbadet", name: "Eriksdalsbadet", type: "bad", description: "Simhall och bad.", address: "Stockholm", lat: 59.3051366, lng: 18.0747794, distance: 0, open: "Se hemsidan", link: "https://motionera.stockholm/eriksdalsbadet" },
  { id: "p-sydpoolen", name: "Sydpoolen", type: "bad", description: "Simhall och bad.", address: "Stockholm", lat: 59.1896864, lng: 17.6353407, distance: 0, open: "Se hemsidan", link: "https://www.sydpoolen.se" },
  { id: "p-langholmen-kajak", name: "Långholmen Kajak", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.3200098, lng: 18.0291652999999, distance: 0, open: "Se hemsidan", link: "https://www.langholmenkajak.se" },
  { id: "p-exit-games", name: "Exit Games", type: "escape", description: "Escape room och mordmysterier.", address: "Stockholm", lat: 59.3134327, lng: 18.0740619, distance: 0, open: "Se hemsidan", link: "https://www.exitgames.se" },
  { id: "p-brainit-escape-room", name: "Brainit Escape Room", type: "escape", description: "Escape room och mordmysterier.", address: "Stockholm", lat: 59.354529, lng: 17.9448095, distance: 0, open: "Se hemsidan", link: "https://www.brainit.se" },
  { id: "p-stadsmysterium", name: "Stadsmysterium", type: "escape", description: "Escape room och mordmysterier.", address: "Stockholm", lat: 59.3233049, lng: 18.0670022, distance: 0, open: "Se hemsidan", link: "https://www.stadsmysterium.se" },
  { id: "p-mordmysterium", name: "Mordmysterium", type: "escape", description: "Escape room och mordmysterier.", address: "Stockholm", lat: 59.354529, lng: 17.9448095, distance: 0, open: "Se hemsidan", link: "https://www.mordmysterium.se" },
  { id: "p-stockholms-spokvandringar", name: "Stockholms Spökvandringar", type: "sevardhet", description: "Sevärdhet och evenemangsplats.", address: "Stockholm", lat: 59.3269277, lng: 18.0701645, distance: 0, open: "Se hemsidan", link: "https://www.stockholmsspokvandringar.se" },
  { id: "p-slottsmord-pa-haringe-slott", name: "Slottsmord på Häringe Slott", type: "sevardhet", description: "Sevärdhet och evenemangsplats.", address: "Stockholm", lat: 59.0392749, lng: 18.0144119, distance: 0, open: "Se hemsidan", link: "https://www.haringeslott.se" },
  { id: "p-raw-comedy-club", name: "RAW Comedy Club", type: "scen", description: "Scen med liveprogram.", address: "Stockholm", lat: 59.3483544, lng: 18.0490603, distance: 0, open: "Se hemsidan", link: "https://www.rawcomedy.se" },
  { id: "p-the-laugh-house", name: "The Laugh House", type: "scen", description: "Scen med liveprogram.", address: "Stockholm", lat: 59.3316791, lng: 18.0264061, distance: 0, open: "Se hemsidan", link: "https://www.thelaughhouse.se" },
  { id: "p-soder-standup-club", name: "Söder StandUp Club", type: "scen", description: "Scen med liveprogram.", address: "Stockholm", lat: 59.3141877, lng: 18.0743484, distance: 0, open: "Se hemsidan", link: "https://www.soderstandup.se" },
  { id: "p-valv1-comedy-club", name: "Valv1 Comedy Club", type: "scen", description: "Scen med liveprogram.", address: "Stockholm", lat: 59.3483544, lng: 18.0490603, distance: 0, open: "Se hemsidan" },
  { id: "p-scalateatern", name: "Scalateatern", type: "scen", description: "Scen med liveprogram.", address: "Stockholm", lat: 59.354529, lng: 17.9448095, distance: 0, open: "Se hemsidan", link: "https://www.scalateatern.se" },
  { id: "p-presens-impro", name: "Presens Impro", type: "scen", description: "Scen med liveprogram.", address: "Stockholm", lat: 59.3430145, lng: 17.9230673, distance: 0, open: "Se hemsidan", link: "https://www.presensimpro.se" },
  { id: "p-dramalabbet", name: "Dramalabbet", type: "scen", description: "Scen med liveprogram.", address: "Stockholm", lat: 59.354529, lng: 17.9448095, distance: 0, open: "Se hemsidan", link: "https://www.dramalabbet.com" },
  { id: "p-orionteatern", name: "Orionteatern", type: "scen", description: "Scen med liveprogram.", address: "Stockholm", lat: 59.3082954, lng: 18.0901758, distance: 0, open: "Se hemsidan", link: "https://www.orionteatern.se" },
  { id: "p-subtopia", name: "Subtopia", type: "scen", description: "Scen med liveprogram.", address: "Stockholm", lat: 59.2388189, lng: 17.8657869, distance: 0, open: "Se hemsidan", link: "https://www.subtopia.se" },
  { id: "p-kulturhuset-stadsteatern-lava", name: "Kulturhuset Stadsteatern Lava", type: "scen", description: "Scen med liveprogram.", address: "Stockholm", lat: 59.3320445, lng: 18.0650677, distance: 0, open: "Se hemsidan", link: "https://www.kulturhusetstadsteatern.se" },
  { id: "p-karaokebaren", name: "Karaokebaren", type: "karaoke", description: "Karaoke med scener och egna rum.", address: "Stockholm", lat: 59.354529, lng: 17.9448095, distance: 0, open: "Se hemsidan", link: "https://www.karaokebaren.se" },
  { id: "p-debaser-strand", name: "Debaser Strand", type: "scen", description: "Scen med liveprogram.", address: "Stockholm", lat: 59.3144592, lng: 18.0324384, distance: 0, open: "Se hemsidan", link: "https://www.debaser.se" },
  { id: "p-kollektivet-livet", name: "Kollektivet Livet", type: "scen", description: "Scen med liveprogram.", address: "Stockholm", lat: 59.3193095, lng: 18.0783075, distance: 0, open: "Se hemsidan", link: "https://www.kollektivetlivet.se" },
  { id: "p-banankompaniet", name: "Banankompaniet", type: "scen", description: "Scen med liveprogram.", address: "Stockholm", lat: 59.3414468, lng: 18.1190121, distance: 0, open: "Se hemsidan", link: "https://www.banankompaniet.se" },
  { id: "p-fallan", name: "Fållan", type: "scen", description: "Scen med liveprogram.", address: "Stockholm", lat: 59.29069999999999, lng: 18.0786829, distance: 0, open: "Se hemsidan", link: "https://www.fallan.nu" },
  { id: "p-fasching", name: "Fasching", type: "scen", description: "Scen med liveprogram.", address: "Stockholm", lat: 59.3336296081543, lng: 18.0557994842529, distance: 0, open: "Se hemsidan", link: "https://www.fasching.se" },
  { id: "p-nalen", name: "Nalen", type: "scen", description: "Scen med liveprogram.", address: "Stockholm", lat: 59.3371799, lng: 18.0677643, distance: 0, open: "Se hemsidan", link: "https://www.nalen.com" },
  { id: "p-the-creativity-house", name: "The Creativity House", type: "aktivitet", description: "Aktivitet att boka – spel, sällskapsspel eller kurs.", address: "Stockholm", lat: 59.3316791, lng: 18.0264061, distance: 0, open: "Se hemsidan", link: "https://www.thecreativityhouse.se" },
  { id: "p-paradox-museum", name: "Paradox Museum", type: "museum", description: "Museum med utställningar.", address: "Stockholm", lat: 59.3344074, lng: 18.0633072, distance: 0, open: "Se hemsidan", link: "https://www.paradoxmuseumstockholm.com" },
  { id: "p-upplevelsemuseet", name: "Upplevelsemuseet", type: "museum", description: "Museum med utställningar.", address: "Stockholm", lat: 59.2922472, lng: 18.0830739, distance: 0, open: "Se hemsidan", link: "https://www.upplevelsemuseet.se" },
  { id: "p-framtidsmuseet", name: "Framtidsmuseet", type: "museum", description: "Museum med utställningar.", address: "Stockholm", lat: 59.293262, lng: 18.080878, distance: 0, open: "Se hemsidan", link: "https://www.framtidsmuseet.se" },
  { id: "p-avicii-experience", name: "Avicii Experience", type: "museum", description: "Museum med utställningar.", address: "Stockholm", lat: 59.33291769999999, lng: 18.0659205, distance: 0, open: "Se hemsidan", link: "https://www.aviciiexperience.com" },
  { id: "p-arkdes", name: "ArkDes", type: "museum", description: "Museum med utställningar.", address: "Stockholm", lat: 59.3259158, lng: 18.0841346, distance: 0, open: "Se hemsidan", link: "https://www.arkdes.se" },
  { id: "p-sparvagsmuseet", name: "Spårvägsmuseet", type: "museum", description: "Museum med utställningar.", address: "Stockholm", lat: 59.35785259999999, lng: 18.0913163, distance: 0, open: "Se hemsidan", link: "https://www.sparvagsmuseet.se" },
  { id: "p-tom-tits-experiment", name: "Tom Tits Experiment", type: "museum", description: "Museum med utställningar.", address: "Stockholm", lat: 59.1998291015625, lng: 17.6243896484375, distance: 0, open: "Se hemsidan", link: "https://www.tomtit.se" },
  { id: "p-polismuseet", name: "Polismuseet", type: "museum", description: "Museum med utställningar.", address: "Stockholm", lat: 59.3330612182617, lng: 18.1196708679199, distance: 0, open: "Se hemsidan", link: "https://www.polismuseet.se" },
  { id: "p-omnipollos-hatt", name: "Omnipollos Hatt", type: "restaurang", description: "Bar och mat.", address: "Stockholm", lat: 59.3180636, lng: 18.0722704, distance: 0, open: "Se hemsidan", link: "https://www.omnipolloshatt.com" },
  { id: "p-mr-cake", name: "Mr. Cake", type: "cafe", description: "Café och fika.", address: "Stockholm", lat: 59.3430187, lng: 18.0683672, distance: 0, open: "Se hemsidan", link: "https://www.mrcake.se" },
  { id: "p-bastard-burgers", name: "Bastard Burgers", type: "restaurang", description: "Bar och mat.", address: "Stockholm", lat: 59.3425596, lng: 18.0583151000001, distance: 0, open: "Se hemsidan", link: "https://www.bastardburgers.com" },
  { id: "p-k25", name: "K25", type: "restaurang", description: "Bar och mat.", address: "Stockholm", lat: 59.335819, lng: 18.0674205, distance: 0, open: "Se hemsidan", link: "https://www.k25.nu" },
  { id: "p-bondens-egen-marknad", name: "Bondens Egen Marknad", type: "sevardhet", description: "Sevärdhet och evenemangsplats.", address: "Stockholm", lat: 59.3410974, lng: 18.0930288, distance: 0, open: "Se hemsidan", link: "https://www.bondensegen.com" },
  { id: "p-loppis-hotorget-och-karlaplan", name: "Loppis Hötorget och Karlaplan", type: "sevardhet", description: "Sevärdhet och evenemangsplats.", address: "Stockholm", lat: 59.3358309, lng: 18.0632652, distance: 0, open: "Se hemsidan", link: "https://www.loppistajm.se" },
  { id: "p-big-ben-comedy", name: "Big Ben Comedy", type: "scen", description: "Komediklubb på Södermalm med standup flera kvällar i veckan.", address: "Folkungagatan 97", lat: 59.315584, lng: 18.083352, distance: 0, open: "Se hemsidan", link: "https://www.bigbenstandup.com" },
  { id: "p-hogt-och-lagt", name: "Högt och Lågt", type: "hoghojd", description: "Klätterpark och höghöjdsbana vid Hammarbybacken.", address: "Hammarby Fabriksväg 111", lat: 59.301225, lng: 18.109289, distance: 0, open: "Se hemsidan", link: "https://www.hogtlagt.se" },
  { id: "p-perla", name: "Perla", type: "keramik", description: "Pärlbutik och verkstad på Östermalm – pärlor, tillbehör och eget skapande.", address: "Grevgatan 27", lat: 59.334373, lng: 18.084793, distance: 0, open: "Se hemsidan", link: "https://www.perlasthlm.se" },
  { id: "p-stockholm-paintball", name: "Stockholm Paintball", type: "aktivitet", description: "Paintballbanor i Upplands Väsby för sällskap och grupper.", address: "Torslundavägen 42, Upplands Väsby", lat: 59.494425, lng: 17.979285, distance: 0, open: "Se hemsidan", link: "https://www.stockholmpaintball.com" },
  { id: "p-gokart-stockholm", name: "Gokart Stockholm", type: "gokart", description: "Gokartbana i Johanneshov – öppnar i nya lokaler.", address: "Rökerigatan 23", lat: 59.290802, lng: 18.082646, distance: 0, open: "Se hemsidan", link: "https://www.gokartstockholm.se" },
  { id: "p-o-learys-gokart-kista", name: "O'Learys Gokart Kista", type: "gokart", description: "Gokart inne i O'Learys eventcenter vid Kista Galleria.", address: "Hanstavägen 55, Kista", lat: 59.4039, lng: 17.9432, distance: 0, open: "Se hemsidan", link: "https://www.olearys.se/kista-event-center" },
  { id: "p-f1-simulator-live-it", name: "F1 Simulator Live it", type: "aktivitet", description: "Formel 1-simulator att boka genom Live it, i Hägersten.", address: "Vretensborgsvägen 19, Hägersten", lat: 59.2976, lng: 18.0142, distance: 0, open: "Se hemsidan", link: "https://www.liveit.se" },
  { id: "p-prison-island-kungens-kurva", name: "Prison Island Kungens Kurva", type: "aktivitet", description: "Utmaningsbana i Heron City – lagtävlingar genom flera rum.", address: "Dialoggatan 2, Kungens Kurva", lat: 59.267, lng: 17.9114, distance: 0, open: "Se hemsidan", link: "https://www.prisonisland.se" },
  { id: "p-promenadteatern", name: "Promenadteatern", type: "scen", description: "True crime-vandringar till fots genom Gamla stan.", address: "Stortorget, Gamla stan", lat: 59.3248, lng: 18.0708, distance: 0, open: "Se hemsidan", link: "https://www.promenadteatern.se" },
  { id: "p-the-jury-experience", name: "The Jury Experience", type: "sevardhet", description: "Interaktiv rättegångsupplevelse på Bio Skandia.", address: "Drottninggatan 82", lat: 59.3361, lng: 18.0627, distance: 0, open: "Se hemsidan", link: "https://www.feverup.com" },
  { id: "p-oslipat", name: "Oslipat", type: "scen", description: "Standupscenen Oslipat, med kvällar på Fotografiska.", address: "Stadsgårdshamnen 22", lat: 59.3198, lng: 18.0847, distance: 0, open: "Se hemsidan", link: "https://www.oslipat.com" },
  { id: "p-mala-keramik", name: "Måla Keramik", type: "keramik", description: "Måla egen keramik på studio – boka bord och välj figur.", address: "Bondegatan 94, Södermalm", lat: 59.3127, lng: 18.0972, distance: 0, open: "Se hemsidan", link: "https://www.malakeramik.se" },
  { id: "p-stockholms-glasbruk", name: "Stockholms Glasbruk", type: "keramik", description: "Glasblåseri och butik inne på Skansen.", address: "Djurgårdsslätten 49", lat: 59.32535, lng: 18.10017, distance: 0, open: "Se hemsidan", link: "https://www.stockholmsglasbruk.se" },
  { id: "p-mala-och-skala", name: "Måla och Skåla", type: "keramik", description: "Keramikmålning med bar – måla, skåla och hämta efter bränning.", address: "Östgötagatan 16", lat: 59.3157, lng: 18.07578, distance: 0, open: "Se hemsidan", link: "https://www.malaochskala.se" },
  { id: "p-rug-tufting-stockholm", name: "Rug Tufting Stockholm", type: "keramik", description: "Tufta egen matta i studio på Birkagatan.", address: "Birkagatan 1", lat: 59.33951, lng: 18.03204, distance: 0, open: "Se hemsidan" },
  { id: "p-medborgarskolan-stockholm", name: "Medborgarskolan Stockholm", type: "aktivitet", description: "Kursverksamhet i Stockholm – bland annat hantverk, språk och musik.", address: "Hagagatan 23 A", lat: 59.34619, lng: 18.05081, distance: 0, open: "Se hemsidan", link: "https://www.medborgarskolan.se" },
  { id: "p-abf-stockholm", name: "ABF Stockholm", type: "aktivitet", description: "ABF-huset vid Sveavägen med kurser, föreläsningar och scenprogram.", address: "Sveavägen 41", lat: 59.33881, lng: 18.05992, distance: 0, open: "Se hemsidan", link: "https://www.abfstockholm.se" },
  { id: "p-al-dente-matlagningskurser", name: "Al Dente Matlagningskurser", type: "aktivitet", description: "Matlagningskurser i italiensk anda på Roslagsgatan.", address: "Roslagsgatan 33", lat: 59.34844, lng: 18.05776, distance: 0, open: "Se hemsidan", link: "https://www.aldentestockholm.com" },
  { id: "p-aveqia-stockholm", name: "Aveqia Stockholm", type: "restaurang", description: "Laga mat tillsammans med kockar och ät det du lagat.", address: "Tulegatan 11", lat: 59.34207, lng: 18.06204, distance: 0, open: "Se hemsidan", link: "https://www.aveqia.com" },
  { id: "p-vikingaliv", name: "Vikingaliv", type: "museum", description: "Vikingatida utställning på Djurgården med guider och båtar.", address: "Djurgårdsstrand 15", lat: 59.3265, lng: 18.0948, distance: 0, open: "Se hemsidan", link: "https://www.thevikingmuseum.com" },
  { id: "p-teatern-ringen", name: "Teatern Ringen", type: "scen", description: "Scen inne i Ringen vid Skanstull – komedi, shower och gästspel.", address: "Götgatan 98, Skanstull", lat: 59.3083, lng: 18.0758, distance: 0, open: "Se hemsidan", link: "https://www.ringen.se/teatern" },
  { id: "p-slakthusomradet", name: "Slakthusområdet", type: "sevardhet", description: "Området i Johanneshov med mat, marknader och evenemang i gamla slakthus.", address: "Hallvägen, Johanneshov", lat: 59.2907, lng: 18.0784, distance: 0, open: "Se hemsidan", link: "https://www.slakthusomradet.se" },
];

/** Startvy för kartan (Stockholm) tills användarens position är känd. */
export const MAP_CENTER = { lat: 59.3293, lng: 18.0686 };

/** Avstånd i km från kartans mittpunkt. */
function centerDistanceKm(lat: number, lng: number): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat - MAP_CENTER.lat);
  const dLng = toRadians(lng - MAP_CENTER.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(MAP_CENTER.lat)) * Math.cos(toRadians(lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

/** Grundutbudet av fasta platser, med avstånd från Stockholms mitt. */
export const PLACES: Place[] = CURATED_PLACES.map((place) => ({
  ...place,
  distance: centerDistanceKm(place.lat ?? MAP_CENTER.lat, place.lng ?? MAP_CENTER.lng),
}));

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
  // Räknas i databasen (public.event_views): en person räknas en gång per event,
  // oavsett hur många gånger eventet öppnas.
  views: "Unika besökare",
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

/**
 * Basstatistik för arrangörspanelen. Visningar är alltid 0 här: de räknas som
 * unika besökare i databasen och får aldrig påhittade värden.
 */
export function baseStats(e: EventItem): EventStats {
  const h = hashString(e.id);
  const interest = e.interested.length;
  return {
    views: 0,
    clicks: Math.round(interest * 2.4) + (h % 9),
    saves: interest + (h % 5),
    interested: interest,
    shares: Math.round(interest / 2) + (h % 3),
    plans: Math.max(0, Math.round(interest / 2) + (h % 3) - 1),
  };
}
