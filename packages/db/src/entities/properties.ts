import { EntitySchema, type Opt } from "@mikro-orm/core";
import { fk } from "./_relations.js";

export type Building = {
  id: string;
  name: string;
  addressStreet: string;
  addressPostalCode: string;
  addressCity: string;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const BuildingSchema = new EntitySchema<Building>({
  name: "Building",
  tableName: "buildings",
  properties: {
    id: {
      type: "string",
      primary: true,
      onCreate: () => crypto.randomUUID(),
    },
    name: { type: "string" },
    addressStreet: { type: "string", fieldName: "address_street" },
    addressPostalCode: { type: "string", fieldName: "address_postal_code" },
    addressCity: { type: "string", fieldName: "address_city" },
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
  uniques: [{ name: "buildings_name_unique", properties: ["name"] }],
});

/**
 * Wohneinheiten. Fläche in Quadratmetern als Real, da qm-Werte oft auf
 * 0,01 genau sind. Die Unterscheidung Eigentümer/Mieter liegt fachlich
 * beim Tenant, nicht bei der Unit.
 */
export type Unit = {
  id: string;
  buildingId: string;
  name: string;
  unitNumber: string | null;
  areaSqm: number;
  heatingAreaSqm: number | null;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const UnitSchema = new EntitySchema<Unit>({
  name: "Unit",
  tableName: "units",
  properties: {
    id: {
      type: "string",
      primary: true,
      onCreate: () => crypto.randomUUID(),
    },
    buildingId: fk(() => BuildingSchema, "building_id", "restrict"),
    name: { type: "string" },
    unitNumber: { type: "string", fieldName: "unit_number", nullable: true },
    areaSqm: { type: "double", fieldName: "area_sqm" },
    heatingAreaSqm: {
      type: "double",
      fieldName: "heating_area_sqm",
      nullable: true,
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
  uniques: [
    {
      name: "units_building_name_unique",
      properties: ["buildingId", "name"],
    },
  ],
});
