import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { StorageService } from "./storage.service.js";

const storage = () => {
  const base = mkdtempSync(join(tmpdir(), "ev-storage-"));
  return { base, service: new StorageService(base) };
};

describe("StorageService", () => {
  it("liest einen Key mit Schrägstrichen, auch wenn das System Rückstriche nutzt", async () => {
    const { base, service } = storage();
    mkdirSync(join(base, "settings"), { recursive: true });
    writeFileSync(join(base, "settings", "sender-logo.svg"), "<svg />");

    const content = await service.read("settings/sender-logo.svg");

    expect(content.toString()).toBe("<svg />");
  });

  it("schreibt verschachtelte Keys und listet sie mit Schrägstrichen auf", async () => {
    const { base, service } = storage();

    await service.write("cost-entries/abc/beleg.pdf", Buffer.from("x"));

    expect(
      readFileSync(join(base, "cost-entries", "abc", "beleg.pdf")).toString(),
    ).toBe("x");
    expect(await service.listKeys()).toEqual(["cost-entries/abc/beleg.pdf"]);
  });

  it("weist Keys ab, die aus dem Basisverzeichnis führen", () => {
    const { service } = storage();

    // `read` prüft den Key synchron, bevor es überhaupt liest
    expect(() => service.read("../geheim.txt")).toThrow(
      /escapes base directory/u,
    );
    expect(() => service.read(`..${sep}geheim.txt`)).toThrow(
      /escapes base directory/u,
    );
    expect(() => service.read("settings/../../geheim.txt")).toThrow(
      /escapes base directory/u,
    );
  });
});
