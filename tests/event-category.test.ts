import { describe, expect, test } from "bun:test";
import { categoryForEvent, categoryFromText, resolveCategory } from "../src/lib/event-category";

describe("ordgränser", () => {
  test("korta ord matchar bara som hela ord", () => {
    expect(
      categoryFromText("Vikingarnas värld – världens största vikingautställning, livet"),
    ).toBeUndefined();
    expect(categoryFromText("Blowing Figures into Space, djurskulpturer")).toBeUndefined();
    expect(categoryFromText("Ölprovning masterclass, fördjupad")).not.toBe("musik");
    expect(categoryFromText("Rättegångarna format")).toBeUndefined();
    expect(categoryFromText("Gemensam bastu och kallbad, runt sjön")).not.toBe("sport");
    expect(categoryFromText("LANDLINES kevin")).not.toBe("mat");
    expect(categoryFromText("Föredrag: Katedraler i underjorden, kvinnor")).not.toBe("mat");
    expect(categoryFromText("Gamla stan – historisk vandring, följ med")).not.toBe("mat");
  });

  test("riktiga träffar fungerar fortfarande", () => {
    expect(categoryFromText("Parken EMO dj")).toBe("musik");
    expect(categoryFromText("Konsert: Gershwin till Bernstein")).toBe("musik");
    expect(categoryFromText("Matvandring i Stockholm")).toBe("mat");
    expect(categoryFromText("Ölprovning masterclass")).toBe("mat");
    expect(categoryFromText("Vinprovning i Gamla stan")).toBe("mat");
    expect(categoryFromText("5 km run i Hagaparken")).toBe("sport");
    expect(categoryFromText("Julmarknad på Stortorget 2026")).toBe("shopping");
    expect(categoryFromText("Skärgårdstur med kajak")).toBe("utomhus");
  });
});

describe("titel före beskrivning", () => {
  test("titeln vinner över beskrivningen", () => {
    expect(
      categoryForEvent({
        name: "Julbord i Vinterträdgården 2026",
        place: "Grand Hôtel",
        description: "musik och live dj hela kvällen",
      }),
    ).toBe("mat");
  });

  test("beskrivningen används när titeln inte säger något", () => {
    expect(
      categoryForEvent({ name: "Vernissage", description: "konsert med orkester" }),
    ).toBe("musik");
  });

  test("annars kultur", () => {
    expect(categoryForEvent({ name: "Något", description: "" })).toBe("kultur");
  });
});

describe("listan som fallback", () => {
  test("fyller bara i när API-texten gett kultur", () => {
    expect(resolveCategory("kultur", "mat")).toBe("mat");
    expect(resolveCategory("kultur", "utomhus")).toBe("utomhus");
  });

  test("rör inte en säker API-kategori", () => {
    expect(resolveCategory("musik", "kultur")).toBe("musik");
    expect(resolveCategory("mat", "kultur")).toBe("mat");
  });

  test("utan listträff behålls kultur", () => {
    expect(resolveCategory("kultur", undefined)).toBe("kultur");
  });
});
