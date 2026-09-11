import { describe, expect, it } from "vitest";
import { pickEntry } from "./updates.service.js";

const entry = (version: string) => ({
  version,
  downloadUrl: `https://example.test/${version}`,
});

const feed = {
  stable: entry("2026.1.0"),
  beta: entry("2026.2.0-beta.1"),
};

describe("pickEntry", () => {
  it("bietet stabilen Installationen nur den stabilen Zweig an", () => {
    expect(pickEntry(feed, "stable")?.version).toBe("2026.1.0");
  });

  it("bietet Vorabversionen die neuere Beta an", () => {
    expect(pickEntry(feed, "beta")?.version).toBe("2026.2.0-beta.1");
  });

  it("holt Vorabversionen auf den stabilen Zweig zurück, wenn dieser weiter ist", () => {
    const feedWithOldBeta = {
      stable: entry("2026.2.0"),
      beta: entry("2026.2.0-beta.1"),
    };
    expect(pickEntry(feedWithOldBeta, "beta")?.version).toBe("2026.2.0");
  });

  it("liefert ohne Beta-Zweig den stabilen Eintrag und ohne Eintraege null", () => {
    expect(pickEntry({ stable: entry("2026.1.0") }, "beta")?.version).toBe(
      "2026.1.0",
    );
    expect(pickEntry({ beta: entry("2026.2.0-beta.1") }, "stable")).toBeNull();
    expect(pickEntry(undefined, "stable")).toBeNull();
  });

  it("verwirft Eintraege, deren Download-Adresse nicht https ist", () => {
    for (const downloadUrl of [
      "javascript:alert(1)",
      "http://example.test/2026.1.0",
      "file:///etc/passwd",
      "keine Adresse",
    ]) {
      expect(
        pickEntry({ stable: { version: "2026.1.0", downloadUrl } }, "stable"),
      ).toBeNull();
    }
  });

  it("laesst Release-Notes ohne https weg, behaelt aber den Eintrag", () => {
    const withUnsafeNotes = {
      stable: { ...entry("2026.1.0"), releaseNotesUrl: "javascript:alert(1)" },
    };
    const picked = pickEntry(withUnsafeNotes, "stable");
    expect(picked?.version).toBe("2026.1.0");
    expect(picked?.releaseNotesUrl).toBeNull();
  });
});
