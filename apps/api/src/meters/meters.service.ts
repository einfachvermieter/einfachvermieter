import {
  CostTypeSchema,
  HeatingSettingSchema,
  type Meter,
  MeterCostTypeAssignmentSchema,
  type MeterDifferenceComponent,
  MeterDifferenceComponentSchema,
  type MeterGasFactor,
  MeterGasFactorSchema,
  type MeterReading,
  MeterReadingSchema,
  MeterSchema,
} from "@einfachvermieter/db";
import { createTranslate } from "@einfachvermieter/i18n";
import {
  buildMeterLabel,
  type GasFactorCreateDto,
  type MeterCreateDto,
  type MeterDifferenceConfigDto,
  type MeterReadingCreateDto,
  type MeterRole,
  type MeterUpdateDto,
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

const serialTakenMessage = (serial: string) =>
  getI18n().t("errors.meterSerialTaken", { serial });

const readingDateTakenMessage = () =>
  getI18n().t("errors.meterReadingDateTaken");

export type MeterSort = "label" | "type" | "role";

export type { MeterGasFactor };

export type MeterWithAssignments = Meter & {
  costTypeIds: string[];
  gasFactors: MeterGasFactor[];

  /**
   * `true`, wenn `costAllocationMode` nicht mehr verändert werden darf,
   * weil andere Konfiguration diesen Zähler als Bestandteil der
   * Heizkostenabrechnung referenziert.
   */
  costAllocationModeLocked: boolean;

  /**
   * Konfiguration für Differenzzähler (`role = "virtual_difference"`).
   * `null` für alle anderen Rollen.
   */
  differenceConfig: MeterDifferenceConfigDto | null;
};

@Injectable()
export class MetersService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Paginierte, sortierbare Zählerliste, optional auf ein Gebäude gefiltert.
   *
   * @param params.q Freitextsuche in Bezeichnung und Seriennummer.
   */
  async list(params: {
    buildingId?: string;
    unitId?: string;
    page: number;
    pageSize: number;
    sort?: MeterSort;
    order?: "asc" | "desc";
    q?: string;
  }) {
    const {
      buildingId,
      unitId,
      page,
      pageSize,
      sort = "label",
      order = "asc",
      q,
    } = params;

    const filters: FilterQuery<Meter>[] = [];
    if (buildingId) {
      filters.push({ buildingId });
    }
    if (unitId) {
      filters.push({ unitId });
    }

    if (q) {
      filters.push({
        $or: [likeContains("label", q), likeContains("serial_number", q)],
      } as FilterQuery<Meter>);
    }

    const where: FilterQuery<Meter> =
      filters.length > 0 ? { $and: filters } : {};

    const [items, total] = await Promise.all([
      this.em.find(MeterSchema, where, {
        orderBy: { [sort]: order } as QueryOrderMap<Meter>,
        limit: pageSize,
        offset: page * pageSize,
      }),
      this.em.count(MeterSchema, where),
    ]);

    const hydrated = await this.hydrateAssignments(items);

    return { items: hydrated, total };
  }

  /**
   * Einzelnen Zähler samt Kostenart-Zuordnungen, Gas-Faktoren und
   * Differenzkonfiguration laden.
   */
  async get(id: string): Promise<MeterWithAssignments> {
    const meter = await this.em.findOne(MeterSchema, { id });
    if (!meter) {
      throw new NotFoundException(notFoundMessage("meter", id));
    }
    const [hydrated] = await this.hydrateAssignments([meter]);
    if (!hydrated) {
      throw new NotFoundException(notFoundMessage("meter", id));
    }
    return hydrated;
  }

  /**
   * Zähler anlegen samt Kostenart-Zuordnungen, Gas-Faktoren und ggf.
   * Differenzkonfiguration. Die Bezeichnung wird aus Typ/Rolle/Raum
   * abgeleitet
   */
  async create(dto: MeterCreateDto): Promise<MeterWithAssignments> {
    if (dto.serialNumber && (await this.serialTaken(dto.serialNumber))) {
      throw new FieldValidationException([
        {
          path: ["serialNumber"],
          message: serialTakenMessage(dto.serialNumber),
        },
      ]);
    }

    const { costTypeIds, gasFactors, differenceConfig, ...meterValues } = dto;

    await this.assertCostTypesBelongToBuilding(
      costTypeIds,
      meterValues.buildingId,
    );

    this.assertGasFactorsValid(meterValues.type, gasFactors ?? []);

    await this.assertDifferenceConfigConsistent(
      null,
      meterValues.role,
      meterValues.type,
      meterValues.buildingId,
      differenceConfig ?? null,
    );

    const label = buildMeterLabel(
      {
        type: meterValues.type,
        role: meterValues.role,
        room: meterValues.room ?? null,
      },
      createTranslate(getI18n()),
    );

    return this.em.transactional(async (em) => {
      const created = em.create(MeterSchema, { ...meterValues, label });

      em.persist(created);
      await em.flush();

      const meterId = created.id;
      await this.syncAssignments(em, meterId, costTypeIds ?? []);
      const insertedFactors = await this.syncGasFactors(
        em,
        meterId,
        gasFactors ?? [],
      );

      const persistedConfig =
        meterValues.role === "virtual_difference" && differenceConfig
          ? differenceConfig
          : null;
      await this.syncDifferenceComponents(em, meterId, persistedConfig);
      await em.flush();

      return {
        ...created,
        costTypeIds: [...(costTypeIds ?? [])],
        gasFactors: insertedFactors,
        costAllocationModeLocked: false,
        differenceConfig: persistedConfig,
      };
    });
  }

  /**
   * Zähler aktualisieren. Sperrt Änderungen, die eine Referenz aus der
   * Heizkostenabrechnung untergraben würden (Kostenart-Zuordnung,
   * `costAllocationMode`), und erzwingt eine gültige Differenzkonfiguration,
   * wenn die Rolle `virtual_difference` ist (bzw. lehnt sie sonst ab).
   */
  async update(id: string, dto: MeterUpdateDto): Promise<MeterWithAssignments> {
    if (
      dto.serialNumber !== undefined &&
      dto.serialNumber !== null &&
      dto.serialNumber !== "" &&
      (await this.serialTaken(dto.serialNumber, id))
    ) {
      throw new FieldValidationException([
        {
          path: ["serialNumber"],
          message: serialTakenMessage(dto.serialNumber),
        },
      ]);
    }

    const existing = await this.em.findOne(MeterSchema, { id });
    if (!existing) {
      throw new NotFoundException(notFoundMessage("meter", id));
    }

    const { costTypeIds, gasFactors, differenceConfig, ...meterPatch } = dto;
    if (costTypeIds !== undefined) {
      await this.assertCostTypesBelongToBuilding(
        costTypeIds,
        existing.buildingId,
      );

      if (costTypeIds.length > 0) {
        await this.assertNotReferencedByHeatingSettings(id, "costTypeIds");
      }
    }

    if (
      meterPatch.costAllocationMode !== undefined &&
      meterPatch.costAllocationMode !== "heating_cost_bill" &&
      existing.costAllocationMode === "heating_cost_bill"
    ) {
      await this.assertNotReferencedByHeatingSettings(id, "costAllocationMode");
    }

    const merged = { ...existing, ...meterPatch };
    const label = buildMeterLabel(
      {
        type: merged.type,
        role: merged.role,
        room: merged.room ?? null,
      },
      createTranslate(getI18n()),
    );

    if (gasFactors !== undefined) {
      this.assertGasFactorsValid(merged.type, gasFactors);
    }

    const existingConfig = await this.loadDifferenceConfig(id);
    const incomingConfig = differenceConfig ?? existingConfig;
    const shouldHaveConfig = merged.role === "virtual_difference";
    if (shouldHaveConfig && !incomingConfig) {
      throw new FieldValidationException([
        {
          path: ["differenceConfig"],
          message: getI18n().t("ui.meters.validation.differenceBaseRequired"),
        },
      ]);
    }

    if (
      !shouldHaveConfig &&
      differenceConfig !== null &&
      differenceConfig !== undefined
    ) {
      throw new FieldValidationException([
        {
          path: ["differenceConfig"],
          message: getI18n().t(
            "ui.meters.validation.differenceConfigOnlyVirtual",
          ),
        },
      ]);
    }

    const effectiveConfig = shouldHaveConfig ? incomingConfig : null;
    await this.assertDifferenceConfigConsistent(
      id,
      merged.role,
      merged.type,
      merged.buildingId,
      effectiveConfig,
    );

    return this.em.transactional(async (em) => {
      const updated = await em.findOne(MeterSchema, { id });
      if (!updated) {
        throw new NotFoundException(notFoundMessage("meter", id));
      }

      em.assign(updated, {
        ...meterPatch,
        label,
        updatedAt: new Date().toISOString(),
      });
      await em.flush();

      if (costTypeIds !== undefined) {
        await this.syncAssignments(em, id, costTypeIds);
      }

      if (gasFactors !== undefined) {
        await this.syncGasFactors(em, id, gasFactors);
      }

      await this.syncDifferenceComponents(em, id, effectiveConfig);

      await em.flush();

      const assignments = await em.find(
        MeterCostTypeAssignmentSchema,
        { meterId: id },
        { fields: ["costTypeId"] },
      );

      const factors = await em.find(
        MeterGasFactorSchema,
        { meterId: id },
        { orderBy: { validFrom: "asc" } },
      );

      const lockingCount = await em.count(HeatingSettingSchema, {
        hotWaterMeterId: id,
      });

      return {
        ...updated,
        costTypeIds: assignments.map((row) => row.costTypeId),
        gasFactors: factors,
        costAllocationModeLocked: lockingCount > 0,
        differenceConfig: effectiveConfig,
      };
    });
  }

  /**
   * Zähler löschen. Verweigert, solange Ablesungen existieren oder der
   * Zähler als Quelle eines Differenzzählers dient.
   */
  async delete(id: string) {
    const reading = await this.em.findOne(MeterReadingSchema, { meterId: id });
    if (reading) {
      throw new BadRequestException(getI18n().t("errors.meterHasReadings"));
    }

    const usedAsSource = await this.em.findOne(MeterDifferenceComponentSchema, {
      sourceMeterId: id,
    });
    if (usedAsSource) {
      throw new BadRequestException(
        getI18n().t("errors.meterUsedInDifference"),
      );
    }

    const meter = await this.em.findOne(MeterSchema, { id });
    if (!meter) {
      throw new NotFoundException(notFoundMessage("meter", id));
    }

    this.em.remove(meter);
    await this.em.flush();

    return meter;
  }

  /**
   * Zähler als inaktiv markieren
   */
  async deactivate(id: string) {
    const meter = await this.em.findOne(MeterSchema, { id });
    if (!meter) {
      throw new NotFoundException(notFoundMessage("meter", id));
    }

    this.em.assign(meter, {
      isActive: false,
      updatedAt: new Date().toISOString(),
    });

    await this.em.flush();

    return meter;
  }

  /**
   * Ablesungen eines Zählers, chronologisch aufsteigend
   */
  listReadings(meterId: string) {
    return this.em.find(
      MeterReadingSchema,
      { meterId },
      { orderBy: { readingDate: "asc" } },
    );
  }

  /**
   * Ablesung anlegen. Nur auf physischen Zählern erlaubt und je Zähler
   * darf ein Ablesedatum nur einmal vorkommen.
   */
  async createReading(dto: MeterReadingCreateDto) {
    await this.assertPhysicalMeter(dto.meterId);

    await this.assertReadingDateFree(dto.meterId, dto.readingDate);

    const created = this.em.create(MeterReadingSchema, dto);

    this.em.persist(created);
    await this.em.flush();

    return created;
  }

  /**
   * Stellt sicher, dass das Ablesedatum auf diesem Zähler noch frei ist.
   *
   * @param excludeId Klammert beim Update die eigene Ablesung aus.
   */
  private async assertReadingDateFree(
    meterId: string,
    readingDate: string,
    excludeId?: string,
  ) {
    const where: FilterQuery<MeterReading> = excludeId
      ? { meterId, readingDate, id: { $ne: excludeId } }
      : { meterId, readingDate };

    const existing = await this.em.count(MeterReadingSchema, where);
    if (existing > 0) {
      throw new FieldValidationException([
        { path: ["readingDate"], message: readingDateTakenMessage() },
      ]);
    }
  }

  /**
   * Differenzzähler sind virtuell. Ihr Stand wird aus anderen Zählern
   * berechnet. Direkte Ablesungen darauf wären eine stille Inkonsistenz.
   */
  private async assertPhysicalMeter(meterId: string) {
    const meter = await this.em.findOne(MeterSchema, { id: meterId });
    if (!meter) {
      throw new NotFoundException(notFoundMessage("meter", meterId));
    }

    if (meter.role === "virtual_difference") {
      throw new BadRequestException(getI18n().t("errors.meterVirtualReadonly"));
    }
  }

  /**
   * Ablesung aktualisieren. Bei geändertem Datum wird die Eindeutigkeit
   * je Zähler erneut geprüft.
   */
  async updateReading(id: string, patch: Partial<MeterReadingCreateDto>) {
    const reading = await this.em.findOne(MeterReadingSchema, { id });
    if (!reading) {
      throw new NotFoundException(notFoundMessage("reading", id));
    }

    if (
      patch.readingDate !== undefined &&
      reading.readingDate !== patch.readingDate
    ) {
      await this.assertReadingDateFree(reading.meterId, patch.readingDate, id);
    }

    this.em.assign(reading, { ...patch, updatedAt: new Date().toISOString() });
    await this.em.flush();

    return reading;
  }

  /**
   * Ablesung löschen
   */
  async deleteReading(id: string) {
    const reading = await this.em.findOne(MeterReadingSchema, { id });
    if (!reading) {
      throw new NotFoundException(notFoundMessage("reading", id));
    }

    this.em.remove(reading);
    await this.em.flush();

    return reading;
  }

  /**
   * Reichert rohe Zähler um Kostenart-Zuordnungen, Gas-Faktoren,
   * Differenzkonfiguration und das `costAllocationModeLocked`-Flag an.
   * Lädt alle Relationen gebündelt (ein Query je Tabelle), um N+1 zu
   * vermeiden.
   */
  private async hydrateAssignments(
    meters: Meter[],
  ): Promise<MeterWithAssignments[]> {
    if (meters.length === 0) {
      return [];
    }

    const meterIds = meters.map((meter) => meter.id);

    const [costRows, factorRows, hotWaterRows, diffRows] = await Promise.all([
      this.em.find(
        MeterCostTypeAssignmentSchema,
        { meterId: { $in: meterIds } },
        { fields: ["meterId", "costTypeId"] },
      ),

      this.em.find(
        MeterGasFactorSchema,
        { meterId: { $in: meterIds } },
        { orderBy: { validFrom: "asc" } },
      ),

      this.em.find(
        HeatingSettingSchema,
        { hotWaterMeterId: { $in: meterIds } },
        { fields: ["hotWaterMeterId"] },
      ),

      this.em.find(MeterDifferenceComponentSchema, {
        virtualMeterId: { $in: meterIds },
      }),
    ]);

    const lockedMeterIds = new Set(
      hotWaterRows
        .map((row) => row.hotWaterMeterId)
        .filter((meterId): meterId is string => meterId !== null),
    );

    return meters.map((meter) => ({
      ...meter,
      costTypeIds: costRows
        .filter((row) => row.meterId === meter.id)
        .map((row) => row.costTypeId),
      gasFactors: factorRows.filter((row) => row.meterId === meter.id),
      costAllocationModeLocked: lockedMeterIds.has(meter.id),
      differenceConfig: this.componentsToConfig(
        diffRows.filter((row) => row.virtualMeterId === meter.id),
      ),
    }));
  }

  /**
   * Setzt die Differenzkomponenten-Zeilen in das DTO zurück: genau eine
   * `base`-Zeile plus die `subtract`-Zeilen. Ohne Basis-Zeile gilt die
   * Konfiguration als nicht vorhanden (`null`).
   */
  private componentsToConfig(
    rows: MeterDifferenceComponent[],
  ): MeterDifferenceConfigDto | null {
    if (rows.length === 0) {
      return null;
    }
    const baseRow = rows.find((row) => row.kind === "base");
    if (!baseRow) {
      return null;
    }
    return {
      baseMeterId: baseRow.sourceMeterId,
      subtractedMeterIds: rows
        .filter((row) => row.kind === "subtract")
        .map((row) => row.sourceMeterId),
    };
  }

  /**
   * Lädt die gespeicherte Differenzkonfiguration eines virtuellen Zählers.
   */
  private async loadDifferenceConfig(
    meterId: string,
  ): Promise<MeterDifferenceConfigDto | null> {
    const rows = await this.em.find(MeterDifferenceComponentSchema, {
      virtualMeterId: meterId,
    });

    return this.componentsToConfig(rows);
  }

  /**
   * Ersetzt die Kostenart-Zuordnungen eines Zählers vollständig durch die
   * übergebene Menge (dedupliziert).
   */
  private async syncAssignments(
    em: EntityManager,
    meterId: string,
    costTypeIds: string[],
  ) {
    await em.nativeDelete(MeterCostTypeAssignmentSchema, { meterId });
    const unique = Array.from(new Set(costTypeIds));
    for (const costTypeId of unique) {
      em.persist(
        em.create(MeterCostTypeAssignmentSchema, { meterId, costTypeId }),
      );
    }
  }

  /**
   * Ersetzt alle Gas-Faktor-Perioden eines Zählers durch die übergebenen.
   * Für Nicht-Gas-Zähler werden alle bestehenden Perioden gelöscht.
   */
  private async syncGasFactors(
    em: EntityManager,
    meterId: string,
    gasFactors: GasFactorCreateDto[],
  ): Promise<MeterGasFactor[]> {
    await em.nativeDelete(MeterGasFactorSchema, { meterId });
    if (gasFactors.length === 0) {
      return [];
    }

    const created = gasFactors.map((factor) =>
      em.create(MeterGasFactorSchema, {
        meterId,
        validFrom: factor.validFrom,
        validUntil: factor.validUntil ?? null,
        energyFactorKwhPerM3: factor.energyFactorKwhPerM3 ?? null,
        notes: factor.notes ?? null,
      }),
    );

    for (const factor of created) {
      em.persist(factor);
    }

    await em.flush();

    return created;
  }

  /**
   * Gas-Faktoren sind nur für Gaszähler zulässig; je Periode muss
   * `validUntil` (falls gesetzt) hinter `validFrom` liegen.
   */
  private assertGasFactorsValid(
    type: MeterCreateDto["type"],
    gasFactors: GasFactorCreateDto[],
  ) {
    if (type !== "gas") {
      if (gasFactors.length > 0) {
        throw new FieldValidationException([
          {
            path: ["gasFactors"],
            message: getI18n().t("ui.meters.validation.gasFactorsOnlyForGas"),
          },
        ]);
      }
      return;
    }

    gasFactors.forEach((factor, index) => {
      if (
        factor.validUntil !== null &&
        factor.validUntil !== undefined &&
        factor.validUntil < factor.validFrom
      ) {
        throw new FieldValidationException([
          {
            path: ["gasFactors", index, "validUntil"],
            message: getI18n().t(
              "ui.meters.validation.gasFactorValidUntilBeforeFrom",
            ),
          },
        ]);
      }
    });
  }

  /**
   * Verhindert Änderungen an einem Zähler, die seine Rolle in der
   * Heizkostenabrechnung untergraben würden (Boiler-WMZ-Verknüpfung).
   */
  private async assertNotReferencedByHeatingSettings(
    meterId: string,
    fieldPath: string,
  ) {
    const linked = await this.em.findOne(HeatingSettingSchema, {
      hotWaterMeterId: meterId,
    });

    if (linked) {
      throw new FieldValidationException([
        {
          path: [fieldPath],
          message: getI18n().t("ui.heating.errors.meterInUseAsHotWaterMeter"),
        },
      ]);
    }
  }

  /**
   * Stellt sicher, dass alle angegebenen Kostenarten existieren und zum
   * selben Gebäude wie der Zähler gehören.
   */
  private async assertCostTypesBelongToBuilding(
    costTypeIds: string[] | undefined,
    buildingId: string,
  ) {
    if (!costTypeIds || costTypeIds.length === 0) {
      return;
    }

    const unique = Array.from(new Set(costTypeIds));
    const rows = await this.em.find(
      CostTypeSchema,
      { id: { $in: unique } },
      { fields: ["id", "buildingId"] },
    );

    if (rows.length !== unique.length) {
      throw new FieldValidationException([
        {
          path: ["costTypeIds"],
          message: getI18n().t("errors.costTypeNotFound"),
        },
      ]);
    }

    if (rows.some((row) => row.buildingId !== buildingId)) {
      throw new FieldValidationException([
        {
          path: ["costTypeIds"],
          message: getI18n().t("errors.costTypeBuildingMismatch"),
        },
      ]);
    }
  }

  /**
   * Ersetzt die Differenzkomponenten eines virtuellen Zählers: eine
   * `base`-Zeile plus je eine `subtract`-Zeile pro abgezogenem Zähler.
   * `config = null` entfernt alle Komponenten.
   */
  private async syncDifferenceComponents(
    em: EntityManager,
    meterId: string,
    config: MeterDifferenceConfigDto | null,
  ) {
    await em.nativeDelete(MeterDifferenceComponentSchema, {
      virtualMeterId: meterId,
    });

    if (!config) {
      return;
    }

    const rows: {
      virtualMeterId: string;
      sourceMeterId: string;
      kind: "base" | "subtract";
    }[] = [
      {
        virtualMeterId: meterId,
        sourceMeterId: config.baseMeterId,
        kind: "base",
      },
      ...config.subtractedMeterIds.map((sourceMeterId) => ({
        virtualMeterId: meterId,
        sourceMeterId,
        kind: "subtract" as const,
      })),
    ];

    for (const row of rows) {
      em.persist(em.create(MeterDifferenceComponentSchema, row));
    }
  }

  /**
   * Prüft die fachlichen Constraints für Differenzzähler-Konfigurationen.
   */
  private async assertDifferenceConfigConsistent(
    meterId: string | null,
    role: MeterRole,
    type: MeterCreateDto["type"],
    buildingId: string,
    config: MeterDifferenceConfigDto | null,
  ) {
    if (role !== "virtual_difference") {
      return;
    }

    if (!config) {
      return;
    }

    if (
      meterId !== null &&
      (config.baseMeterId === meterId ||
        config.subtractedMeterIds.includes(meterId))
    ) {
      throw new FieldValidationException([
        {
          path: ["differenceConfig"],
          message: getI18n().t("ui.meters.validation.differenceCircular"),
        },
      ]);
    }

    const sourceIds = Array.from(
      new Set([config.baseMeterId, ...config.subtractedMeterIds]),
    );

    const rows = await this.em.find(
      MeterSchema,
      { id: { $in: sourceIds } },
      { fields: ["id", "type", "buildingId", "role"] },
    );

    if (rows.length !== sourceIds.length) {
      throw new FieldValidationException([
        {
          path: ["differenceConfig"],
          message: getI18n().t("ui.meters.validation.differenceSourceNotFound"),
        },
      ]);
    }

    if (rows.some((row) => row.type !== type)) {
      throw new FieldValidationException([
        {
          path: ["differenceConfig"],
          message: getI18n().t(
            "ui.meters.validation.differenceSourceTypeMismatch",
          ),
        },
      ]);
    }
    if (rows.some((row) => row.buildingId !== buildingId)) {
      throw new FieldValidationException([
        {
          path: ["differenceConfig"],
          message: getI18n().t(
            "ui.meters.validation.differenceSourceBuildingMismatch",
          ),
        },
      ]);
    }

    if (meterId !== null) {
      await this.assertNoDifferenceCycle(meterId, sourceIds);
    }
  }

  /**
   * Wandert von jeder Quelle durch die Komponenten-Tabelle und lehnt ab,
   * falls ein Pfad zurück zu `meterId` führt (Zyklus).
   */
  private async assertNoDifferenceCycle(meterId: string, sourceIds: string[]) {
    const visited = new Set<string>();
    const queue = [...sourceIds];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId || visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);
      if (currentId === meterId) {
        throw new FieldValidationException([
          {
            path: ["differenceConfig"],
            message: getI18n().t("ui.meters.validation.differenceCircular"),
          },
        ]);
      }

      const downstream = await this.em.find(
        MeterDifferenceComponentSchema,
        { virtualMeterId: currentId },
        { fields: ["sourceMeterId"] },
      );

      for (const row of downstream) {
        if (!visited.has(row.sourceMeterId)) {
          queue.push(row.sourceMeterId);
        }
      }
    }
  }

  /**
   * Prüft, ob die Seriennummer bereits vergeben ist.
   *
   * @param excludeId Klammert beim Update den eigenen Zähler aus
   */
  private async serialTaken(serial: string, excludeId?: string) {
    const where: FilterQuery<Meter> = excludeId
      ? { serialNumber: serial, id: { $ne: excludeId } }
      : { serialNumber: serial };

    return (await this.em.count(MeterSchema, where)) > 0;
  }
}
