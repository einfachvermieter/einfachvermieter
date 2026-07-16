import {
  type CostEntryItem,
  CostEntryItemSchema,
  type CostType,
  CostTypeSchema,
  type Meter,
  MeterDifferenceComponentSchema,
  MeterReadingSchema,
  MeterSchema,
  type OperatingCostStatement,
  OperatingCostStatementSchema,
  PaymentSchema,
  TenantRentSchema,
  TenantSchema,
  type Unit,
  UnitSchema,
  UserSchema,
} from "@einfachvermieter/db";
import {
  type AdvanceAdjustmentDetail,
  addDaysIso,
  aggregateHeatingCosts,
  CalculationError,
  type CalcWarning,
  type CostEntry,
  calculateExternalHeating,
  calculateHeating,
  calculateStatement,
  consumptionBetween,
  type DifferenceConfigInput,
  daysBetween,
  type ExternalHeatingEntry,
  formatWarningParams,
  type HeatingDetail,
  type HotWaterInput,
  inferTariffAdjustmentBpsFromInvoices,
  intersect,
  type MeterInfo,
  type OperatingCostStatementAdvanceAdjustmentDto,
  type OperatingCostStatementCancelDto,
  type OperatingCostStatementCreateDto,
  type PaymentSummary,
  prorationFactor,
  type ReadingPoint,
  STATEMENT_HEATING_COST_TYPE_ID,
  type StatementCalculationInput,
  type StatementResult,
  statementResultSchema,
  suggestNextMonthlyAdvanceCents,
  suggestNextMonthlyAdvanceCentsWithTariffs,
  sumDegreeDays,
  type TariffInferenceItem,
  type TaxableLaborCosts,
  todayIso,
  type UnitInfo,
} from "@einfachvermieter/shared";
import { EntityManager, LockMode } from "@mikro-orm/core";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AccountsService } from "../accounts/accounts.service.js";
import { ExternalHeatingEntriesService } from "../heating/external-heating-entries.service.js";
import { HeatingService } from "../heating/heating.service.js";
import { getI18n } from "../i18n/i18n.registry.js";
import { notFoundMessage } from "../i18n/notFound.js";
import { TenantsService } from "../tenants/tenants.service.js";

type StatementRow = OperatingCostStatement;

export type StatementSort = "tenant" | "period" | "status" | "balance";

export type StatementListParams = {
  buildingId?: string;
  page: number;
  pageSize: number;
  sort?: StatementSort;
  order?: "asc" | "desc";
  q?: string;
};

export type StatementOverviewRow = {
  id: string;
  buildingId: string;
  tenantId: string;
  unitName: string;
  contractResidents: { firstName: string; lastName: string }[];
  periodStart: string;
  periodEnd: string;
  documentDate: string | null;
  status: OperatingCostStatement["status"];
  totalCostsCents: number | null;
  balanceCents: number | null;
  finalizedAt: string | null;
};

export type StatementListResult = {
  items: StatementOverviewRow[];
  total: number;
};

/**
 * Heizkosten-Topf-Position inkl. optionaler CO2-Bepreisung
 */
type HeatingPotEntry = CostEntry & {
  co2CostCents: number | null;
  co2AmountGrams: number | null;
};

/**
 * Zähler samt Ablesungen und (bei Differenzzählern) Komponenten-Konfiguration
 */
type MeterBundle = {
  meter: MeterInfo;
  readings: ReadingPoint[];
  differenceConfig: DifferenceConfigInput | null;
};

/**
 * Lohnkosten-Rohposition (§35a) vor Mieter-Attribution und Aggregation
 */
type LaborItemRaw = {
  costTypeId: string;
  costTypeName: string;
  category: "craftsman" | "household_service";
  isHeating: boolean;
  unitId: string | null;
  amountCents: number;
  laborCostsCents: number;
  periodStart: string;
  periodEnd: string;
};

/**
 * Lohnkosten-Rohpositionen (§35a) einer Kostenart mit gesetztem Anteil
 */
const laborItemsFromCostType = (
  ct: CostType,
  category: "craftsman" | "household_service",
  costsRaw: CostEntryItem[],
): LaborItemRaw[] =>
  costsRaw
    .filter((c) => c.laborCostsCents !== null && c.laborCostsCents > 0)
    .map((c) => ({
      costTypeId: ct.id,
      costTypeName: ct.name,
      category,
      isHeating: ct.category === "heating",
      unitId: c.unitId,
      amountCents: c.amountCents,
      laborCostsCents: c.laborCostsCents ?? 0,
      periodStart: c.periodStart,
      periodEnd: c.periodEnd,
    }));

/**
 * Heizkosten-Topf-Positionen einer Kostenart (category=heating)
 */
const heatingEntriesFromCostType = (
  ct: CostType,
  costsRaw: CostEntryItem[],
): HeatingPotEntry[] =>
  costsRaw.map((c) => ({
    id: c.id,
    costTypeId: c.costTypeId,
    allocationKey: "heating_ordinance",
    name: ct.name,
    amountCents: c.amountCents,
    co2CostCents: ct.co2Tracked ? c.co2CostCents : null,
    co2AmountGrams: ct.co2Tracked ? c.co2AmountGrams : null,
    periodStart: c.periodStart,
    periodEnd: c.periodEnd,
  }));

/**
 * Mieter-Anteil je Betriebskosten-Kostenart (tenant/total) aus dem Ergebnis
 */
const operatingSharesFromResult = (
  result: StatementResult,
): Map<string, number> => {
  const shares = new Map<string, number>();

  for (const line of result.lines) {
    if (line.totalAmountCents <= 0) {
      continue;
    }

    shares.set(line.costTypeId, line.tenantAmountCents / line.totalAmountCents);
  }

  return shares;
};

/**
 * Mieter-Anteil am ungeteilten Heizkosten-Gesamttopf (Heizung + Warmwasser),
 * maßgeblich für die Lohnkosten-Zuordnung der Heiz-Kostenart. 0 bei externer
 * Abrechnung oder ohne Heizkosten.
 */
const heatingTenantShareOf = (
  mode: string,
  heatingDetail: StatementResult["heatingDetail"],
  targetUnitId: string,
): number => {
  if (mode === "external" || !heatingDetail) {
    return 0;
  }

  const total = heatingDetail.totalHeatingCostsCents;
  if (total <= 0) {
    return 0;
  }

  const target = heatingDetail.perUnit.find((u) => u.unitId === targetUnitId);
  const targetHotWater = heatingDetail.hotWaterDetail?.perUnit.find(
    (u) => u.unitId === targetUnitId,
  );

  const tenantHeatingCents =
    (target?.totalCents ?? 0) + (targetHotWater?.totalCents ?? 0);

  return tenantHeatingCents / total;
};

/**
 * Kürzt eine externe Heizkosten-Position auf die Abrechnungsperiode. Bei
 * `prorationMethod === "degree_days"` folgt der Verbrauchskostenanteil
 * (§ 9b HeizkostenV) der Gradtagstabelle, Grundkosten und unklassifizierter
 * Rest bleiben tagesanteilig linear - wie im internen Modus
 * (`aggregateHeatingCosts`).
 */
export const prorateExternalHeatingEntry = (
  entry: ExternalHeatingEntry,
  prorationMethod: Awaited<
    ReturnType<HeatingService["getForBuildingAt"]>
  >["prorationMethod"],
  effectivePeriod: { start: string; end: string },
): {
  unitId: string;
  totalCents: number;
  baseCostCents: number | null;
  consumptionCostCents: number | null;
} => {
  const entryPeriod = { start: entry.periodStart, end: entry.periodEnd };
  const linearFactor = prorationFactor(entryPeriod, effectivePeriod);

  let consumptionFactor = linearFactor;
  if (prorationMethod === "degree_days") {
    const overlap = intersect(entryPeriod, effectivePeriod);
    const itemDegreeDays = overlap ? sumDegreeDays(entryPeriod) : 0;
    const overlapDegreeDays =
      overlap && itemDegreeDays > 0 ? sumDegreeDays(overlap) : 0;
    if (overlapDegreeDays > 0) {
      consumptionFactor = overlapDegreeDays / itemDegreeDays;
    }
  }

  const baseCostCents =
    entry.baseCostCents === null
      ? null
      : Math.round(entry.baseCostCents * linearFactor);
  const consumptionCostCents =
    entry.consumptionCostCents === null
      ? null
      : Math.round(entry.consumptionCostCents * consumptionFactor);
  const restCents =
    entry.totalCents -
    (entry.baseCostCents ?? 0) -
    (entry.consumptionCostCents ?? 0);

  return {
    unitId: entry.unitId,
    totalCents:
      (baseCostCents ?? 0) +
      (consumptionCostCents ?? 0) +
      Math.round(restCents * linearFactor),
    baseCostCents,
    consumptionCostCents,
  };
};

