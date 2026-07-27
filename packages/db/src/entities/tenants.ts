import { EntitySchema, type Opt } from "@mikro-orm/core";
import { fk } from "./_relations.js";
import { UnitSchema } from "./properties.js";

export type TenantKind = "private" | "owner";
export type UserRole = "admin" | "resident";

/**
 * Bewohner. Kontakt- und Stammdaten der Personen, die in einer Wohnung
 * leben.
 */
export type Resident = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const ResidentSchema = new EntitySchema<Resident>({
  name: "Resident",
  tableName: "residents",
  properties: {
    id: { type: "string", primary: true, onCreate: () => crypto.randomUUID() },
    firstName: { type: "string", fieldName: "first_name" },
    lastName: { type: "string", fieldName: "last_name" },
    email: { type: "string", nullable: true },
    phone: { type: "string", nullable: true },
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
 * Mietverträge pro Unit. Aggregat über Bewohner, Mietsätze und
 * Bankverbindungen eines Vertragszeitraums.
 */
export type Tenant = {
  id: string;
  unitId: string;
  kind: TenantKind;
  startDate: string;
  endDate: string | null;
  depositCents: number;
  notes: string | null;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const TenantSchema = new EntitySchema<Tenant>({
  name: "Tenant",
  tableName: "tenants",
  properties: {
    id: { type: "string", primary: true, onCreate: () => crypto.randomUUID() },
    unitId: fk(() => UnitSchema, "unit_id", "restrict"),
    kind: { type: "string", default: "private" },
    startDate: { type: "string", fieldName: "start_date" },
    endDate: { type: "string", fieldName: "end_date", nullable: true },
    depositCents: { type: "integer", fieldName: "deposit_cents", default: 0 },
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
  indexes: [{ name: "tenants_unit_id", properties: ["unitId"] }],
});

/**
 * Verknüpft Bewohner mit einem Mietvertrag. moveIn/moveOut pro Person.
 * isContractParty = 1 markiert die im Vertrag genannten Vertragspartner.
 */
export type TenantResident = {
  id: string;
  tenantId: string;
  residentId: string;
  moveInDate: string | null;
  moveOutDate: string | null;
  isContractParty: number;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const TenantResidentSchema = new EntitySchema<TenantResident>({
  name: "TenantResident",
  tableName: "tenant_residents",
  properties: {
    id: { type: "string", primary: true, onCreate: () => crypto.randomUUID() },
    tenantId: fk(() => TenantSchema, "tenant_id", "cascade"),
    residentId: fk(() => ResidentSchema, "resident_id", "restrict"),
    moveInDate: { type: "string", fieldName: "move_in_date", nullable: true },
    moveOutDate: { type: "string", fieldName: "move_out_date", nullable: true },
    isContractParty: {
      type: "integer",
      fieldName: "is_contract_party",
      default: 1,
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
      name: "tenant_residents_tenant_resident_unique",
      properties: ["tenantId", "residentId"],
    },
  ],
});

/**
 * Zeitliche Kaltmiet-Historie innerhalb eines Tenants. Deckt den
 * Vertragszeitraum lückenlos und überschneidungsfrei ab.
 */
export type TenantRent = {
  id: string;
  tenantId: string;
  startDate: string | null;
  endDate: string | null;
  monthlyBaseRentCents: number;
  monthlyAdvanceCents: number;
  reductionReason: string | null;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const TenantRentSchema = new EntitySchema<TenantRent>({
  name: "TenantRent",
  tableName: "tenant_rents",
  properties: {
    id: { type: "string", primary: true, onCreate: () => crypto.randomUUID() },
    tenantId: fk(() => TenantSchema, "tenant_id", "cascade"),
    startDate: { type: "string", fieldName: "start_date", nullable: true },
    endDate: { type: "string", fieldName: "end_date", nullable: true },
    monthlyBaseRentCents: {
      type: "integer",
      fieldName: "monthly_base_rent_cents",
    },
    monthlyAdvanceCents: {
      type: "integer",
      fieldName: "monthly_advance_cents",
    },
    reductionReason: {
      type: "text",
      fieldName: "reduction_reason",
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
  indexes: [{ name: "tenant_rents_tenant_id", properties: ["tenantId"] }],
});

/**
 * Bankverbindung(en) pro Tenant. Optional 0..n Einträge mit optionalen
 * Start-/Enddaten plus optionalem SEPA-Mandat.
 */
export type TenantBankAccount = {
  id: string;
  tenantId: string;
  startDate: string | null;
  endDate: string | null;
  iban: string;
  bic: string | null;
  accountHolder: string;
  mandateReference: string | null;
  mandateSignedAt: string | null;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const TenantBankAccountSchema = new EntitySchema<TenantBankAccount>({
  name: "TenantBankAccount",
  tableName: "tenant_bank_accounts",
  properties: {
    id: { type: "string", primary: true, onCreate: () => crypto.randomUUID() },
    tenantId: fk(() => TenantSchema, "tenant_id", "cascade"),
    startDate: { type: "string", fieldName: "start_date", nullable: true },
    endDate: { type: "string", fieldName: "end_date", nullable: true },
    iban: { type: "string" },
    bic: { type: "string", nullable: true },
    accountHolder: { type: "string", fieldName: "account_holder" },
    mandateReference: {
      type: "string",
      fieldName: "mandate_reference",
      nullable: true,
    },
    mandateSignedAt: {
      type: "string",
      fieldName: "mandate_signed_at",
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
  indexes: [
    { name: "tenant_bank_accounts_tenant_id", properties: ["tenantId"] },
  ],
});

/**
 * Abweichende Postanschrift(en) eines Mieters. Lücken bedeuten
 * "Postanschrift = Wohnungsadresse".
 */
export type TenantAddress = {
  id: string;
  tenantId: string;
  startDate: string | null;
  endDate: string | null;
  street: string;
  postalCode: string;
  city: string;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const TenantAddressSchema = new EntitySchema<TenantAddress>({
  name: "TenantAddress",
  tableName: "tenant_addresses",
  properties: {
    id: { type: "string", primary: true, onCreate: () => crypto.randomUUID() },
    tenantId: fk(() => TenantSchema, "tenant_id", "cascade"),
    startDate: { type: "string", fieldName: "start_date", nullable: true },
    endDate: { type: "string", fieldName: "end_date", nullable: true },
    street: { type: "string" },
    postalCode: { type: "string", fieldName: "postal_code" },
    city: { type: "string" },
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
  indexes: [{ name: "tenant_addresses_tenant_id", properties: ["tenantId"] }],
});

/**
 * Login-Accounts für Residents, noch nicht in Verwendung
 */
export type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  passwordHash: string;
  role: UserRole;
  residentId: string | null;
  lastLoginAt: string | null;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const UserSchema = new EntitySchema<User>({
  name: "User",
  tableName: "users",
  properties: {
    id: { type: "string", primary: true, onCreate: () => crypto.randomUUID() },
    email: { type: "string" },
    firstName: { type: "string", fieldName: "first_name", nullable: true },
    lastName: { type: "string", fieldName: "last_name", nullable: true },
    passwordHash: { type: "string", fieldName: "password_hash" },
    role: { type: "string", default: "resident" },
    residentId: fk(() => ResidentSchema, "resident_id", "set null", {
      nullable: true,
    }),
    lastLoginAt: { type: "string", fieldName: "last_login_at", nullable: true },
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
  uniques: [{ name: "users_email_unique", properties: ["email"] }],
});

/**
 * Zahlungsbewegungen zu einem Mietvertrag. Genau eines von vier
 * Zweck-Feldern gesetzt (forMonth / forStatementId / forDeposit / forFeeId).
 */
export type Payment = {
  id: string;
  tenantId: string;
  paymentDate: string;
  reference: string | null;
  forMonth: string | null;
  forStatementId: string | null;
  forDeposit: Opt<boolean>;
  forFeeId: string | null;
  baseRentCents: number | null;
  advanceCents: number | null;
  amountCents: number | null;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const PaymentSchema = new EntitySchema<Payment>({
  name: "Payment",
  tableName: "payments",
  properties: {
    id: { type: "string", primary: true, onCreate: () => crypto.randomUUID() },
    tenantId: fk(() => TenantSchema, "tenant_id", "restrict"),
    paymentDate: { type: "string", fieldName: "payment_date" },
    reference: { type: "string", nullable: true },
    forMonth: { type: "string", fieldName: "for_month", nullable: true },
    forStatementId: {
      type: "string",
      fieldName: "for_statement_id",
      nullable: true,
    },
    forDeposit: {
      type: "boolean",
      fieldName: "for_deposit",
      default: false,
    },
    forFeeId: { type: "string", fieldName: "for_fee_id", nullable: true },
    baseRentCents: {
      type: "integer",
      fieldName: "base_rent_cents",
      nullable: true,
    },
    advanceCents: {
      type: "integer",
      fieldName: "advance_cents",
      nullable: true,
    },
    amountCents: {
      type: "integer",
      fieldName: "amount_cents",
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
  indexes: [{ name: "payments_tenant_id", properties: ["tenantId"] }],
});
