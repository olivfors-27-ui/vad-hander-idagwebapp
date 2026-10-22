// När ett event slutar synas i appen.
//
// Samma regel finns i databasen (public.event_visible_until + vyn
// visible_public_events): 3 timmar efter sluttiden, eller 4 timmar efter
// starttiden när sluttid saknas. Tiderna tolkas som svensk tid
// (Europe/Stockholm), oavsett var enheten står.

import type { EventItem } from "./hander-data";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

/** Offset (ms) för Europe/Stockholm vid en viss UTC-tid. Tar hänsyn till sommartid. */
function stockholmOffsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Stockholm",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const value = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour") % 24,
    value("minute"),
    value("second"),
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Svensk wall-clock-tid (datum + HH:MM) som UTC-ms. */
function stockholmToUtc(date: string, time: string): number | null {
  const d = DATE_RE.exec(date.trim());
  const t = TIME_RE.exec(time.trim());
  if (!d || !t) return null;
  const wall = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  // Två pass räcker för att hamna rätt även vid skiftet till/från sommartid.
  let guess = wall;
  for (let i = 0; i < 2; i++) guess = wall - stockholmOffsetMs(guess);
  return guess;
}

/**
 * När eventet ska sluta visas. Null = okänt datum/tid, då döljs inget.
 */
export function eventVisibleUntil(e: Pick<EventItem, "date" | "start" | "end">): number | null {
  const start = stockholmToUtc(e.date, e.start);
  if (start === null) return null;
  const end = e.end?.trim() ? stockholmToUtc(e.date, e.end) : null;
  if (end === null) return start + 4 * 60 * 60 * 1000;
  const endMs = end < start ? end + 24 * 60 * 60 * 1000 : end;
  return endMs + 3 * 60 * 60 * 1000;
}

/** Ska eventet synas i appen just nu? */
export function isEventVisible(
  e: Pick<EventItem, "date" | "start" | "end">,
  now = Date.now(),
): boolean {
  const until = eventVisibleUntil(e);
  return until === null || now < until;
}
