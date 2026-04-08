import type { StatementResult } from "@einfachvermieter/shared";
import { EntitySchema, type Opt } from "@mikro-orm/core";
import { fk } from "./_relations.js";
import { BuildingSchema } from "./properties.js";
import { TenantSchema, UserSchema } from "./tenants.js";

export type StatementStatus =
  | "draft"
  | "finalized"
  | "cancelled"
  | "superseded";

/**
 * Nebenkostenabrechnung für einen Zeitraum und einen Mietvertrag. Solange
 * status "draft": Live-Berechnung. Bei "finalized" wird der komplette
 * Berechnungsstand in snapshotData (JSON) eingefroren.
 */
export type OperatingCostStatement = {
  id: string;
  buildingId: string;
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  documentDate: string | null;
  status: StatementStatus;
  snapshotData: StatementResult | null;
  totalCostsCents: number | null;
  totalAdvancesCents: number | null;
  balanceCents: number | null;
  adjustedMonthlyAdvanceCents: number | null;
  adjustedAdvanceValidFrom: string | null;
  tariffAdjustmentBps: Record<string, number> | null;
  finalizedAt: string | null;
  finalizedByUserId: string | null;
  pdfPath: string | null;
  sequenceNumber: number | null;
  revisionNumber: number | null;
  sentAt: string | null;
  supersedesStatementId: string | null;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  cancellationReason: string | null;
  notes: string | null;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const OperatingCostStatementSchema =
  new EntitySchema<OperatingCostStatement>({
    name: "OperatingCostStatement",
    tableName: "operating_cost_statements",
    properties: {
      id: {
        type: "string",
        primary: true,
        onCreate: () => crypto.randomUUID(),
      },
      buildingId: fk(() => BuildingSchema, "building_id", "restrict"),
      tenantId: fk(() => TenantSchema, "tenant_id", "restrict"),
      periodStart: { type: "string", fieldName: "period_start" },
      periodEnd: { type: "string", fieldName: "period_end" },
      documentDate: {
        type: "string",
        fieldName: "document_date",
        nullable: true,
      },
      status: { type: "string", default: "draft" },
      snapshotData: {
        type: "json",
        fieldName: "snapshot_data",
        nullable: true,
      },
      totalCostsCents: {
        type: "integer",
        fieldName: "total_costs_cents",
        nullable: true,
      },
      totalAdvancesCents: {
        type: "integer",
        fieldName: "total_advances_cents",
        nullable: true,
      },
      balanceCents: {
        type: "integer",
        fieldName: "balance_cents",
        nullable: true,
      },
      adjustedMonthlyAdvanceCents: {
        type: "integer",
        fieldName: "adjusted_monthly_advance_cents",
        nullable: true,
      },
      adjustedAdvanceValidFrom: {
        type: "string",
        fieldName: "adjusted_advance_valid_from",
        nullable: true,
      },
      tariffAdjustmentBps: {
        type: "json",
        fieldName: "tariff_adjustment_bps",
        nullable: true,
      },
      finalizedAt: {
        type: "string",
        fieldName: "finalized_at",
        nullable: true,
      },
      finalizedByUserId: fk(
        () => UserSchema,
        "finalized_by_user_id",
        "set null",
        { nullable: true },
      ),
      pdfPath: { type: "text", fieldName: "pdf_path", nullable: true },
      sequenceNumber: {
        type: "integer",
        fieldName: "sequence_number",
        nullable: true,
      },
      revisionNumber: {
        type: "integer",
        fieldName: "revision_number",
        nullable: true,
      },
      sentAt: { type: "string", fieldName: "sent_at", nullable: true },
      // Weiche Selbst-Referenz, plain String statt echter FK
      // um eine zirkuläre Auflösung mit sich selbst zu vermeiden
      supersedesStatementId: {
        type: "string",
        fieldName: "supersedes_statement_id",
        nullable: true,
      },
      cancelledAt: {
        type: "string",
        fieldName: "cancelled_at",
        nullable: true,
      },
      cancelledByUserId: fk(
        () => UserSchema,
        "cancelled_by_user_id",
        "set null",
        { nullable: true },
      ),
      cancellationReason: {
        type: "text",
        fieldName: "cancellation_reason",
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
        name: "operating_cost_statements_tenant_id",
        properties: ["tenantId"],
      },
      {
        name: "operating_cost_statements_building_id",
        properties: ["buildingId"],
      },
    ],
  });
