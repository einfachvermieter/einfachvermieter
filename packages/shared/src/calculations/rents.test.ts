import { describe, expect, it } from "vitest";
import { pickRentForDate, pickRentForMonth } from "./rents.js";

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
