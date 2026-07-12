import {
  MeterSchema,
  ResidentSchema,
  TenantResidentSchema,
  TenantSchema,
  type Unit,
  UnitSchema,
} from "@einfachvermieter/db";
import {
  todayIso,
  type UnitCreateDto,
  type UnitUpdateDto,
} from "@einfachvermieter/shared";
import { EntityManager, type FilterQuery } from "@mikro-orm/core";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { FieldValidationException } from "../common/field-validation.exception.js";
import { likeContains } from "../common/like-search.js";
import { getI18n } from "../i18n/i18n.registry.js";
import { notFoundMessage } from "../i18n/notFound.js";
import {
  deriveUnitOccupancy,
  type UnitOccupancy,
} from "../tenants/occupancy.js";

const nameTakenMessage = (name: string) =>
  getI18n().t("validation.nameTaken", { name });

export type UnitSort = "name" | "areaSqm" | "status" | "tenant";

export type UnitOverviewRow = Unit & { occupancy: UnitOccupancy };

/**
 * Sortierreihenfolge der Belegungs-Status in der Liste
 */
const STATUS_SORT_ORDER = new Map<UnitOccupancy["status"], number>([
  ["rented", 0],
  ["vacant_from", 1],
  ["vacant", 2],
  ["owner", 3],
]);

