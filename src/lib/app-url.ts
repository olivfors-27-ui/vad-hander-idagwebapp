// Bas-URL för delnings-, inbjudnings- och bekräftelselänkar.
//
// Prioritetsordning:
//   1. VITE_APP_URL – appens publika adress, sätts per miljö (Cloudflare/Pages).
//   2. Den origin som faktiskt serverar appen (webbläsarens location).
//
// Ingen hårdkodad domän: appen pekar aldrig på en adress som deploymenten inte
// äger. Körs appen lokalt utan VITE_APP_URL blir basen localhost, vilket är
// sant för den körningen – varningen nedan säger till att sätta variabeln.
const configured = ((import.meta.env["VITE_APP_URL"] as string | undefined) ?? "")
  .trim()
  .replace(/\/+$/, "");

const browserOrigin = typeof window !== "undefined" ? window.location.origin : "";

/** Appens publika bas-URL utan avslutande snedstreck. */
export const APP_URL = (configured || browserOrigin).replace(/\/+$/, "");

/** True när bas-URL:en kommer från VITE_APP_URL. */
export const APP_URL_CONFIGURED = Boolean(configured);

if (
  !configured &&
  typeof window !== "undefined" &&
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(browserOrigin)
) {
  console.warn(
    "[hander] VITE_APP_URL saknas – inbjudnings- och bekräftelselänkar pekar nu på " +
      browserOrigin +
      ". Sätt VITE_APP_URL till appens publika adress innan du delar en länk.",
  );
}

/** Bygg en absolut länk inuti appen, t.ex. appUrl("/join/ABC123"). */
export const appUrl = (path: string) => `${APP_URL}${path.startsWith("/") ? path : `/${path}`}`;