/**
 * Kontext für die Mieter-Attribution einer einzelnen Lohnkosten-Position
 */
type LaborAttributionContext = {
  mode: string;
  prorationMethod: Awaited<
    ReturnType<HeatingService["getForBuildingAt"]>
  >["prorationMethod"];
  targetUnitId: string;
  heatingTenantShare: number;
  operatingShares: Map<string, number>;
  effectivePeriod: { start: string; end: string };
  statementPeriod: { start: string; end: string };
};

/**
 * Roher (ungerundeter) Mieter-Lohnkostenanteil einer Position: Attributions-
 * faktor (Perioden-Overlap) x Mieter-Anteil x Lohnkosten. null, wenn die
 * Position nicht auf den Ziel-Mieter entfällt.
 */
const attributeLaborItem = (
  item: LaborItemRaw,
  context: LaborAttributionContext,
): number | null => {
  if (item.isHeating && context.mode === "external") {
    return null;
  }

  if (item.unitId && item.unitId !== context.targetUnitId) {
    return null;
  }

  let attributionFactor: number;
  let tenantShare: number;

  if (item.isHeating) {
    const itemAgg = aggregateHeatingCosts(
      [
        {
          amountCents: item.amountCents,
          periodStart: item.periodStart,
          periodEnd: item.periodEnd,
        },
      ],
      context.effectivePeriod,
      context.prorationMethod,
    );
    attributionFactor =
      item.amountCents > 0 ? itemAgg.totalCents / item.amountCents : 0;
    tenantShare = context.heatingTenantShare;
  } else {
    attributionFactor = prorationFactor(
      { start: item.periodStart, end: item.periodEnd },
      context.statementPeriod,
    );
    tenantShare = context.operatingShares.get(item.costTypeId) ?? 0;
  }

  if (attributionFactor === 0 || tenantShare === 0) {
    return null;
  }

  return item.laborCostsCents * attributionFactor * tenantShare;
};

@Injectable()
export class StatementsService {
  constructor(
    private readonly em: EntityManager,
    private readonly tenantsService: TenantsService,
    private readonly heatingService: HeatingService,
    private readonly externalHeatingEntriesService: ExternalHeatingEntriesService,
    private readonly accountsService: AccountsService,
  ) {}

  /**
   * Paginierte, sortierbare Abrechnungs-Übersicht, optional auf ein Gebäude
   * gefiltert.
   *
   * Der Mieter-Bezeichner (Wohnung + präsente Vertragsparteien) hängt von der
   * Mieter-Aggregation ab; Suche und Sortierung über diese abgeleiteten Spalten
   * laufen, wie bei der Mieter-Übersicht und bei kleinem Datenvolumen, im
   * Speicher.
   *
   * @param params.q Freitextsuche in Wohnungsname und Vor-/Nachname der Vertragsparteien
   */
  async list(params: StatementListParams): Promise<StatementListResult> {
    const {
      buildingId,
      page,
      pageSize,
      sort = "period",
      order = "desc",
      q,
    } = params;

    const statements = await this.em.find(
      OperatingCostStatementSchema,
      buildingId ? { buildingId } : {},
      {
        fields: [
          // snapshotData brauchen wir hier nicht
          "id",
          "buildingId",
          "tenantId",
          "periodStart",
          "periodEnd",
          "documentDate",
          "status",
          "totalCostsCents",
          "balanceCents",
          "finalizedAt",
        ],
      },
    );
    if (statements.length === 0) {
      return { items: [], total: 0 };
    }

    const { items: tenantRows } = await this.tenantsService.list({
      buildingId,
      page: 0,
      pageSize: Number.MAX_SAFE_INTEGER,
    });
    const tenantById = new Map(tenantRows.map((row) => [row.id, row]));

    const needle = q?.toLowerCase();

    type Entry = {
      row: StatementOverviewRow;
      sortUnit: string;
      sortResident: string;
    };
    const entries: Entry[] = [];

    for (const statement of statements) {
      const tenant = tenantById.get(statement.tenantId);
      const unitName = tenant?.unitName ?? "";
      const contractResidents = tenant?.contractResidents ?? [];

      if (needle) {
        const matchesResident = contractResidents.some(
          (resident) =>
            resident.firstName.toLowerCase().includes(needle) ||
            resident.lastName.toLowerCase().includes(needle),
        );

        if (!unitName.toLowerCase().includes(needle) && !matchesResident) {
          continue;
        }
      }

      const [firstResident] = contractResidents;
      entries.push({
        sortUnit: unitName.toLowerCase(),
        sortResident: firstResident
          ? `${firstResident.lastName.toLowerCase()} ${firstResident.firstName.toLowerCase()}`
          : "",
        row: {
          id: statement.id,
          buildingId: statement.buildingId,
          tenantId: statement.tenantId,
          unitName,
          contractResidents,
          periodStart: statement.periodStart,
          periodEnd: statement.periodEnd,
          documentDate: statement.documentDate,
          status: statement.status,
          totalCostsCents: statement.totalCostsCents,
          balanceCents: statement.balanceCents,
          finalizedAt: statement.finalizedAt,
        },
      });
    }

    const dir = order === "desc" ? -1 : 1;
    const sortKey = (entry: Entry): string | number => {
      switch (sort) {
        case "tenant":
          return entry.sortUnit;
        case "status":
          return entry.row.status;
        case "balance":
          return entry.row.balanceCents ?? Number.NEGATIVE_INFINITY;
        default:
          return entry.row.periodStart;
      }
    };

    entries.sort((a, b) => {
      const ka = sortKey(a);
      const kb = sortKey(b);

      let primary = 0;
      if (typeof ka === "number" && typeof kb === "number") {
        primary = ka - kb;
      } else if (sort === "tenant") {
        primary =
          String(ka).localeCompare(String(kb)) ||
          a.sortResident.localeCompare(b.sortResident);
      } else {
        primary = String(ka).localeCompare(String(kb));
      }

      if (primary !== 0) {
        return primary * dir;
      }

      return a.row.id.localeCompare(b.row.id);
    });

    const total = entries.length;
    const items = entries
      .slice(page * pageSize, page * pageSize + pageSize)
      .map((entry) => entry.row);

    return { items, total };
  }

  /**
   * Eine Abrechnung per Id laden
   */
  async get(id: string) {
    const statement = await this.em.findOne(OperatingCostStatementSchema, {
      id,
    });
    if (!statement) {
      throw new NotFoundException(notFoundMessage("statement", id));
    }

    return statement;
  }

  /**
   * Liefert die zum Stichtag (`atDate`) vertragliche monatliche
   * NK-Vorauszahlung eines Tenants
   */
  private async getMonthlyRentAt(
    tenantId: string,
    atDate: string,
  ): Promise<{ advanceCents: number; baseRentCents: number }> {
    const rents = await this.em.find(
      TenantRentSchema,
      { tenantId },
      { orderBy: { startDate: "asc" } },
    );
    if (rents.length === 0) {
      return { advanceCents: 0, baseRentCents: 0 };
    }

    const covering =
      rents.find(
        (rent) =>
          (rent.startDate === null || rent.startDate <= atDate) &&
          (rent.endDate === null || rent.endDate >= atDate),
      ) ?? rents.at(-1);

    return {
      advanceCents: covering?.monthlyAdvanceCents ?? 0,
      baseRentCents: covering?.monthlyBaseRentCents ?? 0,
    };
  }

