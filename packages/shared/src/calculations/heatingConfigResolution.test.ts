import { describe, expect, it } from "vitest";
import type { HeatingSettings } from "../schemas/heating.js";
import { hasBlockingWarning } from "./diagnostics.js";
import {
  co2SettingsForPeriod,
  resolveHeatingConfigForPeriod,
} from "./heatingConfigResolution.js";
import { addDaysIso } from "./period.js";

const period = { start: "2026-01-01", end: "2026-12-31" };

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
  createdAt: "",
  updatedAt: "",
  ...fields,
});

/**
 * Zwei Versionen mit Wechsel zum 01.07.
 */
const switchAtJuly = (
  first: Partial<HeatingSettings>,
  second: Partial<HeatingSettings>,
) => [
  version("2020-01-01", "2026-06-30", first),
  version("2026-07-01", null, second),
];

const codes = (versions: HeatingSettings[]) =>
  resolveHeatingConfigForPeriod(versions, period).warnings.map(
    (warning) => warning.code,
  );

describe("resolveHeatingConfigForPeriod", () => {
  it("liefert bei einer Version diese ohne Warnung", () => {
    const only = version("2020-01-01", null);

    expect(resolveHeatingConfigForPeriod([only], period)).toEqual({
      settings: only,
      versions: [only],
      warnings: [],
    });
  });

  it("meldet bei zwei Versionen ohne Unterschied nichts", () => {
    expect(codes(switchAtJuly({}, {}))).toEqual([]);
  });

  it("zählt eine Version ab dem ersten Tag nicht als Wechsel und eine ab dem Tag nach dem Ende nicht mit", () => {
    const versions = [
      version("2025-01-01", "2025-12-31", { baseSharePercent: 50 }),
      version("2026-01-01", "2026-12-31"),
      version("2027-01-01", null, { heatingType: "central_without_hot_water" }),
    ];
    const resolution = resolveHeatingConfigForPeriod(versions, period);

    expect(resolution.warnings).toEqual([]);
    expect(resolution.versions).toEqual([versions[1]]);
    expect(resolution.settings).toEqual(versions[1]);
  });

  it("erkennt einen Wechsel am letzten Tag", () => {
    expect(
      codes([
        version("2020-01-01", "2026-12-30"),
        version("2026-12-31", null, { hotWaterSupplyTemperatureCelsius: 55 }),
      ]),
    ).toEqual(["heatingConfigPlantChangedInPeriod"]);
  });

  describe("Festlegungen", () => {
    it.each<[string, Partial<HeatingSettings>]>([
      ["Prozentsatz", { baseSharePercent: 50, consumptionSharePercent: 50 }],
      ["Grundkostenmaßstab", { baseMethod: "heated_area" }],
      ["Gradtage", { prorationMethod: "degree_days" }],
      ["70 %", { mandatorySeventyPercent: true }],
    ])("rechnet bei geändertem %s mit der ersten Version und blockiert nicht", (_label, change) => {
      const versions = switchAtJuly({}, change);
      const resolution = resolveHeatingConfigForPeriod(versions, period);

      expect(resolution.settings).toEqual(versions[0]);
      expect(resolution.warnings).toEqual([
        {
          code: "heatingConfigScalesNotApplied",
          params: { date: "2026-07-01" },
        },
      ]);
      expect(
        hasBlockingWarning({
          heatingDetail: { warnings: resolution.warnings },
        }),
      ).toBe(false);
    });

    it("meldet bei A → B → A nur B", () => {
      expect(
        resolveHeatingConfigForPeriod(
          [
            version("2020-01-01", "2026-03-31"),
            version("2026-04-01", "2026-08-31", { baseSharePercent: 40 }),
            version("2026-09-01", null),
          ],
          period,
        ).warnings,
      ).toEqual([
        {
          code: "heatingConfigScalesNotApplied",
          params: { date: "2026-04-01" },
        },
      ]);
    });

    it("rechnet in der Folgeperiode mit den neuen Werten", () => {
      const versions = switchAtJuly({}, { baseSharePercent: 50 });
      const next = resolveHeatingConfigForPeriod(versions, {
        start: "2026-07-01",
        end: "2027-06-30",
      });

      expect(next.settings?.baseSharePercent).toBe(50);
      expect(next.warnings).toEqual([]);
    });
  });

  describe("Zustand der Anlage", () => {
    it.each<
      [string, Partial<HeatingSettings>, Partial<HeatingSettings>, string]
    >([
      [
        "intern ↔ extern",
        {},
        { mode: "external" },
        "heatingConfigModeChangedInPeriod",
      ],
      [
        "Verbrauchserfassung",
        {},
        { consumptionMethod: "heat_cost_allocator" },
        "heatingConfigConsumptionMethodChangedInPeriod",
      ],
      [
        "Energieträger mit zentralem Warmwasser",
        {},
        { fuelType: "oil" },
        "heatingConfigFuelChangedInPeriod",
      ],
      [
        "Faktor mit zentralem Warmwasser",
        {},
        { gasBillingByCalorificValue: true },
        "heatingConfigFuelChangedInPeriod",
      ],
      [
        "Energieträger ohne zentrales Warmwasser",
        { heatingType: "central_without_hot_water" },
        { heatingType: "central_without_hot_water", fuelType: "oil" },
        "heatingConfigPlantChangedInPeriod",
      ],
      [
        "Warmwasser",
        {},
        { heatingType: "central_without_hot_water" },
        "heatingConfigPlantChangedInPeriod",
      ],
      [
        "Wärmezähler für Warmwasser",
        {},
        { hotWaterMeterId: "m1" },
        "heatingConfigPlantChangedInPeriod",
      ],
      [
        "Vorlauftemperatur",
        {},
        { hotWaterSupplyTemperatureCelsius: 55 },
        "heatingConfigPlantChangedInPeriod",
      ],
      [
        "Keine Heizkostenabrechnung → intern",
        { mode: "none" },
        {},
        "heatingConfigPlantChangedInPeriod",
      ],
      [
        "intern → Keine Heizkostenabrechnung",
        {},
        { mode: "none" },
        "heatingConfigPlantChangedInPeriod",
      ],
    ])("blockiert: %s", (_label, first, second, code) => {
      const versions = switchAtJuly(first, second);
      const resolution = resolveHeatingConfigForPeriod(versions, period);

      expect(resolution.warnings).toEqual([
        { code, params: { date: "2026-07-01" } },
      ]);
      expect(resolution.settings).toEqual(versions[0]);
      expect(
        hasBlockingWarning({
          heatingDetail: { warnings: resolution.warnings },
        }),
      ).toBe(true);
    });

    it("blockiert Energieträger A → B → A mit zentralem Warmwasser an beiden Stichtagen", () => {
      expect(
        codes([
          version("2020-01-01", "2026-03-31"),
          version("2026-04-01", "2026-08-31", { fuelType: "heat_pump" }),
          version("2026-09-01", null),
        ]),
      ).toEqual([
        "heatingConfigFuelChangedInPeriod",
        "heatingConfigFuelChangedInPeriod",
      ]);
    });

    it("blockiert einen Energieträgerwechsel, wenn nur ein Teil der Periode zentrales Warmwasser hat", () => {
      expect(
        codes(
          switchAtJuly(
            { heatingType: "central_without_hot_water" },
            { fuelType: "oil" },
          ),
        ),
      ).toContain("heatingConfigFuelChangedInPeriod");
    });

    it("vergleicht im externen Modus nur, ob die Seite nach § 6a gedruckt wird, und druckt sie im Zweifel", () => {
      const resolution = resolveHeatingConfigForPeriod(
        switchAtJuly(
          { mode: "external", includeBillingInfo: false },
          { mode: "external", includeBillingInfo: true, fuelType: "oil" },
        ),
        period,
      );

      expect(resolution.warnings).toEqual([]);
      expect(resolution.settings?.includeBillingInfo).toBe(true);
    });

    it("bleibt ohne zentrale Versorgung bei der ersten Version", () => {
      const versions = switchAtJuly({ mode: "none" }, { mode: "none" });

      expect(resolveHeatingConfigForPeriod(versions, period)).toEqual({
        settings: versions[0],
        versions,
        warnings: [],
      });
    });
  });

  describe("Lücken und Überlappungen", () => {
    it("findet bei direkt aufeinanderfolgenden Versionen weder Lücke noch Überlappung", () => {
      expect(codes(switchAtJuly({}, {}))).toEqual([]);
    });

    it("blockiert eine Lücke von einem Tag mit den richtigen Tagen", () => {
      const resolution = resolveHeatingConfigForPeriod(
        [version("2020-01-01", "2026-06-29"), version("2026-07-01", null)],
        period,
      );

      expect(resolution.warnings).toEqual([
        {
          code: "heatingConfigGapInPeriod",
          params: { fromDate: "2026-06-30", toDate: "2026-06-30" },
        },
      ]);
      expect(resolution.settings).not.toBeNull();
    });

    it("blockiert eine Lücke am Beginn und rechnet mit der ersten Version", () => {
      const later = version("2026-03-01", null);
      const resolution = resolveHeatingConfigForPeriod([later], period);

      expect(resolution.settings).toEqual(later);
      expect(resolution.warnings).toEqual([
        {
          code: "heatingConfigGapInPeriod",
          params: { fromDate: "2026-01-01", toDate: "2026-02-28" },
        },
      ]);
    });

    it("liefert ohne Version im Zeitraum keine Konfiguration", () => {
      const resolution = resolveHeatingConfigForPeriod(
        [version("2027-01-01", null)],
        period,
      );

      expect(resolution.settings).toBeNull();
      expect(resolution.warnings).toEqual([
        {
          code: "heatingConfigGapInPeriod",
          params: { fromDate: "2026-01-01", toDate: "2026-12-31" },
        },
      ]);
    });

    it("liefert bei einer Überlappung keine Konfiguration, unabhängig von der Reihenfolge", () => {
      const versions = [
        version("2020-01-01", "2026-07-31"),
        version("2026-07-01", null, { baseSharePercent: 50 }),
      ];

      for (const list of [versions, [...versions].reverse()]) {
        const resolution = resolveHeatingConfigForPeriod(list, period);
        expect(resolution.settings).toBeNull();
        expect(resolution.warnings).toEqual([
          {
            code: "heatingConfigOverlapInPeriod",
            params: { date: "2026-07-01" },
          },
        ]);
      }
    });

    it("behandelt zwei Versionen mit demselben „Gültig ab“ als Überlappung", () => {
      const resolution = resolveHeatingConfigForPeriod(
        [version("2026-01-01", null), version("2026-01-01", null)],
        period,
      );

      expect(resolution.settings).toBeNull();
      expect(resolution.warnings.map((warning) => warning.code)).toEqual([
        "heatingConfigOverlapInPeriod",
      ]);
    });
  });

  it("rechnet bei zufälligen Versionen nie still falsch: entweder eine Konfiguration oder eine Sperre", () => {
    let seed = 42;
    const random = (max: number) => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed % max;
    };
    const variants: Partial<HeatingSettings>[] = [
      {},
      { baseSharePercent: 50 },
      { mode: "none" },
      { mode: "external" },
      { heatingType: "central_without_hot_water" },
      { fuelType: "oil" },
      { consumptionMethod: "heat_cost_allocator" },
      { hotWaterMeterId: "m1" },
    ];

    for (let run = 0; run < 300; run++) {
      const versions: HeatingSettings[] = [];
      let cursor = "2025-10-01";
      for (let index = 0; index < 1 + random(4); index++) {
        const start = addDaysIso(cursor, random(5) === 0 ? random(30) - 15 : 0);
        const end = addDaysIso(start, 20 + random(200));
        versions.push(
          version(start, random(6) === 0 ? null : end, {
            ...variants[random(variants.length)],
            id: `v${index}`,
          }),
        );
        cursor = addDaysIso(end, 1);
      }

      const resolution = resolveHeatingConfigForPeriod(versions, period);
      const blocked = hasBlockingWarning({
        heatingDetail: { warnings: resolution.warnings },
      });

      expect(resolution.settings !== null || blocked).toBe(true);
      // Ohne Sperre gilt an jedem Tag genau eine Version, mit gleicher Anlage
      const plantOf = (candidate: HeatingSettings | null | undefined) =>
        candidate?.mode === "internal"
          ? [
              candidate.mode,
              candidate.heatingType,
              candidate.fuelType,
              candidate.hotWaterMeterId,
            ].join()
          : candidate?.mode;
      for (
        let day = period.start;
        !blocked && day <= period.end;
        day = addDaysIso(day, 1)
      ) {
        const covering = resolution.versions.filter(
          (candidate) =>
            candidate.validFrom <= day &&
            (candidate.validTo === null || candidate.validTo >= day),
        );
        expect(covering.map(plantOf)).toEqual([plantOf(resolution.settings)]);
      }
    }
  });
});

