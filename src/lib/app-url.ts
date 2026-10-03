// Bas-URL för delnings- och inbjudningslänkar.
// Prioritet: VITE_APP_URL (sätts per miljö i Cloudflare) → aktuell webbplats → produktion.
const RAW_BASE =
  (import.meta.env["VITE_APP_URL"] as string | undefined) ||
  (typeof window !== "undefined" ? window.location.origin : "") ||
  "https://hander.pages.dev";

/** Appens publika bas-URL utan avslutande snedstreck. */
export const APP_URL = RAW_BASE.replace(/\/+$/, "");

/** Bygg en absolut länk inuti appen, t.ex. appUrl("/join/ABC123"). */
export const appUrl = (path: string) => `${APP_URL}${path.startsWith("/") ? path : `/${path}`}`;
