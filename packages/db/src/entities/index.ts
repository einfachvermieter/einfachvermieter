import { AccountFeeSchema, AccountSettlementSchema } from "./account.js";
import {
  CostEntryAttachmentSchema,
  CostEntryItemSchema,
  CostEntrySchema,
  CostTypeSchema,
  ExternalHeatingEntrySchema,
  HeatingSettingSchema,
} from "./costs.js";
import { MeterCostTypeAssignmentSchema } from "./meter-cost-types.js";
import {
  MeterDifferenceComponentSchema,
  MeterGasFactorSchema,
  MeterReadingSchema,
  MeterSchema,
} from "./meters.js";
import { BuildingSchema, UnitSchema } from "./properties.js";
import { SessionSchema } from "./sessions.js";
import { AppSettingsSchema } from "./settings.js";
import { OperatingCostStatementSchema } from "./statements.js";
import {
  PaymentSchema,
  ResidentSchema,
  TenantAddressSchema,
  TenantBankAccountSchema,
  TenantRentSchema,
  TenantResidentSchema,
  TenantSchema,
  UserSchema,
} from "./tenants.js";

export * from "./account.js";
export * from "./costs.js";
export * from "./meter-cost-types.js";
export * from "./meters.js";
export * from "./properties.js";
export * from "./sessions.js";
export * from "./settings.js";
export * from "./statements.js";
export * from "./tenants.js";

export const entitySchemas = [
  BuildingSchema,
  UnitSchema,
  MeterSchema,
  MeterReadingSchema,
  MeterGasFactorSchema,
  MeterDifferenceComponentSchema,
  MeterCostTypeAssignmentSchema,
  CostTypeSchema,
  CostEntrySchema,
  CostEntryItemSchema,
  HeatingSettingSchema,
  ExternalHeatingEntrySchema,
  CostEntryAttachmentSchema,
  ResidentSchema,
  TenantSchema,
  TenantResidentSchema,
  TenantRentSchema,
  TenantBankAccountSchema,
  TenantAddressSchema,
  UserSchema,
  SessionSchema,
  PaymentSchema,
  OperatingCostStatementSchema,
  AccountFeeSchema,
  AccountSettlementSchema,
  AppSettingsSchema,
];
