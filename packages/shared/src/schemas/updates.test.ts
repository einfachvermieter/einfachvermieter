import { describe, expect, it } from "vitest";
import { appDistribution } from "./updates.js";

describe("appDistribution", () => {
  it("liest den Veröffentlichungsweg aus dem Schlüssel", () => {
    expect(appDistribution("win-store")).toBe("store");
    expect(appDistribution("macos-download")).toBe("download");
  });

  it("verweist ohne bekannten Weg auf die Anleitung", () => {
    expect(appDistribution("server")).toBe("instructions");
    expect(appDistribution("linux-deb")).toBe("instructions");
  });
});
