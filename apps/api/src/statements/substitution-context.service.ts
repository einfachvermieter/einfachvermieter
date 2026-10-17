import {
  ConsumptionSubstitutionSchema,
  type Meter,
  MeterReadingSchema,
  MeterSchema,
  OperatingCostStatementSchema,
  UnitSchema,
  UnitSupplyExclusionSchema,
} from "@einfachvermieter/db";
import {
  addDaysIso,
  applyCompensations,
  baseCostAreaFor,
  buildUnitSupply,
  type CalcWarning,
  type CompensationInput,
  type ConsumptionSubstitution,
  compensationsFromSubstitution,
  evaluateSubstitutionScope,
  invalidationsFromSubstitution,
  type MeterInfo,
  type Period,
  type ReadingInvalidation,
  type ReadingPoint,
  type ScopeEvaluation,
  type ScopeMeter,
  type SubstitutedPeriodMeters,
  type SubstitutionInput,
  type SubstitutionSnapshot,
  type SupplyExclusion,
  sumDegreeDays,
} from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import { Injectable } from "@nestjs/common";
import { HeatingService } from "../heating/heating.service.js";

/**
 * Zählerdaten aus der Datenbank in das Format der Berechnung
 */
export const toMeterInfo = (meter: Meter): MeterInfo =>
  ({
    id: meter.id,
    type: meter.type,
    role: meter.role,
    unitId: meter.unitId,
    label: meter.label,
    serialNumber: meter.serialNumber,
    measurementUnit: meter.measurementUnit,
    kTotal: meter.kTotal,
    validFrom: meter.validFrom,
    validUntil: meter.validUntil,
    resetDay: meter.resetDay,
  }) as MeterInfo;

export type SubstitutionContext = {
  substitutions: SubstitutionInput[];
  compensations: CompensationInput[];
  readingInvalidations: ReadingInvalidation[];
  substitutedPeriods: SubstitutedPeriodMeters[];
  referenceMeters: { heating: ScopeMeter[]; hotWater: ScopeMeter[] };
  warnings: CalcWarning[];
};

type ScopeMeterFilter = {
  heatingType: Meter["type"];
};

const periodKey = (period: Period): string => `${period.start}|${period.end}`;

export type PeriodHistory = {
  compensations: CompensationInput[];
  readingInvalidations: ReadingInvalidation[];
  substitutedPeriods: SubstitutedPeriodMeters[];
};

export type PeriodEvaluation = {
  heatingMeterType?: "heat_cost_allocator" | "heat_meter";
  heating?: ScopeEvaluation;
  hotWater?: ScopeEvaluation;
  meters?: ScopeMeter[];
};

const toSnapshots = (
  evaluation: ScopeEvaluation | undefined,
): SubstitutionSnapshot[] =>
  (evaluation?.resolved ?? []).map(({ isValid, ...entry }) => ({
    ...entry,
    appliedToDistribution: isValid && !evaluation?.limitExceeded,
  }));

export const toSubstitutionInput = (
  row: ConsumptionSubstitution,
): SubstitutionInput => ({
  id: row.id,
  unitId: row.unitId,
  periodStart: row.periodStart,
  periodEnd: row.periodEnd,
  scope: row.scope,
  reason: row.reason,
  reasonNote: row.reasonNote,
  affectedMeterIds: row.affectedMeterIds,
  meterKeptCounting: row.meterKeptCounting,
  affectedAreaSqm: row.affectedAreaSqm,
  method: row.method,
  basisSource: row.basisSource,
  referencePeriodStart: row.referencePeriodStart,
  referencePeriodEnd: row.referencePeriodEnd,
  referenceMeterIds: row.referenceMeterIds,
  comparisonUnitIds: row.comparisonUnitIds,
  manualAffectedConsumption: row.manualAffectedConsumption,
  manualTotalConsumption: row.manualTotalConsumption,
  manualComparisonConsumption: row.manualComparisonConsumption,
  manualComparisonAreaSqm: row.manualComparisonAreaSqm,
  basisNote: row.basisNote,
});

/**
 * Lädt alles, was die Heizkostenberechnung für § 9a HeizkostenV braucht:
 * die Erfassungsausfälle der Periode, Zählerstände der Vergleichszeiträume
 * und die Ausgleichsstände aus früheren Ausfallperioden. Für den Ausgleich
 * ist der Snapshot einer finalisierten Abrechnung maßgeblich.
 */
