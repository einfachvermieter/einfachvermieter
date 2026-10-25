import {
  ConsumptionSubstitutionSchema,
  MeterSchema,
  UnitSchema,
} from "@einfachvermieter/db";
import {
  baseCostAreaFor,
  type ConsumptionSubstitutionWriteDto,
  type HeatingBaseMethod,
  isReferencePeriodUsable,
  type Period,
  type ResolvedSubstitution,
  type SubstitutionInput,
  type SubstitutionScope,
  shiftIsoYears,
} from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { assertBuildingExists } from "../common/assert-exists.js";
import { assertBuildingPeriodNotFinalized } from "../common/finalized-period-lock.js";
import {
  HeatingService,
  requireResolvedSettings,
} from "../heating/heating.service.js";
import { getI18n } from "../i18n/i18n.registry.js";
import { notFoundMessage } from "../i18n/notFound.js";
import { SubstitutionContextService } from "./substitution-context.service.js";

/**
 * Wie viele Jahre zurück das Formular Vergleichszeiträume anbietet
 */
const REFERENCE_YEAR_OPTIONS = 5;

export type SubstitutionOptions = {
  meters: Array<{
    id: string;
    label: string;
    isContinuous: boolean;
    hasGap: boolean;
  }>;
  unitMeterCount: number;
  allMeters: Array<{ id: string; label: string; isActive: boolean }>;
  wholeUnitAreaSqm: number;
  shareMethod: boolean;
  referenceYears: Array<{ years: number; period: Period; isUsable: boolean }>;
  comparisonUnits: Array<{ id: string; name: string; isUsable: boolean }>;
};

export type SubstitutionPreview = {
  resolved: ResolvedSubstitution | null;
  warnings: Array<{ code: string; params?: Record<string, string | number> }>;
  affectedAreaSqm: number;
  totalAreaSqm: number;
  limitExceeded: boolean;
};

const lockKey = "errors.substitutionFinalizedImmutable";

/**
 * Erfassungsausfälle nach § 9a HeizkostenV: anlegen, ändern, löschen,
 * Formular-Optionen und Vorschau. Gebäudeweit je Periode; gesperrt, sobald
 * eine Abrechnung des Gebäudes für die Periode finalisiert ist.
 */
@Injectable()
export class ConsumptionSubstitutionsService {
  constructor(
    private readonly em: EntityManager,
    private readonly heatingService: HeatingService,
    private readonly contextService: SubstitutionContextService,
  ) {}

  async list(buildingId: string, period?: Period) {
    await assertBuildingExists(this.em, buildingId);

    return this.em.find(
      ConsumptionSubstitutionSchema,
      {
        buildingId,
        ...(period ? { periodStart: period.start, periodEnd: period.end } : {}),
      },
      { orderBy: { periodStart: "asc", createdAt: "asc" } },
    );
  }

  async create(
    buildingId: string,
    dto: ConsumptionSubstitutionWriteDto,
    userId: string,
  ) {
    await assertBuildingExists(this.em, buildingId);
    await assertBuildingPeriodNotFinalized(
      this.em,
      buildingId,
      dto.periodStart,
      dto.periodEnd,
      lockKey,
    );
    await this.validate(buildingId, dto);

    const existing = await this.em.findOne(ConsumptionSubstitutionSchema, {
      unitId: dto.unitId,
      scope: dto.scope,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
    });
    if (existing) {
      throw new ConflictException(getI18n().t("errors.substitutionDuplicate"));
    }

    const created = this.em.create(ConsumptionSubstitutionSchema, {
      buildingId,
      ...dto,
      decidedByUserId: userId,
    });
    this.em.persist(created);
    await this.em.flush();

    return created;
  }

  async update(
    id: string,
    dto: ConsumptionSubstitutionWriteDto,
    userId: string,
  ) {
    const existing = await this.getRow(id);
    await assertBuildingPeriodNotFinalized(
      this.em,
      existing.buildingId,
      existing.periodStart,
      existing.periodEnd,
      lockKey,
    );

    if (
      dto.unitId !== existing.unitId ||
      dto.scope !== existing.scope ||
      dto.periodStart !== existing.periodStart ||
      dto.periodEnd !== existing.periodEnd
    ) {
      throw new BadRequestException(
        getI18n().t("errors.substitutionIdentityFixed"),
      );
    }
    await this.validate(existing.buildingId, dto);

    this.em.assign(existing, {
      ...dto,
      decidedByUserId: userId,
      updatedAt: new Date().toISOString(),
    });
    await this.em.flush();

    return existing;
  }

