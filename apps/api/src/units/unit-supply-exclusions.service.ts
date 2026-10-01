import {
  OperatingCostStatementSchema,
  UnitSchema,
  type UnitSupplyExclusion,
  UnitSupplyExclusionSchema,
} from "@einfachvermieter/db";
import {
  type Period,
  type SupplyExclusion,
  substitutionScopes,
  suppliedPeriods,
  type UnitSupplyExclusionWriteDto,
} from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { assertUnitExists } from "../common/assert-exists.js";
import { getI18n } from "../i18n/i18n.registry.js";
import { notFoundMessage } from "../i18n/notFound.js";

type ExclusionSpan = Pick<
  UnitSupplyExclusion,
  "unitId" | "scope" | "validFrom" | "validUntil"
>;

const OPEN_END = "9999-12-31";

const overlaps = (first: ExclusionSpan, second: ExclusionSpan): boolean =>
  first.scope === second.scope &&
  first.validFrom <= (second.validUntil ?? OPEN_END) &&
  second.validFrom <= (first.validUntil ?? OPEN_END);

/**
 * Nichtteilnahme einer Wohnung an der zentralen Heizung oder am zentralen
 * Warmwasser. Änderungen sind zulässig, solange sich die Nichtteilnahme
 * innerhalb keiner finalisierten Abrechnungsperiode des Gebäudes ändert.
 */
@Injectable()
export class UnitSupplyExclusionsService {
  constructor(private readonly em: EntityManager) {}

  async list(unitId: string) {
    await assertUnitExists(this.em, unitId);

    return this.em.find(
      UnitSupplyExclusionSchema,
      { unitId },
      { orderBy: { validFrom: "asc" } },
    );
  }

  async create(unitId: string, dto: UnitSupplyExclusionWriteDto) {
    const existing = await this.list(unitId);
    await this.assertChangeAllowed(unitId, existing, [
      ...existing,
      { unitId, ...dto },
    ]);

    const created = this.em.create(UnitSupplyExclusionSchema, {
      unitId,
      ...dto,
    });
    this.em.persist(created);
    await this.em.flush();

    return created;
  }

  async update(id: string, dto: UnitSupplyExclusionWriteDto) {
    const row = await this.getRow(id);
    const existing = await this.list(row.unitId);
    await this.assertChangeAllowed(row.unitId, existing, [
      ...existing.filter((entry) => entry.id !== id),
      { unitId: row.unitId, ...dto },
    ]);

    this.em.assign(row, { ...dto, updatedAt: new Date().toISOString() });
    await this.em.flush();

    return row;
  }

  async delete(id: string) {
    const row = await this.getRow(id);
    const existing = await this.list(row.unitId);
    await this.assertChangeAllowed(
      row.unitId,
      existing,
      existing.filter((entry) => entry.id !== id),
    );

    this.em.remove(row);
    await this.em.flush();

    return { success: true };
  }

  private async getRow(id: string) {
    const row = await this.em.findOne(UnitSupplyExclusionSchema, { id });
    if (!row) {
      throw new NotFoundException(notFoundMessage("unitSupplyExclusion", id));
    }

    return row;
  }

  /**
   * Prüft Überschneidungen und die Sperre: Je finalisierter Periode des
   * Gebäudes müssen die versorgten Zeiträume der Wohnung vorher und nachher
   * gleich sein. Ein Eintrag, der eine finalisierte Periode berührt, darf
   * also außerhalb davon weiter geändert werden.
   */
  private async assertChangeAllowed(
    unitId: string,
    before: ExclusionSpan[],
    after: ExclusionSpan[],
  ): Promise<void> {
    const hasOverlap = after.some((first, index) =>
      after.slice(index + 1).some((second) => overlaps(first, second)),
    );
    if (hasOverlap) {
      throw new ConflictException(getI18n().t("errors.supplyExclusionOverlap"));
    }

    const unit = await this.em.findOneOrFail(UnitSchema, { id: unitId });
    const finalized = await this.em.find(
      OperatingCostStatementSchema,
      { buildingId: unit.buildingId, status: "finalized" },
      { fields: ["periodStart", "periodEnd"] },
    );

    const suppliedIn = (
      exclusions: ExclusionSpan[],
      scope: SupplyExclusion["scope"],
      period: Period,
    ): string =>
      JSON.stringify(
        suppliedPeriods(exclusions, unitId, scope, period).map(
          ({ start, end }) => [start, end],
        ),
      );

    for (const statement of finalized) {
      const period = { start: statement.periodStart, end: statement.periodEnd };
      const changed = substitutionScopes.some(
        (scope) =>
          suppliedIn(before, scope, period) !==
          suppliedIn(after, scope, period),
      );

      if (changed) {
        throw new BadRequestException(
          getI18n().t("errors.supplyExclusionFinalizedImmutable"),
        );
      }
    }
  }
}
