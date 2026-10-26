import { describe, expect, it } from "vitest";
import {
  type HeatingSettings,
  heatingSettingsWriteSchema,
} from "../schemas/heating.js";
import {
  HEATING_HISTORY_FIELD_SCOPES,
  heatingConfigChangeVerdict,
  heatingConfigHistory,
  heatingSettingsProjection,
} from "./heatingConfigHistory.js";
import { addDaysIso } from "./period.js";

const period = { start: "2025-01-01", end: "2025-12-31" };

const version = (
  validFrom: string,
  validTo: string | null,
  fields: Partial<HeatingSettings> = {},
): HeatingSettings => ({
  id: `v-${validFrom}`,
  buildingId: "b1",
  mode: "internal",
  baseSharePercent: 30,
  consumptionSharePercent: 70,
  baseMethod: "living_area",
  consumptionMethod: "heat_meter",
  prorationMethod: "linear",
  heatingType: "central_with_hot_water",
  fuelType: "gas",
  hotWaterMeterId: null,
  hotWaterSupplyTemperatureCelsius: 60,
  gasBillingByCalorificValue: false,
  heatPumpMonovalent: false,
  mandatorySeventyPercent: false,
  includeBillingInfo: true,
  co2CostShareEnabled: true,
  co2BuildingRestricted: false,
  co2SupplyRestricted: false,
  co2RestrictionEvidenceNote: null,
  seventyInsulationAnswer: null,
  seventyPipesAnswer: null,
  co2BuildingRestrictionAnswer: null,
  co2SupplyRestrictionAnswer: null,
  validFrom,
  validTo,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  ...fields,
});

const verdict = (before: HeatingSettings[], after: HeatingSettings[]) =>
  heatingConfigChangeVerdict(before, after, period);

/**
 * Ein abweichender Wert je Feld des internen Zustands
 */
const internalChanges: Partial<HeatingSettings>[] = [
  { baseSharePercent: 50, consumptionSharePercent: 50 },
  { mandatorySeventyPercent: true },
  { baseMethod: "heated_area" },
  { consumptionMethod: "heat_cost_allocator" },
  { prorationMethod: "degree_days" },
  { heatingType: "central_without_hot_water" },
  { fuelType: "oil" },
  { hotWaterMeterId: "meter-1" },
  { hotWaterSupplyTemperatureCelsius: 55 },
  { gasBillingByCalorificValue: true },
  { heatPumpMonovalent: true },
  { co2CostShareEnabled: false },
  { co2BuildingRestricted: true },
  { co2SupplyRestricted: true },
  { co2RestrictionEvidenceNote: "Denkmalschutz" },
  { seventyInsulationAnswer: "unknown" },
  { seventyPipesAnswer: "yes" },
  { co2BuildingRestrictionAnswer: "no" },
  { co2SupplyRestrictionAnswer: "unknown" },
];

describe("heatingSettingsProjection", () => {
  it("ordnet jedes Feld der Version zu, passend zum Write-Schema", () => {
    const fieldsOf = (mode: string) =>
      Object.entries(HEATING_HISTORY_FIELD_SCOPES)
        .filter(([, scope]) => scope === "all" || scope === mode)
        .map(([field]) => field)
        .sort();
    for (const option of heatingSettingsWriteSchema.options) {
      const mode = option.shape.mode.value;
      const writable = Object.keys(option.shape)
        .filter((field) => field !== "validFrom" && field !== "validTo")
        .sort();
      expect(fieldsOf(mode)).toEqual(writable);
    }
  });

  it("ignoriert Füllwerte bei external und none", () => {
    const external = version("2020-01-01", null, { mode: "external" });
    expect(heatingSettingsProjection(external)).toBe(
      heatingSettingsProjection({
        ...external,
        baseSharePercent: 50,
        baseMethod: "heated_area",
        fuelType: "oil",
      }),
    );
    expect(heatingSettingsProjection(external)).not.toBe(
      heatingSettingsProjection({ ...external, includeBillingInfo: false }),
    );
    const none = version("2020-01-01", null, { mode: "none" });
    expect(heatingSettingsProjection(none)).toBe(
      heatingSettingsProjection({
        ...none,
        includeBillingInfo: false,
        co2CostShareEnabled: false,
      }),
    );
  });

  it("zählt includeBillingInfo intern nicht", () => {
    const internal = version("2020-01-01", null);
    expect(heatingSettingsProjection(internal)).toBe(
      heatingSettingsProjection({ ...internal, includeBillingInfo: false }),
    );
  });
});

