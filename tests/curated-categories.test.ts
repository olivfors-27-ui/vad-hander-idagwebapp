import { describe, expect, test } from "bun:test";
import { CURATED_VENUES, curatedCategoryFor, isCuratedEvent } from "../src/lib/event-source";

const UNCATEGORIZED = ["Stockholms kommun", "Tele2 Arena", "Avicii Arena"];

describe("listans kategorier", () => {
  test("listan är intakt och nästan helt kategoriserad", () => {
    expect(CURATED_VENUES).toHaveLength(552);
    const missing = CURATED_VENUES.filter((venue) => !venue.category).map((venue) => venue.name);
    expect(missing.sort()).toEqual([...UNCATEGORIZED].sort());
  });

  test("kategorin slås upp på namn", () => {
    expect(curatedCategoryFor({ name: "Fotografiska" })).toBe("kultur");
    expect(curatedCategoryFor({ name: "Debaser Strand" })).toBe("musik");
    expect(curatedCategoryFor({ name: "Klättercentret Solna" })).toBe("sport");
    expect(curatedCategoryFor({ name: "Norra Brunn" })).toBe("kultur");
  });

  test("kategorin slås upp på länk", () => {
    expect(
      curatedCategoryFor({ name: "Något annat", sourceUrl: "https://www.pharmarium.se/events" }),
    ).toBe("fest");
  });

  test("okänt ställe ger ingen kategori", () => {
    expect(
      curatedCategoryFor({ name: "Hemma hos mig", sourceUrl: "https://example.com" }),
    ).toBeUndefined();
  });

  test("delad domän markerar men kategoriserar inte", () => {
    const event = { name: "Öppet hus", sourceUrl: "https://www.stockholm.se/evenemang/oppet-hus" };
    expect(isCuratedEvent(event)).toBe(true);
    expect(curatedCategoryFor(event)).toBeUndefined();
  });

  test("platsen räknas som fast även när länken är en aggregator", () => {
    const event = {
      name: "BARNVAGNSTORSDAG",
      place: "Paradox Museum Stockholm",
      sourceUrl: "https://www.visitstockholm.se/evenemang/barnvagnstorsdag",
    };
    expect(isCuratedEvent(event)).toBe(true);
    expect(curatedCategoryFor(event)).toBe("kultur");
  });

  test("arenor gör inte eventet fast", () => {
    const concert = {
      name: "Tove Lo – ESTRUS",
      place: "Avicii Arena",
      sourceUrl: "https://www.ticketmaster.se/event/123",
    };
    expect(isCuratedEvent(concert)).toBe(false);
    expect(
      isCuratedEvent({ ...concert, place: "Tele2 Arena", sourceUrl: "https://www.stockholmlive.com" }),
    ).toBe(false);
  });

  test("musikscenens plats gör inte eventet fast, men titeln gör det", () => {
    const clubNight = {
      name: "Club Night",
      place: "Debaser Strand",
      sourceUrl: "https://www.ticketmaster.se/event/1",
    };
    expect(isCuratedEvent(clubNight)).toBe(false);
    expect(isCuratedEvent({ ...clubNight, place: "Fållan" })).toBe(false);
    expect(isCuratedEvent({ ...clubNight, place: "Fryshuset" })).toBe(false);
    expect(isCuratedEvent({ ...clubNight, place: "Kulturhuset Stadsteatern" })).toBe(false);
    expect(
      isCuratedEvent({
        name: "Debaser Strand presenterar: Club Night",
        place: "Någon annan lokal",
        sourceUrl: "",
      }),
    ).toBe(true);
  });

  test("platsen ger kategori även när titeln inte säger något", () => {
    const event = { name: "Kvällsöppet", place: "Fotografiska", sourceUrl: "https://example.com" };
    expect(curatedCategoryFor(event)).toBe("kultur");
  });

  test("namnet i titeln kategoriserar på delad domän", () => {
    const event = {
      name: "Simning på Eriksdalsbadet",
      sourceUrl: "https://www.stockholm.se/evenemang/simning",
    };
    expect(curatedCategoryFor(event)).toBe("sport");
  });

  test("enordsnamn från andra domäner smittar inte", () => {
    const event = {
      name: "Camping vid Nacka",
      sourceUrl: "https://www.stockholm.se/evenemang/camping",
    };
    expect(isCuratedEvent(event)).toBe(true);
    expect(curatedCategoryFor(event)).toBeUndefined();
  });

  test("flerordsnamn kategoriserar även på delad domän", () => {
    const event = {
      name: "Friidrott på Zinkensdamms IP",
      sourceUrl: "https://www.stockholm.se/evenemang/friidrott",
    };
    expect(curatedCategoryFor(event)).toBe("sport");
  });

  test("specifik path vinner över domänens rot", () => {
    // kth.se har både KTH-hallen (rot) och KTH Biblioteket (/biblioteket).
    expect(
      curatedCategoryFor({ name: "Studiekväll", sourceUrl: "https://www.kth.se/biblioteket" }),
    ).toBe("student");
    expect(
      curatedCategoryFor({ name: "Studiekväll", sourceUrl: "https://www.olearys.se/tolv-stockholm" }),
    ).toBe("sport");
  });

  test("unik värd kategoriserar även utan path", () => {
    expect(
      curatedCategoryFor({ name: "Studentpub", sourceUrl: "https://www.samvet.se/kalender" }),
    ).toBe("student");
  });
});