  /**
   * Blockiert Anlegen/Finalisieren, wenn für denselben Mieter bereits eine
   * finalisierte Abrechnung mit überlappendem Zeitraum existiert.
   */
  private async assertNoOverlappingFinalized(
    em: EntityManager,
    tenantId: string,
    periodStart: string,
    periodEnd: string,
    ignoreStatementId?: string | null,
  ) {
    const overlapping = await em.findOne(OperatingCostStatementSchema, {
      tenantId,
      status: "finalized",
      periodStart: { $lte: periodEnd },
      periodEnd: { $gte: periodStart },
      ...(ignoreStatementId ? { id: { $ne: ignoreStatementId } } : {}),
    });

    if (overlapping) {
      throw new BadRequestException(
        getI18n().t("errors.statementPeriodOverlapsFinalized", {
          periodStart: overlapping.periodStart,
          periodEnd: overlapping.periodEnd,
        }),
      );
    }
  }

  /**
   * Erstellt eine neue Abrechnung im Status "draft"
   */
  async create(dto: OperatingCostStatementCreateDto) {
    await this.assertNoOverlappingFinalized(
      this.em,
      dto.tenantId,
      dto.periodStart,
      dto.periodEnd,
    );

    const created = this.em.create(OperatingCostStatementSchema, {
      buildingId: dto.buildingId,
      tenantId: dto.tenantId,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      documentDate: dto.documentDate ?? todayIso(),
      notes: dto.notes,
      status: "draft",
      tariffAdjustmentBps: null,
    });

    this.em.persist(created);
    await this.em.flush();

    return created;
  }

  /**
   * Übersetzt einen behebbaren Berechnungsfehler (CalculationError) in der
   * API in eine BadRequest-Antwort mit lokalisiertem Text. Andere
   * Fehler (interne Asserts, technische Fehler) bleiben unverändert.
   */
  private toCalcHttpError(err: unknown): Error {
    if (err instanceof CalculationError) {
      return new BadRequestException(
        getI18n().t(`errors.calc.${err.code}`, err.params ?? {}),
      );
    }
    return err instanceof Error ? err : new Error(String(err));
  }

  /**
   * Lokalisiert eine Berechnungs-Warnung für die UI/PDF-Anzeige.
   */
  private formatWarning(
    source: "heating" | "water",
    warning: CalcWarning,
  ): string {
    const i18n = getI18n();
    const params = formatWarningParams(warning.params);

    let message = i18n.t(`warnings.${warning.code}`, params);

    if (params.label !== undefined) {
      message = i18n.t("warnings.labeled", {
        label: params.label,
        message,
      });
    }

    return i18n.t("warnings.line", {
      category: i18n.t(`warnings.category.${source}`),
      message,
    });
  }

