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
