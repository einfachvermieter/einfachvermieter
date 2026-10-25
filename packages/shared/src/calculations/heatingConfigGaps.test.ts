import { afterEach, describe, expect, it, vi } from "vitest";
import { uncoveredHeatingConfigPeriods } from "./heatingConfigGaps.js";

const version = (validFrom: string, validTo: string | null = null) => ({
  validFrom,
  validTo,
});

describe("uncoveredHeatingConfigPeriods", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("findet bei lückenlosen Versionen keinen Abschnitt", () => {
    const configs = [
      version("2024-01-01", "2024-12-31"),
      version("2025-01-01", "2025-06-30"),
      version("2025-07-01"),
    ];

    expect(
      uncoveredHeatingConfigPeriods(configs, "2024-01-01", "2026-12-31"),
    ).toEqual([]);
  });

  it("findet eine Lücke zwischen zwei Versionen", () => {
    const configs = [
      version("2025-01-01", "2025-03-31"),
      version("2025-05-01"),
    ];

    expect(
      uncoveredHeatingConfigPeriods(configs, "2025-01-01", "2025-12-31"),
    ).toEqual([{ start: "2025-04-01", end: "2025-04-30" }]);
  });

  it("findet zwei Lücken, unabhängig von der Reihenfolge der Liste", () => {
    const configs = [
      version("2025-09-01"),
      version("2025-01-01", "2025-03-31"),
      version("2025-05-01", "2025-07-31"),
    ];

    expect(
      uncoveredHeatingConfigPeriods(configs, "2025-01-01", "2025-12-31"),
    ).toEqual([
      { start: "2025-04-01", end: "2025-04-30" },
      { start: "2025-08-01", end: "2025-08-31" },
    ]);
  });

  it("findet eine Lücke von einem Tag", () => {
    const configs = [
      version("2025-01-01", "2025-03-30"),
      version("2025-04-01"),
    ];

    expect(
      uncoveredHeatingConfigPeriods(configs, "2025-01-01", "2025-12-31"),
    ).toEqual([{ start: "2025-03-31", end: "2025-03-31" }]);
  });

  it("sieht bei einer Version ohne Ende kein offenes Ende", () => {
    expect(
      uncoveredHeatingConfigPeriods(
        [version("2020-01-01")],
        "2020-01-01",
        "2030-12-31",
      ),
    ).toEqual([]);
  });

  it("gibt den Rest des Zeitraums zurück, wenn die letzte Version ohne Nachfolgerin endet", () => {
    expect(
      uncoveredHeatingConfigPeriods(
        [version("2025-01-01", "2026-06-30")],
        "2025-01-01",
        "2026-10-26",
      ),
    ).toEqual([{ start: "2026-07-01", end: "2026-10-26" }]);
  });

  it("findet bei einem Ende nach dem Zeitraum keinen Abschnitt, bei längerem Zeitraum schon", () => {
    const configs = [version("2025-01-01", "2026-12-31")];

    expect(
      uncoveredHeatingConfigPeriods(configs, "2025-01-01", "2026-10-26"),
    ).toEqual([]);
    expect(
      uncoveredHeatingConfigPeriods(configs, "2026-07-01", "2027-06-30"),
    ).toEqual([{ start: "2027-01-01", end: "2027-06-30" }]);
  });

  it("gibt einen Abschnitt am Anfang zurück, wenn der Zeitraum vor der ersten Version beginnt", () => {
    expect(
      uncoveredHeatingConfigPeriods(
        [version("2025-04-01")],
        "2025-01-01",
        "2025-12-31",
      ),
    ).toEqual([{ start: "2025-01-01", end: "2025-03-31" }]);
  });

  it("übergeht eine Version, die vor dem Zeitraum endet", () => {
    const configs = [
      version("2023-01-01", "2023-12-31"),
      version("2025-01-01"),
    ];

    expect(
      uncoveredHeatingConfigPeriods(configs, "2025-01-01", "2025-12-31"),
    ).toEqual([]);
  });

  it("springt bei überlappenden Versionen nicht zurück", () => {
    const configs = [
      version("2025-01-01", "2025-06-30"),
      version("2025-03-01", "2025-04-30"),
      version("2025-07-01"),
    ];

    expect(
      uncoveredHeatingConfigPeriods(configs, "2025-01-01", "2025-12-31"),
    ).toEqual([]);
  });

  it("sieht bei einer Version, die über ihre Vorgängerin hinausreicht, nur die Lücke danach", () => {
    const configs = [
      version("2026-01-01", "2026-06-30"),
      version("2026-05-01", "2026-08-31"),
      version("2026-10-01"),
    ];

    expect(
      uncoveredHeatingConfigPeriods(configs, "2026-01-01", "2026-12-31"),
    ).toEqual([{ start: "2026-09-01", end: "2026-09-30" }]);
  });

  it("gibt ohne Version den ganzen Zeitraum zurück", () => {
    expect(
      uncoveredHeatingConfigPeriods([], "2025-01-01", "2025-12-31"),
    ).toEqual([{ start: "2025-01-01", end: "2025-12-31" }]);
  });

  it("schneidet eine Lücke am Ende des Zeitraums ab", () => {
    const configs = [
      version("2025-01-01", "2025-03-31"),
      version("2026-01-01"),
    ];

    expect(
      uncoveredHeatingConfigPeriods(configs, "2025-01-01", "2025-06-30"),
    ).toEqual([{ start: "2025-04-01", end: "2025-06-30" }]);
  });

  it("liest kein Datum außer dem übergebenen Zeitraum", () => {
    const configs = [version("2025-01-01", "2025-06-30")];
    const expected = [{ start: "2025-07-01", end: "2025-12-31" }];

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2020-01-01T12:00:00Z"));
    expect(
      uncoveredHeatingConfigPeriods(configs, "2025-01-01", "2025-12-31"),
    ).toEqual(expected);
    vi.setSystemTime(new Date("2030-01-01T12:00:00Z"));
    expect(
      uncoveredHeatingConfigPeriods(configs, "2025-01-01", "2025-12-31"),
    ).toEqual(expected);
  });
});
