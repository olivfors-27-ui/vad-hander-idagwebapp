// Bas-URL för delnings-, inbjudnings- och bekräftelselänkar.
//
// Prioritetsordning:
//   1. VITE_APP_URL – appens publika adress, sätts per miljö (Cloudflare/Pages).
//   2. Den origin som faktiskt serverar appen (webbläsarens location).
//
// En VITE_APP_URL som pekar på localhost ignoreras när appen körs på en publik
// adress. Annars skulle bekräftelsemejl skicka folk till deras egen dator – och
// när adressen inte finns bland Redirect URLs i Supabase faller länken dessutom
// tillbaka på projektets Site URL, som ofta är just http://localhost:3000.
const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

const configured = ((import.meta.env["VITE_APP_URL"] as string | undefined) ?? "")
  .trim()
  .replace(/\/+$/, "");

const browserOrigin = typeof window !== "undefined" ? window.location.origin : "";

const configuredIsLoopback = LOOPBACK.test(configured);
const browserIsLoopback = LOOPBACK.test(browserOrigin);

/** True när VITE_APP_URL pekar på localhost men appen körs på en publik adress. */
export const APP_URL_IGNORED_LOOPBACK =
  Boolean(configured) && configuredIsLoopback && Boolean(browserOrigin) && !browserIsLoopback;

const base = APP_URL_IGNORED_LOOPBACK ? browserOrigin : configured || browserOrigin;

/** Appens publika bas-URL utan avslutande snedstreck. */
export const APP_URL = base.replace(/\/+$/, "");

/** True när bas-URL:en kommer från VITE_APP_URL. */
export const APP_URL_CONFIGURED = Boolean(configured) && !APP_URL_IGNORED_LOOPBACK;

if (APP_URL_IGNORED_LOOPBACK) {
  console.warn(
    `[tagalong] VITE_APP_URL pekar på ${configured} men appen körs på ${browserOrigin} – använder ${browserOrigin} i länkar i stället.`,
  );
}

if (!configured && browserIsLoopback) {
  console.warn(
    "[tagalong] VITE_APP_URL saknas – inbjudnings- och bekräftelselänkar pekar nu på " +
      browserOrigin +
      ". Sätt VITE_APP_URL till appens publika adress innan du delar en länk.",
  );
}

/** Bygg en absolut länk inuti appen, t.ex. appUrl("/join/ABC123"). */
export const appUrl = (path: string) => `${APP_URL}${path.startsWith("/") ? path : `/${path}`}`;
