import { describe, expect, test } from "bun:test";
import { MAX_LOOKAHEAD_DAYS, isWithinLookahead, latestVisibleDate } from "../src/lib/event-time";

const dateOf = (daysFromNow: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

describe("visningsfönstret", () => {
  test("dagens event och en månad framåt visas", () => {
    expect(isWithinLookahead(dateOf(0))).toBe(true);
    expect(isWithinLookahead(dateOf(MAX_LOOKAHEAD_DAYS))).toBe(true);
  });

  test("event längre bort än en månad visas inte", () => {
    expect(isWithinLookahead(dateOf(MAX_LOOKAHEAD_DAYS + 1))).toBe(false);
    expect(isWithinLookahead("2032-01-01")).toBe(false);
  });

  test("tomt datum släpps inte igenom", () => {
    expect(isWithinLookahead("")).toBe(false);
  });

  test("sista datum räknas från dagens datum", () => {
    expect(latestVisibleDate()).toBe(dateOf(MAX_LOOKAHEAD_DAYS));
  });
});
