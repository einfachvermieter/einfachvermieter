import { EntitySchema, type Opt } from "@mikro-orm/core";
import { fk } from "./_relations.js";
import { BuildingSchema, UnitSchema } from "./properties.js";

export type MeterType =
  | "electricity"
  | "water_cold"
  | "water_hot"
  | "gas"
  | "heat_meter"
  | "heat_cost_allocator";

export type MeterRole =
  | "main"
  | "unit"
  | "sub"
  | "common"
  | "virtual_difference";

export type MeterMeasurementUnit = "m3" | "kwh" | "units";

export type MeterCostAllocationMode = "heating_cost_bill" | "cost_types";

export type MeterReadBy =
  | "landlord"
  | "tenant"
  | "utility"
  | "metering_service"
  | "property_management";

export type MeterDifferenceKind = "base" | "subtract";

/**
 * Zähler im Haus. Abstraktes Modell für alle Zählertypen. Rolle
 * "virtual_difference" ist ein virtueller Zähler, dessen Stand
 * ausschließlich rechnerisch aus anderen Zählern ermittelt wird.
 */
export type Meter = {
  id: string;
  buildingId: string;
  unitId: string | null;
  type: MeterType;
  role: MeterRole;
  label: string;
  serialNumber: string | null;
  measurementUnit: MeterMeasurementUnit;
  room: string | null;
  costAllocationMode: MeterCostAllocationMode;
  radiator: string | null;
  kTotal: number | null;
  radiatorManufacturer: string | null;
  radiatorModel: string | null;
  radiatorType: string | null;
  radiatorDimensions: string | null;
  validFrom: string;
  validUntil: string | null;
  isActive: Opt<boolean>;
  /**
   * Gerät ist fernablesbar (§ 5 Abs. 2 HeizkostenV). Steuert nur den
   * Hinweis auf die unterjährigen Verbrauchsinformationen, keine Berechnung.
   */
  isRemoteReadable: Opt<boolean>;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const MeterSchema = new EntitySchema<Meter>({
  name: "Meter",
  tableName: "meters",
  properties: {
    id: {
      type: "string",
      primary: true,
      onCreate: () => crypto.randomUUID(),
    },
    buildingId: fk(() => BuildingSchema, "building_id", "restrict"),
    unitId: fk(() => UnitSchema, "unit_id", "restrict", { nullable: true }),
    type: { type: "string" },
    role: { type: "string" },
    label: { type: "string" },
    serialNumber: {
      type: "string",
      fieldName: "serial_number",
      nullable: true,
    },
    measurementUnit: { type: "string", fieldName: "measurement_unit" },
    room: { type: "string", nullable: true },
    costAllocationMode: {
      type: "string",
      fieldName: "cost_allocation_mode",
      default: "cost_types",
    },
    radiator: { type: "string", nullable: true },
    kTotal: { type: "double", fieldName: "k_total", nullable: true },
    radiatorManufacturer: {
      type: "string",
      fieldName: "radiator_manufacturer",
      nullable: true,
    },
    radiatorModel: {
      type: "string",
      fieldName: "radiator_model",
      nullable: true,
    },
    radiatorType: {
      type: "string",
      fieldName: "radiator_type",
      nullable: true,
    },
    radiatorDimensions: {
      type: "string",
      fieldName: "radiator_dimensions",
      nullable: true,
    },
    validFrom: { type: "string", fieldName: "valid_from" },
    validUntil: { type: "string", fieldName: "valid_until", nullable: true },
    isActive: { type: "boolean", fieldName: "is_active", default: true },
    isRemoteReadable: {
      type: "boolean",
      fieldName: "is_remote_readable",
      default: false,
    },
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
  uniques: [{ name: "meters_serial_unique", properties: ["serialNumber"] }],
});

/**
 * Zählerstände mit Datum. Für Zeitraumschnitte wird linear zwischen zwei
 * Ständen interpoliert.
 */
export type MeterReading = {
  id: string;
  meterId: string;
  readingDate: string;
  value: number;
  isCumulative: boolean;
  isEstimated: boolean;
  readBy: MeterReadBy;
  notes: string | null;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const MeterReadingSchema = new EntitySchema<MeterReading>({
  name: "MeterReading",
  tableName: "meter_readings",
  properties: {
    id: {
      type: "string",
      primary: true,
      onCreate: () => crypto.randomUUID(),
    },
    meterId: fk(() => MeterSchema, "meter_id", "restrict"),
    readingDate: { type: "string", fieldName: "reading_date" },
    value: { type: "double" },
    isCumulative: {
      type: "boolean",
      fieldName: "is_cumulative",
      default: true,
    },
    isEstimated: {
      type: "boolean",
      fieldName: "is_estimated",
      default: false,
    },
    readBy: { type: "string", fieldName: "read_by", default: "landlord" },
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
  uniques: [
    {
      name: "meter_readings_meter_date",
      properties: ["meterId", "readingDate"],
    },
  ],
});

/**
 * Umrechnungsfaktoren m3 -> kWh für Gaszähler. Pro Gültigkeitsperiode ein
 * Eintrag. Nur für type = "gas".
 */
export type MeterGasFactor = {
  id: string;
  meterId: string;
  validFrom: string;
  validUntil: string | null;
  energyFactorKwhPerM3: number | null;
  notes: string | null;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const MeterGasFactorSchema = new EntitySchema<MeterGasFactor>({
  name: "MeterGasFactor",
  tableName: "meter_gas_factors",
  properties: {
    id: {
      type: "string",
      primary: true,
      onCreate: () => crypto.randomUUID(),
    },
    meterId: fk(() => MeterSchema, "meter_id", "cascade"),
    validFrom: { type: "string", fieldName: "valid_from" },
    validUntil: { type: "string", fieldName: "valid_until", nullable: true },
    energyFactorKwhPerM3: {
      type: "double",
      fieldName: "energy_factor_kwh_per_m3",
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
  uniques: [
    {
      name: "meter_gas_factors_meter_from",
      properties: ["meterId", "validFrom"],
    },
  ],
});

/**
 * Bestandteile eines Differenzzählers (role = "virtual_difference").
 * Genau ein "base"-Eintrag und ein/mehrere "subtract"-Einträge.
 */
export type MeterDifferenceComponent = {
  id: string;
  virtualMeterId: string;
  sourceMeterId: string;
  kind: MeterDifferenceKind;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const MeterDifferenceComponentSchema =
  new EntitySchema<MeterDifferenceComponent>({
    name: "MeterDifferenceComponent",
    tableName: "meter_difference_components",
    properties: {
      id: {
        type: "string",
        primary: true,
        onCreate: () => crypto.randomUUID(),
      },
      virtualMeterId: fk(() => MeterSchema, "virtual_meter_id", "cascade"),
      sourceMeterId: fk(() => MeterSchema, "source_meter_id", "restrict"),
      kind: { type: "string" },
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
        name: "meter_diff_components_unique",
        properties: ["virtualMeterId", "sourceMeterId"],
      },
    ],
  });
