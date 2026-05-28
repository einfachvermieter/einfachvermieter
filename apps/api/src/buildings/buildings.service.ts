import {
  type Building,
  BuildingSchema,
  UnitSchema,
} from "@einfachvermieter/db";
import type {
  BuildingCreateDto,
  BuildingUpdateDto,
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
  }) {
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

    return { items, total };
  }

  async get(id: string) {
    const result = await this.em.findOne(BuildingSchema, { id });
    if (!result) {
      throw new NotFoundException(notFoundMessage("building", id));
    }

    return result;
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
