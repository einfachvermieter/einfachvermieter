import {
  type Building,
  BuildingSchema,
  type HeatingSetting,
  HeatingSettingSchema,
  MeterSchema,
} from "@einfachvermieter/db";
import type {
  HeatingSettings,
  HeatingSettingsWriteDto,
} from "@einfachvermieter/shared";
import { EntityManager, type FilterQuery } from "@mikro-orm/core";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { assertBuildingExists } from "../common/assert-exists.js";
import { getI18n } from "../i18n/i18n.registry.js";
import { notFoundMessage } from "../i18n/notFound.js";

export type HeatingSort = "building" | "mode" | "validFrom";

export type HeatingOverviewParams = {
  page: number;
  pageSize: number;
  sort?: HeatingSort;
  order?: "asc" | "desc";
  q?: string;
  buildingId?: string;
};

export type HeatingOverviewRow = {
  building: Building;
  settings: HeatingSettings;
};

export type HeatingOverviewResult = {
  items: HeatingOverviewRow[];
  total: number;
};

/**
 * Defaults für ein Gebäude, das noch keine eigene Konfiguration hat
 */
const defaultSettings = (buildingId: string): HeatingSettings => ({
  id: "",
  buildingId,
  mode: "internal",
  baseSharePercent: 30,
  consumptionSharePercent: 70,
  baseMethod: "area",
  consumptionMethod: "heat_meter",
  prorationMethod: "linear",
  heatingType: "central_without_hot_water",
  fuelType: "gas",
  hotWaterMeterId: null,
  hotWaterSupplyTemperatureCelsius: 60,
  totalHeatEnergyKwh: null,
  co2CostShareEnabled: true,
  validFrom: "1900-01-01",
  validTo: null,
  createdAt: "",
  updatedAt: "",
});

