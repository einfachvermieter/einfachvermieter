import { OperatingCostStatementSchema } from "@einfachvermieter/db";
import type { EntityManager } from "@mikro-orm/core";
import { BadRequestException } from "@nestjs/common";
import { getI18n } from "../i18n/i18n.registry.js";

/**
 * Ueberpruefung der Sperre des Mieterkontos:
 * liegt ein Datum (bzw. ein Datumsbereich, z. B. ein Mietmonat)
 * in einer finalisierten Abrechnungsperiode des Mieters,
 * sind Schreiboperationen für diesen Zweck gesperrt.
 */
export const assertDateRangeNotFinalized = async (
  em: EntityManager,
  tenantId: string,
  rangeStart: string,
  rangeEnd: string = rangeStart,
): Promise<void> => {
  const finalized = await em.count(OperatingCostStatementSchema, {
    tenantId,
    status: "finalized",
    periodStart: { $lte: rangeEnd },
    periodEnd: { $gte: rangeStart },
  });

  if (finalized > 0) {
    throw new BadRequestException(
      getI18n().t("errors.paymentFinalizedImmutable"),
    );
  }
};

/**
 * Sperre der gebäudeweiten Grundlagen einer Abrechnungsperiode (z.B.
 * Erfassungsausfälle nach § 9a HeizkostenV): Ist für das Gebäude eine
 * Abrechnung finalisiert, die den Zeitraum überschneidet, sind
 * Änderungen gesperrt.
 */
export const assertBuildingPeriodNotFinalized = async (
  em: EntityManager,
  buildingId: string,
  rangeStart: string,
  rangeEnd: string,
  messageKey: string,
): Promise<void> => {
  const finalized = await em.count(OperatingCostStatementSchema, {
    buildingId,
    status: "finalized",
    periodStart: { $lte: rangeEnd },
    periodEnd: { $gte: rangeStart },
  });

  if (finalized > 0) {
    throw new BadRequestException(getI18n().t(messageKey));
  }
};

/**
 * Finalisierte Abrechnung des Gebäudes für genau diesen Zeitraum. Werte je
 * Abrechnungszeitraum wirken nur auf Abrechnungen mit demselben Zeitraum;
 * eine bloße Überschneidung sperrt deshalb nicht. Stornierte und ersetzte
 * Abrechnungen sperren ebenfalls nicht.
 */
export const findFinalizedStatementForExactPeriod = async (
  em: EntityManager,
  buildingId: string,
  periodStart: string,
  periodEnd: string,
): Promise<string | null> => {
  const finalized = await em.findOne(
    OperatingCostStatementSchema,
    { buildingId, status: "finalized", periodStart, periodEnd },
    { fields: ["id"] },
  );

  return finalized?.id ?? null;
};
