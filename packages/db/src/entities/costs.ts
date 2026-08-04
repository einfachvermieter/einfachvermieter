import { EntitySchema, type Opt } from "@mikro-orm/core";
import { fk } from "./_relations.js";
import { MeterSchema } from "./meters.js";
import { BuildingSchema, UnitSchema } from "./properties.js";

export type CostCategory = "operating" | "heating";
export type AllocationKey =
  | "per_living_area"
  | "per_heating_area"
  | "per_person"
  | "per_unit"
  | "per_consumption_m3"
  | "per_consumption_kwh"
  | "fixed";
export type LaborCostCategory = "craftsman" | "household_service";
export type HeatingMode = "internal" | "external";
export type HeatingBaseMethod = "area";
export type HeatingConsumptionMethod = "heat_meter" | "heat_cost_allocator";
export type HeatingProrationMethod = "linear" | "degree_days";
export type HeatingType =
  | "central_with_hot_water"
  | "central_without_hot_water"
  | "decentralized";
export type FuelType =
  | "gas"
  | "oil"
  | "district_heat"
  | "pellets"
  | "wood"
  | "electricity"
  | "heat_pump"
  | "other";

/**
 * Betriebskostenarten mit Umlageschlüssel. category "heating" fließt in
 * den zentralen Heizkostentopf; defaultAllocationKey ist dann NULL.
 */
