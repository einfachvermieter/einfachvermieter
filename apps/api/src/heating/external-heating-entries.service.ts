import { ExternalHeatingEntrySchema, UnitSchema } from "@einfachvermieter/db";
import type {
  ExternalHeatingEntry,
  ExternalHeatingEntryCreateDto,
  ExternalHeatingEntryUpdateDto,
} from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import { Injectable, NotFoundException } from "@nestjs/common";
import { notFoundMessage } from "../i18n/notFound.js";
import { assertBuildingExists } from "./assert-building-exists.js";

/**
 * CRUD für externe Heizkosten-Einträge pro Wohnung und Zeitraum.
 * Wird ausschließlich im externen Heizkosten-Modus genutzt.
 */
@Injectable()
export class ExternalHeatingEntriesService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Alle externen Heizkosten-Einträge eines Gebäudes, sortiert nach
   * Zeitraum-Beginn und Wohnung.
   */
  async listForBuilding(buildingId: string): Promise<ExternalHeatingEntry[]> {
    await assertBuildingExists(this.em, buildingId);

    return this.em.find(
      ExternalHeatingEntrySchema,
      { buildingId },
      { orderBy: { periodStart: "asc", unitId: "asc" } },
    );
  }

  /**
   * Alle Einträge, deren Zeitraum die gegebene Periode überlappt. Wird
   * in der Abrechnung verwendet, um die pro Wohnung ausgewiesenen
   * Endbeträge unverändert in das Statement zu übernehmen.
   */
  listForBuildingAndPeriod(
    buildingId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<ExternalHeatingEntry[]> {
    return this.em.find(ExternalHeatingEntrySchema, {
      buildingId,
      periodStart: { $lte: periodEnd },
      periodEnd: { $gte: periodStart },
    });
  }

  /**
   * Externen Heizkosten-Eintrag anlegen. Prüft, dass Gebäude und Wohnung
   * existieren und zusammengehören.
   */
  async create(
    buildingId: string,
    dto: ExternalHeatingEntryCreateDto,
  ): Promise<ExternalHeatingEntry> {
    await assertBuildingExists(this.em, buildingId);
    await this.assertUnitBelongsToBuilding(dto.unitId, buildingId);

    const created = this.em.create(ExternalHeatingEntrySchema, {
      buildingId,
      unitId: dto.unitId,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      totalCents: dto.totalCents,
      baseCostCents: dto.baseCostCents ?? null,
      consumptionCostCents: dto.consumptionCostCents ?? null,
      notes: dto.notes ?? null,
    });

    this.em.persist(created);
    await this.em.flush();

    return created;
  }

  /**
   * Externen Heizkosten-Eintrag aktualisieren
   */
  async update(
    id: string,
    dto: ExternalHeatingEntryUpdateDto,
  ): Promise<ExternalHeatingEntry> {
    const existing = await this.em.findOne(ExternalHeatingEntrySchema, { id });
    if (!existing) {
      throw new NotFoundException(notFoundMessage("externalHeatingEntry", id));
    }

    await this.assertUnitBelongsToBuilding(dto.unitId, existing.buildingId);

    this.em.assign(existing, {
      unitId: dto.unitId,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      totalCents: dto.totalCents,
      baseCostCents: dto.baseCostCents ?? null,
      consumptionCostCents: dto.consumptionCostCents ?? null,
      notes: dto.notes ?? null,
      updatedAt: new Date().toISOString(),
    });

    await this.em.flush();

    return existing;
  }

  /**
   * Externen Heizkosten-Eintrag löschen
   */
  async delete(id: string): Promise<ExternalHeatingEntry> {
    const existing = await this.em.findOne(ExternalHeatingEntrySchema, { id });
    if (!existing) {
      throw new NotFoundException(notFoundMessage("externalHeatingEntry", id));
    }

    this.em.remove(existing);
    await this.em.flush();

    return existing;
  }

  /**
   * Sicherstellen, dass die Wohnung existiert und zum Gebäude gehört
   */
  private async assertUnitBelongsToBuilding(
    unitId: string,
    buildingId: string,
  ) {
    const unit = await this.em.findOne(UnitSchema, { id: unitId });
    if (!unit || unit.buildingId !== buildingId) {
      throw new NotFoundException(notFoundMessage("unit", unitId));
    }
  }
}