@Injectable()
export class SubstitutionContextService {
  constructor(
    private readonly em: EntityManager,
    private readonly heatingService: HeatingService,
  ) {}

  /**
   * Zeiträume ohne zentrale Versorgung aller Wohnungen des Gebäudes
   */
  async loadSupplyExclusions(buildingId: string): Promise<SupplyExclusion[]> {
    const units = await this.em.find(
      UnitSchema,
      { buildingId },
      { fields: ["id"] },
    );
    if (units.length === 0) {
      return [];
    }

    const rows = await this.em.find(UnitSupplyExclusionSchema, {
      unitId: { $in: units.map((unit) => unit.id) },
    });

    return rows.map((row) => ({
      unitId: row.unitId,
      scope: row.scope,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
    }));
  }

  /**
   * Erfassungsausfälle genau dieser Periode
   */
  async listForPeriod(
    buildingId: string,
    period: Period,
  ): Promise<SubstitutionInput[]> {
    const rows = await this.em.find(
      ConsumptionSubstitutionSchema,
      { buildingId, periodStart: period.start, periodEnd: period.end },
      { orderBy: { createdAt: "asc" } },
    );

    return rows.map((row) =>
      toSubstitutionInput(row as ConsumptionSubstitution),
    );
  }

  async buildContext(
    buildingId: string,
    period: Period,
    consumptionMethod: "heat_meter" | "heat_cost_allocator",
  ): Promise<SubstitutionContext> {
    const substitutions = await this.listForPeriod(buildingId, period);
    const history = await this.loadHistory(buildingId, period);
    const filter: ScopeMeterFilter = {
      heatingType:
        consumptionMethod === "heat_cost_allocator"
          ? "heat_cost_allocator"
          : "heat_meter",
    };

    return {
      substitutions,
      ...history,
      referenceMeters: await this.loadReferenceMeters(
        buildingId,
        substitutions,
        filter,
      ),
    };
  }

  /**
   * Zähler des Bereichs samt Ablesungen rund um die Vergleichszeiträume der
   * Erfassungsausfälle mit Verfahren a aus Zählerständen. Auch inaktive
   * Zähler, damit Vorgänger-Geräte vergleichbar bleiben.
   */
  async loadReferenceMeters(
    buildingId: string,
    substitutions: SubstitutionInput[],
    filter: ScopeMeterFilter,
  ): Promise<{ heating: ScopeMeter[]; hotWater: ScopeMeter[] }> {
    const withReference = substitutions.filter(
      (entry) =>
        entry.method === "same_rooms_comparable_period" &&
        entry.basisSource === "meter_readings" &&
        entry.referencePeriodStart !== null &&
        entry.referencePeriodEnd !== null,
    );

    if (withReference.length === 0) {
      return { heating: [], hotWater: [] };
    }

    const starts = withReference.map(
      (entry) => entry.referencePeriodStart ?? "",
    );
    const ends = withReference.map((entry) => entry.referencePeriodEnd ?? "");
    const byDate = (a: string, b: string) => a.localeCompare(b);
    const window = {
      start: addDaysIso(starts.sort(byDate)[0] ?? "", -366),
      end: addDaysIso(ends.sort(byDate).at(-1) ?? "", 366),
    };

    const meters = await this.em.find(MeterSchema, {
      buildingId,
      role: "unit",
      type: { $in: [filter.heatingType, "water_hot"] },
    });
    const bundles = await this.withReadings(meters, window);

    return {
      heating: bundles.filter(
        (entry) => entry.meter.type === filter.heatingType,
      ),
      hotWater: bundles.filter((entry) => entry.meter.type === "water_hot"),
    };
  }