@Injectable()
export class HeatingService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Paginierte, sortierbare Heizkosten-Übersicht (Versionen), optional auf ein
   * Gebäude gefiltert.
   *
   * @param params.q Freitextsuche (q) im Gebäudenamen
   */
  async list(params: HeatingOverviewParams): Promise<HeatingOverviewResult> {
    const {
      page,
      pageSize,
      sort = "building",
      order = "asc",
      q,
      buildingId,
    } = params;

    const settings = await this.em.find(
      HeatingSettingSchema,
      buildingId ? { buildingId } : {},
    );

    const buildingIds = [...new Set(settings.map((s) => s.buildingId))];
    const buildings = await this.em.find(BuildingSchema, {
      id: { $in: buildingIds },
    });
    const buildingById = new Map(buildings.map((b) => [b.id, b]));

    let rows: HeatingOverviewRow[] = [];
    for (const setting of settings) {
      const building = buildingById.get(setting.buildingId);
      if (building) {
        rows.push({ building, settings: setting });
      }
    }

    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter((row) =>
        row.building.name.toLowerCase().includes(needle),
      );
    }

    const dir = order === "desc" ? -1 : 1;
    const sortKey = (row: HeatingOverviewRow): string => {
      if (sort === "mode") {
        return row.settings.mode;
      }
      if (sort === "validFrom") {
        return row.settings.validFrom;
      }
      return row.building.name;
    };

    rows.sort((a, b) => {
      const primary = sortKey(a).localeCompare(sortKey(b));
      if (primary !== 0) {
        return primary * dir;
      }

      // Pro Gebäude die neueste Version zuerst.
      return b.settings.validFrom.localeCompare(a.settings.validFrom);
    });

    const total = rows.length;
    const items = rows.slice(page * pageSize, page * pageSize + pageSize);
    return { items, total };
  }

  /**
   * Alle Versionen eines Gebäudes, validFrom absteigend (neueste zuerst).
   */
  async listForBuilding(buildingId: string): Promise<HeatingSettings[]> {
    await assertBuildingExists(this.em, buildingId);

    return this.em.find(
      HeatingSettingSchema,
      { buildingId },
      { orderBy: { validFrom: "desc" } },
    );
  }

  /**
   * Liefert die zu einem Stichtag gültige Version. Existiert noch keine
   * Version, wird der Default geliefert. Existieren Versionen, aber keine
   * deckt das Datum ab, wird bewusst ein Fehler geworfen.
   */
  async getForBuildingAt(
    buildingId: string,
    date: string,
  ): Promise<HeatingSettings> {
    await assertBuildingExists(this.em, buildingId);

    const row = await this.em.findOne(HeatingSettingSchema, {
      buildingId,
      validFrom: { $lte: date },
      $or: [{ validTo: null }, { validTo: { $gte: date } }],
    });
    if (row) {
      return row;
    }

    const earliest = await this.em.findOne(
      HeatingSettingSchema,
      { buildingId },
      { orderBy: { validFrom: "asc" } },
    );
    if (!earliest) {
      return defaultSettings(buildingId);
    }

    throw new BadRequestException(
      getI18n().t("errors.heatingNoConfigForDate", {
        date,
        earliest: earliest.validFrom,
      }),
    );
  }

  /**
   * Liefert eine Version per ID, ohne buildingId-Constraint.
   */
  async getByIdGlobal(id: string): Promise<HeatingSettings> {
    const row = await this.em.findOne(HeatingSettingSchema, { id });
    if (!row) {
      throw new NotFoundException(notFoundMessage("heatingSettings", id));
    }
    return row;
  }

  /**
   * Liefert eine Version per ID, prüft Gebäudezugehörigkeit.
   */
  async getById(buildingId: string, id: string): Promise<HeatingSettings> {
    const row = await this.getByIdGlobal(id);
    if (row.buildingId !== buildingId) {
      throw new NotFoundException(notFoundMessage("heatingSettings", id));
    }
    return row;
  }

  /**
   * Neue Heizkosten-Version anlegen. Prüft im internen Modus den
   * Boiler-WMZ und stellt sicher, dass der Gültigkeitszeitraum keine
   * bestehende Version desselben Gebäudes überlappt.
   */
  async create(
    buildingId: string,
    dto: HeatingSettingsWriteDto,
  ): Promise<HeatingSettings> {
    await assertBuildingExists(this.em, buildingId);
    if (dto.mode === "internal" && dto.hotWaterMeterId !== null) {
      await this.assertValidHotWaterMeter(buildingId, dto.hotWaterMeterId);
    }
    await this.assertNoOverlap(buildingId, dto.validFrom, dto.validTo, null);

    const created = this.em.create(
      HeatingSettingSchema,
      this.toRowValues(buildingId, dto),
    );
    this.em.persist(created);
    await this.em.flush();
    return created;
  }

  /**
   * Bestehende Heizkosten-Version aktualisieren
   */
  async update(
    buildingId: string,
    id: string,
    dto: HeatingSettingsWriteDto,
  ): Promise<HeatingSettings> {
    const existing = await this.em.findOne(HeatingSettingSchema, { id });
    if (!existing || existing.buildingId !== buildingId) {
      throw new NotFoundException(notFoundMessage("heatingSettings", id));
    }
    if (dto.mode === "internal" && dto.hotWaterMeterId !== null) {
      await this.assertValidHotWaterMeter(buildingId, dto.hotWaterMeterId);
    }
    await this.assertNoOverlap(buildingId, dto.validFrom, dto.validTo, id);

    this.em.assign(existing, {
      ...this.toRowValues(buildingId, dto),
      updatedAt: new Date().toISOString(),
    });
    await this.em.flush();
    return existing;
  }

  /**
   * Heizkosten-Version löschen, sofern sie zum angegebenen Gebäude gehört.
   */
  async delete(buildingId: string, id: string): Promise<void> {
    const existing = await this.em.findOne(HeatingSettingSchema, { id });
    if (!existing || existing.buildingId !== buildingId) {
      throw new NotFoundException(notFoundMessage("heatingSettings", id));
    }
    this.em.remove(existing);
    await this.em.flush();
  }

  /**
   * Im externen Modus sind die Verteilungs- und Anlagenfelder fachlich
   * bedeutungslos. Wir schreiben trotzdem Defaults, damit die NOT-NULL-
   * Spalten befüllt sind.
   */
  private toRowValues(buildingId: string, dto: HeatingSettingsWriteDto) {
    if (dto.mode === "external") {
      return {
        buildingId,
        mode: dto.mode,
        validFrom: dto.validFrom,
        validTo: dto.validTo,
        baseSharePercent: 30,
        consumptionSharePercent: 70,
        baseMethod: "area" as const,
        consumptionMethod: "heat_meter" as const,
        prorationMethod: "linear" as const,
        heatingType: "central_without_hot_water" as const,
        fuelType: "gas" as const,
        hotWaterMeterId: null,
        hotWaterSupplyTemperatureCelsius: 60,
        totalHeatEnergyKwh: null,
        co2CostShareEnabled: true,
      };
    }
    return {
      buildingId,
      mode: dto.mode,
      validFrom: dto.validFrom,
      validTo: dto.validTo,
      baseSharePercent: dto.baseSharePercent,
      consumptionSharePercent: dto.consumptionSharePercent,
      baseMethod: dto.baseMethod,
      consumptionMethod: dto.consumptionMethod,
      prorationMethod: dto.prorationMethod,
      heatingType: dto.heatingType,
      fuelType: dto.fuelType,
      hotWaterMeterId: dto.hotWaterMeterId,
      hotWaterSupplyTemperatureCelsius: dto.hotWaterSupplyTemperatureCelsius,
      totalHeatEnergyKwh: dto.totalHeatEnergyKwh,
      co2CostShareEnabled: dto.co2CostShareEnabled,
    };
  }

  /**
   * Prüft, dass der Gültigkeitszeitraum keine andere Version desselben
   * Gebäudes überlappt. Offene Intervalle (validTo NULL) = "bis unendlich".
   */
  private async assertNoOverlap(
    buildingId: string,
    validFrom: string,
    validTo: string | null,
    excludeId: string | null,
  ): Promise<void> {
    const where: FilterQuery<HeatingSetting> =
      excludeId === null
        ? { buildingId }
        : { buildingId, id: { $ne: excludeId } };
    const others = await this.em.find(HeatingSettingSchema, where);

    for (const other of others) {
      if (
        intervalsOverlap(validFrom, validTo, other.validFrom, other.validTo)
      ) {
        throw new BadRequestException(
          getI18n().t("ui.heating.errors.versionOverlap"),
        );
      }
    }
  }

  /**
   * Der Boiler-WMZ muss gebäudezentral sein, ein Wärmemengenzähler und darf
   * nicht zugleich Verbrauchs-Basis einer Kostenart sein.
   */
  private async assertValidHotWaterMeter(buildingId: string, meterId: string) {
    const meter = await this.em.findOne(MeterSchema, { id: meterId });
    if (!meter) {
      throw new NotFoundException(notFoundMessage("meter", meterId));
    }

    if (meter.buildingId !== buildingId) {
      throw new BadRequestException(
        getI18n().t("ui.heating.errors.hotWaterMeterBuildingMismatch"),
      );
    }

    if (meter.type !== "heat_meter") {
      throw new BadRequestException(
        getI18n().t("ui.heating.errors.hotWaterMeterType"),
      );
    }

    if (meter.unitId !== null || meter.role === "unit") {
      throw new BadRequestException(
        getI18n().t("ui.heating.errors.hotWaterMeterScope"),
      );
    }

    if (meter.costAllocationMode !== "heating_cost_bill") {
      throw new BadRequestException(
        getI18n().t("ui.heating.errors.hotWaterMeterNotHeatingCostBill"),
      );
    }
  }
}

/**
 * [aFrom, aTo] überlappt [bFrom, bTo], wenn aFrom <= bTo UND bFrom <= aTo.
 * Null auf einer To-Seite bedeutet "Unendlich".
 */
const intervalsOverlap = (
  aFrom: string,
  aTo: string | null,
  bFrom: string,
  bTo: string | null,
): boolean => {
  const aFromLeqBTo = bTo === null ? true : aFrom <= bTo;
  const bFromLeqATo = aTo === null ? true : bFrom <= aTo;
  return aFromLeqBTo && bFromLeqATo;
};
