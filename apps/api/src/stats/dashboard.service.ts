import {
  BuildingSchema,
  MeterSchema,
  OperatingCostStatementSchema,
  type Resident,
  ResidentSchema,
  type Tenant,
  type TenantRent,
  TenantRentSchema,
  TenantResidentSchema,
  TenantSchema,
  type Unit,
  UnitSchema,
} from "@einfachvermieter/db";
import {
  type DashboardResult,
  daysBetween,
  firstOfMonthIso,
  formatName,
  pickRentForMonth,
  todayIso,
} from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import { Injectable } from "@nestjs/common";
import { AccountsService } from "../accounts/accounts.service.js";

const MONTHS_IN_CHART = 6;
const MAX_OVERDUE_TENANTS = 20;

/**
 * Läuft das Mietverhältnis (mind. teilweise) im Kalenderjahr
 */
const overlapsYear = (tenant: Tenant, year: number): boolean =>
  tenant.startDate <= `${year}-12-31` &&
  (tenant.endDate === null || tenant.endDate >= `${year}-01-01`);

/**
 * Läuft das Mietverhältnis am Stichtag
 */
const isActiveOn = (tenant: Tenant, date: string): boolean =>
  tenant.startDate <= date &&
  (tenant.endDate === null || tenant.endDate >= date);