export type CostType = {
  id: string;
  buildingId: string;
  name: string;
  category: CostCategory;
  defaultAllocationKey: AllocationKey | null;
  laborCostCategory: LaborCostCategory | null;
  co2Tracked: boolean;
  /**
   * Erfassungs-/Abrechnungsentgelt (Gerätemiete, Eichung, Ablesedienst,
   * Abrechnungsservice).
   */
  isMeteringServiceCost: boolean;
  description: string | null;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const CostTypeSchema = new EntitySchema<CostType>({
  name: "CostType",
  tableName: "cost_types",
  properties: {
    id: { type: "string", primary: true, onCreate: () => crypto.randomUUID() },
    buildingId: fk(() => BuildingSchema, "building_id", "restrict"),
    name: { type: "string" },
    category: { type: "string", default: "operating" },
    defaultAllocationKey: {
      type: "string",
      fieldName: "default_allocation_key",
      nullable: true,
    },
    laborCostCategory: {
      type: "string",
      fieldName: "labor_cost_category",
      nullable: true,
    },
    co2Tracked: { type: "boolean", fieldName: "co2_tracked", default: false },
    isMeteringServiceCost: {
      type: "boolean",
      fieldName: "is_metering_service_cost",
      default: false,
    },
    description: { type: "text", nullable: true },
    createdAt: {
      type: "string",
      fieldName: "created_at",
      defaultRaw: "current_timestamp",
    },
    updatedAt: {
      type: "string",
      fieldName: "updated_at",
      defaultRaw: "current_timestamp",
    },
  },
  indexes: [{ name: "cost_types_building_id", properties: ["buildingId"] }],
});

/**
 * Eingehende Lieferantenrechnung.
 * Enthält 1..N Positionen (cost_entry_items)
 */
export type CostEntry = {
  id: string;
  invoiceDate: string;
  invoiceNumber: string | null;
  vendor: string | null;
  documentPath: string | null;
  notes: string | null;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const CostEntrySchema = new EntitySchema<CostEntry>({
  name: "CostEntry",
  tableName: "cost_entries",
  properties: {
    id: { type: "string", primary: true, onCreate: () => crypto.randomUUID() },
    invoiceDate: { type: "string", fieldName: "invoice_date" },
    invoiceNumber: {
      type: "string",
      fieldName: "invoice_number",
      nullable: true,
    },
    vendor: { type: "string", nullable: true },
    documentPath: { type: "text", fieldName: "document_path", nullable: true },
    notes: { type: "text", nullable: true },
    createdAt: {
      type: "string",
      fieldName: "created_at",
      defaultRaw: "current_timestamp",
    },
    updatedAt: {
      type: "string",
      fieldName: "updated_at",
      defaultRaw: "current_timestamp",
    },
  },
});

/**
 * Einzelne Position einer Lieferantenrechnung. Tagesgenaue Periode,
 * eigene Kostenart und Betrag. unitId nur bei "fixed"-Umlage.
 */
export type CostEntryItem = {
  id: string;
  costEntryId: string;
  costTypeId: string;
  unitId: string | null;
  amountCents: number;
  unitPriceCents: number | null;
  laborCostsCents: number | null;
  co2AmountGrams: number | null;
  co2CostCents: number | null;
  /**
   * Im `amountCents` enthaltene Steuern, Abgaben und Zölle in Cent (Summe
   * aus USt, Energiesteuer, CO2-Preis laut Brennstoffrechnung);
   * nur bei Heiz-Positionen erfasst.
   */
  containedTaxesCents: number | null;
  periodStart: string;
  periodEnd: string;
  position: number;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const CostEntryItemSchema = new EntitySchema<CostEntryItem>({
  name: "CostEntryItem",
  tableName: "cost_entry_items",
  properties: {
    id: { type: "string", primary: true, onCreate: () => crypto.randomUUID() },
    costEntryId: fk(() => CostEntrySchema, "cost_entry_id", "cascade"),
    costTypeId: fk(() => CostTypeSchema, "cost_type_id", "restrict"),
    unitId: fk(() => UnitSchema, "unit_id", "restrict", { nullable: true }),
    amountCents: { type: "integer", fieldName: "amount_cents" },
    unitPriceCents: {
      type: "integer",
      fieldName: "unit_price_cents",
      nullable: true,
    },
    laborCostsCents: {
      type: "integer",
      fieldName: "labor_costs_cents",
      nullable: true,
    },
    co2AmountGrams: {
      type: "integer",
      fieldName: "co2_amount_grams",
      nullable: true,
    },
    co2CostCents: {
      type: "integer",
      fieldName: "co2_cost_cents",
      nullable: true,
    },
    containedTaxesCents: {
      type: "integer",
      fieldName: "contained_taxes_cents",
      nullable: true,
    },
    periodStart: { type: "string", fieldName: "period_start" },
    periodEnd: { type: "string", fieldName: "period_end" },
    position: { type: "integer", default: 0 },
    createdAt: {
      type: "string",
      fieldName: "created_at",
      defaultRaw: "current_timestamp",
    },
    updatedAt: {
      type: "string",
      fieldName: "updated_at",
      defaultRaw: "current_timestamp",
    },
  },
  indexes: [
    { name: "cost_entry_items_cost_entry_id", properties: ["costEntryId"] },
    { name: "cost_entry_items_cost_type_id", properties: ["costTypeId"] },
    { name: "cost_entry_items_unit_id", properties: ["unitId"] },
  ],
});

/**
 * Heizkosten-Konfiguration pro Gebäude, versioniert über validFrom/validTo.
 * hotWaterMeterId set null bei Zähler-Löschung -> Fallback Schätzformel.
 */
export type HeatingSetting = {
  id: string;
  buildingId: string;
  mode: HeatingMode;
  baseSharePercent: number;
  consumptionSharePercent: number;
  baseMethod: HeatingBaseMethod;
  consumptionMethod: HeatingConsumptionMethod;
  prorationMethod: HeatingProrationMethod;
  heatingType: HeatingType;
  fuelType: FuelType;
  hotWaterMeterId: string | null;
  hotWaterSupplyTemperatureCelsius: number;
  /**
   * Gesamt-Wärmemenge der Heizungsanlage in kWh (Q_gesamt): Nenner der
   * Warmwasser-Abspaltung nach § 9 Abs. 2 HeizkostenV. Nur bei
   * `heatingType = "central_with_hot_water"` fachlich relevant; NULL, wenn
   * (noch) nicht erfasst (dann unterbleibt die Abspaltung mit Warnung).
   */
  totalHeatEnergyKwh: number | null;
  /**
   * Brennwertbezogene Abrechnung von Erdgas: die nach den Formeln des
   * § 9 Abs. 2 HeizkostenV bestimmte Warmwasser-Wärmemenge ist dann mit 1,11
   * zu multiplizieren. Nur bei `fuelType = "gas"` sinnvoll.
   */
  gasBillingByCalorificValue: Opt<boolean>;
  /**
   * Monovalent betriebene Wärmepumpe: Faktor 0,30 auf die nach den Formeln
   * bestimmte Warmwasser-Wärmemenge (§ 9 Abs. 2 HeizkostenV). Nur bei
   * `fuelType = "heat_pump"` sinnvoll.
   */
  heatPumpMonovalent: Opt<boolean>;
  /**
   * Gebäude, das nach § 7 Abs. 1 Satz 2 HeizkostenV zwingend 70 % nach
   * Verbrauch verteilen muss (Anforderungsniveau der WSchV 1994 nicht
   * erfüllt, Öl-/Gas-Zentralheizung, freiliegende Leitungen überwiegend
   * gedämmt).
   */
  mandatorySeventyPercent: Opt<boolean>;
  /**
   * Jährliche Treibhausgasemissionen des Fernwärmenetzes in kg. Pflicht-
   * angabe der Abrechnungsinformationen nach § 6a Abs. 3 HeizkostenV.
   * Nur bei `fuelType = "district_heat"` relevant; Wert steht auf der
   * Rechnung des Wärmelieferanten.
   */
  districtHeatEmissionsKgPerYear: number | null;
  /**
   * Primärenergiefaktor des Fernwärmenetzes (§ 6a Abs. 3 HeizkostenV).
   * Nur bei `fuelType = "district_heat"` relevant.
   */
  districtHeatPrimaryEnergyFactor: number | null;
  /**
   * Ob die Seite „Abrechnungsinformationen nach § 6a HeizkostenV" mit der
   * Abrechnung gedruckt wird. Nur im externen Modus abwählbar.
   */
  includeBillingInfo: Opt<boolean>;
  co2CostShareEnabled: boolean;
  validFrom: string;
  validTo: string | null;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const HeatingSettingSchema = new EntitySchema<HeatingSetting>({
  name: "HeatingSetting",
  tableName: "heating_settings",
  properties: {
    id: { type: "string", primary: true, onCreate: () => crypto.randomUUID() },
    buildingId: fk(() => BuildingSchema, "building_id", "restrict"),
    mode: { type: "string" },
    baseSharePercent: {
      type: "integer",
      fieldName: "base_share_percent",
      default: 30,
    },
    consumptionSharePercent: {
      type: "integer",
      fieldName: "consumption_share_percent",
      default: 70,
    },
    baseMethod: { type: "string", fieldName: "base_method", default: "area" },
    consumptionMethod: {
      type: "string",
      fieldName: "consumption_method",
      default: "heat_meter",
    },
    prorationMethod: {
      type: "string",
      fieldName: "proration_method",
      default: "linear",
    },
    heatingType: {
      type: "string",
      fieldName: "heating_type",
      default: "central_without_hot_water",
    },
    fuelType: { type: "string", fieldName: "fuel_type", default: "gas" },
    hotWaterMeterId: fk(() => MeterSchema, "hot_water_meter_id", "set null", {
      nullable: true,
    }),
    hotWaterSupplyTemperatureCelsius: {
      type: "integer",
      fieldName: "hot_water_supply_temperature_celsius",
      default: 60,
    },
    totalHeatEnergyKwh: {
      type: "double",
      fieldName: "total_heat_energy_kwh",
      nullable: true,
    },
    gasBillingByCalorificValue: {
      type: "boolean",
      fieldName: "gas_billing_by_calorific_value",
      default: false,
    },
    heatPumpMonovalent: {
      type: "boolean",
      fieldName: "heat_pump_monovalent",
      default: false,
    },
    mandatorySeventyPercent: {
      type: "boolean",
      fieldName: "mandatory_seventy_percent",
      default: false,
    },
    districtHeatEmissionsKgPerYear: {
      type: "double",
      fieldName: "district_heat_emissions_kg_per_year",
      nullable: true,
    },
    districtHeatPrimaryEnergyFactor: {
      type: "double",
      fieldName: "district_heat_primary_energy_factor",
      nullable: true,
    },
    includeBillingInfo: {
      type: "boolean",
      fieldName: "include_billing_info",
      default: true,
    },
    co2CostShareEnabled: {
      type: "boolean",
      fieldName: "co2_cost_share_enabled",
      default: true,
    },
    validFrom: {
      type: "string",
      fieldName: "valid_from",
      default: "1900-01-01",
    },
    validTo: { type: "string", fieldName: "valid_to", nullable: true },
    createdAt: {
      type: "string",
      fieldName: "created_at",
      defaultRaw: "current_timestamp",
    },
    updatedAt: {
      type: "string",
      fieldName: "updated_at",
      defaultRaw: "current_timestamp",
    },
  },
  uniques: [
    {
      name: "heating_settings_building_id_valid_from_unique",
      properties: ["buildingId", "validFrom"],
    },
  ],
});

/**
 * Extern berechnete Heizkosten pro Wohnung und Zeitraum. Nur im
 * heatingSettings.mode === "external" ausgewertet.
 */
export type ExternalHeatingEntry = {
  id: string;
  buildingId: string;
  unitId: string;
  periodStart: string;
  periodEnd: string;
  totalCents: number;
  baseCostCents: number | null;
  consumptionCostCents: number | null;
  notes: string | null;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const ExternalHeatingEntrySchema =
  new EntitySchema<ExternalHeatingEntry>({
    name: "ExternalHeatingEntry",
    tableName: "external_heating_entries",
    properties: {
      id: {
        type: "string",
        primary: true,
        onCreate: () => crypto.randomUUID(),
      },
      buildingId: fk(() => BuildingSchema, "building_id", "restrict"),
      unitId: fk(() => UnitSchema, "unit_id", "restrict"),
      periodStart: { type: "string", fieldName: "period_start" },
      periodEnd: { type: "string", fieldName: "period_end" },
      totalCents: { type: "integer", fieldName: "total_cents" },
      baseCostCents: {
        type: "integer",
        fieldName: "base_cost_cents",
        nullable: true,
      },
      consumptionCostCents: {
        type: "integer",
        fieldName: "consumption_cost_cents",
        nullable: true,
      },
      notes: { type: "text", nullable: true },
      createdAt: {
        type: "string",
        fieldName: "created_at",
        defaultRaw: "current_timestamp",
      },
      updatedAt: {
        type: "string",
        fieldName: "updated_at",
        defaultRaw: "current_timestamp",
      },
    },
    indexes: [
      {
        name: "external_heating_entries_building_id",
        properties: ["buildingId"],
      },
      { name: "external_heating_entries_unit_id", properties: ["unitId"] },
    ],
  });

/**
 * Hochgeladene Belege zu einer Kostenrechnung.
 */
export type CostEntryAttachment = {
  id: string;
  costEntryId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  ocrText: string | null;
  createdAt: Opt<string>;
};

export const CostEntryAttachmentSchema = new EntitySchema<CostEntryAttachment>({
  name: "CostEntryAttachment",
  tableName: "cost_entry_attachments",
  properties: {
    id: {
      type: "string",
      primary: true,
      onCreate: () => crypto.randomUUID(),
    },
    costEntryId: fk(() => CostEntrySchema, "cost_entry_id", "cascade"),
    originalFilename: { type: "string", fieldName: "original_filename" },
    mimeType: { type: "string", fieldName: "mime_type" },
    sizeBytes: { type: "integer", fieldName: "size_bytes" },
    storageKey: { type: "text", fieldName: "storage_key" },
    ocrText: { type: "text", fieldName: "ocr_text", nullable: true },
    createdAt: {
      type: "string",
      fieldName: "created_at",
      defaultRaw: "current_timestamp",
    },
  },
  indexes: [
    {
      name: "cost_entry_attachments_cost_entry_id",
      properties: ["costEntryId"],
    },
  ],
});
