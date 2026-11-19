import { describe, expect, test } from "bun:test";
import {
  CURATED_VENUES,
  isApiEvent,
  isCuratedEvent,
  isTemporaryEvent,
  matchesSourceTab,
  withFeedSource,
} from "../src/lib/event-source";

const apiEvent = (name: string, sourceUrl?: string) => ({
  name,
  sourceUrl,
  organizerId: "visit-stockholm",
  feedSource: undefined,
});

describe("isApiEvent", () => {
  test("känner igen alla visit-källor via prefixet", () => {
    expect(isApiEvent({ organizerId: "visit-stockholm" })).toBe(true);
    expect(isApiEvent({ organizerId: "visit-sweden" })).toBe(true);
    expect(isApiEvent({ organizerId: "visit-uppsala" })).toBe(true);
  });

  test("appens egna event är inte API-event", () => {
    expect(isApiEvent({ organizerId: "me" })).toBe(false);
    expect(isApiEvent({ organizerId: "visitstockholm" })).toBe(false);
    expect(isApiEvent({ organizerId: "" })).toBe(false);
  });
});

describe("isCuratedEvent – domän", () => {
  test("hela sajten matchar när posten saknar path", () => {
    expect(isCuratedEvent(apiEvent("Julmarknad", "https://www.hotorgshallen.se/"))).toBe(true);
    expect(isCuratedEvent(apiEvent("Fisk", "https://www.kajsasfisk.se/kalender/"))).toBe(true);
    expect(isCuratedEvent(apiEvent("Kaffe", "https://vetekatten.se/"))).toBe(true);
  });

  test("scenens egen länk gör inte eventet fast", () => {
    expect(isCuratedEvent(apiEvent("Lucia", "https://www.berns.se/kalender/"))).toBe(false);
    expect(isCuratedEvent(apiEvent("Konsert", "https://nalen.com/"))).toBe(false);
    expect(isCuratedEvent(apiEvent("Klubb", "https://www.sodrateatern.com/"))).toBe(false);
    expect(isCuratedEvent(apiEvent("Södra Teatern: Klubbkväll"))).toBe(true);
  });

  test("post med path kräver just den pathen", () => {
    expect(isCuratedEvent(apiEvent("Afterwork", "https://www.olearys.se/tolv-stockholm/"))).toBe(true);
    expect(isCuratedEvent(apiEvent("Afterwork", "https://www.olearys.se/"))).toBe(false);
    expect(isCuratedEvent(apiEvent("Padel", "https://www.camping.se/stockholm/"))).toBe(true);
    expect(isCuratedEvent(apiEvent("Padel", "https://www.camping.se/"))).toBe(false);
  });

  test("subdomän matchar sin förälder", () => {
    expect(isCuratedEvent(apiEvent("Pepparkakshus 2026", "https://pepparkakshus.arkdes.se/"))).toBe(true);
    expect(isCuratedEvent(apiEvent("Föreställning", "https://biljetter.hotorgshallen.se/x"))).toBe(true);
  });

  test("aggregatorer matchar bara sin egen path", () => {
    expect(isCuratedEvent(apiEvent("Afterwork", "https://www.instagram.com/crumheaven/?hl=en"))).toBe(true);
    expect(isCuratedEvent(apiEvent("Tropical Pirate Nights", "https://www.instagram.com/p/abc123/"))).toBe(false);
    expect(isCuratedEvent(apiEvent("Loppis", "https://www.loppistajm.se/"))).toBe(false);
    expect(isCuratedEvent(apiEvent("Utflykt", "https://www.visitstockholm.se/"))).toBe(false);
  });

  test("Debaser Strand kräver namnet, inte hela debaser.se", () => {
    expect(isCuratedEvent(apiEvent("Ready For It? - Swiftie Club", "https://www.debaser.se/kalender/x/"))).toBe(
      false,
    );
    expect(isCuratedEvent(apiEvent("Debaser Strand: Klubb", "https://www.debaser.se/"))).toBe(true);
  });
});

