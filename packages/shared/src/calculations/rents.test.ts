import { describe, expect, it } from "vitest";
import {
  pickRentForDate,
  pickRentForMonth,
  rentTargetForMonth,
} from "./rents.js";

const rents = [
  { startDate: null, endDate: "2025-06-30", monthlyBaseRentCents: 50_000 },
  {
    startDate: "2025-07-01",
    endDate: "2025-12-31",
    monthlyBaseRentCents: 52_000,
  },
  { startDate: "2026-01-01", endDate: null, monthlyBaseRentCents: 54_000 },
];

describe("pickRentForDate", () => {
  it("behandelt offene Grenzen als Vertragsbeginn und Vertragsende", () => {
    expect(pickRentForDate(rents, "1990-01-01")?.monthlyBaseRentCents).toBe(
      50_000,
    );
    expect(pickRentForDate(rents, "2099-12-31")?.monthlyBaseRentCents).toBe(
      54_000,
    );
  });

  it("zählt den ersten und den letzten Tag eines Zeitraums mit", () => {
    expect(pickRentForDate(rents, "2025-06-30")?.monthlyBaseRentCents).toBe(
      50_000,
    );
    expect(pickRentForDate(rents, "2025-07-01")?.monthlyBaseRentCents).toBe(
      52_000,
    );
    expect(pickRentForDate(rents, "2025-12-31")?.monthlyBaseRentCents).toBe(
      52_000,
    );
  });

  it("nimmt bei überlappenden Zeiträumen den früheren Eintrag", () => {
    const overlapping = [
      { startDate: null, endDate: "2025-07-31", monthlyBaseRentCents: 50_000 },
      { startDate: "2025-07-01", endDate: null, monthlyBaseRentCents: 52_000 },
    ];

    expect(
      pickRentForDate(overlapping, "2025-07-15")?.monthlyBaseRentCents,
    ).toBe(50_000);
  });

  it("findet in einer Lücke und ohne Einträge nichts", () => {
    const withGap = [
      { startDate: null, endDate: "2025-06-30" },
      { startDate: "2025-08-01", endDate: null },
    ];

    expect(pickRentForDate(withGap, "2025-07-15")).toBeUndefined();
    expect(pickRentForDate([], "2025-07-15")).toBeUndefined();
  });
});

describe("pickRentForMonth", () => {
  it("richtet sich nach dem Monatsersten", () => {
    expect(pickRentForMonth(rents, "2025-06")?.monthlyBaseRentCents).toBe(
      50_000,
    );
    expect(pickRentForMonth(rents, "2025-07")?.monthlyBaseRentCents).toBe(
      52_000,
    );
  });

  it("lässt eine Änderung mitten im Monat erst im Folgemonat gelten", () => {
    const midMonth = [
      { startDate: null, endDate: "2025-07-14", monthlyBaseRentCents: 50_000 },
      { startDate: "2025-07-15", endDate: null, monthlyBaseRentCents: 52_000 },
    ];

    expect(pickRentForMonth(midMonth, "2025-07")?.monthlyBaseRentCents).toBe(
      50_000,
    );
    expect(pickRentForMonth(midMonth, "2025-08")?.monthlyBaseRentCents).toBe(
      52_000,
    );
  });
});

describe("rentTargetForMonth", () => {
  const rent = {
    startDate: null,
    endDate: null,
    monthlyBaseRentCents: 60_000,
    monthlyAdvanceCents: 15_000,
  };
  const openRent = [rent];

  it("setzt einen vollen Monat mit dem vollen Mietsatz an", () => {
    expect(
      rentTargetForMonth(
        openRent,
        { startDate: "2025-01-01", endDate: null },
        "2025-02",
      ),
    ).toEqual({ baseRentCents: 60_000, advanceCents: 15_000 });
  });

  it("rechnet den Einzugsmonat nach Kalendertagen des Monats", () => {
    // 15.04. bis 30.04. = 16 von 30 Tagen
    expect(
      rentTargetForMonth(
        openRent,
        { startDate: "2025-04-15", endDate: null },
        "2025-04",
      ),
    ).toEqual({ baseRentCents: 32_000, advanceCents: 8000 });

    // 15.05. bis 31.05. = 17 von 31 Tagen
    expect(
      rentTargetForMonth(
        openRent,
        { startDate: "2025-05-15", endDate: null },
        "2025-05",
      ),
    ).toEqual({ baseRentCents: 32_903, advanceCents: 8226 });
  });

  it("rechnet den Einzugsmonat auch, wenn der Mietsatz den Vertragsbeginn als Datum trägt", () => {
    const datedRent = [{ ...rent, startDate: "2025-04-15" }];

    expect(
      rentTargetForMonth(
        datedRent,
        { startDate: "2025-04-15", endDate: null },
        "2025-04",
      ),
    ).toEqual({ baseRentCents: 32_000, advanceCents: 8000 });
  });

  it("rechnet den Auszugsmonat anteilig", () => {
    // 01.06. bis 10.06. = 10 von 30 Tagen
    expect(
      rentTargetForMonth(
        openRent,
        { startDate: "2025-01-01", endDate: "2025-06-10" },
        "2025-06",
      ),
    ).toEqual({ baseRentCents: 20_000, advanceCents: 5000 });
  });

  it("zählt bei Beginn und Ende im selben Monat nur die Tage dazwischen", () => {
    // 10.02. bis 16.02. = 7 von 28 Tagen
    expect(
      rentTargetForMonth(
        openRent,
        { startDate: "2025-02-10", endDate: "2025-02-16" },
        "2025-02",
      ),
    ).toEqual({ baseRentCents: 15_000, advanceCents: 3750 });
  });

  it("berücksichtigt den Schalttag", () => {
    // 15.02. bis 29.02.2024 = 15 von 29 Tagen
    expect(
      rentTargetForMonth(
        openRent,
        { startDate: "2024-02-15", endDate: null },
        "2024-02",
      ),
    ).toEqual({ baseRentCents: 31_034, advanceCents: 7759 });
  });

  it("gewichtet einen Mietsatzwechsel mitten im Monat nach Tagen", () => {
    const changing = [
      {
        startDate: null,
        endDate: "2025-04-14",
        monthlyBaseRentCents: 60_000,
        monthlyAdvanceCents: 15_000,
      },
      {
        startDate: "2025-04-15",
        endDate: null,
        monthlyBaseRentCents: 90_000,
        monthlyAdvanceCents: 15_000,
      },
    ];

    // 14 Tage zu 600 EUR + 16 Tage zu 900 EUR, je durch 30
    expect(
      rentTargetForMonth(
        changing,
        { startDate: "2025-01-01", endDate: null },
        "2025-04",
      ),
    ).toEqual({ baseRentCents: 76_000, advanceCents: 15_000 });
  });

  it("liefert außerhalb des Vertrags und ohne Mietsatz nichts", () => {
    const contract = { startDate: "2025-04-15", endDate: "2025-06-10" };

    expect(rentTargetForMonth(openRent, contract, "2025-03")).toBeUndefined();
    expect(rentTargetForMonth(openRent, contract, "2025-07")).toBeUndefined();
    expect(rentTargetForMonth([], contract, "2025-05")).toBeUndefined();
  });
});
