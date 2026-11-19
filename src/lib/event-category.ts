import type { CategoryId } from "./hander-data";

/**
 * Kategorisering av API-event. Nyckelorden matchas med ordgräns (svenska tecken
 * räknas som ordtecken), så "livet" inte blir musik och "format" inte blir mat.
 * Långa, entydiga ord får matcha som förled ("konserten", "matvandring");
 * korta, generiska ord kräver hela ordet ("dj", "run", "vin").
 */

const LETTERS = "a-zåäö0-9";
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Ordet får inleda ett längre ord: "konsert" matchar "konserten". */
const stem = (words: string[]) =>
  words.map((word) => `(?<![${LETTERS}])${escape(word)}`).join("|");
/** Ordet måste stå för sig självt: "dj" matchar inte "djurskulpturer". */
const whole = (words: string[]) =>
  words.map((word) => `(?<![${LETTERS}])${escape(word)}(?![${LETTERS}])`).join("|");

const RULES: { category: CategoryId; re: RegExp }[] = [
  {
    category: "musik",
    re: new RegExp(
      `${stem(["musik", "konsert", "julkonsert", "jazz", "spelning", "symfoni", "orkester"])}|${whole([
        "opera",
        "operan",
        "dj",
        "live",
      ])}`,
    ),
  },
  {
    category: "fest",
    re: new RegExp(
      `${stem(["klubb", "festival", "fest", "mingel", "disco", "party", "club"])}|${whole(["pub"])}`,
    ),
  },
  {
    category: "sport",
    re: new RegExp(
      `${stem([
        "sport",
        "lopp",
        "basket",
        "fotboll",
        "yoga",
        "träning",
        "wellbeing",
        "padel",
        "golf",
      ])}|${whole(["run", "race", "match", "badminton"])}`,
    ),
  },
  {
    category: "mat",
    re: new RegExp(
      `${stem([
        "food",
        "drink",
        "middag",
        "lunch",
        "restaurant",
        "café",
        "cafe",
        "julbord",
        "mat",
        "öl",
        "vinprovning",
      ])}|${whole(["vin"])}`,
    ),
  },
  {
    category: "student",
    re: new RegExp(
      stem(["student", "campus", "university", "universitet", "föreläsning", "seminar"]),
    ),
  },
  {
    category: "shopping",
    re: new RegExp(`${stem(["market", "mässa", "shopping", "loppis", "bakluckeloppis", "marknad", "julmarknad", "designmarknad"])}|${whole(["fair"])}`),
  },
  {
    category: "utomhus",
    re: new RegExp(
      `${stem(["outdoor", "utomhus", "vandring", "kajak", "skärgård", "naturreservat", "bad"])}|${whole([
        "natur",
        "park",
        "parken",
        "strand",
      ])}`,
    ),
  },
];

/** Första kategorin som matchar, eller undefined när texten inte säger något. */
export function categoryFromText(value: string): CategoryId | undefined {
  if (!value) return undefined;
  const text = value.toLowerCase();
  return RULES.find(({ re }) => re.test(text))?.category;
}

/**
 * Titel och plats avgör först; beskrivningen används bara när titeln inte säger
 * något. Beskrivningstexten innehåller ofta lösryckta ord som "musik".
 */
export function categoryForEvent(event: {
  name: string;
  place?: string;
  description?: string;
}): CategoryId {
  return (
    categoryFromText(`${event.name} ${event.place ?? ""}`) ??
    categoryFromText(event.description ?? "") ??
    "kultur"
  );
}

/**
 * Listans kategori fyller bara i när API-texten inte kommit längre än till
 * fallbacken "kultur". Ett julbord på ett museum är mat, inte kultur.
 */
export function resolveCategory(
  apiCategory: CategoryId,
  listCategory: CategoryId | undefined,
): CategoryId {
  return apiCategory === "kultur" && listCategory ? listCategory : apiCategory;
}
