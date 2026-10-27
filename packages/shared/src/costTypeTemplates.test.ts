import { deTranslations } from "@einfachvermieter/i18n";
import { describe, expect, it } from "vitest";
import {
  costTypeFieldsFromTemplate,
  costTypeTemplates,
} from "./costTypeTemplates.js";
import {
  costTypeBulkCreateSchema,
  isLikelyNonAllocatableCostTypeName,
} from "./schemas/core.js";

const BUILDING_ID = "00000000-0000-4000-8000-000000000001";

const texts = deTranslations.ui.costs.templates as Record<
  string,
  { name?: string; hint?: string }
>;

const nameOf = (key: string): string => texts[key]?.name ?? "";

describe("Vorlagenkatalog der Kostenarten", () => {
  it("hat eindeutige Schlüssel und Namen", () => {
    const keys = costTypeTemplates.map((template) => template.key);
    const names = keys.map((key) => nameOf(key).toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it("hat zu jeder Vorlage Name und Hinweis in de.json", () => {
    for (const template of costTypeTemplates) {
      expect(texts[template.key]?.name, template.key).toBeTruthy();
      expect(texts[template.key]?.hint, template.key).toBeTruthy();
    }
  });

  it("führt die BetrKV-Nummer genau bei Betriebskosten", () => {
    for (const template of costTypeTemplates) {
      const number = template.betrkvNumber;
      const expected =
        template.category === "heating"
          ? number === null
          : number !== null && number >= 1 && number <= 17;
      expect(expected, template.key).toBe(true);
    }
  });

  it("löst bei keinem Namen die Warnung vor nicht umlagefähigen Kosten aus", () => {
    for (const template of costTypeTemplates) {
      expect(
        isLikelyNonAllocatableCostTypeName(nameOf(template.key)),
        template.key,
      ).toBe(false);
    }
  });

  it("besteht mit jeder Vorbelegung die Feldprüfung der API", () => {
    for (const hasUnitWaterMeters of [false, true]) {
      for (const usesCo2Split of [false, true]) {
        const result = costTypeBulkCreateSchema.safeParse({
          buildingId: BUILDING_ID,
          items: costTypeTemplates.map((template) =>
            costTypeFieldsFromTemplate(template, {
              name: nameOf(template.key),
              hasUnitWaterMeters,
              usesCo2Split,
            }),
          ),
        });
        expect(result.error?.issues ?? []).toEqual([]);
      }
    }
  });
});

describe("costTypeFieldsFromTemplate", () => {
  const templateOf = (key: string) => {
    const template = costTypeTemplates.find((entry) => entry.key === key);
    if (!template) {
      throw new Error(key);
    }
    return template;
  };
  const context = {
    name: "x",
    hasUnitWaterMeters: false,
    usesCo2Split: false,
  };

  it("verteilt Frisch- und Schmutzwasser nach m3, wenn Wohnungen Wasserzähler haben", () => {
    for (const key of ["fresh_water", "waste_water"]) {
      expect(
        costTypeFieldsFromTemplate(templateOf(key), context)
          .defaultAllocationKey,
      ).toBe("per_living_area");
      expect(
        costTypeFieldsFromTemplate(templateOf(key), {
          ...context,
          hasUnitWaterMeters: true,
        }).defaultAllocationKey,
      ).toBe("per_consumption_m3");
    }
  });

  it("lässt Niederschlagswasser bei Wohnfläche", () => {
    expect(
      costTypeFieldsFromTemplate(templateOf("rain_water"), {
        ...context,
        hasUnitWaterMeters: true,
      }).defaultAllocationKey,
    ).toBe("per_living_area");
  });

  it("setzt die CO2-Erfassung nur an der Heizenergie", () => {
    const withCo2 = { ...context, usesCo2Split: true };
    expect(
      costTypeFieldsFromTemplate(templateOf("heating_energy"), withCo2)
        .co2Tracked,
    ).toBe(true);
    expect(
      costTypeFieldsFromTemplate(templateOf("heating_energy"), context)
        .co2Tracked,
    ).toBe(false);
    expect(
      costTypeFieldsFromTemplate(templateOf("heating_maintenance"), withCo2)
        .co2Tracked,
    ).toBe(false);
  });
});

describe("costTypeBulkCreateSchema", () => {
  const item = {
    name: "Grundsteuer",
    category: "operating",
    defaultAllocationKey: "per_living_area",
    laborCostCategory: null,
  };

  it("lehnt gleiche Namen im selben Aufruf ab, auch mit anderer Schreibung", () => {
    const result = costTypeBulkCreateSchema.safeParse({
      buildingId: BUILDING_ID,
      items: [item, { ...item, name: "  grundSTEUER " }],
    });
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["items", 1, "name"],
    ]);
  });

  it("lehnt leere und zu lange Listen ab", () => {
    for (const items of [
      [],
      Array.from({ length: 51 }, (_, index) => ({
        ...item,
        name: `Kostenart ${index}`,
      })),
    ]) {
      expect(
        costTypeBulkCreateSchema.safeParse({ buildingId: BUILDING_ID, items })
          .success,
      ).toBe(false);
    }
  });
});
