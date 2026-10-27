import type {
  CostTypeAllocationKey,
  CostTypeCategory,
  LaborCostCategory,
} from "./schemas/common.js";

/**
 * Vorlage für eine übliche Kostenart nach § 2 BetrKV. Sie füllt beim
 * Anlegen nur vor; die angelegte Kostenart merkt sich weder Vorlage noch
 * Nummer. Name und Hinweis stehen in der Übersetzung unter
 * `ui.costs.templates.<key>`.
 */
export type CostTypeTemplate = {
  key: string;
  category: CostTypeCategory;
  /**
   * Nummer in § 2 BetrKV. `null` bei Heizkosten, weil dieselbe Kostenart je
   * nach Anlage unter Nr. 4, 5 oder 6 fällt.
   */
  betrkvNumber: number | null;
  /**
   * `null` bei Heizkosten. Bei Wasser der Vorschlag ohne
   * Wohnungswasserzähler, siehe `costTypeFieldsFromTemplate`.
   */
  defaultAllocationKey: CostTypeAllocationKey | null;
  laborCostCategory: LaborCostCategory | null;
  isMeteringServiceCost: boolean;
};

/**
 * Betriebskostenart mit Schlüssel Wohnfläche, dem gesetzlichen Regelfall
 * ohne Vereinbarung
 */
const operating = (
  key: string,
  betrkvNumber: number,
  laborCostCategory: LaborCostCategory | null = null,
  defaultAllocationKey: CostTypeAllocationKey = "per_living_area",
): CostTypeTemplate => ({
  key,
  category: "operating",
  betrkvNumber,
  defaultAllocationKey,
  laborCostCategory,
  isMeteringServiceCost: false,
});

/**
 * Heizkostenart ohne eigenen Schlüssel, verteilt über die
 * Heizkostenkonfiguration
 */
const heating = (
  key: string,
  laborCostCategory: LaborCostCategory | null = null,
  isMeteringServiceCost = false,
): CostTypeTemplate => ({
  key,
  category: "heating",
  betrkvNumber: null,
  defaultAllocationKey: null,
  laborCostCategory,
  isMeteringServiceCost,
});

/**
 * Vorlagenkatalog in der Reihenfolge des Sheets. Die Gruppe ergibt sich aus
 * den Feldern: Heizkosten, Nr. 17 (sonstige) oder übrige Betriebskosten.
 *
 * Die Wartung von Etagenheizung und Warmwassergeräten bekommt den Schlüssel
 * "fix" (Direktzuordnung je Rechnungsposition), weil das Gerät nur seiner
 * Wohnung dient. Das ist eine Produktentscheidung, keine gesetzliche Vorgabe.
 */
export const costTypeTemplates: readonly CostTypeTemplate[] = [
  operating("property_tax", 1),
  operating("fresh_water", 2),
  operating("waste_water", 3),
  operating("rain_water", 3),
  operating("floor_heating_maintenance", 4, "craftsman", "fixed"),
  operating("water_heater_maintenance", 5, "craftsman", "fixed"),
  operating("elevator", 7, "craftsman"),
  operating("street_cleaning", 8),
  operating("winter_service", 8, "household_service"),
  operating("refuse_collection", 8),
  operating("building_cleaning", 9, "household_service"),
  operating("pest_control", 9),
  operating("gardening", 10, "household_service"),
  operating("common_power", 11),
  operating("chimney_cleaning", 12, "craftsman"),
  operating("building_insurance", 13),
  operating("liability_insurance", 13),
  operating("caretaker", 14, "household_service"),
  operating("shared_antenna", 15),
  operating("fiber_provision_fee", 15, null, "fixed"),
  operating("laundry_facilities", 16),
  heating("heating_energy"),
  heating("heating_operating_power"),
  heating("heating_maintenance", "craftsman"),
  heating("heating_chimney_sweep", "craftsman"),
  heating("heating_metering_service", null, true),
  operating("smoke_detector_inspection", 17, "craftsman"),
  operating("gutter_cleaning", 17, "craftsman"),
];

export type CostTypeTemplateGroup = "operating" | "heating" | "other";

/**
 * Gruppe der Vorlage im Sheet
 */
export const costTypeTemplateGroup = (
  template: CostTypeTemplate,
): CostTypeTemplateGroup => {
  if (template.category === "heating") {
    return "heating";
  }
  return template.betrkvNumber === 17 ? "other" : "operating";
};

/**
 * Vorlagen, deren Schlüssel dem erfassten Wasserverbrauch folgt
 */
const WATER_TEMPLATE_KEYS = new Set(["fresh_water", "waste_water"]);

/**
 * Felder der anzulegenden Kostenart. Zwei Werte hängen am Gebäude: Wasser
 * nach m3, wenn Wohnungen Wasserzähler haben (§ 556a Abs. 1 Satz 2 BGB),
 * und die CO2-Erfassung der Heizenergie, wenn eine Heizkostenkonfiguration
 * die CO2-Aufteilung nutzt.
 */
export const costTypeFieldsFromTemplate = (
  template: CostTypeTemplate,
  context: { name: string; hasUnitWaterMeters: boolean; usesCo2Split: boolean },
) => ({
  name: context.name,
  category: template.category,
  defaultAllocationKey:
    WATER_TEMPLATE_KEYS.has(template.key) && context.hasUnitWaterMeters
      ? ("per_consumption_m3" as const)
      : template.defaultAllocationKey,
  laborCostCategory: template.laborCostCategory,
  co2Tracked: template.key === "heating_energy" && context.usesCo2Split,
  isMeteringServiceCost: template.isMeteringServiceCost,
});
