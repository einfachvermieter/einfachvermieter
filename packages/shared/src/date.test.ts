import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { todayIso } from "./date.js";

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
