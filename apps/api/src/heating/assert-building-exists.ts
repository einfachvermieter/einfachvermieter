import { BuildingSchema } from "@einfachvermieter/db";
import type { EntityManager } from "@mikro-orm/core";
import { NotFoundException } from "@nestjs/common";
import { notFoundMessage } from "../i18n/notFound.js";

/**
 * Wirft `NotFoundException`, wenn das Gebäude nicht existiert.
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
