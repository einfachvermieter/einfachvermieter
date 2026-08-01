import { describe, expect, it } from "vitest";
import {
  nextStatementNumber,
  prorateExternalHeatingEntry,
} from "./statements.service.js";

const entryBase = {
  unitId: "unit-1",
  periodStart: "2025-01-01",
  periodEnd: "2025-12-31",
};

describe("prorateExternalHeatingEntry", () => {
  it("kürzt Grundkosten linear und Verbrauchskosten nach Gradtagstabelle bei Mieterwechsel (§ 9b HeizkostenV)", () => {
    const entry = {
      ...entryBase,
      totalCents: 130_000,
      baseCostCents: 30_000,
      consumptionCostCents: 100_000,
    };
    const effectivePeriod = { start: "2025-01-01", end: "2025-06-30" };

    const linear = prorateExternalHeatingEntry(
      entry,
      "linear",
      effectivePeriod,
    );
    const degreeDays = prorateExternalHeatingEntry(
      entry,
      "degree_days",
      effectivePeriod,
    );

    // Grundkosten bleiben in beiden Modi gleich (tagesanteilig, 181/365 Tage)
    expect(linear.baseCostCents).toBe(14_877);
    expect(degreeDays.baseCostCents).toBe(14_877);

    // Verbrauchskosten: linear 181/365, Gradtagstabelle Jan-Jun = 583 von 1.000 ‰
    expect(linear.consumptionCostCents).toBe(49_589);
    expect(degreeDays.consumptionCostCents).toBe(58_300);

    expect(degreeDays.totalCents).toBe(
      (degreeDays.baseCostCents ?? 0) + (degreeDays.consumptionCostCents ?? 0),
    );
  });

  it("kürzt ohne Grund-/Verbrauchs-Aufteilung den Gesamtbetrag weiterhin rein linear", () => {
    const entry = {
      ...entryBase,
      totalCents: 100_000,
      baseCostCents: null,
      consumptionCostCents: null,
    };
    const effectivePeriod = { start: "2025-01-01", end: "2025-06-30" };

    const result = prorateExternalHeatingEntry(
      entry,
      "degree_days",
      effectivePeriod,
    );

    expect(result.baseCostCents).toBeNull();
    expect(result.consumptionCostCents).toBeNull();
    expect(result.totalCents).toBe(49_589);
  });
});

describe("nextStatementNumber", () => {
  it("gibt einer eigenständigen Abrechnung die nächste freie Jahresnummer", () => {
    expect(nextStatementNumber(3, null)).toEqual({
      sequenceNumber: 4,
      revisionNumber: 1,
    });
  });

  it("behält bei einer Korrektur die Nummer und zählt die Revision hoch", () => {
    expect(
      nextStatementNumber(7, { sequenceNumber: 3, revisionNumber: 1 }),
    ).toEqual({ sequenceNumber: 3, revisionNumber: 2 });
  });

  it("zählt die Revision auch in einer Kette weiter", () => {
    const zweite = nextStatementNumber(7, {
      sequenceNumber: 3,
      revisionNumber: 2,
    });

    expect(zweite).toEqual({ sequenceNumber: 3, revisionNumber: 3 });
  });

  it("füllt Lücken nicht auf, damit keine Nummer zweimal vergeben wird", () => {
    // Nummer 2 gehört einer stornierten Abrechnung und bleibt belegt.
    expect(nextStatementNumber(4, null).sequenceNumber).toBe(5);
  });
});