  async delete(id: string) {
    const existing = await this.getRow(id);
    await assertBuildingPeriodNotFinalized(
      this.em,
      existing.buildingId,
      existing.periodStart,
      existing.periodEnd,
      lockKey,
    );

    this.em.remove(existing);
    await this.em.flush();

    return existing;
  }

  /**
   * Angaben fürs Formular: Zähler der Wohnung im Bereich, technisch
   * nutzbare Vergleichsjahre und mögliche Vergleichswohnungen
   */
  async options(
    buildingId: string,
    unitId: string,
    scope: SubstitutionScope,
    period: Period,
    affectedMeterIds: string[],
  ): Promise<SubstitutionOptions> {
    await assertBuildingExists(this.em, buildingId);
    const unit = await this.assertUnit(buildingId, unitId);
    const { meterType, baseMethod } = await this.scopeSettingsFor(
      buildingId,
      scope,
      period,
    );
    const history = await this.contextService.loadHistory(buildingId, period);
    const current = await this.contextService.listForPeriod(buildingId, period);
    const evaluation = await this.contextService.evaluatePeriod(
      buildingId,
      period,
      current,
      history,
    );
    const scopeEvaluation =
      scope === "heating" ? evaluation.heating : evaluation.hotWater;
    const shareMethod =
      scope === "heating" && meterType === "heat_cost_allocator";

    const unitMeters = (evaluation.meters ?? []).filter(
      (entry) =>
        entry.meter.unitId === unitId && entry.meter.type === meterType,
    );
    const gapMeterIds = new Set(
      (scopeEvaluation?.gaps ?? []).map((gap) => gap.meterId),
    );

    const referenceIds =
      affectedMeterIds.length > 0
        ? affectedMeterIds
        : unitMeters.map((entry) => entry.meter.id);
    const referenceYears = Array.from(
      { length: REFERENCE_YEAR_OPTIONS },
      (_, index) => {
        const years = index + 1;
        return {
          years,
          period: {
            start: shiftIsoYears(period.start, -years),
            end: shiftIsoYears(period.end, -years),
          },
        };
      },
    );
    const draftInputs: SubstitutionInput[] = referenceYears.map((entry) => ({
      ...this.emptyInput(unitId, scope, period),
      method: "same_rooms_comparable_period",
      referencePeriodStart: entry.period.start,
      referencePeriodEnd: entry.period.end,
    }));
    const reference = await this.contextService.loadReferenceMeters(
      buildingId,
      draftInputs,
      { heatingType: scope === "heating" ? meterType : "heat_meter" },
    );
    const referenceMeters =
      scope === "heating" ? reference.heating : reference.hotWater;

    const substitutedUnits = new Set(
      current
        .filter((entry) => entry.scope === scope)
        .map((entry) => entry.unitId),
    );
    const meteredUnits = new Set(
      (evaluation.meters ?? [])
        .filter((entry) => entry.meter.type === meterType)
        .map((entry) => entry.meter.unitId ?? ""),
    );
    const gapUnits = new Set(
      (scopeEvaluation?.gaps ?? []).map((gap) => gap.unitId),
    );
    const units = await this.em.find(
      UnitSchema,
      { buildingId },
      { orderBy: { name: "asc" } },
    );
    const allMeters = await this.em.find(
      MeterSchema,
      { unitId, role: "unit", type: meterType },
      { orderBy: { label: "asc" } },
    );

    return {
      meters: unitMeters.map((entry) => ({
        id: entry.meter.id,
        label: entry.meter.label,
        isContinuous: !entry.meter.resetDay,
        hasGap: gapMeterIds.has(entry.meter.id),
      })),
      unitMeterCount: unitMeters.length,
      allMeters: allMeters.map((entry) => ({
        id: entry.id,
        label: entry.label,
        isActive: entry.isActive,
      })),
      wholeUnitAreaSqm: baseCostAreaFor(scope, unit, baseMethod),
      shareMethod,
      referenceYears: referenceYears.map((entry) => ({
        ...entry,
        isUsable: isReferencePeriodUsable({
          referencePeriod: entry.period,
          referenceMeterIds: referenceIds,
          referenceMeters,
          shareMethod,
          substitutedPeriods: history.substitutedPeriods,
        }),
      })),
      comparisonUnits: units
        .filter((entry) => entry.id !== unitId)
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          isUsable:
            meteredUnits.has(entry.id) &&
            !gapUnits.has(entry.id) &&
            !substitutedUnits.has(entry.id),
        })),
    };
  }

  /**
   * Rechnet ein noch nicht gespeichertes Formular mit den übrigen
   * Erfassungsausfällen der Periode
   */
  async preview(
    buildingId: string,
    dto: ConsumptionSubstitutionWriteDto,
    existingId: string | null,
  ): Promise<SubstitutionPreview> {
    await assertBuildingExists(this.em, buildingId);
    const period = { start: dto.periodStart, end: dto.periodEnd };
    const history = await this.contextService.loadHistory(buildingId, period);
    const others = (
      await this.contextService.listForPeriod(buildingId, period)
    ).filter(
      (entry) =>
        entry.id !== existingId &&
        !(entry.unitId === dto.unitId && entry.scope === dto.scope),
    );
    const draftId = existingId ?? "preview";
    const draft: SubstitutionInput = { id: draftId, ...dto };
    const evaluation = await this.contextService.evaluatePeriod(
      buildingId,
      period,
      [...others, draft],
      history,
    );
    const scopeEvaluation =
      dto.scope === "heating" ? evaluation.heating : evaluation.hotWater;
    const unitName = scopeEvaluation?.resolved.find(
      (entry) => entry.substitutionId === draftId,
    )?.unitName;

    return {
      resolved:
        scopeEvaluation?.resolved.find(
          (entry) => entry.substitutionId === draftId,
        ) ?? null,
      warnings: (scopeEvaluation?.warnings ?? []).filter(
        (warning) =>
          warning.code !== "consumptionGap" &&
          warning.params?.unit === unitName,
      ),
      affectedAreaSqm: scopeEvaluation?.affectedAreaSqm ?? 0,
      totalAreaSqm: scopeEvaluation?.totalAreaSqm ?? 0,
      limitExceeded: scopeEvaluation?.limitExceeded ?? false,
    };
  }

  private emptyInput(
    unitId: string,
    scope: SubstitutionScope,
    period: Period,
  ): SubstitutionInput {
    return {
      id: "options",
      unitId,
      periodStart: period.start,
      periodEnd: period.end,
      scope,
      reason: "other",
      reasonNote: null,
      affectedMeterIds: [],
      meterKeptCounting: null,
      affectedAreaSqm: null,
      method: "building_or_group_average",
      basisSource: "meter_readings",
      referencePeriodStart: null,
      referencePeriodEnd: null,
      referenceMeterIds: null,
      comparisonUnitIds: null,
      manualAffectedConsumption: null,
      manualTotalConsumption: null,
      manualComparisonConsumption: null,
      manualComparisonAreaSqm: null,
      basisNote: null,
    };
  }

  private async getRow(id: string) {
    const row = await this.em.findOne(ConsumptionSubstitutionSchema, { id });
    if (!row) {
      throw new NotFoundException(
        notFoundMessage("consumptionSubstitution", id),
      );
    }

    return row;
  }

  private async assertUnit(buildingId: string, unitId: string) {
    const unit = await this.em.findOne(UnitSchema, { id: unitId });
    if (!unit || unit.buildingId !== buildingId) {
      throw new NotFoundException(notFoundMessage("unit", unitId));
    }

    return unit;
  }

  /**
   * Zählertyp und Grundkostenmaßstab des Bereichs; wirft, wenn der Bereich
   * in der Periode nicht nach HeizkostenV in der App gerechnet wird
   */
  private async scopeSettingsFor(
    buildingId: string,
    scope: SubstitutionScope,
    period: Period,
  ): Promise<{
    meterType: "heat_cost_allocator" | "heat_meter" | "water_hot";
    baseMethod: HeatingBaseMethod;
  }> {
    const settings = requireResolvedSettings(
      await this.heatingService.resolveForPeriod(buildingId, period),
    );
    const inactive =
      settings.mode !== "internal" ||
      (scope === "hot_water" &&
        settings.heatingType !== "central_with_hot_water");
    if (inactive) {
      throw new BadRequestException(
        getI18n().t("errors.substitutionScopeInactive"),
      );
    }

    const { baseMethod } = settings;
    if (scope === "hot_water") {
      return { meterType: "water_hot", baseMethod };
    }

    return {
      meterType:
        settings.consumptionMethod === "heat_cost_allocator"
          ? "heat_cost_allocator"
          : "heat_meter",
      baseMethod,
    };
  }

  /**
   * Prüfungen mit Datenbankbezug: Wohnung, Zähler und Messart
   */
  private async validate(
    buildingId: string,
    dto: ConsumptionSubstitutionWriteDto,
  ): Promise<void> {
    const unit = await this.assertUnit(buildingId, dto.unitId);
    const period = { start: dto.periodStart, end: dto.periodEnd };
    const { meterType, baseMethod } = await this.scopeSettingsFor(
      buildingId,
      dto.scope,
      period,
    );
    const invalid = (key: string) =>
      new BadRequestException(getI18n().t(`errors.substitution.${key}`));

    const unitMeters = await this.em.find(MeterSchema, {
      unitId: dto.unitId,
      role: "unit",
      type: meterType,
    });
    const activeUnitMeters = unitMeters.filter((meter) => meter.isActive);
    const affected = dto.affectedMeterIds.map((id) =>
      unitMeters.find((meter) => meter.id === id),
    );
    if (affected.some((meter) => meter === undefined)) {
      throw invalid("meterMismatch");
    }

    const hasContinuous = affected.some((meter) => !meter?.resetDay);
    if (hasContinuous !== (dto.meterKeptCounting !== null)) {
      throw invalid(
        hasContinuous
          ? "meterKeptCountingRequired"
          : "meterKeptCountingNotApplicable",
      );
    }

    if (dto.scope === "heating") {
      const wholeUnit = activeUnitMeters.every((meter) =>
        dto.affectedMeterIds.includes(meter.id),
      );
      if (wholeUnit && dto.affectedAreaSqm !== null) {
        throw invalid("areaWholeUnit");
      }
      if (
        !wholeUnit &&
        (dto.affectedAreaSqm === null ||
          dto.affectedAreaSqm >= baseCostAreaFor("heating", unit, baseMethod))
      ) {
        throw invalid("areaPartial");
      }
    }

    if (dto.referenceMeterIds) {
      const referenceMeters = await this.em.find(MeterSchema, {
        id: { $in: dto.referenceMeterIds },
      });
      const mismatch =
        referenceMeters.length !== dto.referenceMeterIds.length ||
        referenceMeters.some(
          (meter) =>
            meter.unitId !== dto.unitId ||
            meter.role !== "unit" ||
            meter.type !== meterType,
        );
      if (mismatch) {
        throw invalid("meterMismatch");
      }
    }

    const isAllocator = meterType === "heat_cost_allocator";
    const isManual = dto.basisSource === "manual_reference";
    if (
      isManual &&
      dto.method === "same_rooms_comparable_period" &&
      isAllocator !== (dto.manualTotalConsumption !== null)
    ) {
      throw invalid(
        isAllocator ? "manualTotalRequired" : "manualTotalNotApplicable",
      );
    }
    if (
      isManual &&
      dto.method !== "same_rooms_comparable_period" &&
      isAllocator
    ) {
      throw invalid("manualComparisonAllocator");
    }

    if (dto.comparisonUnitIds) {
      const comparisonUnits = await this.em.find(UnitSchema, {
        id: { $in: dto.comparisonUnitIds },
        buildingId,
      });

      if (comparisonUnits.length !== dto.comparisonUnitIds.length) {
        throw invalid("comparisonUnitMismatch");
      }
    }
  }
}