describe("co2SettingsForPeriod", () => {
  const item = (periodStart: string, periodEnd: string, co2 = true) => ({
    periodStart,
    periodEnd,
    co2CostCents: co2 ? 10_000 : null,
    co2AmountGrams: co2 ? 2_000_000 : null,
  });
  const gasThenHeatPump = switchAtJuly(
    {},
    { fuelType: "heat_pump", co2CostShareEnabled: false },
  );
  const building = { co2BuildingRestricted: true };

  it("rechnet die Aufteilung, wenn alle CO2-Rechnungen in der Zeit mit Aufteilung liegen", () => {
    expect(
      co2SettingsForPeriod(
        gasThenHeatPump,
        [
          item("2026-01-01", "2026-06-30"),
          item("2026-07-01", "2026-12-31", false),
        ],
        period,
      ),
    ).toMatchObject({ enabled: true, conflict: null });
  });

  it("blockiert, wenn eine CO2-Rechnung über den Stichtag reicht", () => {
    expect(
      co2SettingsForPeriod(
        gasThenHeatPump,
        [item("2026-01-01", "2026-07-31")],
        period,
      ).conflict,
    ).toEqual({ code: "co2ShareConflictInPeriod" });
  });

  it("blockiert bei CO2-Rechnungen in beiden Zeiten", () => {
    expect(
      co2SettingsForPeriod(
        gasThenHeatPump,
        [item("2026-01-01", "2026-03-31"), item("2026-10-01", "2026-12-31")],
        period,
      ).conflict,
    ).toEqual({ code: "co2ShareConflictInPeriod" });
  });

  it("schaltet ohne CO2-Rechnung ein, wenn eine Version die Aufteilung einschaltet", () => {
    expect(co2SettingsForPeriod(gasThenHeatPump, [], period)).toMatchObject({
      enabled: true,
      conflict: null,
    });
    expect(
      co2SettingsForPeriod(
        switchAtJuly(
          { co2CostShareEnabled: false },
          { co2CostShareEnabled: false },
        ),
        [],
        period,
      ),
    ).toMatchObject({ enabled: false, conflict: null });
  });

  it("zählt Rechnungen außerhalb des Zeitraums und Versionen außerhalb nicht", () => {
    expect(
      co2SettingsForPeriod(
        [
          version("2020-01-01", "2025-12-31", { co2CostShareEnabled: false }),
          version("2026-01-01", null),
        ],
        [item("2025-06-01", "2025-12-31"), item("2026-01-01", "2026-12-31")],
        period,
      ),
    ).toMatchObject({ enabled: true, conflict: null });
  });

  describe("Angaben nach § 9 CO2KostAufG", () => {
    it("blockiert, wenn die Beschränkung nur in einer Zeit gilt und Rechnungen in beiden liegen", () => {
      expect(
        co2SettingsForPeriod(
          switchAtJuly(building, {}),
          [item("2026-01-01", "2026-06-30"), item("2026-07-01", "2026-12-31")],
          period,
        ).conflict,
      ).toEqual({ code: "co2RestrictionConflictInPeriod" });
    });

    it("rechnet mit den Angaben der Zeit, in der alle Rechnungen liegen", () => {
      expect(
        co2SettingsForPeriod(
          switchAtJuly(building, {}),
          [item("2026-01-01", "2026-06-30")],
          period,
        ),
      ).toMatchObject({
        enabled: true,
        buildingRestricted: true,
        conflict: null,
      });
    });

    it("nimmt bei verschiedenem Text den der Version am letzten Tag der Rechnungen", () => {
      expect(
        co2SettingsForPeriod(
          switchAtJuly(
            { ...building, co2RestrictionEvidenceNote: "alt" },
            { ...building, co2RestrictionEvidenceNote: "neu" },
          ),
          [item("2026-01-01", "2026-03-31"), item("2026-07-01", "2026-09-30")],
          period,
        ),
      ).toMatchObject({ evidenceNote: "neu", conflict: null });
      expect(
        co2SettingsForPeriod(
          switchAtJuly(
            { ...building, co2RestrictionEvidenceNote: "alt" },
            { ...building, co2RestrictionEvidenceNote: "neu" },
          ),
          [item("2026-01-01", "2026-03-31")],
          period,
        ).evidenceNote,
      ).toBe("alt");
    });

    it("prüft bei Beschränkung in der ersten und ausgeschalteter Aufteilung in der zweiten Version nur den Switch", () => {
      expect(
        co2SettingsForPeriod(
          switchAtJuly(building, { co2CostShareEnabled: false }),
          [item("2026-01-01", "2026-12-31")],
          period,
        ).conflict,
      ).toEqual({ code: "co2ShareConflictInPeriod" });
    });
  });

  it("sperrt das Finalisieren bei beiden Konflikten", () => {
    for (const code of [
      "co2ShareConflictInPeriod",
      "co2RestrictionConflictInPeriod",
    ]) {
      expect(
        hasBlockingWarning({ heatingDetail: { warnings: [{ code }] } }),
      ).toBe(true);
    }
  });
});