  /**
   * Ausgleichsstände, entwertete Ablesungen und ersetzte Zähler aller
   * Ausfallperioden vor `period`, in zeitlicher Reihenfolge, damit sich
   * aufeinanderfolgende Ausfälle verketten
   */
  async loadHistory(
    buildingId: string,
    period: Period,
  ): Promise<PeriodHistory & { warnings: CalcWarning[] }> {
    const records = (await this.em.find(
      ConsumptionSubstitutionSchema,
      { buildingId, periodEnd: { $lt: period.start } },
      { orderBy: { periodStart: "asc" } },
    )) as ConsumptionSubstitution[];
    const statements = await this.em.find(
      OperatingCostStatementSchema,
      { buildingId, status: "finalized", periodEnd: { $lt: period.start } },
      { orderBy: { finalizedAt: "desc" } },
    );

    const snapshotByPeriod = new Map<
      string,
      {
        statementId: string;
        finalizedAt: string | null;
        substitutions: SubstitutionSnapshot[];
      }
    >();
    for (const statement of statements) {
      const key = periodKey({
        start: statement.periodStart,
        end: statement.periodEnd,
      });
      if (snapshotByPeriod.has(key)) {
        continue;
      }
      snapshotByPeriod.set(key, {
        statementId: statement.id,
        finalizedAt: statement.finalizedAt,
        substitutions:
          statement.snapshotData?.heatingDetail?.substitutions ?? [],
      });
    }

    const periods = new Map<string, Period>();
    for (const record of records) {
      periods.set(
        periodKey({ start: record.periodStart, end: record.periodEnd }),
        {
          start: record.periodStart,
          end: record.periodEnd,
        },
      );
    }
    for (const statement of statements) {
      const snapshot = snapshotByPeriod.get(
        periodKey({ start: statement.periodStart, end: statement.periodEnd }),
      );
      if (snapshot && snapshot.substitutions.length > 0) {
        periods.set(
          periodKey({ start: statement.periodStart, end: statement.periodEnd }),
          { start: statement.periodStart, end: statement.periodEnd },
        );
      }
    }

    const compensations: CompensationInput[] = [];
    const readingInvalidations: ReadingInvalidation[] = [];
    const substitutedPeriods: SubstitutedPeriodMeters[] = [];
    const warnings: CalcWarning[] = [];
    const previousPeriodEnd = addDaysIso(period.start, -1);

    const ordered = [...periods.values()].sort((a, b) =>
      a.start.localeCompare(b.start),
    );
    for (const sourcePeriod of ordered) {
      const key = periodKey(sourcePeriod);
      const snapshot = snapshotByPeriod.get(key);
      const periodRecords = records.filter(
        (record) =>
          record.periodStart === sourcePeriod.start &&
          record.periodEnd === sourcePeriod.end,
      );

      let resolved: SubstitutionSnapshot[];
      let statementId: string | undefined;
      if (snapshot) {
        ({ substitutions: resolved, statementId } = snapshot);

        if (
          sourcePeriod.end === previousPeriodEnd &&
          this.recordsDiffer(periodRecords, snapshot)
        ) {
          const unitIds = new Set([
            ...periodRecords.map((record) => record.unitId),
            ...resolved.map((entry) => entry.unitId),
          ]);
          const units = await this.em.find(UnitSchema, {
            id: { $in: [...unitIds] },
          });
          for (const unit of units) {
            warnings.push({
              code: "substitutionRecordDiffersFromSnapshot",
              params: { unit: unit.name },
            });
          }
        }
      } else {
        const evaluation = await this.evaluatePeriod(
          buildingId,
          sourcePeriod,
          periodRecords.map(toSubstitutionInput),
          { compensations, readingInvalidations, substitutedPeriods },
        );
        resolved = [
          ...toSnapshots(evaluation.heating),
          ...toSnapshots(evaluation.hotWater),
        ];
      }

      for (const entry of resolved) {
        compensations.push(
          ...compensationsFromSubstitution(entry, sourcePeriod, statementId),
        );
        readingInvalidations.push(
          ...invalidationsFromSubstitution(entry, sourcePeriod),
        );
      }
      if (resolved.length > 0) {
        substitutedPeriods.push({
          period: sourcePeriod,
          meterIds: resolved.flatMap((entry) =>
            entry.perMeter.map((meter) => meter.meterId),
          ),
        });
      }
    }

    return {
      compensations,
      readingInvalidations,
      substitutedPeriods,
      warnings,
    };
  }

  /**
   * Weicht ein Erfassungsausfall von der finalisierten Abrechnung ab
   * (fehlt, ist neu oder wurde nach dem Finalisieren geändert)?
   */
  private recordsDiffer(
    records: ConsumptionSubstitution[],
    snapshot: {
      finalizedAt: string | null;
      substitutions: SubstitutionSnapshot[];
    },
  ): boolean {
    const snapshotIds = new Set(
      snapshot.substitutions.map((entry) => entry.substitutionId),
    );
    const recordIds = new Set(records.map((record) => record.id));

    return (
      snapshotIds.size !== recordIds.size ||
      [...snapshotIds].some((id) => !recordIds.has(id)) ||
      records.some(
        (record) =>
          snapshot.finalizedAt !== null &&
          (record.updatedAt ?? "") > snapshot.finalizedAt,
      )
    );
  }

