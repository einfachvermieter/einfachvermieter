import { describe, expect, it } from "vitest";
import { compareVersions, isNewerVersion, isPrerelease } from "./version.js";

describe("isNewerVersion", () => {
  it("vergleicht numerisch je Stelle", () => {
    expect(isNewerVersion("1.2.0", "1.1.9")).toBe(true);
    expect(isNewerVersion("1.10.0", "1.9.0")).toBe(true);
    expect(isNewerVersion("0.0.1", "0.0.1")).toBe(false);
    expect(isNewerVersion("0.0.1", "0.0.2")).toBe(false);
  });

  it("toleriert v-Präfix und fehlende Stellen", () => {
    expect(isNewerVersion("v1.0", "0.9.9")).toBe(true);
    expect(isNewerVersion("1", "1.0.0")).toBe(false);
  });

  it("ordnet Vorabversionen vor der fertigen Version ein", () => {
    expect(isNewerVersion("1.0.0", "1.0.0-beta.2")).toBe(true);
    expect(isNewerVersion("1.0.0-beta.2", "1.0.0")).toBe(false);
    expect(isNewerVersion("1.0.0-beta.3", "1.0.0-beta.2")).toBe(true);
    expect(isNewerVersion("1.0.0-beta.10", "1.0.0-beta.9")).toBe(true);
    expect(isNewerVersion("1.0.0-beta.1", "1.0.0-alpha.9")).toBe(true);
    expect(isNewerVersion("1.0.0-rc.1", "1.0.0-beta.9")).toBe(true);
    expect(isNewerVersion("1.0.0-alpha", "1.0.0-alpha.1")).toBe(false);
    expect(isNewerVersion("1.0.1-alpha.1", "1.0.0")).toBe(true);
  });

  it("liefert 0 für gleiche Versionen", () => {
    expect(compareVersions("v1.2.3-rc.1", "1.2.3-rc.1")).toBe(0);
  });
});

describe("isPrerelease", () => {
  it("erkennt das Vorab-Kennzeichen", () => {
    expect(isPrerelease("2026.1.0-beta.1")).toBe(true);
    expect(isPrerelease("v2026.1.0-rc.1")).toBe(true);
    expect(isPrerelease("2026.1.0")).toBe(false);
  });
});