describe("isCuratedEvent – namn", () => {
  test("flerordsnamn matchar som hel fras", () => {
    expect(isCuratedEvent(apiEvent("Julbord på Karamellan vid Drottningholms Slott 2026"))).toBe(true);
    expect(isCuratedEvent(apiEvent("Vandring i solnedgången i Tyresta nationalpark"))).toBe(true);
    expect(isCuratedEvent(apiEvent("Afterwork på John Scott’s Kungsgatan"))).toBe(true);
  });

  test("enstaka ord matchar bara exakt", () => {
    expect(isCuratedEvent(apiEvent("Camping"))).toBe(true);
    expect(isCuratedEvent(apiEvent("Camping under stjärnorna"))).toBe(false);
    expect(isCuratedEvent(apiEvent("Rigoletto Speciale"))).toBe(false);
    expect(isCuratedEvent(apiEvent("Vem stal den vackra trädgården från gåsen?"))).toBe(false);
  });

  test("kända falska träffar hålls borta", () => {
    expect(isCuratedEvent(apiEvent("Rigoletto Speciale", "https://www.operacongrazia.com/rigoletto"))).toBe(false);
    expect(isCuratedEvent(apiEvent("Vem stal den vackra trädgården?", "https://www.konsthallc.se/"))).toBe(false);
    expect(isCuratedEvent(apiEvent("Camping under stjärnorna", "https://example.com/x"))).toBe(false);
    expect(isCuratedEvent(apiEvent("Okänd klubbkväll", "https://example.com/x"))).toBe(false);
  });
});

describe("withFeedSource", () => {
  test("stämplar API-event som api eller curated", () => {
    expect(withFeedSource(apiEvent("Hemlig klubb", "https://example.com/x")).feedSource).toBe("api");
    expect(withFeedSource(apiEvent("Fisk", "https://www.kajsasfisk.se/x")).feedSource).toBe("curated");
    expect(withFeedSource(apiEvent("Lucia på Berns", "https://www.berns.se/x")).feedSource).toBe("api");
  });

  test("appens event blir app", () => {
    const event = { name: "Eget event", organizerId: "me", feedSource: undefined };
    expect(withFeedSource(event).feedSource).toBe("app");
  });

  test("rör inte event vars stämpel stämmer", () => {
    const stamped = { ...apiEvent("Hemlig klubb"), feedSource: "api" as const };
    expect(withFeedSource(stamped)).toBe(stamped);
  });

  test("stämplar om när listan ändrats sedan cachen skrevs", () => {
    const stale = { ...apiEvent("Hemlig klubb"), feedSource: "curated" as const };
    expect(withFeedSource(stale).feedSource).toBe("api");
  });

  test("isTemporaryEvent läser stämpeln i stället för att räkna om", () => {
    const stamped = { ...apiEvent("Hemlig klubb", "https://example.com/x"), feedSource: "curated" as const };
    expect(isTemporaryEvent(stamped)).toBe(false);
    expect(isTemporaryEvent({ ...apiEvent("Hemlig klubb"), feedSource: "api" as const })).toBe(true);
  });
});

describe("matchesSourceTab", () => {
  test("delar upp temporära och kuraterade", () => {
    const temporary = withFeedSource(apiEvent("Hemlig klubb", "https://example.com/x"));
    const curated = withFeedSource(apiEvent("Fisk", "https://www.kajsasfisk.se/x"));
    expect(matchesSourceTab(temporary, "event")).toBe(true);
    expect(matchesSourceTab(temporary, "fasta")).toBe(false);
    expect(matchesSourceTab(curated, "fasta")).toBe(true);
    expect(matchesSourceTab(curated, "event")).toBe(false);
    expect(matchesSourceTab(temporary, "bada")).toBe(true);
    expect(matchesSourceTab(curated, "bada")).toBe(true);
  });
});

test("listan är intakt", () => {
  expect(CURATED_VENUES.length).toBeGreaterThanOrEqual(190);
});
