import { describe, expect, it } from "vitest";
import { isoDatePlusOneYear } from "../date.js";
import {
  addDaysIso,
  countPeriodMonths,
  daysBetween,
  daysInYear,
  intersect,
  monthBoundary,
  periodShareOfYear,
  prorationFactor,
} from "./period.js";

describe("daysInYear", () => {
  it("liefert 366 im Schaltjahr und sonst 365", () => {
    expect(daysInYear("2024-07-15")).toBe(366);
    expect(daysInYear("2025-07-15")).toBe(365);
    // 2100 ist kein Schaltjahr (durch 100, nicht durch 400 teilbar).
    expect(daysInYear("2100-03-01")).toBe(365);
  });
});

describe("daysBetween", () => {
  it("berechnet ganzes Jahr korrekt (inklusiv)", () => {
    expect(daysBetween("2025-01-01", "2025-12-31")).toBe(365);
  });

  it("berechnet Schaltjahr korrekt", () => {
    expect(daysBetween("2024-01-01", "2024-12-31")).toBe(366);
  });

  it("ein einzelner Tag = 1", () => {
    expect(daysBetween("2025-06-15", "2025-06-15")).toBe(1);
  });

  it("Monatsgrenze korrekt", () => {
    expect(daysBetween("2025-01-01", "2025-01-31")).toBe(31);
  });
});

describe("intersect", () => {
  it("findet Overlap bei überlappenden Perioden", () => {
    const result = intersect(
      { start: "2024-08-01", end: "2025-07-31" },
      { start: "2025-01-01", end: "2025-12-31" },
    );
    expect(result).toEqual({ start: "2025-01-01", end: "2025-07-31" });
  });

  it("gibt null zurück bei überlappungsfreien Perioden", () => {
    const result = intersect(
      { start: "2024-01-01", end: "2024-06-30" },
      { start: "2024-07-01", end: "2024-12-31" },
    );
    expect(result).toBeNull();
  });

  it("funktioniert bei vollständiger Enthaltenheit", () => {
    const result = intersect(
      { start: "2025-01-01", end: "2025-12-31" },
      { start: "2025-03-01", end: "2025-08-31" },
    );
    expect(result).toEqual({ start: "2025-03-01", end: "2025-08-31" });
  });
});

describe("prorationFactor", () => {
  it("volle Überlappung -> 1,0", () => {
    const factor = prorationFactor(
      { start: "2025-01-01", end: "2025-12-31" },
      { start: "2025-01-01", end: "2025-12-31" },
    );
    expect(factor).toBe(1);
  });

  it("keine Überlappung -> 0", () => {
    const factor = prorationFactor(
      { start: "2023-01-01", end: "2023-12-31" },
      { start: "2025-01-01", end: "2025-12-31" },
    );
    expect(factor).toBe(0);
  });

  it("Gas-Rechnung über Jahresgrenze", () => {
    // Rechnung 01.08.2024 - 31.07.2025, Abrechnung 01.01.2025 - 31.12.2025
    // Overlap 01.01.2025 - 31.07.2025 = 212 Tage
    // Rechnung gesamt: 365 Tage
    const factor = prorationFactor(
      { start: "2024-08-01", end: "2025-07-31" },
      { start: "2025-01-01", end: "2025-12-31" },
    );
    expect(factor).toBeCloseTo(212 / 365, 6);
  });
});

/**
 * Jeder Tag der Jahre 2027 und 2028 (2028 ist ein Schaltjahr)
 */
const startDays = Array.from({ length: 731 }, (_, index) =>
  addDaysIso("2027-01-01", index),
);

const share = (start: string, end: string) => periodShareOfYear({ start, end });

/**
 * Vergleicht zwei Anteile in ganzen Zahlen; `null` ist das volle Jahr.
 */
const isLarger = (
  later: ReturnType<typeof share>,
  earlier: ReturnType<typeof share>,
): boolean => {
  const [a, b] = [later, earlier].map(
    (value) => value ?? { numerator: 1, denominator: 1 },
  );

  return (
    (a?.numerator ?? 0) * (b?.denominator ?? 0) >
    (b?.numerator ?? 0) * (a?.denominator ?? 0)
  );
};

describe("monthBoundary", () => {
  it.each([
    ["2027-01-28", "2027-02-28", "2027-03-28", "2027-04-28", "2028-01-28"],
    ["2027-01-29", "2027-03-01", "2027-03-29", "2027-04-29", "2028-01-29"],
    ["2027-01-30", "2027-03-01", "2027-03-30", "2027-04-30", "2028-01-30"],
    ["2027-01-31", "2027-03-01", "2027-03-31", "2027-05-01", "2028-01-31"],
    ["2028-01-30", "2028-03-01", "2028-03-30", "2028-04-30", "2029-01-30"],
    ["2028-01-31", "2028-03-01", "2028-03-31", "2028-05-01", "2029-01-31"],
    ["2027-02-28", "2027-03-28", "2027-04-28", "2027-05-28", "2028-02-28"],
    ["2028-02-29", "2028-03-29", "2028-04-29", "2028-05-29", "2029-03-01"],
  ])("ab %s", (start, first, second, third, twelfth) => {
    expect(monthBoundary(start, 0)).toBe(start);
    expect(monthBoundary(start, 1)).toBe(first);
    expect(monthBoundary(start, 2)).toBe(second);
    expect(monthBoundary(start, 3)).toBe(third);
    expect(monthBoundary(start, 12)).toBe(twelfth);
  });

  it("ist für jeden Anfangstag ein gültiges Datum und wächst mit jedem Monat", () => {
    for (const start of startDays) {
      for (let months = 1; months <= 12; months++) {
        const boundary = monthBoundary(start, months);

        // Ein ungültiges Datum käme aus der Tagesrechnung verändert zurück
        expect(addDaysIso(boundary, 0)).toBe(boundary);
        expect(boundary > monthBoundary(start, months - 1)).toBe(true);
      }
    }
  });

  it("zieht die Jahresgrenze am selben Tag wie die Prüfung beim Anlegen", () => {
    for (const start of startDays) {
      const lastAllowedEnd = addDaysIso(monthBoundary(start, 12), -1);

      // Beim Anlegen gilt periodEnd < isoDatePlusOneYear(periodStart)
      expect(lastAllowedEnd < isoDatePlusOneYear(start)).toBe(true);
      expect(addDaysIso(lastAllowedEnd, 1) < isoDatePlusOneYear(start)).toBe(
        false,
      );
    }
  });
});