@Injectable()
export class UnitsService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Paginierte, sortierbare Wohnungsliste mit Belegung,
   * optional auf ein Gebäude gefiltert.
   *
   * @param params.q Freitextsuche im Wohnungsnamen.
   */
  async list(params: {
    buildingId?: string;
    page: number;
    pageSize: number;
    sort?: UnitSort;
    order?: "asc" | "desc";
    q?: string;
  }): Promise<{
    items: UnitOverviewRow[];
    total: number;
    rentedCount: number;
  }> {
    const {
      buildingId,
      page,
      pageSize,
      sort = "name",
      order = "asc",
      q,
    } = params;

    const filters: FilterQuery<Unit>[] = [];
    if (buildingId) {
      filters.push({ buildingId });
    }

    if (q) {
      filters.push(likeContains("name", q) as FilterQuery<Unit>);
    }

    const where: FilterQuery<Unit> =
      filters.length > 0 ? { $and: filters } : {};

    const units = await this.em.find(UnitSchema, where);
    const rows = await this.withOccupancy(units);

    const dir = order === "desc" ? -1 : 1;
    const byName = (a: UnitOverviewRow, b: UnitOverviewRow) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase());

    rows.sort((a, b) => {
      switch (sort) {
        case "areaSqm":
          return dir * (a.areaSqm - b.areaSqm || byName(a, b));
        case "status":
          return (
            dir *
            ((STATUS_SORT_ORDER.get(a.occupancy.status) ?? 0) -
              (STATUS_SORT_ORDER.get(b.occupancy.status) ?? 0) || byName(a, b))
          );

        case "tenant":
          return (
            dir *
            ((a.occupancy.tenantNames[0] ?? "")
              .toLowerCase()
              .localeCompare(
                (b.occupancy.tenantNames[0] ?? "").toLowerCase(),
              ) || byName(a, b))
          );

        default:
          return dir * byName(a, b);
      }
    });

    const rentedCount = rows.filter(
      (row) =>
        row.occupancy.status === "rented" ||
        row.occupancy.status === "vacant_from",
    ).length;

    return {
      items: rows.slice(page * pageSize, (page + 1) * pageSize),
      total: rows.length,
      rentedCount,
    };
  }

  /**
   * Belegung je Wohnung ableiten (Verträge, Vertragspartner-Namen)
   */
  private async withOccupancy(units: Unit[]): Promise<UnitOverviewRow[]> {
    const unitIds = units.map((unit) => unit.id);

    const tenants =
      unitIds.length > 0
        ? await this.em.find(TenantSchema, { unitId: { $in: unitIds } })
        : [];

    const links =
      tenants.length > 0
        ? await this.em.find(TenantResidentSchema, {
            tenantId: { $in: tenants.map((tenant) => tenant.id) },
          })
        : [];

    const residentIds = [...new Set(links.map((link) => link.residentId))];
    const residents =
      residentIds.length > 0
        ? await this.em.find(ResidentSchema, { id: { $in: residentIds } })
        : [];

    const tenantsByUnit = new Map<string, typeof tenants>();
    for (const tenant of tenants) {
      const list = tenantsByUnit.get(tenant.unitId);
      if (list) {
        list.push(tenant);
      } else {
        tenantsByUnit.set(tenant.unitId, [tenant]);
      }
    }

    const linksByTenant = new Map<string, typeof links>();
    for (const link of links) {
      const list = linksByTenant.get(link.tenantId);
      if (list) {
        list.push(link);
      } else {
        linksByTenant.set(link.tenantId, [link]);
      }
    }

    const residentById = new Map(
      residents.map((resident) => [resident.id, resident]),
    );

    const today = todayIso();

    return units.map((unit) => ({
      ...unit,
      occupancy: deriveUnitOccupancy(
        tenantsByUnit.get(unit.id) ?? [],
        linksByTenant,
        residentById,
        today,
      ),
    }));
  }

  async get(id: string) {
    const unit = await this.em.findOne(UnitSchema, { id });
    if (!unit) {
      throw new NotFoundException(notFoundMessage("unit", id));
    }

    return unit;
  }

  /**
   * Wohnung anlegen. Der Name muss innerhalb des Gebaeudes eindeutig sein.
   */
  async create(dto: UnitCreateDto) {
    if (await this.nameTaken(dto.buildingId, dto.name)) {
      throw new FieldValidationException([
        { path: ["name"], message: nameTakenMessage(dto.name) },
      ]);
    }

    const created = this.em.create(UnitSchema, dto);

    this.em.persist(created);
    await this.em.flush();

    return created;
  }

  /**
   * Wohnung aktualisieren
   */
  async update(id: string, dto: UnitUpdateDto) {
    const unit = await this.em.findOne(UnitSchema, { id });
    if (!unit) {
      throw new NotFoundException(notFoundMessage("unit", id));
    }

    if (
      dto.name !== undefined &&
      (await this.nameTaken(unit.buildingId, dto.name, id))
    ) {
      throw new FieldValidationException([
        { path: ["name"], message: nameTakenMessage(dto.name) },
      ]);
    }

    this.em.assign(unit, { ...dto, updatedAt: new Date().toISOString() });

    await this.em.flush();

    return unit;
  }

  /**
   * Wohnung loeschen. Nicht moeglich, solange noch Mietvertraege oder Zaehler
   * an der Wohnung haengen.
   */
  async delete(id: string) {
    const tenant = await this.em.findOne(TenantSchema, { unitId: id });
    if (tenant) {
      throw new BadRequestException(getI18n().t("errors.unitHasTenants"));
    }

    const meter = await this.em.findOne(MeterSchema, { unitId: id });
    if (meter) {
      throw new BadRequestException(getI18n().t("errors.unitHasMeters"));
    }

    const unit = await this.em.findOne(UnitSchema, { id });
    if (!unit) {
      throw new NotFoundException(notFoundMessage("unit", id));
    }

    this.em.remove(unit);
    await this.em.flush();

    return unit;
  }

  /**
   * Prueft, ob im Gebaeude bereits eine Wohnung mit diesem Namen existiert.
   *
   * @param excludeId Eigene Wohnung kann von Check ausgenommen werden
   */
  private async nameTaken(
    buildingId: string,
    name: string,
    excludeId?: string,
  ) {
    const where: FilterQuery<Unit> = excludeId
      ? { buildingId, name, id: { $ne: excludeId } }
      : { buildingId, name };

    return (await this.em.count(UnitSchema, where)) > 0;
  }
}
