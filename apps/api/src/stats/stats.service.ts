import {
  BuildingSchema,
  CostEntrySchema,
  CostTypeSchema,
  MeterSchema,
  OperatingCostStatementSchema,
  PaymentSchema,
  ResidentSchema,
  TenantSchema,
  UnitSchema,
} from "@einfachvermieter/db";
import type { StatsResult } from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import { Injectable } from "@nestjs/common";

@Injectable()
export class StatsService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Zählt die zentralen Entitäten fürs Dashboard parallel
   */
  async overview(): Promise<StatsResult> {
    const [
      buildings,
      units,
      meters,
      tenants,
      residents,
      costTypes,
      costs,
      payments,
      statements,
    ] = await Promise.all([
      this.em.count(BuildingSchema),
      this.em.count(UnitSchema),
      this.em.count(MeterSchema),
      this.em.count(TenantSchema),
      this.em.count(ResidentSchema),
      this.em.count(CostTypeSchema),
      this.em.count(CostEntrySchema),
      this.em.count(PaymentSchema),
      this.em.count(OperatingCostStatementSchema),
    ]);

    return {
      buildings,
      units,
      meters,
      tenants,
      residents,
      costTypes,
      costs,
      payments,
      statements,
    };
  }
}
