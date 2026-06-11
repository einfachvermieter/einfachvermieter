import {
  BuildingSchema,
  CostEntryItemSchema,
  CostEntrySchema,
  CostTypeSchema,
  MeterSchema,
  OperatingCostStatementSchema,
  PaymentSchema,
  ResidentSchema,
  TenantResidentSchema,
  TenantSchema,
  UnitSchema,
} from "@einfachvermieter/db";
import type { StatsResult } from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import { Injectable } from "@nestjs/common";

/** Gebäude-Scope: vorab aufgelöste Id-Ketten fürs Zählen */
type Scope = {
  unitIds: string[];
  tenantIds: string[];
  costTypeIds: string[];
};

@Injectable()
export class StatsService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Zählt die zentralen Entitäten. Mit `buildingId` werden die
   * Counts aufs Gebäude gescoped (Sidebar-Zähl-Badges); `buildings` bleibt
   * dabei global.
   */
  overview(buildingId?: string): Promise<StatsResult> {
    if (!buildingId) {
      return this.globalCounts();
    }

    return this.scopedCounts(buildingId);
  }

  private async globalCounts(): Promise<StatsResult> {
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
      openStatementsCount,
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
      this.em.count(OperatingCostStatementSchema, { status: "draft" }),
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
      openStatementsCount,
    };
  }

  private async scopedCounts(buildingId: string): Promise<StatsResult> {
    const scope = await this.resolveScope(buildingId);
    // Leeres $in ist nicht in allen Dialekten gültig. Platzhalter zählt 0.
    const tenantIds = scope.tenantIds.length > 0 ? scope.tenantIds : [""];
    const costTypeIds = scope.costTypeIds.length > 0 ? scope.costTypeIds : [""];

    const [
      buildings,
      meters,
      statements,
      openStatementsCount,
      residents,
      payments,
      costs,
    ] = await Promise.all([
      this.em.count(BuildingSchema),
      this.em.count(MeterSchema, { buildingId }),
      this.em.count(OperatingCostStatementSchema, { buildingId }),
      this.em.count(OperatingCostStatementSchema, {
        buildingId,
        status: "draft",
      }),
      this.countResidents(tenantIds),
      this.em.count(PaymentSchema, { tenantId: { $in: tenantIds } }),
      this.countCostEntries(costTypeIds),
    ]);

    return {
      buildings,
      units: scope.unitIds.length,
      meters,
      tenants: scope.tenantIds.length,
      residents,
      costTypes: scope.costTypeIds.length,
      costs,
      payments,
      statements,
      openStatementsCount,
    };
  }

  /**
   * Mieter hängen nur über die Wohnung am Gebäude, Bewohner/Zahlungen nur
   * über den Mietvertrag, Rechnungen über ihre Positionen an der Kostenart.
   */
  private async resolveScope(buildingId: string): Promise<Scope> {
    const [units, costTypes] = await Promise.all([
      this.em.find(UnitSchema, { buildingId }, { fields: ["id"] }),
      this.em.find(CostTypeSchema, { buildingId }, { fields: ["id"] }),
    ]);
    const unitIds = units.map((unit) => unit.id);

    const tenantIds =
      unitIds.length > 0
        ? (
            await this.em.find(
              TenantSchema,
              { unitId: { $in: unitIds } },
              { fields: ["id"] },
            )
          ).map((tenant) => tenant.id)
        : [];

    return {
      unitIds,
      tenantIds,
      costTypeIds: costTypes.map((costType) => costType.id),
    };
  }

  /**
   * Bewohner zählen.
   * Ein Bewohner kann an mehreren Mietverträgen hängen
   */
  private async countResidents(tenantIds: string[]): Promise<number> {
    const links = await this.em.find(
      TenantResidentSchema,
      { tenantId: { $in: tenantIds } },
      { fields: ["residentId"] },
    );

    return new Set(links.map((link) => link.residentId)).size;
  }

  /**
   * Positionen zählen.
   * Eine Rechnung kann mehrere Positionen im Gebäude haben
   */
  private async countCostEntries(costTypeIds: string[]): Promise<number> {
    const items = await this.em.find(
      CostEntryItemSchema,
      { costTypeId: { $in: costTypeIds } },
      { fields: ["costEntryId"] },
    );

    return new Set(items.map((item) => item.costEntryId)).size;
  }
}