  /**
   * Berechnet die Abrechnung aus den aktuellen Stammdaten.
   * Mieter-Periode wird auf die tatsächliche Vertragsdauer beschnitten.
   * Heizung, Wasser, Lohnkosten und Vorauszahlungen werden aggregiert und
   * zu einem StatementResult zusammengeführt.
   */
  async calculate(
    buildingId: string,
    tenantId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<StatementResult> {
    const tenant = await this.em.findOne(TenantSchema, { id: tenantId });
    if (!tenant) {
      throw new NotFoundException(notFoundMessage("tenant", tenantId));
    }

    const tenantEnd = tenant.endDate ?? "9999-12-31";
    if (!(tenant.startDate <= periodEnd && tenantEnd >= periodStart)) {
      throw new BadRequestException(
        getI18n().t("errors.tenantNotBillable", {
          tenantId,
          periodStart,
          periodEnd,
        }),
      );
    }
    const targetUnitId = tenant.unitId;

    const effectivePeriod = {
      start: tenant.startDate > periodStart ? tenant.startDate : periodStart,
      end: tenantEnd < periodEnd ? tenantEnd : periodEnd,
    };
    const statementPeriod = { start: periodStart, end: periodEnd };

    const {
      unitsRaw,
      units,
      occupantsByUnitFull,
      occupancyDaysByUnitFull,
      occupancyDaysByUnitTenant,
    } = await this.buildUnitInfos(
      buildingId,
      statementPeriod,
      effectivePeriod,
      targetUnitId,
    );
    const periodDays = daysBetween(periodStart, periodEnd);

    const {
      metersRaw,
      readingsByMeter,
      waterMeters,
      heatMeters,
      heatCostAllocators,
    } = await this.loadMeterBundles(buildingId, statementPeriod);

    const { operatingCostTypes, heatingCostEntries, laborItems } =
      await this.loadCostEntries(buildingId, statementPeriod);

    const heatingSettings = await this.heatingService.getForBuildingAt(
      buildingId,
      periodStart,
    );

    const heatingDetail = await this.buildHeatingDetail({
      buildingId,
      heatingSettings,
      units,
      unitsRaw,
      metersRaw,
      readingsByMeter,
      heatMeters,
      heatCostAllocators,
      heatingCostEntries,
      statementPeriod,
      effectivePeriod,
      occupancyDaysByUnitFull,
      occupancyDaysByUnitTenant,
      occupantsByUnitFull,
      targetUnitId,
    });

    const totalAdvancesCents =
      await this.accountsService.getReceivedAdvancesForPeriod(
        tenantId,
        effectivePeriod.start,
        effectivePeriod.end,
      );

    const payments = await this.loadPayments(tenantId, effectivePeriod);

    let result: StatementResult;
    try {
      result = calculateStatement({
        period: statementPeriod,
        tenantPeriod: effectivePeriod,
        units,
        targetTenantId: tenantId,
        targetUnitId,
        costTypes: operatingCostTypes,
        waterMeters,
        heatingDetail,
        totalAdvancesCents,
      });
    } catch (err) {
      throw this.toCalcHttpError(err);
    }

    const warnings: string[] = [
      ...(result.heatingDetail?.warnings ?? []).map((warning) =>
        this.formatWarning("heating", warning),
      ),
      ...(result.waterDetail?.warnings ?? []).map((warning) =>
        this.formatWarning("water", warning),
      ),
    ];

    const occupancyDetail = this.buildOccupancyDetail(
      unitsRaw,
      occupancyDaysByUnitFull,
      periodDays,
      result.lines.some((line) => line.allocationKey === "per_person"),
    );

    const advanceAdjustment = await this.buildAdvanceAdjustment({
      tenantId,
      periodEnd,
      buildingId,
      statementPeriod,
      effectivePeriod,
      result,
    });

    const taxableLaborCosts = this.buildTaxableLaborCosts({
      result,
      heatingSettings,
      targetUnitId,
      laborItems,
      effectivePeriod,
      statementPeriod,
    });

    return {
      ...result,
      warnings,
      payments,
      ...(occupancyDetail ? { occupancyDetail } : {}),
      advanceAdjustment,
      ...(taxableLaborCosts ? { taxableLaborCosts } : {}),
    };
  }

  /**
   * Lädt Wohnungen samt Belegungs-Kennzahlen und baut die UnitInfo-Liste. Wird für
   * die Ziel-Wohnung auf die Mieter-Periode beschnitten, sonst über die volle
   * Abrechnungsperiode.
   */
  private async buildUnitInfos(
    buildingId: string,
    statementPeriod: { start: string; end: string },
    effectivePeriod: { start: string; end: string },
    targetUnitId: string,
  ): Promise<{
    unitsRaw: Unit[];
    units: UnitInfo[];
    occupantsByUnitFull: Awaited<
      ReturnType<TenantsService["getOccupantCountPerUnit"]>
    >;
    occupancyDaysByUnitFull: Awaited<
      ReturnType<TenantsService["getOccupancyDaysPerUnit"]>
    >;
    occupancyDaysByUnitTenant: Awaited<
      ReturnType<TenantsService["getOccupancyDaysPerUnit"]>
    >;
  }> {
    const unitsRaw = await this.em.find(UnitSchema, { buildingId });

    const occupancyRows =
      await this.tenantsService.loadBuildingOccupancyRows(buildingId);

    const occupantsByUnitFull = this.tenantsService.getOccupantCountPerUnit(
      occupancyRows,
      statementPeriod,
    );

    const occupancyDaysByUnitFull = this.tenantsService.getOccupancyDaysPerUnit(
      occupancyRows,
      statementPeriod,
    );

    const occupantsByUnitTenant = this.tenantsService.getOccupantCountPerUnit(
      occupancyRows,
      effectivePeriod,
    );

    const occupancyDaysByUnitTenant =
      this.tenantsService.getOccupancyDaysPerUnit(
        occupancyRows,
        effectivePeriod,
      );

    const periodDays = daysBetween(statementPeriod.start, statementPeriod.end);

    const units: UnitInfo[] = unitsRaw.map((u) => {
      const isTarget = u.id === targetUnitId;
      const daysSource = isTarget
        ? occupancyDaysByUnitTenant
        : occupancyDaysByUnitFull;
      const occupantSource = isTarget
        ? occupantsByUnitTenant
        : occupantsByUnitFull;
      const days = daysSource.get(u.id) ?? {
        personDays: 0,
        occupiedDays: 0,
      };

      return {
        id: u.id,
        name: u.name,
        areaSqm: u.areaSqm,
        heatingAreaSqm: u.heatingAreaSqm,
        occupantCount: occupantSource.get(u.id) ?? 0,
        personDays: days.personDays,
        occupiedDays: days.occupiedDays,
        periodDays,
      };
    });

    return {
      unitsRaw,
      units,
      occupantsByUnitFull,
      occupancyDaysByUnitFull,
      occupancyDaysByUnitTenant,
    };
  }

  /**
   * Lädt aktive Zähler samt Ablesungen und Differenzzähler-Konfiguration und
   * bündelt sie nach Wasser-, Wärme- und Heizkostenverteiler-Zählern
   * (jeweils role=unit für die Verbrauchsverteilung).
   */
  private async loadMeterBundles(
    buildingId: string,
    statementPeriod: { start: string; end: string },
  ): Promise<{
    metersRaw: Meter[];
    readingsByMeter: Map<string, ReadingPoint[]>;
    waterMeters: MeterBundle[];
    heatMeters: MeterBundle[];
    heatCostAllocators: MeterBundle[];
  }> {
    const metersRaw = await this.em.find(MeterSchema, {
      buildingId,
      isActive: true,
    });

    const meterIds = metersRaw.map((m) => m.id);
    const readingsByMeter = new Map<string, ReadingPoint[]>();

    if (meterIds.length > 0) {
      // Verbrauch wird nur innerhalb der Abrechnungsperiode interpoliert; ein
      // Jahr Puffer je Seite deckt die umschliessenden Ablesungen bei jaehrlicher
      // (gesetzlich vorgeschriebener) Ablesung ab.
      const windowStart = addDaysIso(statementPeriod.start, -366);
      const windowEnd = addDaysIso(statementPeriod.end, 366);
      const readingsRaw = await this.em.find(
        MeterReadingSchema,
        {
          meterId: { $in: meterIds },
          readingDate: { $gte: windowStart, $lte: windowEnd },
        },
        { orderBy: { readingDate: "asc" } },
      );

      for (const reading of readingsRaw) {
        const point: ReadingPoint = {
          date: reading.readingDate,
          value: reading.value,
          isCumulative: reading.isCumulative,
          isEstimated: reading.isEstimated,
        };

        const existing = readingsByMeter.get(reading.meterId);

        if (existing) {
          existing.push(point);
        } else {
          readingsByMeter.set(reading.meterId, [point]);
        }
      }
    }

    const virtualMeterIds = metersRaw
      .filter((m) => m.role === "virtual_difference")
      .map((m) => m.id);

    const differenceConfigByMeter = new Map<string, DifferenceConfigInput>();

    if (virtualMeterIds.length > 0) {
      const componentsRaw = await this.em.find(MeterDifferenceComponentSchema, {
        virtualMeterId: { $in: virtualMeterIds },
      });

      for (const virtualMeterId of virtualMeterIds) {
        const rows = componentsRaw.filter(
          (row) => row.virtualMeterId === virtualMeterId,
        );

        const baseRow = rows.find((row) => row.kind === "base");
        if (!baseRow) {
          continue;
        }

        differenceConfigByMeter.set(virtualMeterId, {
          baseMeterId: baseRow.sourceMeterId,
          subtractedMeterIds: rows
            .filter((row) => row.kind === "subtract")
            .map((row) => row.sourceMeterId),
        });
      }
    }

    const toMeterBundle = (m: (typeof metersRaw)[number]): MeterBundle => ({
      meter: {
        id: m.id,
        type: m.type,
        role: m.role,
        unitId: m.unitId,
        label: m.label,
        serialNumber: m.serialNumber,
        measurementUnit: m.measurementUnit,
        kTotal: m.kTotal,
        validFrom: m.validFrom,
        validUntil: m.validUntil,
      } as MeterInfo,
      readings: readingsByMeter.get(m.id) ?? [],
      differenceConfig:
        m.role === "virtual_difference"
          ? (differenceConfigByMeter.get(m.id) ?? null)
          : null,
    });

    const waterMeters = metersRaw
      .filter((m) => m.type === "water_cold" || m.type === "water_hot")
      .map(toMeterBundle);
    // Verbrauchsverteilung verteilt NUR wohnungsbezogene Zähler (role=unit).
    // Gebäudeweite WMZ (role=main für totalHeatEnergyKwh, role=common als
    // Warmwasser-Boiler via hotWaterMeterId) werden über eigene Pfade
    // angesprochen und dürfen nicht in die Pro-Wohnung-Verteilung. Sonst
    // wirft die Calc-Schicht `heatingMeterNoUnit`.
    const heatMeters = metersRaw
      .filter((m) => m.type === "heat_meter" && m.role === "unit")
      .map(toMeterBundle);
    const heatCostAllocators = metersRaw
      .filter((m) => m.type === "heat_cost_allocator" && m.role === "unit")
      .map(toMeterBundle);

    return {
      metersRaw,
      readingsByMeter,
      waterMeters,
      heatMeters,
      heatCostAllocators,
    };
  }

  /**
   * Lädt die Zahlungen des Mieters innerhalb der (Monats-gerundeten) Periode
   */
  private async loadPayments(
    tenantId: string,
    effectivePeriod: { start: string; end: string },
  ): Promise<PaymentSummary[]> {
    const startMonth = effectivePeriod.start.slice(0, 7);
    const endMonth = effectivePeriod.end.slice(0, 7);

    const paymentsRaw = await this.em.find(
      PaymentSchema,
      {
        tenantId,
        forMonth: { $gte: startMonth, $lte: endMonth },
      },
      { orderBy: { forMonth: "asc" } },
    );

    return paymentsRaw.map((row) => ({
      id: row.id,
      forMonth: row.forMonth ?? "",
      date: row.paymentDate,
      baseRentCents: row.baseRentCents ?? 0,
      advanceCents: row.advanceCents ?? 0,
      reference: row.reference ?? null,
    }));
  }

  /**
   * Baut das Belegungs-Detail nur, wenn mindestens eine Wohnung eine Lücke in
   * der Belegung hat (sonst undefined). Ergänzt Vermieter-Eigennutzungstage.
   */
  private buildOccupancyDetail(
    unitsRaw: Unit[],
    occupancyDaysByUnitFull: Awaited<
      ReturnType<TenantsService["getOccupancyDaysPerUnit"]>
    >,
    periodDays: number,
    hasPersonAllocation: boolean,
  ) {
    const fullPersonDays = unitsRaw.map(
      (u) => occupancyDaysByUnitFull.get(u.id)?.personDays ?? 0,
    );

    const fullOccupiedDays = unitsRaw.map(
      (u) => occupancyDaysByUnitFull.get(u.id)?.occupiedDays ?? 0,
    );

    // Der Belegungs-Anhang erklärt sowohl den Leerstand-Vermieteranteil als auch
    // die Personentage-Gewichte einer Personenumlage. Fußnote und Tabelle müssen
    // gemeinsam erscheinen, sonst verweist die Fußnote ins Leere.
    const hasGap = fullOccupiedDays.some((d) => d < periodDays);
    if (!hasGap && !hasPersonAllocation) {
      return;
    }

    return {
      periodDays,

      perUnit: unitsRaw.map((u, idx) => {
        const detail = occupancyDaysByUnitFull.get(u.id);
        const spans = detail?.residentSpans ?? [];
        return {
          unitId: u.id,
          unitName: u.name,
          areaSqm: u.areaSqm,
          occupantCount: detail?.occupantCount ?? 0,
          occupiedDays: fullOccupiedDays[idx] ?? 0,
          personDays: fullPersonDays[idx] ?? 0,
          residents: spans.map((s, sidx) => ({
            label: `Person ${sidx + 1}`,
            from: s.from,
            to: s.to,
            days: s.days,
          })),
        };
      }),

      totalPersonDays: (() => {
        const tenantPD = fullPersonDays.reduce((acc, d) => acc + d, 0);
        const totalOcc = fullOccupiedDays.reduce((acc, d) => acc + d, 0);
        const landlordPD = Math.max(0, unitsRaw.length * periodDays - totalOcc);
        return tenantPD + landlordPD;
      })(),

      totalOccupiedDays: fullOccupiedDays.reduce((acc, d) => acc + d, 0),

      landlordOccupiedDays: Math.max(
        0,
        unitsRaw.length * periodDays -
          fullOccupiedDays.reduce((acc, d) => acc + d, 0),
      ),

      landlordPersonDays: Math.max(
        0,
        unitsRaw.length * periodDays -
          fullOccupiedDays.reduce((acc, d) => acc + d, 0),
      ),
    };
  }

  /**
   * Ermittelt die Vorauszahlungs-Anpassung: aktuelle Monatsbeträge und
   * Vorschlag für die Folgeperiode (mit/ohne Tarif-Automatik).
   */
  private async buildAdvanceAdjustment(input: {
    tenantId: string;
    periodEnd: string;
    buildingId: string;
    statementPeriod: { start: string; end: string };
    effectivePeriod: { start: string; end: string };
    result: StatementResult;
  }): Promise<AdvanceAdjustmentDetail> {
    const {
      tenantId,
      periodEnd,
      buildingId,
      statementPeriod,
      effectivePeriod,
      result,
    } = input;

    const {
      advanceCents: currentMonthlyAdvanceCents,
      baseRentCents: currentMonthlyBaseRentCents,
    } = await this.getMonthlyRentAt(tenantId, periodEnd);

    const tenantBilledDays = daysBetween(
      effectivePeriod.start,
      effectivePeriod.end,
    );

    const suggestedMonthlyAdvanceCents = suggestNextMonthlyAdvanceCents(
      result.totalCostsCents,
      tenantBilledDays,
    );

    const linesByCostTypeId: Record<string, number> = {};

    for (const line of result.lines) {
      linesByCostTypeId[line.costTypeId] =
        (linesByCostTypeId[line.costTypeId] ?? 0) + line.tenantAmountCents;
    }

    const suggestedMonthlyAdvanceWithTariffsCents =
      suggestNextMonthlyAdvanceCentsWithTariffs(
        linesByCostTypeId,
        tenantBilledDays,
        null,
      );

    const autoTariffAdjustmentBps = await this.computeAutoTariffAdjustmentBps(
      buildingId,
      statementPeriod,
    );

    return {
      currentMonthlyAdvanceCents,
      currentMonthlyBaseRentCents,
      suggestedMonthlyAdvanceCents,
      suggestedMonthlyAdvanceWithTariffsCents,
      tenantBilledDays,
      adjustedMonthlyAdvanceCents: null,
      adjustedAdvanceValidFrom: null,
      tariffAdjustmentBps: null,
      autoTariffAdjustmentBps,
    };
  }

  /**
   * Ermittelt die steuerlich absetzbaren Lohnkosten (§35a EStG) je Kategorie:
   * pro Position Mieter-Attribution, Aggregation je Kostenart, Gruppierung nach
   * Handwerker-/haushaltsnaher Leistung. undefined, wenn nichts anfällt.
   */
  private buildTaxableLaborCosts(input: {
    result: StatementResult;
    heatingSettings: Awaited<ReturnType<HeatingService["getForBuildingAt"]>>;
    targetUnitId: string;
    laborItems: LaborItemRaw[];
    effectivePeriod: { start: string; end: string };
    statementPeriod: { start: string; end: string };
  }): TaxableLaborCosts | undefined {
    const {
      result,
      heatingSettings,
      targetUnitId,
      laborItems,
      effectivePeriod,
      statementPeriod,
    } = input;

    const context: LaborAttributionContext = {
      mode: heatingSettings.mode,
      prorationMethod: heatingSettings.prorationMethod,
      targetUnitId,
      heatingTenantShare: heatingTenantShareOf(
        heatingSettings.mode,
        result.heatingDetail,
        targetUnitId,
      ),
      operatingShares: operatingSharesFromResult(result),
      effectivePeriod,
      statementPeriod,
    };

    const aggregation = new Map<
      string,
      {
        costTypeName: string;
        category: "craftsman" | "household_service";
        tenantLaborCentsRaw: number;
      }
    >();

    for (const item of laborItems) {
      const tenantLaborRaw = attributeLaborItem(item, context);
      if (tenantLaborRaw === null) {
        continue;
      }

      const existing = aggregation.get(item.costTypeId);
      if (existing) {
        existing.tenantLaborCentsRaw += tenantLaborRaw;
      } else {
        aggregation.set(item.costTypeId, {
          costTypeName: item.costTypeName,
          category: item.category,
          tenantLaborCentsRaw: tenantLaborRaw,
        });
      }
    }

    const grouped = new Map<
      "craftsman" | "household_service",
      Array<{
        costTypeId: string;
        costTypeName: string;
        tenantAmountCents: number;
      }>
    >();

    for (const [costTypeId, agg] of aggregation) {
      const rounded = Math.round(agg.tenantLaborCentsRaw);
      if (rounded <= 0) {
        continue;
      }

      const list = grouped.get(agg.category) ?? [];
      list.push({
        costTypeId,
        costTypeName: agg.costTypeName,
        tenantAmountCents: rounded,
      });

      grouped.set(agg.category, list);
    }

    const order: Array<"craftsman" | "household_service"> = [
      "craftsman",
      "household_service",
    ];

    const byCategory = order
      .map((category) => {
        const lines = grouped.get(category);
        if (!lines || lines.length === 0) {
          return null;
        }
        lines.sort((a, b) => b.tenantAmountCents - a.tenantAmountCents);
        const tenantTotalCents = lines.reduce(
          (acc, line) => acc + line.tenantAmountCents,
          0,
        );
        return { category, tenantTotalCents, lines };
      })
      .filter((group): group is NonNullable<typeof group> => group !== null);

    return byCategory.length > 0 ? { byCategory } : undefined;
  }

  /**
   * Lädt die Kostenarten-Positionen der Periode und partitioniert sie in
   * Betriebskosten-Kostenarten, Heizkosten-Töpfe und Lohnkosten (§35a).
   */
  private async loadCostEntries(
    buildingId: string,
    statementPeriod: { start: string; end: string },
  ): Promise<{
    operatingCostTypes: StatementCalculationInput["costTypes"];
    heatingCostEntries: HeatingPotEntry[];
    laborItems: LaborItemRaw[];
  }> {
    const costTypesRaw = await this.em.find(CostTypeSchema, { buildingId });
    const costTypeIds = costTypesRaw.map((ct) => ct.id);
    const allItems =
      costTypeIds.length > 0
        ? await this.em.find(CostEntryItemSchema, {
            costTypeId: { $in: costTypeIds },
            periodStart: { $lte: statementPeriod.end },
            periodEnd: { $gte: statementPeriod.start },
          })
        : [];
    const itemsByCostType = new Map<string, typeof allItems>();

    for (const item of allItems) {
      const list = itemsByCostType.get(item.costTypeId) ?? [];
      list.push(item);
      itemsByCostType.set(item.costTypeId, list);
    }

    const operatingCostTypes: StatementCalculationInput["costTypes"] = [];
    const heatingCostEntries: HeatingPotEntry[] = [];
    const laborItems: LaborItemRaw[] = [];

    for (const costTypeRaw of costTypesRaw) {
      const costsRaw = itemsByCostType.get(costTypeRaw.id) ?? [];

      if (costTypeRaw.laborCostCategory) {
        laborItems.push(
          ...laborItemsFromCostType(
            costTypeRaw,
            costTypeRaw.laborCostCategory,
            costsRaw,
          ),
        );
      }

      if (costTypeRaw.category === "heating") {
        heatingCostEntries.push(
          ...heatingEntriesFromCostType(costTypeRaw, costsRaw),
        );
        continue;
      }

      if (!costTypeRaw.defaultAllocationKey) {
        throw new Error(
          `Kostenart ${costTypeRaw.id} hat category="operating" ohne defaultAllocationKey`,
        );
      }

      const allocationKey = costTypeRaw.defaultAllocationKey;

      operatingCostTypes.push({
        id: costTypeRaw.id,
        name: costTypeRaw.name,
        allocationKey,
        costs: costsRaw.map((cost) => ({
          id: cost.id,
          costTypeId: cost.costTypeId,
          allocationKey,
          name: costTypeRaw.name,
          unitId: cost.unitId,
          amountCents: cost.amountCents,
          periodStart: cost.periodStart,
          periodEnd: cost.periodEnd,
        })),
      });
    }

    return { operatingCostTypes, heatingCostEntries, laborItems };
  }

  /**
   * Warmwasser-Abspaltung (§ 9 Abs. 2 HeizkostenV): nur bei zentraler
   * Warmwasserbereitung über die Heizung. Q_WW aus dem Boiler-WMZ (gemessen)
   * oder der Schätzformel über den Warmwasserverbrauch; Q_gesamt aus den
   * Heizungseinstellungen, ersatzweise aus einem Haupt-WMZ.
   */
  private buildHotWaterInput(input: {
    heatingSettings: Awaited<ReturnType<HeatingService["getForBuildingAt"]>>;
    unitsRaw: Unit[];
    metersRaw: Meter[];
    readingsByMeter: Map<string, ReadingPoint[]>;
    statementPeriod: { start: string; end: string };
    effectivePeriod: { start: string; end: string };
    targetUnitId: string;
  }): HotWaterInput | undefined {
    const {
      heatingSettings,
      unitsRaw,
      metersRaw,
      readingsByMeter,
      statementPeriod,
      effectivePeriod,
      targetUnitId,
    } = input;
    if (heatingSettings.heatingType !== "central_with_hot_water") {
      return;
    }
    const deltaBetween = (
      meterId: string,
      period: { start: string; end: string },
    ): number =>
      consumptionBetween(
        readingsByMeter.get(meterId) ?? [],
        period.start,
        period.end,
      );
    const deltaOverPeriod = (meterId: string): number =>
      deltaBetween(meterId, statementPeriod);

    let { totalHeatEnergyKwh } = heatingSettings;
    if (totalHeatEnergyKwh === null) {
      const mainHeatMeter = metersRaw.find(
        (m) => m.type === "heat_meter" && m.role === "main",
      );

      if (mainHeatMeter) {
        totalHeatEnergyKwh = deltaOverPeriod(mainHeatMeter.id);
      }
    }

    const boilerHeatKwh = heatingSettings.hotWaterMeterId
      ? deltaOverPeriod(heatingSettings.hotWaterMeterId)
      : null;

    // Ziel-Wohnung: Zähler = Mietzeit-Delta, der Rest der vollen Periode
    // (Vor-/Nachmieter, Leerstand) fällt als `landlordM3` auf den Vermieter.
    // Q_WW/Gesamtvolumen bleiben Voll-Perioden-Werte (Jahres-Topf-Split).
    let landlordM3 = 0;
    const unitHotWaterM3 = unitsRaw.map((u) => {
      const isTarget = u.id === targetUnitId;
      let fullM3 = 0;
      let m3 = 0;
      for (const m of metersRaw) {
        if (m.type !== "water_hot" || m.role !== "unit" || m.unitId !== u.id) {
          continue;
        }
        const meterFullM3 = deltaOverPeriod(m.id);
        fullM3 += meterFullM3;
        m3 += isTarget ? deltaBetween(m.id, effectivePeriod) : meterFullM3;
      }
      if (isTarget) {
        landlordM3 += Math.max(0, fullM3 - m3);
      }
      return { unitId: u.id, m3 };
    });

    const totalHotWaterM3 =
      unitHotWaterM3.reduce((acc, entry) => acc + entry.m3, 0) + landlordM3;

    return {
      totalHeatEnergyKwh,
      boilerHeatKwh,
      hotWaterVolumeM3: totalHotWaterM3 > 0 ? totalHotWaterM3 : null,
      supplyTemperatureCelsius:
        heatingSettings.hotWaterSupplyTemperatureCelsius,
      unitHotWaterM3,
      landlordM3,
    };
  }

  /**
   * Ermittelt das Heizkosten-Detail: entweder aus externer Abrechnung
   * (verbrauchsunabhängig prorata) oder über die interne HeizkostenV-Verteilung
   * inkl. Warmwasser-Abspaltung (§ 9 Abs. 2) und CO2-Bepreisung.
   */
  private async buildHeatingDetail(input: {
    buildingId: string;
    heatingSettings: Awaited<ReturnType<HeatingService["getForBuildingAt"]>>;
    units: UnitInfo[];
    unitsRaw: Unit[];
    metersRaw: Meter[];
    readingsByMeter: Map<string, ReadingPoint[]>;
    heatMeters: MeterBundle[];
    heatCostAllocators: MeterBundle[];
    heatingCostEntries: HeatingPotEntry[];
    statementPeriod: { start: string; end: string };
    effectivePeriod: { start: string; end: string };
    occupancyDaysByUnitFull: Awaited<
      ReturnType<TenantsService["getOccupancyDaysPerUnit"]>
    >;
    occupancyDaysByUnitTenant: Awaited<
      ReturnType<TenantsService["getOccupancyDaysPerUnit"]>
    >;
    occupantsByUnitFull: Awaited<
      ReturnType<TenantsService["getOccupantCountPerUnit"]>
    >;
    targetUnitId: string;
  }): Promise<HeatingDetail> {
    const {
      buildingId,
      heatingSettings,
      units,
      unitsRaw,
      metersRaw,
      readingsByMeter,
      heatMeters,
      heatCostAllocators,
      heatingCostEntries,
      statementPeriod,
      effectivePeriod,
      occupancyDaysByUnitFull,
      occupancyDaysByUnitTenant,
      occupantsByUnitFull,
      targetUnitId,
    } = input;

    let heatingDetail: HeatingDetail;
    if (heatingSettings.mode === "external") {
      const entries =
        await this.externalHeatingEntriesService.listForBuildingAndPeriod(
          buildingId,
          effectivePeriod.start,
          effectivePeriod.end,
        );

      heatingDetail = calculateExternalHeating({
        units,
        entries: entries.map((entry) =>
          prorateExternalHeatingEntry(
            entry,
            heatingSettings.prorationMethod,
            effectivePeriod,
          ),
        ),
      });

      return heatingDetail;
    }

    const heatingAggregation = aggregateHeatingCosts(
      heatingCostEntries,
      statementPeriod,
      heatingSettings.prorationMethod,
    );

    const totalHeatingCostsCents = heatingAggregation.totalCents;
    const breakdownMap = new Map<string, number>();

    heatingCostEntries.forEach((entry, idx) => {
      const attributedCents =
        heatingAggregation.perItemAttributedCents[idx] ?? 0;
      if (attributedCents === 0) {
        return;
      }
      breakdownMap.set(
        entry.name,
        (breakdownMap.get(entry.name) ?? 0) + attributedCents,
      );
    });

    const costBreakdown = [...breakdownMap.entries()]
      .map(([label, amountCents]) => ({ label, amountCents }))
      .sort((a, b) => b.amountCents - a.amountCents);
    const { consumptionMethod } = heatingSettings;
    const consumptionMeters =
      consumptionMethod === "heat_cost_allocator"
        ? heatCostAllocators
        : heatMeters;
    const statementPeriodDays = daysBetween(
      statementPeriod.start,
      statementPeriod.end,
    );
    const statementPeriodDegreeDayPromille = sumDegreeDays(statementPeriod);

    const unitsForHeating: UnitInfo[] = unitsRaw.map((u) => {
      // Ziel-Wohnung: Belegung auf die Mietzeit geclippt, damit der
      // Grundkostenanteil außerhalb der Mietzeit (Vor-/Nachmieter, Leerstand)
      // dem Vermieter zufällt statt doppelt kassiert zu werden.
      const daysSource =
        u.id === targetUnitId
          ? occupancyDaysByUnitTenant
          : occupancyDaysByUnitFull;
      const days = daysSource.get(u.id) ?? {
        personDays: 0,
        occupiedDays: 0,
        occupiedDegreeDayPromille: 0,
      };
      return {
        id: u.id,
        name: u.name,
        areaSqm: u.areaSqm,
        heatingAreaSqm: u.heatingAreaSqm,
        occupantCount: occupantsByUnitFull.get(u.id) ?? 0,
        personDays: days.personDays,
        occupiedDays: days.occupiedDays,
        occupiedDegreeDayPromille: days.occupiedDegreeDayPromille,
        periodDays: statementPeriodDays,
        periodDegreeDayPromille: statementPeriodDegreeDayPromille,
      };
    });

    // Warmwasser-Abspaltung (§ 9 Abs. 2 HeizkostenV): nur bei zentraler
    // Warmwasserbereitung über die Heizung. Q_WW kommt aus dem Boiler-WMZ
    // (gemessen) oder der Schätzformel über den Warmwasserverbrauch; Q_gesamt
    // aus den Heizungseinstellungen, ersatzweise aus einem Haupt-WMZ.
    const hotWater = this.buildHotWaterInput({
      heatingSettings,
      unitsRaw,
      metersRaw,
      readingsByMeter,
      statementPeriod,
      effectivePeriod,
      targetUnitId,
    });

    try {
      heatingDetail = calculateHeating({
        totalHeatingCostsCents,
        config: {
          consumptionShareBps: heatingSettings.consumptionSharePercent * 100,
        },
        units: unitsForHeating,
        consumptionMeters,
        consumptionMethod,
        periodStart: statementPeriod.start,
        periodEnd: statementPeriod.end,
        tenantPeriodStart: effectivePeriod.start,
        tenantPeriodEnd: effectivePeriod.end,
        targetUnitId,
        prorationMethod: heatingSettings.prorationMethod,
        ...(hotWater ? { hotWater } : {}),
        co2: {
          enabled: heatingSettings.co2CostShareEnabled,
          totalCostCents: heatingAggregation.totalCo2CostCents,
          totalAmountGrams: heatingAggregation.totalCo2AmountGrams,
          livingAreaSqm: unitsRaw.reduce((acc, u) => acc + u.areaSqm, 0),
          periodDays: statementPeriodDays,
        },
      });
      heatingDetail.costBreakdown = costBreakdown;
      heatingDetail.fuelType = heatingSettings.fuelType;
    } catch (err) {
      throw this.toCalcHttpError(err);
    }

    return heatingDetail;
  }

  /**
   * Berechnet das Ergebnis für ein konkretes Statement und mergt die am
   * Record gespeicherten Anpassungs-Felder in `advanceAdjustment`.
   */
  async calculateForStatement(
    statement: StatementRow,
  ): Promise<StatementResult> {
    const result = await this.calculate(
      statement.buildingId,
      statement.tenantId,
      statement.periodStart,
      statement.periodEnd,
    );
    if (!result.advanceAdjustment) {
      return result;
    }

    const { tariffAdjustmentBps } = statement;
    const linesByCostTypeId: Record<string, number> = {};

    for (const line of result.lines) {
      linesByCostTypeId[line.costTypeId] =
        (linesByCostTypeId[line.costTypeId] ?? 0) + line.tenantAmountCents;
    }

    const tenant = await this.em.findOne(TenantSchema, {
      id: statement.tenantId,
    });

    const tenantEnd = tenant?.endDate ?? "9999-12-31";
    const effectiveStart =
      tenant && tenant.startDate > statement.periodStart
        ? tenant.startDate
        : statement.periodStart;
    const effectiveEnd =
      tenantEnd < statement.periodEnd ? tenantEnd : statement.periodEnd;
    const tenantBilledDays = daysBetween(effectiveStart, effectiveEnd);
    const suggestedMonthlyAdvanceWithTariffsCents =
      suggestNextMonthlyAdvanceCentsWithTariffs(
        linesByCostTypeId,
        tenantBilledDays,
        tariffAdjustmentBps,
      );

    return {
      ...result,
      advanceAdjustment: {
        ...result.advanceAdjustment,
        suggestedMonthlyAdvanceWithTariffsCents,
        adjustedMonthlyAdvanceCents: statement.adjustedMonthlyAdvanceCents,
        adjustedAdvanceValidFrom: statement.adjustedAdvanceValidFrom,
        tariffAdjustmentBps,
      },
    };
  }

  /**
   * Ermittelt App-seitig pro Kostenart eine erwartete Tarif-Anpassung in
   * Basispunkten (Vergleich Folge-Periode gegen aktuelle Periode).
   */
  private async computeAutoTariffAdjustmentBps(
    buildingId: string,
    period: { start: string; end: string },
  ): Promise<Record<string, number> | null> {
    const periodDays = daysBetween(period.start, period.end);
    const followUpStart = addDaysIso(period.end, 1);
    const followUpEnd = addDaysIso(period.end, periodDays);

    const costTypes = await this.em.find(
      CostTypeSchema,
      { buildingId },
      { fields: ["id", "defaultAllocationKey", "category"] },
    );

    const costTypeById = new Map(costTypes.map((ct) => [ct.id, ct]));
    const costTypeIds = costTypes.map((ct) => ct.id);

    const rows =
      costTypeIds.length > 0
        ? await this.em.find(CostEntryItemSchema, {
            costTypeId: { $in: costTypeIds },
            periodStart: { $lte: followUpEnd },
            periodEnd: { $gte: period.start },
          })
        : [];

    const items: TariffInferenceItem[] = rows.map((row) => {
      const costType = costTypeById.get(row.costTypeId);
      return {
        costTypeId: row.costTypeId,
        allocationKey:
          costType?.category === "heating"
            ? "heating_ordinance"
            : (costType?.defaultAllocationKey ?? "fixed"),
        amountCents: row.amountCents,
        unitPriceCents: row.unitPriceCents,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
      };
    });

    const result = inferTariffAdjustmentBpsFromInvoices({
      items,
      currentPeriod: period,
      followUpPeriod: { start: followUpStart, end: followUpEnd },
      heatingPseudoId: STATEMENT_HEATING_COST_TYPE_ID,
    });

    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Setzt oder entfernt die optionale Anpassung der monatlichen NK-
   * Vorauszahlung an einer Draft-Abrechnung
   */
  async setAdvanceAdjustment(
    id: string,
    dto: OperatingCostStatementAdvanceAdjustmentDto,
  ) {
    const statement = await this.get(id);
    if (statement.status === "finalized") {
      throw new BadRequestException(
        getI18n().t("errors.statementAlreadyFinalized"),
      );
    }

    if (
      dto.adjustedAdvanceValidFrom !== null &&
      dto.adjustedAdvanceValidFrom <= statement.periodEnd
    ) {
      throw new BadRequestException(
        getI18n().t("errors.statementAdjustmentValidFromBeforePeriodEnd", {
          validFrom: dto.adjustedAdvanceValidFrom,
          periodEnd: statement.periodEnd,
        }),
      );
    }

    this.em.assign(statement, {
      adjustedMonthlyAdvanceCents: dto.adjustedMonthlyAdvanceCents,
      adjustedAdvanceValidFrom: dto.adjustedAdvanceValidFrom,
      tariffAdjustmentBps: dto.tariffAdjustmentBps,
      updatedAt: new Date().toISOString(),
    });

    await this.em.flush();

    return statement;
  }

  /**
   * Finalisiert eine Draft-Abrechnung: Berechnung wird als Snapshot
   * persistiert. Ab hier unveränderbar.
   */
  async finalize(id: string, finalizedByUserId: string) {
    const statement = await this.get(id);
    if (statement.status !== "draft") {
      throw new BadRequestException(
        getI18n().t("errors.statementAlreadyFinalized"),
      );
    }

    // finalized_by_user_id ist ein echter FK; ein stale JWT-Cookie würde sonst
    // erst beim Schreiben in eine kryptische FK-Verletzung laufen.
    const finalizingUser = await this.em.findOne(UserSchema, {
      id: finalizedByUserId,
    });
    if (!finalizingUser) {
      throw new BadRequestException(getI18n().t("errors.sessionUserMissing"));
    }

    const result = await this.calculateForStatement(statement);

    const parsed = statementResultSchema.safeParse(result);
    if (!parsed.success) {
      throw new BadRequestException(
        getI18n().t("errors.statementFinalizeCalculationIncomplete", {
          message: parsed.error.message,
        }),
      );
    }

    const adjustment = result.advanceAdjustment;
    const needsRentRotation =
      adjustment !== undefined &&
      adjustment.adjustedMonthlyAdvanceCents !== null &&
      adjustment.adjustedAdvanceValidFrom !== null &&
      adjustment.adjustedMonthlyAdvanceCents !==
        adjustment.currentMonthlyAdvanceCents;

    const periodYear = Number(statement.periodStart.slice(0, 4));
    const yearStart = `${periodYear}-01-01`;
    const yearEnd = `${periodYear}-12-31`;

    const updated = await this.em.transactional(async (em) => {
      // Status erneut checken: zwei parallele Finalize-Requests
      // (z.B. Doppelklick, Retry) könnten sonst doppelt Soll buchen etc.
      const row = await em.findOne(
        OperatingCostStatementSchema,
        { id },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      if (!row) {
        throw new NotFoundException(notFoundMessage("statement", id));
      }

      if (row.status !== "draft") {
        throw new BadRequestException(
          getI18n().t("errors.statementAlreadyFinalized"),
        );
      }

      await this.assertNoOverlappingFinalized(
        em,
        row.tenantId,
        row.periodStart,
        row.periodEnd,
        row.supersedesStatementId,
      );

      if (needsRentRotation) {
        await this.rotateTenantRents(
          em,
          statement.tenantId,
          adjustment.adjustedMonthlyAdvanceCents as number,
          adjustment.adjustedAdvanceValidFrom as string,
        );
      }
      const seqRows = await em.find(
        OperatingCostStatementSchema,
        {
          periodStart: { $gte: yearStart, $lte: yearEnd },
          sequenceNumber: { $ne: null },
        },
        { fields: ["sequenceNumber"] },
      );
      const maxSeq = seqRows.reduce(
        (acc, seqRow) => Math.max(acc, seqRow.sequenceNumber ?? 0),
        0,
      );
      const sequenceNumber = maxSeq + 1;

      // Korrekturkette: ersetzt diese Abrechnung eine frühere, wird die alte
      // auf `superseded` gesetzt und die Revisionsnummer hochgezählt.
      let revisionNumber = 1;
      if (row.supersedesStatementId) {
        const superseded = await em.findOne(OperatingCostStatementSchema, {
          id: row.supersedesStatementId,
        });
        if (superseded && superseded.status === "finalized") {
          em.assign(superseded, {
            status: "superseded",
            updatedAt: new Date().toISOString(),
          });
          revisionNumber = (superseded.revisionNumber ?? 1) + 1;
        }
      }

      em.assign(row, {
        status: "finalized",
        snapshotData: parsed.data,
        totalCostsCents: result.totalCostsCents,
        totalAdvancesCents: result.totalAdvancesCents,
        balanceCents: result.balanceCents,
        sequenceNumber,
        revisionNumber,
        finalizedAt: new Date().toISOString(),
        finalizedByUserId,
        updatedAt: new Date().toISOString(),
      });
      await em.flush();

      // Bei einer Korrektur das Soll der ersetzten Abrechnung zurücknehmen,
      // bevor das neue (korrigierte) Soll gebucht wird. Beides läuft in
      // derselben Transaktion wie der Statuswechsel. Sonst könnte ein
      // Fehler hier ein finalisiertes Statement ohne Mieterkonto-Buchung
      // hinterlassen.
      if (row.supersedesStatementId) {
        await this.accountsService.removeSettlementForStatement(
          row.supersedesStatementId,
          em,
        );
      }

      await this.accountsService.recordSettlement(
        statement.tenantId,
        id,
        statement.periodEnd,
        result.balanceCents,
        em,
      );

      return row;
    });

    return updated;
  }

  /**
   * Storniert eine finalisierte Abrechnung: das Abrechnungs-Soll auf dem
   * Mieterkonto wird zurückgenommen, der Status auf `cancelled` gesetzt und
   * die Begründung revisionssicher festgehalten. Der Snapshot bleibt als
   * Beleg erhalten. Eine bereits ersetzte (`superseded`) Abrechnung kann nicht
   * erneut storniert werden.
   */
  async cancel(
    id: string,
    cancelledByUserId: string,
    dto: OperatingCostStatementCancelDto,
  ) {
    const statement = await this.get(id);
    if (statement.status !== "finalized") {
      throw new BadRequestException(
        getI18n().t("errors.statementNotCancellable"),
      );
    }

    // Settlement-Rücknahme und Statuswechsel atomar. Sonst könnte ein
    // Fehler dazwischen das Soll entfernen, das Statement aber `finalized`
    // lassen.
    return this.em.transactional(async (em) => {
      const row = await em.findOne(OperatingCostStatementSchema, { id });
      if (!row) {
        throw new NotFoundException(notFoundMessage("statement", id));
      }

      await this.accountsService.removeSettlementForStatement(id, em);

      em.assign(row, {
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
        cancelledByUserId,
        cancellationReason: dto.reason,
        updatedAt: new Date().toISOString(),
      });
      await em.flush();

      return row;
    });
  }

  /**
   * Legt eine Korrektur-Abrechnung als neue Draft für dieselbe Periode an,
   * verknüpft über `supersedesStatementId`. Beim Finalisieren der Korrektur
   * wird die ursprüngliche Abrechnung auf `superseded` gesetzt und ihr Soll
   * durch das korrigierte ersetzt. Quelle muss finalisiert oder storniert
   * sein und darf nicht selbst bereits ersetzt worden sein.
   */
  async createCorrection(id: string) {
    const source = await this.get(id);
    if (source.status !== "finalized" && source.status !== "cancelled") {
      throw new BadRequestException(
        getI18n().t("errors.statementNotCorrectable"),
      );
    }

    const existingDraft = await this.em.findOne(OperatingCostStatementSchema, {
      supersedesStatementId: id,
      status: "draft",
    });
    if (existingDraft) {
      return existingDraft;
    }

    const correction = this.em.create(OperatingCostStatementSchema, {
      buildingId: source.buildingId,
      tenantId: source.tenantId,
      periodStart: source.periodStart,
      periodEnd: source.periodEnd,
      notes: source.notes,
      status: "draft",
      tariffAdjustmentBps: null,
      supersedesStatementId: id,
    });

    this.em.persist(correction);
    await this.em.flush();

    return correction;
  }

  /**
   * Schließt den `tenant_rents`-Eintrag, der `validFrom` abdeckt, zum
   * Vortag und legt einen neuen Eintrag mit gleicher Kaltmiete und neuer
   * Vorauszahlung an. Erwartet eine aktive Transaktion (`em`).
   */
  private async rotateTenantRents(
    em: EntityManager,
    tenantId: string,
    newMonthlyAdvanceCents: number,
    validFrom: string,
  ) {
    const rents = await em.find(
      TenantRentSchema,
      { tenantId },
      { orderBy: { startDate: "asc" } },
    );
    if (rents.length === 0) {
      throw new BadRequestException(
        getI18n().t("errors.tenantHasNoRent", { tenantId }),
      );
    }

    const covering = rents.find(
      (rent) =>
        (rent.startDate === null || rent.startDate < validFrom) &&
        (rent.endDate === null || rent.endDate >= validFrom),
    );
    if (!covering) {
      throw new BadRequestException(
        getI18n().t("errors.statementAdjustmentNoMatchingRent", {
          tenantId,
          validFrom,
        }),
      );
    }

    // Original-Enddatum sichern, BEVOR `assign` die Entity mutiert.
    // Der neue Eintrag erbt das ursprüngliche Enddatum.
    const originalEndDate = covering.endDate;
    const previousDayIso = addDaysIso(validFrom, -1);

    em.assign(covering, {
      endDate: previousDayIso,
      updatedAt: new Date().toISOString(),
    });
    em.persist(
      em.create(TenantRentSchema, {
        tenantId,
        startDate: validFrom,
        endDate: originalEndDate,
        monthlyBaseRentCents: covering.monthlyBaseRentCents,
        monthlyAdvanceCents: newMonthlyAdvanceCents,
      }),
    );
  }

  /**
   * Löscht eine Abrechnung. Nur im Status "draft" zulässig.
   * Finalisierte Abrechnungen bleiben als Beleg erhalten.
   */
  async delete(id: string) {
    const statement = await this.get(id);
    if (statement.status !== "draft") {
      throw new BadRequestException(
        getI18n().t("errors.statementDeleteFinalized"),
      );
    }

    this.em.remove(statement);
    await this.em.flush();

    return statement;
  }
}
