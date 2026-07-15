import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { isoDatePlusOneYear, todayIso } from "./date.js";

describe("todayIso", () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    // Tokyo (UTC+9): um 23:30 UTC ist dort schon der Folgetag.
    process.env.TZ = "Asia/Tokyo";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-14T23:30:00Z"));
  });

  afterAll(() => {
    vi.useRealTimers();
    process.env.TZ = originalTz;
  });

  it("gibt das lokale Datum, nicht das UTC-Datum", () => {
    expect(todayIso()).toBe("2026-03-15");
  });
});

describe("isoDatePlusOneYear", () => {
  it("erhöht nur das Jahr", () => {
    expect(isoDatePlusOneYear("2024-01-01")).toBe("2025-01-01");
  });

  it("liefert am 29. Februar den String-Grenzwert für Vergleiche", () => {
    expect(isoDatePlusOneYear("2024-02-29")).toBe("2025-02-29");
  });
});
