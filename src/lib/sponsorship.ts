// Sponsring: pris och betalningsinstruktion på ett ställe.
//
// Båda värdena kan överstyras med miljövariabler i Cloudflare
// (VITE_SPONSOR_PRICE / VITE_SPONSOR_SWISH) utan att koden ändras.

const env = import.meta.env as Record<string, string | undefined>;

const parsedPrice = Number(env["VITE_SPONSOR_PRICE"]);
const parsedSwish = (env["VITE_SPONSOR_SWISH"] ?? "").trim();

export const SPONSORSHIP = {
  /** Pris i kronor för en sponsrad placering. */
  priceSek: Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : 99,
  /** Mobilnummer som betalningen görs till (Swish). */
  paymentNumber: /^[0-9+\s-]{6,20}$/.test(parsedSwish) ? parsedSwish : "0793045840",
  /** Texten som förklarar när sponsring är möjlig. */
  availabilityNote:
    "Sponsring är möjligt först när eventet är skapat och godkänt av en moderator.",
} as const;

export const sponsorshipPriceLabel = () => `${SPONSORSHIP.priceSek} kr`;
