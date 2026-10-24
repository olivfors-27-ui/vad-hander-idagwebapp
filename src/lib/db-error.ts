import { MAX_EVENTS_PER_ACCOUNT, MAX_EVENT_GUESTS } from "@/lib/event-admin";

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
  name?: unknown;
};

const asText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * Gör ett databas- eller nätverksfel begripligt utan att tappa bort vad som
 * faktiskt hände. Kända fel översätts; okända visas med sin kod och sitt
 * ursprungliga meddelande, så att nästa felsökning inte börjar på noll.
 */
export function describeDbError(error: unknown): string {
  const source = (error ?? {}) as ErrorLike;
  const code = asText(source.code);
  const message = asText(source.message) || (typeof error === "string" ? error.trim() : "");
  const lower = message.toLowerCase();

  if (
    asText(source.name) === "AuthRetryableFetchError" ||
    /failed to fetch|fetch failed|networkerror|load failed|network request failed|network error/.test(
      lower,
    )
  ) {
    return "Kunde inte nå servern. Kontrollera anslutningen och försök igen.";
  }
  if (/auth session missing|jwt expired|invalid jwt|refresh token/.test(lower)) {
    return "Sessionen har gått ut. Logga in igen.";
  }
  if (lower.includes("event_full")) {
    return `Eventet är fullt (max ${MAX_EVENT_GUESTS} deltagare).`;
  }
  if (lower.includes("event_limit_reached")) {
    return `Du kan som mest skapa ${MAX_EVENTS_PER_ACCOUNT} event per konto.`;
  }

  switch (code) {
    case "42883":
      // T.ex. "function gen_random_bytes(integer) does not exist": funktionen
      // finns i extensions-schemat men nåddes inte av funktionens search_path.
      return message
        ? `Databasfunktionen saknas: ${message}`
        : "Databasfunktionen saknas – databasmigrationen är inte körd.";
    case "PGRST202":
      return message
        ? `Databasfunktionen saknas: ${message}. Kör den senaste databasmigrationen.`
        : "Databasfunktionen saknas. Kör den senaste databasmigrationen.";
    case "P0002":
      return lower.includes("invitation")
        ? "Inbjudan finns inte kvar – den kan ha tagits bort av arrangören."
        : "Eventet finns inte kvar i databasen.";
    case "42501":
      if (lower.includes("not signed in")) return "Du är inte inloggad. Logga in och försök igen.";
      if (lower.includes("guest response token")) {
        return "Svarslänken är ogiltig eller har gått ut. Öppna inbjudningslänken igen.";
      }
      return message
        ? `Du har inte behörighet: ${message}`
        : "Du har inte behörighet att göra det här.";
    case "23514":
      return "Kontrollera tiderna (slut efter start) och att platsen ligger i Sverige.";
    case "23505":
      return message
        ? `Det finns redan en likadan rad: ${message}`
        : "Det finns redan en likadan rad.";
  }

  if (source.status === 401 || source.status === 403) {
    return "Sessionen har gått ut. Logga in igen.";
  }
  if (message) return code ? `${message} (${code})` : message;
  return code ? `Något gick fel (${code}).` : "Något gick fel. Försök igen.";
}
