import { HeatingPeriodValueSchema, MeterSchema } from "@einfachvermieter/db";
import {
  emptyHeatingPeriodValueSet,
  type HeatingPeriodValueSet,
  type HeatingPeriodValues,
  type HeatingPeriodValuesWriteDto,
  heatingPeriodValueRelevance,
  type Period,
} from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import { BadRequestException, Injectable } from "@nestjs/common";
import { assertBuildingExists } from "../common/assert-exists.js";
import { findFinalizedStatementForExactPeriod } from "../common/finalized-period-lock.js";
import { getI18n } from "../i18n/i18n.registry.js";
import { HeatingService } from "./heating.service.js";

/**
 * Werte eines Abrechnungszeitraums je Gebäude (Gesamt-Wärmemenge,
 * Fernwärme-Angaben). Eine Zeile gehört zu genau einem Zeitraum; Zeilen
 * anderer Zeiträume zählen nie, auch wenn sie sich überschneiden.
 */
@Injectable()
export class HeatingPeriodValuesService {
  constructor(
    private readonly em: EntityManager,
    private readonly heatingService: HeatingService,
  ) {}

  /**
   * Die gespeicherten Werte des Zeitraums; ohne Zeile alle leer.
   */
  async valuesFor(
    buildingId: string,
    period: Period,
  ): Promise<HeatingPeriodValueSet> {
    const row = await this.em.findOne(HeatingPeriodValueSchema, {
      buildingId,
      periodStart: period.start,
      periodEnd: period.end,
    });
    if (!row) {
      return emptyHeatingPeriodValueSet;
    }

    return {
      totalHeatEnergyKwh: row.totalHeatEnergyKwh,
      districtHeatEmissionsKgPerYear: row.districtHeatEmissionsKgPerYear,
      districtHeatPrimaryEnergyFactor: row.districtHeatPrimaryEnergyFactor,
    };
  }

  /**
   * Werte mit den Angaben, die die Eingabe an der Abrechnung braucht:
   * welche Werte die Berechnung verwendet und ob der Zeitraum gesperrt ist.
   */
  async get(buildingId: string, period: Period): Promise<HeatingPeriodValues> {
    const { versions } = await this.heatingService.resolveForPeriod(
      buildingId,
      period,
    );
    const mainHeatMeters = await this.em.count(MeterSchema, {
      buildingId,
      type: "heat_meter",
      role: "main",
    });

    return {
      ...(await this.valuesFor(buildingId, period)),
      relevance: heatingPeriodValueRelevance(versions),
      hasMainHeatMeter: mainHeatMeters > 0,
      lockedByStatementId: await findFinalizedStatementForExactPeriod(
        this.em,
        buildingId,
        period.start,
        period.end,
      ),
    };
  }

  /**
   * Setzt die Zeile des Zeitraums vollständig auf die übergebenen Werte.
   * Sind alle drei leer, wird die Zeile gelöscht. Ob ein Wert Bedeutung
   * hat oder es eine Abrechnung zum Zeitraum gibt, wird nicht geprüft.
   */
  async put(
    buildingId: string,
    dto: HeatingPeriodValuesWriteDto,
  ): Promise<HeatingPeriodValues> {
    await assertBuildingExists(this.em, buildingId);
    const { periodStart, periodEnd, ...values } = dto;

    const lockedBy = await findFinalizedStatementForExactPeriod(
      this.em,
      buildingId,
      periodStart,
      periodEnd,
    );
    if (lockedBy !== null) {
      throw new BadRequestException(
        getI18n().t("errors.heatingPeriodValuesFinalizedImmutable"),
      );
    }

    const existing = await this.em.findOne(HeatingPeriodValueSchema, {
      buildingId,
      periodStart,
      periodEnd,
    });
    const isEmpty = Object.values(values).every((value) => value === null);

    if (existing && isEmpty) {
      this.em.remove(existing);
    } else if (existing) {
      this.em.assign(existing, {
        ...values,
        updatedAt: new Date().toISOString(),
      });
    } else if (!isEmpty) {
      this.em.persist(
        this.em.create(HeatingPeriodValueSchema, {
          buildingId,
          periodStart,
          periodEnd,
          ...values,
        }),
      );
    }
    await this.em.flush();

    return this.get(buildingId, { start: periodStart, end: periodEnd });
  }
}
