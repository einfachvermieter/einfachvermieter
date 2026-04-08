import { EntitySchema, type Opt } from "@mikro-orm/core";
import { fk } from "./_relations.js";
import { OperatingCostStatementSchema } from "./statements.js";
import { TenantSchema } from "./tenants.js";

/**
 * Mahn-/Rücklauf-/Verzugsgebühren. Erhöhen die Soll-Seite gegen den
 * Mieter, fließen NICHT in die NK-Abrechnung. Immer positiv.
 */
export type AccountFee = {
  id: string;
  tenantId: string;
  date: string;
  amountCents: number;
  reason: string;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const AccountFeeSchema = new EntitySchema<AccountFee>({
  name: "AccountFee",
  tableName: "account_fees",
  properties: {
    id: { type: "string", primary: true, onCreate: () => crypto.randomUUID() },
    tenantId: fk(() => TenantSchema, "tenant_id", "restrict"),
    date: { type: "string" },
    amountCents: { type: "integer", fieldName: "amount_cents" },
    reason: { type: "text" },
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
  indexes: [{ name: "account_fees_tenant_id", properties: ["tenantId"] }],
});

/**
 * Settlement-Ergebnis aus finalisierter NK-Abrechnung. positiv = Mieter
 * muss nachzahlen, negativ = Mieter bekommt Guthaben.
 */
export type AccountSettlement = {
  id: string;
  tenantId: string;
  statementId: string;
  date: string;
  amountCents: number;
  createdAt: Opt<string>;
};

export const AccountSettlementSchema = new EntitySchema<AccountSettlement>({
  name: "AccountSettlement",
  tableName: "account_settlements",
  properties: {
    id: { type: "string", primary: true, onCreate: () => crypto.randomUUID() },
    tenantId: fk(() => TenantSchema, "tenant_id", "restrict"),
    statementId: fk(
      () => OperatingCostStatementSchema,
      "statement_id",
      "restrict",
    ),
    date: { type: "string" },
    amountCents: { type: "integer", fieldName: "amount_cents" },
    createdAt: {
      type: "string",
      fieldName: "created_at",
      defaultRaw: "current_timestamp",
    },
  },
  indexes: [
    { name: "account_settlements_tenant_id", properties: ["tenantId"] },
    { name: "account_settlements_statement_id", properties: ["statementId"] },
  ],
});