  /**
   * Rechnet die Erfassungsausfälle einer Periode ohne Abrechnung: für
   * frühere, nicht finalisierte Perioden (Ausgleich) und für die
   * Vorschau im Formular
   */
  async evaluatePeriod(
    buildingId: string,
    period: Period,
    substitutions: SubstitutionInput[],
    earlier: PeriodHistory,
  ): Promise<PeriodEvaluation> {
    let settings: Awaited<ReturnType<HeatingService["getForBuildingAt"]>>;
    try {
      settings = await this.heatingService.getForBuildingAt(
        buildingId,
        period.start,
      );
    } catch {
      return {};
    }
    if (settings.mode !== "internal") {
      return {};
    }

    const heatingType =
      settings.consumptionMethod === "heat_cost_allocator"
        ? "heat_cost_allocator"
        : "heat_meter";
    const withHotWater = settings.heatingType === "central_with_hot_water";
    const unitsRaw = await this.em.find(UnitSchema, { buildingId });
    const units = unitsRaw.map((unit) => ({ id: unit.id, name: unit.name }));
    const meters = await this.em.find(MeterSchema, {
      buildingId,
      isActive: true,
      role: "unit",
      type: { $in: [heatingType, "water_hot"] },
    });
    const bundles = (
      await this.withReadings(meters, {
        start: addDaysIso(period.start, -366),
        end: addDaysIso(period.end, 366),
      })
    ).map((entry) => ({
      meter: entry.meter,
      readings: applyCompensations(
        entry.meter.id,
        entry.readings,
        earlier.compensations,
        earlier.readingInvalidations,
      ),
    }));
    const reference = await this.loadReferenceMeters(
      buildingId,
      substitutions,
      {
        heatingType,
      },
    );

    const exclusions = await this.loadSupplyExclusions(buildingId);

    const evaluate = (
      scope: "heating" | "hot_water",
      scopeMeters: ScopeMeter[],
      referenceMeters: ScopeMeter[],
    ): ScopeEvaluation =>
      evaluateSubstitutionScope({
        scope,
        ...(exclusions.length > 0
          ? {
              supply: buildUnitSupply(
                exclusions,
                units.map((unit) => unit.id),
                scope,
                period,
              ),
            }
          : {}),
        period,
        units,
        baseAreaByUnit: new Map(
          unitsRaw.map((unit) => [
            unit.id,
            baseCostAreaFor(scope, unit, settings.baseMethod),
          ]),
        ),
        meters: scopeMeters,
        shareMethod:
          scope === "heating" && heatingType === "heat_cost_allocator",
        substitutions,
        referenceMeters,
        substitutedPeriods: earlier.substitutedPeriods,
        intervalWeight:
          scope === "heating" && settings.prorationMethod === "degree_days"
            ? (fromDate: string, toDate: string) =>
                sumDegreeDays({ start: fromDate, end: toDate })
            : undefined,
      });

    return {
      heatingMeterType: heatingType,
      heating: evaluate(
        "heating",
        bundles.filter((entry) => entry.meter.type === heatingType),
        reference.heating,
      ),
      ...(withHotWater
        ? {
            hotWater: evaluate(
              "hot_water",
              bundles.filter((entry) => entry.meter.type === "water_hot"),
              reference.hotWater,
            ),
          }
        : {}),
      meters: bundles,
    };
  }

  private async withReadings(
    meters: Meter[],
    window: Period,
  ): Promise<ScopeMeter[]> {
    if (meters.length === 0) {
      return [];
    }

    const readings = await this.em.find(
      MeterReadingSchema,
      {
        meterId: { $in: meters.map((meter) => meter.id) },
        readingDate: { $gte: window.start, $lte: window.end },
      },
      { orderBy: { readingDate: "asc" } },
    );

    return meters.map((meter) => ({
      meter: toMeterInfo(meter),
      readings: readings
        .filter((reading) => reading.meterId === meter.id)
        .map(
          (reading): ReadingPoint => ({
            date: reading.readingDate,
            value: reading.value,
            isCumulative: reading.isCumulative,
            isEstimated: reading.isEstimated,
          }),
        ),
    }));
  }
}
