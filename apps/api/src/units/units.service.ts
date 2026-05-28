import {
  MeterSchema,
  TenantSchema,
  type Unit,
  UnitSchema,
} from "@einfachvermieter/db";
import type { UnitCreateDto, UnitUpdateDto } from "@einfachvermieter/shared";
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

export type UnitSort = "name" | "areaSqm";

@Injectable()
export class UnitsService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Paginierte, sortierbare Wohnungsliste, optional auf ein Gebäude gefiltert
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
  }) {
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

    const [items, total] = await Promise.all([
      this.em.find(UnitSchema, where, {
        orderBy: { [sort]: order } as QueryOrderMap<Unit>,
        limit: pageSize,
        offset: page * pageSize,
      }),
      this.em.count(UnitSchema, where),
    ]);

    return { items, total };
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
