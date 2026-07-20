import { BuildingSchema, TenantSchema, UnitSchema } from "@einfachvermieter/db";
import type { EntityManager } from "@mikro-orm/core";
import { NotFoundException } from "@nestjs/common";
import { notFoundMessage } from "../i18n/notFound.js";

/**
 * Wirft `NotFoundException`, wenn das Gebäude nicht existiert. Vor dem Anlegen
 * abhängiger Entitäten aufrufen, damit statt eines rohen FK-Fehlers eine
 * saubere Meldung zurückkommt.
 */
export const assertBuildingExists = async (
  em: EntityManager,
  buildingId: string,
): Promise<void> => {
  const building = await em.findOne(BuildingSchema, { id: buildingId });
  if (!building) {
    throw new NotFoundException(notFoundMessage("building", buildingId));
  }
};

/**
 * Wirft `NotFoundException`, wenn die Wohnung nicht existiert
 */
export const assertUnitExists = async (
  em: EntityManager,
  unitId: string,
): Promise<void> => {
  const unit = await em.findOne(UnitSchema, { id: unitId });
  if (!unit) {
    throw new NotFoundException(notFoundMessage("unit", unitId));
  }
};

/**
 * Wirft `NotFoundException`, wenn der Mietvertrag nicht existiert
 */
export const assertTenantExists = async (
  em: EntityManager,
  tenantId: string,
): Promise<void> => {
  const tenant = await em.findOne(TenantSchema, { id: tenantId });
  if (!tenant) {
    throw new NotFoundException(notFoundMessage("tenant", tenantId));
  }
};