describe("heatingConfigHistory", () => {
  it("legt gleiche Abschnitte zusammen und kennt keine Gültigkeit", () => {
    const split = [
      version("2020-01-01", "2025-06-30"),
      { ...version("2025-07-01", null), id: "x", updatedAt: "2026-01-01" },
    ];
    expect(heatingConfigHistory(split, period)).toEqual(
      heatingConfigHistory([version("2019-01-01", "2030-12-31")], period),
    );
    expect(heatingConfigHistory(split, period)).toHaveLength(1);
  });
});

describe("heatingConfigChangeVerdict", () => {
  const current = [version("2020-01-01", null)];

  it.each(
    internalChanges,
  )("lehnt einen geänderten Wert des internen Zustands ab: %o", (change) => {
    expect(verdict(current, [version("2020-01-01", null, change)])).toBe(
      "finalizedImmutable",
    );
  });

  it("lehnt auch Felder ohne Wirkung ab (Vorlauftemperatur ohne Warmwasser, Wärmepumpe bei Gas)", () => {
    const withoutHotWater = [
      version("2020-01-01", null, {
        heatingType: "central_without_hot_water",
      }),
    ];
    expect(
      verdict(withoutHotWater, [
        version("2020-01-01", null, {
          heatingType: "central_without_hot_water",
          hotWaterSupplyTemperatureCelsius: 50,
          heatPumpMonovalent: true,
        }),
      ]),
    ).toBe("finalizedImmutable");
  });

  it("erlaubt Änderungen außerhalb des Zeitraums", () => {
    expect(verdict(current, [version("2020-01-01", "2025-12-31")])).toBe(
      "allowed",
    );
    expect(verdict(current, [version("2025-01-01", null)])).toBe("allowed");
    expect(verdict(current, [version("2025-01-02", null)])).toBe(
      "finalizedImmutable",
    );
    expect(verdict(current, [version("2020-01-01", "2025-06-30")])).toBe(
      "finalizedImmutable",
    );
    expect(verdict(current, [])).toBe("finalizedImmutable");
  });

  it("erlaubt eine weitere Version mit gleichen Werten, nicht mit abweichendem Feld", () => {
    const shortened = [version("2020-01-01", "2025-06-30")];
    expect(verdict(current, [...shortened, version("2025-07-01", null)])).toBe(
      "allowed",
    );
    // Die Auflösung gäbe hier nur einen Hinweis, die Sperre lehnt trotzdem ab
    expect(
      verdict(current, [
        ...shortened,
        version("2025-07-01", null, { baseSharePercent: 40 }),
      ]),
    ).toBe("finalizedImmutable");
  });

  it("lehnt Wechsel der Abrechnungsart ab", () => {
    const external = [version("2020-01-01", null, { mode: "external" })];
    const none = [version("2020-01-01", null, { mode: "none" })];
    expect(verdict(external, none)).toBe("finalizedImmutable");
    expect(verdict(external, current)).toBe("finalizedImmutable");
    expect(verdict(none, current)).toBe("finalizedImmutable");
    expect(
      verdict(external, [
        version("2020-01-01", null, {
          mode: "external",
          includeBillingInfo: false,
        }),
      ]),
    ).toBe("finalizedImmutable");
  });

  it("setzt ganzen Zeitraum ohne Version und ganzen Zeitraum none gleich", () => {
    const later = [version("2026-01-01", null)];
    expect(
      verdict(later, [...later, version("2025-01-01", "2025-12-31", noneMode)]),
    ).toBe("allowed");
    expect(verdict([], [version("2025-01-01", "2025-12-31", noneMode)])).toBe(
      "allowed",
    );
    expect(verdict([], [version("2025-01-01", null)])).toBe(
      "finalizedImmutable",
    );
    expect(verdict([], [version("2026-01-01", null)])).toBe("allowed");
  });

  it("lehnt eine halb mit none gefüllte Lücke ab", () => {
    const halfConfigured = [
      version("2020-01-01", "2025-06-30", noneMode),
      version("2026-01-01", null),
    ];
    // vorher blockiert (Lücke), Bezugszustand none: none in die Lücke
    // verlängern ist eine Rückführung
    expect(
      verdict(halfConfigured, [
        version("2020-01-01", "2025-12-31", noneMode),
        version("2026-01-01", null),
      ]),
    ).toBe("allowed");
    const halfNone = [
      version("2025-07-01", "2025-12-31", noneMode),
      version("2026-01-01", null),
    ];
    expect(verdict([version("2026-01-01", null)], halfNone)).toBe(
      "finalizedImmutable",
    );
  });
});

