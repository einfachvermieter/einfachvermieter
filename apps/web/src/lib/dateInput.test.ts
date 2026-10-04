import { describe, expect, it } from "vitest";
import {
  dateToIso,
  formatForMonth,
  formatIsoDateForDisplay,
  formatIsoMonthForDisplay,
  isoForMonthBoundary,
  isoToDate,
  parseDisplayDateToIso,
  parseDisplayMonthToIso,
} from "./dateInput";

describe("parseDisplayDateToIso", () => {
  it("liest deutsche, kompakte und ISO-Schreibweise", () => {
    expect(parseDisplayDateToIso("01.02.2025")).toBe("2025-02-01");
    expect(parseDisplayDateToIso("1.2.2025")).toBe("2025-02-01");
    expect(parseDisplayDateToIso("01022025")).toBe("2025-02-01");
    expect(parseDisplayDateToIso("2025-02-01")).toBe("2025-02-01");
    expect(parseDisplayDateToIso("  01.02.2025 ")).toBe("2025-02-01");
  });

  it("unterscheidet leere von ungültiger Eingabe", () => {
    expect(parseDisplayDateToIso("")).toBe("");
    expect(parseDisplayDateToIso("   ")).toBe("");
    expect(parseDisplayDateToIso("abc")).toBeNull();
  });

  it("greift nicht mitten im Tippen bei zweistelligem Jahr", () => {
    expect(parseDisplayDateToIso("01.01.19")).toBeNull();
  });

  it("weist Tage ab, die es nicht gibt", () => {
    expect(parseDisplayDateToIso("31.02.2025")).toBeNull();
    expect(parseDisplayDateToIso("29.02.2025")).toBeNull();
    expect(parseDisplayDateToIso("29.02.2024")).toBe("2024-02-29");
  });

  it("weist Jahre außerhalb von 1900 bis 2200 ab", () => {
    expect(parseDisplayDateToIso("31.12.1899")).toBeNull();
    expect(parseDisplayDateToIso("01.01.1900")).toBe("1900-01-01");
    expect(parseDisplayDateToIso("31.12.2200")).toBe("2200-12-31");
    expect(parseDisplayDateToIso("01.01.2201")).toBeNull();
  });
});

describe("parseDisplayMonthToIso", () => {
  it("liefert je nach Grenze den ersten oder letzten Tag des Monats", () => {
    expect(parseDisplayMonthToIso("02.2025", "start")).toBe("2025-02-01");
    expect(parseDisplayMonthToIso("02.2025", "end")).toBe("2025-02-28");
    expect(parseDisplayMonthToIso("2.2024", "end")).toBe("2024-02-29");
    expect(parseDisplayMonthToIso("122025", "end")).toBe("2025-12-31");
    expect(parseDisplayMonthToIso("2025-12", "start")).toBe("2025-12-01");
  });

  it("unterscheidet leere von ungültiger Eingabe", () => {
    expect(parseDisplayMonthToIso("", "start")).toBe("");
    expect(parseDisplayMonthToIso("13.2025", "start")).toBeNull();
    expect(parseDisplayMonthToIso("02.25", "start")).toBeNull();
  });
});

describe("isoForMonthBoundary", () => {
  it("rechnet mit dem Monatsindex ab 0", () => {
    expect(isoForMonthBoundary(2025, 0, "start")).toBe("2025-01-01");
    expect(isoForMonthBoundary(2025, 11, "end")).toBe("2025-12-31");
  });
});

describe("Anzeigeformate", () => {
  it("formatiert ISO-Datum und Monat deutsch", () => {
    expect(formatIsoDateForDisplay("2025-02-01")).toBe("01.02.2025");
    expect(formatIsoMonthForDisplay("2025-02-01")).toBe("02.2025");
    expect(formatForMonth("2025-02")).toBe("02.2025");
  });

  it("gibt für leere oder kaputte Werte einen leeren Text zurück", () => {
    expect(formatIsoDateForDisplay("")).toBe("");
    expect(formatIsoDateForDisplay("2025-13-01")).toBe("");
    expect(formatIsoMonthForDisplay("kaputt")).toBe("");
  });
});

describe("isoToDate und dateToIso", () => {
  it("bleiben beim Hin- und Rückweg auf demselben Kalendertag", () => {
    for (const iso of ["2025-01-01", "2024-02-29", "2025-12-31"]) {
      const date = isoToDate(iso);
      expect(date).toBeDefined();
      expect(dateToIso(date as Date)).toBe(iso);
    }
  });

  it("liefert für leere oder kaputte Werte kein Datum", () => {
    expect(isoToDate("")).toBeUndefined();
    expect(isoToDate("2025-02-30")).toBeUndefined();
  });
});
