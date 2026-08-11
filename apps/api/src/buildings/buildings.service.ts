import {
  type Building,
  BuildingSchema,
  TenantSchema,
  UnitSchema,
} from "@einfachvermieter/db";
import {
  type BuildingCreateDto,
  type BuildingUpdateDto,
  todayIso,
} from "@einfachvermieter/shared";
import {
  EntityManager,
  type FilterQuery,
  type QueryOrderMap,
} from "@mikro-orm/core";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { FieldValidationException } from "../common/field-validation.exception.js";
import { likeContains } from "../common/like-search.js";
import { getI18n } from "../i18n/i18n.registry.js";
import { notFoundMessage } from "../i18n/notFound.js";

const nameTakenMessage = (name: string) =>
  getI18n().t("validation.nameTaken", { name });

export type BuildingSort =
  | "name"
  | "addressStreet"
  | "addressPostalCode"
  | "addressCity";

@Injectable()
export class BuildingsService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Paginierte, sortierbare Gebäudeliste.
   *
   * @param params.q Freitextsuche in Name und Adressfeldern.
   */
  async list(params: {
    page: number;
    pageSize: number;
    sort?: BuildingSort;
    order?: "asc" | "desc";
    q?: string;
  }): Promise<{
    items: (Building & { unitsCount: number; activeTenantsCount: number })[];
    total: number;
  }> {
    const { page, pageSize, sort = "name", order = "asc", q } = params;

    const where: FilterQuery<Building> = q
      ? ({
          $or: [
            "name",
            "address_street",
            "address_postal_code",
            "address_city",
          ].map((column) => likeContains(column, q)),
        } as FilterQuery<Building>)
      : {};

    const [items, total] = await Promise.all([
      this.em.find(BuildingSchema, where, {
        orderBy: { [sort]: order } as QueryOrderMap<Building>,
        limit: pageSize,
        offset: page * pageSize,
      }),
      this.em.count(BuildingSchema, where),
    ]);

    const counts = await this.countPerBuilding(items.map((item) => item.id));

    return {
      items: items.map((item) => ({
        ...item,
        unitsCount: counts.get(item.id)?.units ?? 0,
        activeTenantsCount: counts.get(item.id)?.activeTenants ?? 0,
      })),
      total,
    };
  }

  /**
   * Wohnungen und aktive Mietverhältnisse (Stichtag heute) je Gebäude für Übersichts-Karte und Gebäude-Switcher.
   */
  private async countPerBuilding(buildingIds: string[]) {
    const counts = new Map<string, { units: number; activeTenants: number }>();
    if (buildingIds.length === 0) {
      return counts;
    }

    const units = await this.em.find(
      UnitSchema,
      { buildingId: { $in: buildingIds } },
      { fields: ["id", "buildingId"] },
    );
    const buildingIdByUnit = new Map(
      units.map((unit) => [unit.id, unit.buildingId]),
    );

    const today = todayIso();
    const activeTenants =
      units.length > 0
        ? await this.em.find(
            TenantSchema,
            {
              unitId: { $in: units.map((unit) => unit.id) },
              startDate: { $lte: today },
              $or: [{ endDate: null }, { endDate: { $gte: today } }],
            },
            { fields: ["id", "unitId"] },
          )
        : [];

    for (const id of buildingIds) {
      counts.set(id, { units: 0, activeTenants: 0 });
    }

    for (const unit of units) {
      const entry = counts.get(unit.buildingId);
      if (entry) {
        entry.units += 1;
      }
    }

    for (const tenant of activeTenants) {
      const buildingId = buildingIdByUnit.get(tenant.unitId);
      const entry = buildingId ? counts.get(buildingId) : undefined;
      if (entry) {
        entry.activeTenants += 1;
      }
    }

    return counts;
  }

  async get(id: string) {
    const result = await this.em.findOne(BuildingSchema, { id });
    if (!result) {
      throw new NotFoundException(notFoundMessage("building", id));
    }

    const counts = (await this.countPerBuilding([id])).get(id);
    return {
      ...result,
      unitsCount: counts?.units ?? 0,
      activeTenantsCount: counts?.activeTenants ?? 0,
    };
  }

  async create(dto: BuildingCreateDto) {
    if (await this.nameTaken(dto.name)) {
      throw new FieldValidationException([
        { path: ["name"], message: nameTakenMessage(dto.name) },
      ]);
    }

    const created = this.em.create(BuildingSchema, dto);

    this.em.persist(created);
    await this.em.flush();

    return created;
  }

  async update(id: string, dto: BuildingUpdateDto) {
    if (dto.name !== undefined && (await this.nameTaken(dto.name, id))) {
      throw new FieldValidationException([
        { path: ["name"], message: nameTakenMessage(dto.name) },
      ]);
    }

    const building = await this.em.findOne(BuildingSchema, { id });
    if (!building) {
      throw new NotFoundException(notFoundMessage("building", id));
    }

    this.em.assign(building, { ...dto, updatedAt: new Date().toISOString() });
    await this.em.flush();

    return building;
  }

  /**
   * Prueft, ob bereits ein Gebaeude mit diesem Namen existiert
   */
  private async nameTaken(name: string, excludeId?: string) {
    const where: FilterQuery<Building> = excludeId
      ? { name, id: { $ne: excludeId } }
      : { name };

    return (await this.em.count(BuildingSchema, where)) > 0;
  }

  /**
   * Gebaeude loeschen
   * Nicht moeglich, solange noch Wohnungen daran haengen
   */
  async delete(id: string) {
    const unit = await this.em.findOne(UnitSchema, { buildingId: id });
    if (unit) {
      throw new BadRequestException(getI18n().t("errors.buildingHasUnits"));
    }

    const building = await this.em.findOne(BuildingSchema, { id });
    if (!building) {
      throw new NotFoundException(notFoundMessage("building", id));
    }

    this.em.remove(building);
    await this.em.flush();

    return building;
  }
}