/**
 * Zahlen und Aufgaben der Übersichtsseite
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly em: EntityManager,
    private readonly accountsService: AccountsService,
  ) {}

  async overview(): Promise<DashboardResult> {
    const today = todayIso();
    const statementYear = Number(today.slice(0, 4)) - 1;
    const chartStart = firstOfMonthIso(today, -(MONTHS_IN_CHART - 1));

    const [buildings, units, tenants, rents, meterCount] = await Promise.all([
      this.em.find(BuildingSchema, {}, { orderBy: { name: "asc" } }),
      this.em.find(UnitSchema, {}),
      this.em.find(TenantSchema, {}),
      this.em.find(TenantRentSchema, {}, { orderBy: { startDate: "asc" } }),
      this.em.count(MeterSchema, { isActive: true }),
    ]);

    const [balances, months, firstOpenMonths, names] = await Promise.all([
      this.accountsService.getAllBalances(today),
      this.accountsService.getMonthlyTotals(chartStart, today),
      this.accountsService.getFirstOpenMonths(chartStart, today),
      this.tenantNames(tenants.map((tenant) => tenant.id)),
    ]);

    const missingByTenant = await this.missingStatements(
      tenants,
      statementYear,
    );

    const unitById = new Map(units.map((unit) => [unit.id, unit]));
    const buildingNames = new Map(
      buildings.map((building) => [building.id, building.name]),
    );
    const overdueByTenant = new Map(
      balances
        .filter((balance) => balance.balanceCents < 0)
        .map((balance) => [balance.tenantId, -balance.balanceCents]),
    );

    const overdueTenants = [...overdueByTenant.entries()]
      .map(([tenantId, amountCents]) => {
        const tenant = tenants.find((candidate) => candidate.id === tenantId);
        const buildingId = tenant
          ? unitById.get(tenant.unitId)?.buildingId
          : undefined;

        return {
          tenantId,
          residentNames: names.get(tenantId) ?? [],
          buildingName: buildingId ? (buildingNames.get(buildingId) ?? "") : "",
          amountCents,
          sinceMonth: firstOpenMonths.get(tenantId) ?? null,
        };
      })
      .sort((a, b) => b.amountCents - a.amountCents)
      .slice(0, MAX_OVERDUE_TENANTS);

    const statementsTotal = missingByTenant.size + missingByTenant.doneCount;
    const statementDeadline = `${statementYear + 1}-12-31`;

    return {
      statementYear,
      statementsDone: missingByTenant.doneCount,
      statementsTotal,
      statementDeadline,
      daysUntilDeadline: daysBetween(today, statementDeadline) - 1,
      buildingsWithMissingStatements: this.groupMissingByBuilding(
        missingByTenant.openTenantIds,
        tenants,
        unitById,
        buildings,
      ),
      overdueTotalCents: [...overdueByTenant.values()].reduce(
        (sum, amount) => sum + amount,
        0,
      ),
      overdueTenants,
      months,
      buildings: this.buildingRows({
        buildings,
        units,
        tenants,
        rents,
        today,
        overdueByTenant,
        openTenantIds: missingByTenant.openTenantIds,
        unitById,
      }),
      unitsWithoutTenant: this.unitsWithoutTenant(units, tenants, buildings),
      meterCount,
    };
  }

  /**
   * Wohnungen ohne jedes Mietverhältnis (also noch nicht eingerichtet)
   */
  private unitsWithoutTenant(
    units: Unit[],
    tenants: Tenant[],
    buildings: { id: string; name: string }[],
  ): DashboardResult["unitsWithoutTenant"] {
    const withTenant = new Set(tenants.map((tenant) => tenant.unitId));
    const buildingNames = new Map(
      buildings.map((building) => [building.id, building.name]),
    );

    return units
      .filter((unit) => !withTenant.has(unit.id))
      .map((unit) => ({
        id: unit.id,
        name: unit.name,
        buildingId: unit.buildingId,
        buildingName: buildingNames.get(unit.buildingId) ?? "",
      }));
  }

  /**
   * Mietverhältnisse des Abrechnungsjahres, getrennt nach erledigt und
   * offen. Erledigt heißt: eine finalisierte Abrechnung deckt den
   * Zeitraum ab; Entwürfe zählen nicht, sie wahren die Frist nicht.
   */
  private async missingStatements(
    tenants: Tenant[],
    year: number,
  ): Promise<{ doneCount: number; openTenantIds: string[]; size: number }> {
    const relevant = tenants.filter(
      (tenant) => tenant.kind === "private" && overlapsYear(tenant, year),
    );
    if (relevant.length === 0) {
      return { doneCount: 0, openTenantIds: [], size: 0 };
    }

    const statements = await this.em.find(OperatingCostStatementSchema, {
      tenantId: { $in: relevant.map((tenant) => tenant.id) },
      status: "finalized",
      periodStart: { $lte: `${year}-12-31` },
      periodEnd: { $gte: `${year}-01-01` },
    });
    const settled = new Set(statements.map((statement) => statement.tenantId));

    const openTenantIds = relevant
      .filter((tenant) => !settled.has(tenant.id))
      .map((tenant) => tenant.id);

    return {
      doneCount: relevant.length - openTenantIds.length,
      openTenantIds,
      size: openTenantIds.length,
    };
  }

  /**
   * Offene Abrechnungen je Gebäude, für den Hinweis im Kopf
   */
  private groupMissingByBuilding(
    openTenantIds: string[],
    tenants: Tenant[],
    unitById: Map<string, Unit>,
    buildings: { id: string; name: string }[],
  ): { id: string; name: string; count: number }[] {
    const counts = new Map<string, number>();

    for (const tenantId of openTenantIds) {
      const tenant = tenants.find((candidate) => candidate.id === tenantId);
      const buildingId = tenant
        ? unitById.get(tenant.unitId)?.buildingId
        : null;

      if (buildingId) {
        counts.set(buildingId, (counts.get(buildingId) ?? 0) + 1);
      }
    }

    return buildings
      .filter((building) => counts.has(building.id))
      .map((building) => ({
        id: building.id,
        name: building.name,
        count: counts.get(building.id) ?? 0,
      }));
  }

  /**
   * Je Gebäude: Belegung, Sollmiete des laufenden Monats, Rückstände und
   * fehlende Abrechnungen
   */
  private buildingRows(input: {
    buildings: { id: string; name: string }[];
    units: Unit[];
    tenants: Tenant[];
    rents: TenantRent[];
    today: string;
    overdueByTenant: Map<string, number>;
    openTenantIds: string[];
    unitById: Map<string, Unit>;
  }): DashboardResult["buildings"] {
    const month = input.today.slice(0, 7);
    const openTenants = new Set(input.openTenantIds);

    return input.buildings.map((building) => {
      const buildingUnits = input.units.filter(
        (unit) => unit.buildingId === building.id,
      );
      const unitIds = new Set(buildingUnits.map((unit) => unit.id));
      const activeTenants = input.tenants.filter(
        (tenant) =>
          unitIds.has(tenant.unitId) && isActiveOn(tenant, input.today),
      );

      const monthlyRentCents = activeTenants.reduce((sum, tenant) => {
        const rent = pickRentForMonth(
          input.rents.filter((row) => row.tenantId === tenant.id),
          month,
        );

        return (
          sum +
          (rent ? rent.monthlyBaseRentCents + rent.monthlyAdvanceCents : 0)
        );
      }, 0);

      const buildingTenantIds = input.tenants
        .filter((tenant) => unitIds.has(tenant.unitId))
        .map((tenant) => tenant.id);

      return {
        id: building.id,
        name: building.name,
        unitsCount: buildingUnits.length,
        rentedCount: new Set(activeTenants.map((tenant) => tenant.unitId)).size,
        monthlyRentCents,
        overdueCents: buildingTenantIds.reduce(
          (sum, tenantId) => sum + (input.overdueByTenant.get(tenantId) ?? 0),
          0,
        ),
        missingStatements: buildingTenantIds.filter((tenantId) =>
          openTenants.has(tenantId),
        ).length,
      };
    });
  }

  /**
   * Anzeigename je Mietverhältnis: die Bewohner mit Komma verbunden
   */
  private async tenantNames(
    tenantIds: string[],
  ): Promise<Map<string, string[]>> {
    if (tenantIds.length === 0) {
      return new Map();
    }

    const links = await this.em.find(TenantResidentSchema, {
      tenantId: { $in: tenantIds },
    });
    const residents = await this.em.find(ResidentSchema, {
      id: { $in: links.map((link) => link.residentId) },
    });
    const residentById = new Map<string, Resident>(
      residents.map((resident) => [resident.id, resident]),
    );

    const names = new Map<string, string[]>();
    for (const link of links) {
      const resident = residentById.get(link.residentId);
      if (!resident) {
        continue;
      }
      const list = names.get(link.tenantId) ?? [];
      list.push(formatName(resident.firstName, resident.lastName));
      names.set(link.tenantId, list);
    }

    return names;
  }
}