const noneMode: Partial<HeatingSettings> = { mode: "none" };

describe("heatingConfigChangeVerdict, blockierter Altbestand", () => {
  const versionA = (validTo: string | null, fields = {}) =>
    version("2020-01-01", validTo, fields);

  it("Lücke nach A: nur Verlängern von A und Füllen mit den Werten von A", () => {
    const before = [versionA("2025-06-30"), version("2026-01-01", null)];
    const later = version("2026-01-01", null);
    expect(verdict(before, [versionA("2025-12-31"), later])).toBe("allowed");
    expect(verdict(before, [versionA("2025-09-30"), later])).toBe("allowed");
    expect(
      verdict(before, [
        ...before,
        version("2025-07-01", "2025-12-31", { fuelType: "oil" }),
      ]),
    ).toBe("legacyRepairOnly");
    expect(
      verdict(before, [
        ...before,
        version("2025-07-01", "2025-12-31", noneMode),
      ]),
    ).toBe("legacyRepairOnly");
    expect(
      verdict(before, [...before, version("2025-07-01", "2025-12-31")]),
    ).toBe("allowed");
    expect(
      verdict(before, [versionA("2025-06-30", { fuelType: "oil" }), later]),
    ).toBe("legacyRepairOnly");
    expect(verdict(before, [versionA("2025-03-31"), later])).toBe(
      "legacyRepairOnly",
    );
    expect(verdict(before, [later])).toBe("legacyRepairOnly");
  });

  it("A, dann B mit anderer Verbrauchserfassung: B entfernen, dann A verlängern", () => {
    const methodB = { consumptionMethod: "heat_cost_allocator" } as const;
    const before = [
      versionA("2025-06-30"),
      version("2025-07-01", null, methodB),
    ];
    expect(verdict(before, [versionA("2025-06-30")])).toBe("allowed");
    expect(
      verdict(before, [
        versionA("2025-06-30"),
        version("2025-10-01", null, methodB),
      ]),
    ).toBe("allowed");
    expect(
      verdict(before, [
        versionA("2025-06-30"),
        version("2026-01-01", null, methodB),
      ]),
    ).toBe("allowed");
    expect(
      verdict(before, [
        versionA("2025-03-31"),
        version("2025-06-01", null, methodB),
      ]),
    ).toBe("legacyRepairOnly");
    // Feld von B ändern, gleich ob danach rechenbar oder weiter blockiert.
    // B ganz auf die Werte von A zu setzen ist dagegen eine Rückführung.
    expect(
      verdict(before, [
        versionA("2025-06-30"),
        version("2025-07-01", null, {
          baseSharePercent: 40,
          consumptionSharePercent: 60,
        }),
      ]),
    ).toBe("legacyRepairOnly");
    expect(
      verdict(before, [versionA("2025-06-30"), version("2025-07-01", null)]),
    ).toBe("allowed");
    expect(
      verdict(before, [
        versionA("2025-06-30"),
        version("2025-07-01", null, { ...methodB, fuelType: "oil" }),
      ]),
    ).toBe("legacyRepairOnly");

    const removed = [versionA("2025-06-30")];
    const repaired = [versionA(null)];
    expect(verdict(removed, repaired)).toBe("allowed");
    // Danach gilt die strenge Regel
    expect(verdict(repaired, [versionA(null, { fuelType: "oil" })])).toBe(
      "finalizedImmutable",
    );
  });

  it("A verlängern macht den Zeitraum rechenbar, solange B noch drinliegt: abgelehnt", () => {
    const before = [
      versionA("2025-03-31"),
      version("2025-05-01", null, {
        baseSharePercent: 40,
        consumptionSharePercent: 60,
      }),
    ];
    expect(
      verdict(before, [versionA("2025-04-30"), before[1] as HeatingSettings]),
    ).toBe("legacyRepairOnly");
    const withoutB = [versionA("2025-03-31")];
    expect(verdict(before, withoutB)).toBe("allowed");
    expect(verdict(withoutB, [versionA("2025-12-31")])).toBe("allowed");
  });

  it("Überlappung am ersten Tag: eine löschen erlaubt, eine dritte nicht", () => {
    const second = version("2024-06-01", null, {
      id: "overlap",
      fuelType: "oil",
    });
    const before = [versionA(null), second];
    expect(verdict(before, [versionA(null)])).toBe("allowed");
    expect(verdict(before, [second])).toBe("allowed");
    expect(
      verdict(before, [version("2020-01-01", null, { fuelType: "pellets" })]),
    ).toBe("legacyRepairOnly");
  });

  it("Überlappung mit gleichen Werten: eine löschen erlaubt, eine ändern nicht", () => {
    const twin = version("2025-04-01", null, { id: "twin" });
    const before = [versionA(null), twin];
    expect(verdict(before, [versionA(null)])).toBe("allowed");
    expect(verdict(before, [twin])).toBe("legacyRepairOnly");
    expect(
      verdict(before, [versionA(null), { ...twin, fuelType: "oil" }]),
    ).toBe("legacyRepairOnly");
  });

  it("keine Version am ersten Tag: spätere Version nur hinausschieben", () => {
    const before = [version("2025-07-01", null)];
    expect(verdict(before, [version("2026-01-01", null)])).toBe("allowed");
    expect(
      verdict(before, [version("2025-07-01", null, { fuelType: "oil" })]),
    ).toBe("finalizedImmutable");
    expect(
      verdict(
        [version("2026-01-01", null)],
        [
          version("2025-01-01", "2025-12-31", noneMode),
          version("2026-01-01", null),
        ],
      ),
    ).toBe("allowed");
  });

  it("ist monoton: erlaubte Änderungen führen nie vom Bezugszustand weg", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    const pick = <T>(items: readonly T[]): T =>
      items[Math.floor(random() * items.length)] as T;
    const starts = [
      "2024-01-01",
      "2025-01-01",
      "2025-04-01",
      "2025-07-01",
      "2025-10-01",
      "2026-01-01",
    ];
    const fuels = ["gas", "oil"] as const;
    const methods = ["heat_meter", "heat_cost_allocator"] as const;
    const randomVersions = (): HeatingSettings[] => {
      const count = 1 + Math.floor(random() * 3);
      const from = [
        ...new Set(Array.from({ length: count }, () => pick(starts))),
      ].sort((left, right) => left.localeCompare(right));
      return from.map((validFrom, index) => {
        const next = from[index + 1];
        const openEnd = random() < 0.5 ? null : "2025-08-31";
        const validTo =
          next !== undefined && random() < 0.8
            ? addDaysIso(next, random() < 0.7 ? -1 : -15)
            : openEnd;
        return version(
          validFrom,
          validTo && validTo < validFrom ? validFrom : validTo,
          {
            fuelType: pick(fuels),
            consumptionMethod: pick(methods),
          },
        );
      });
    };
    const days = Array.from({ length: 365 }, (_, index) =>
      addDaysIso(period.start, index),
    );
    const valuesAt = (versions: HeatingSettings[], day: string) =>
      versions
        .filter(
          (entry) =>
            entry.validFrom <= day &&
            (entry.validTo === null || entry.validTo >= day),
        )
        .map(heatingSettingsProjection)
        .sort((left, right) => left.localeCompare(right))
        .join("|");

    let checked = 0;
    const violations: string[] = [];
    for (let run = 0; run < 400; run += 1) {
      const before = randomVersions();
      const after = randomVersions();
      const first = before.filter(
        (entry) =>
          entry.validFrom <= period.start &&
          (entry.validTo === null || entry.validTo >= period.start),
      );
      if (first.length !== 1) {
        continue;
      }
      const reference = heatingSettingsProjection(first[0] as HeatingSettings);
      const strictlyEqual =
        JSON.stringify(heatingConfigHistory(before, period)) ===
        JSON.stringify(heatingConfigHistory(after, period));
      if (strictlyEqual || verdict(before, after) !== "allowed") {
        continue;
      }
      checked += 1;
      for (const day of days) {
        const previous = valuesAt(before, day);
        const next = valuesAt(after, day);
        const leavesReference = previous === reference && next !== reference;
        if (leavesReference || ![previous, reference, ""].includes(next)) {
          violations.push(`run ${run}, ${day}`);
        }
      }
    }
    expect(violations).toEqual([]);
    expect(checked).toBeGreaterThan(0);
  });
});