describe("periodShareOfYear", () => {
  it.each([
    ["2027-01-01", "2027-12-31"],
    ["2028-01-01", "2028-12-31"],
    ["2027-07-01", "2028-06-30"],
    ["2027-03-01", "2028-02-29"],
    ["2028-03-01", "2029-02-28"],
    ["2028-02-29", "2029-02-28"],
    ["2027-02-28", "2028-02-27"],
  ])("%s bis %s ist ein volles Jahr", (start, end) => {
    expect(share(start, end)).toBeNull();
  });

  it.each([
    // 365 Tage und trotzdem kurz: die Tageszahl taugt nicht als Kriterium
    ["2027-03-01", "2028-02-28"],
    ["2028-02-29", "2029-02-27"],
    ["2027-01-01", "2027-12-30"],
  ])("%s bis %s ist kurz", (start, end) => {
    expect(share(start, end)).not.toBeNull();
  });

  it.each([
    ["2027-01-28", "2027-02-27", 1, 0, 28, 1, 12],
    ["2027-01-28", "2027-02-28", 1, 1, 28, 29, 336],
    ["2027-01-29", "2027-02-27", 0, 30, 31, 5, 62],
    ["2027-01-29", "2027-02-28", 1, 0, 28, 1, 12],
    ["2027-01-30", "2027-02-28", 1, 0, 29, 1, 12],
    ["2027-01-31", "2027-02-28", 1, 0, 30, 1, 12],
    ["2027-01-31", "2027-03-30", 2, 0, 31, 1, 6],
    ["2027-01-31", "2027-03-31", 2, 1, 31, 21, 124],
    ["2028-02-29", "2029-02-27", 11, 30, 31, 371, 372],
  ])("Monatsende %s bis %s", (start, end, fullMonths, restDays, nextMonthDays, numerator, denominator) => {
    expect(countPeriodMonths({ start, end })).toEqual({
      fullMonths,
      restDays,
      nextMonthDays,
    });
    expect(share(start, end)).toEqual({ numerator, denominator });
  });

  it.each([
    // Acht Monate sind gekürzt 2/3, nicht 8/12 oder 240/360
    ["2027-03-01", "2027-10-31", 2, 3],
    ["2027-01-01", "2027-08-15", 58, 93],
    ["2027-01-15", "2027-02-14", 1, 12],
    ["2027-02-15", "2027-03-14", 1, 12],
    ["2027-01-31", "2027-02-27", 7, 87],
    ["2027-01-31", "2027-02-28", 1, 12],
    ["2028-01-31", "2028-02-28", 29, 360],
    ["2028-01-31", "2028-02-29", 1, 12],
    ["2028-02-29", "2028-03-28", 1, 12],
    ["2027-03-01", "2028-02-27", 173, 174],
    ["2027-03-01", "2028-02-28", 347, 348],
    ["2028-02-29", "2029-02-26", 185, 186],
    ["2028-02-29", "2029-02-27", 371, 372],
    ["2027-02-28", "2028-02-25", 185, 186],
    ["2027-02-28", "2028-02-26", 371, 372],
    // Rest über einen Monatswechsel
    ["2027-01-30", "2027-02-02", 1, 90],
  ])("%s bis %s ergibt %i/%i", (start, end, numerator, denominator) => {
    expect(share(start, end)).toEqual({ numerator, denominator });
  });

  it("wächst mit jedem Tag am Ende und erreicht am letzten Tag das volle Jahr", () => {
    // Zählt Verstöße, statt je Tag zu prüfen: gut 260.000 Zeiträume
    const violations: string[] = [];

    for (const start of startDays) {
      const lastDay = addDaysIso(monthBoundary(start, 12), -1);
      let previous = share(start, start);

      for (let end = addDaysIso(start, 1); end <= lastDay; ) {
        const current = share(start, end);

        if (
          !isLarger(current, previous) ||
          (current === null) !== (end === lastDay)
        ) {
          violations.push(`${start} bis ${end}`);
        }
        previous = current;
        end = addDaysIso(end, 1);
      }
    }

    expect(violations).toEqual([]);
  }, 30_000);

  it("wird bei früherem Anfang und gleichem Ende nie kleiner", () => {
    const end = "2027-02-28";
    const starts = ["2027-02-01", "2027-01-31", "2027-01-30", "2027-01-29"];

    // Vier verschieden lange Zeiträume sind genau ein Monat
    for (const start of starts) {
      expect(share(start, end)).toEqual({ numerator: 1, denominator: 12 });
    }

    for (const periodEnd of ["2027-02-28", "2028-02-29", "2028-07-15"]) {
      let later = share(periodEnd, periodEnd);

      for (let offset = 1; offset < 360; offset++) {
        const earlier = share(addDaysIso(periodEnd, -offset), periodEnd);

        expect(isLarger(later, earlier)).toBe(false);
        later = earlier;
      }
    }
  });
});
