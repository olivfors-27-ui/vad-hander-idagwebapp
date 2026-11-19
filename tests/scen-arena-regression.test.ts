import { describe, expect, test } from "bun:test";
import {
  isCuratedEvent,
  isTemporaryEvent,
  withFeedSource,
} from "../src/lib/event-source";

/**
 * Låser beteendet från kurateringsarbetet: arenor och scener ska ge grå
 * markering, medan ett scennamn i titeln fortfarande räknas som fast.
 */
const apiEvent = (name: string, sourceUrl?: string, place?: string) => ({
  name,
  place,
  sourceUrl,
  organizerId: "visit-stockholm",
  feedSource: undefined,
});

describe("regression: arenor", () => {
  test("arena som plats ger grått, oavsett titel", () => {
    for (const place of ["Avicii Arena", "Tele2 Arena", "3Arena", "Strawberry Arena"]) {
      expect(isCuratedEvent(apiEvent("Tove Lo – ESTRUS", "https://www.ticketmaster.se/x", place))).toBe(
        false,
      );
      expect(isCuratedEvent(apiEvent("Konsert", undefined, place))).toBe(false);
    }
  });

  test("arenans egen länk ger grått", () => {
    expect(isCuratedEvent(apiEvent("Lars Winnerbäck", "https://www.stockholmlive.com/"))).toBe(false);
  });

  test("arena i titeln ger fortfarande grått", () => {
    expect(isCuratedEvent(apiEvent("Victor Leksell på Avicii Arena"))).toBe(false);
  });
});

describe("regression: scener", () => {
  test("scenens plats ger grått", () => {
    for (const place of ["Debaser Strand", "Fållan", "Fryshuset", "Kulturhuset Stadsteatern"]) {
      expect(isCuratedEvent(apiEvent("Klubbkväll", "https://example.com/x", place))).toBe(false);
    }
  });

  test("scenens egen länk ger grått", () => {
    for (const url of [
      "https://www.berns.se/kalender/",
      "https://nalen.com/",
      "https://www.folkoperan.se/",
      "https://www.berwaldhallen.se/",
    ]) {
      expect(isCuratedEvent(apiEvent("Konsert", url))).toBe(false);
    }
  });

  test("scen på delad värd ger grått även via reservträffen", () => {
    // langholmen.com har både "Långholmen" och scenen "Långholmens Wärdshus".
    const julbord = apiEvent(
      "Klassiskt Julbord på Långholmen",
      "https://langholmen.com/restaurang/julbord/",
      "Långholmens Wärdshus",
    );
    expect(isCuratedEvent(julbord)).toBe(false);
  });

  test("scennamn i titeln ger fast", () => {
    expect(isCuratedEvent(apiEvent("Södra Teatern: Klubbkväll"))).toBe(true);
    expect(
      isCuratedEvent(apiEvent("Jesus Christ Superstar på Kulturhuset Stadsteatern")),
    ).toBe(true);
    expect(isCuratedEvent({ ...apiEvent("Debaser Strand: Klubb"), place: "Annan lokal" })).toBe(true);
  });

  test("stämpeln följer samma regel när eventet läses in", () => {
    const stageLink = withFeedSource(apiEvent("Konsert", "https://nalen.com/"));
    const stagePlace = withFeedSource(apiEvent("Klubbkväll", undefined, "Debaser Strand"));
    const titled = withFeedSource(apiEvent("Södra Teatern: Klubbkväll"));

    expect(stageLink.feedSource).toBe("api");
    expect(stagePlace.feedSource).toBe("api");
    expect(titled.feedSource).toBe("curated");
    expect(isTemporaryEvent(stageLink)).toBe(true);
    expect(isTemporaryEvent(stagePlace)).toBe(true);
    expect(isTemporaryEvent(titled)).toBe(false);
  });
});
