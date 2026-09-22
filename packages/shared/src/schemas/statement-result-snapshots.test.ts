import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { statementResultSchema } from "./statement-result.js";

/**
 * Berechnungsergebnisse, wie sie finalisierte Abrechnungen als Snapshot
 * speichern. Neue Fassungen kommen dazu, alte bleiben liegen: Das Schema
 * muss jeden je gespeicherten Snapshot lesen können, sonst lassen sich
 * finalisierte Abrechnungen nicht mehr öffnen und kein PDF mehr erzeugen.
 */
const fixtureDir = new URL("./fixtures/statement-result/", import.meta.url);
const fixtureNames = readdirSync(fixtureDir).filter((name) =>
  name.endsWith(".json"),
);

describe("statementResultSchema liest gespeicherte Snapshots", () => {
  it("findet Fixtures", () => {
    expect(fixtureNames.length).toBeGreaterThan(0);
  });

  it.each(fixtureNames)("%s", (name) => {
    const snapshot = JSON.parse(
      readFileSync(new URL(name, fixtureDir), "utf-8"),
    );

    // Schlägt das fehl, wurde das Schema inkompatibel geändert oder die
    // Version hochgezählt.x
    expect(() => statementResultSchema.parse(snapshot)).not.toThrow();
  });
});
