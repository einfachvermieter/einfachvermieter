import {
  type CostEntry,
  type CostEntryItem,
  CostEntryItemSchema,
  CostEntrySchema,
  type CostType,
  CostTypeSchema,
  MeterCostTypeAssignmentSchema,
  UnitSchema,
} from "@einfachvermieter/db";
import type {
  CostEntryCreateDto,
  CostEntryItemDto,
  CostEntryUpdateDto,
  CostTypeCreateDto,
  CostTypeUpdateDto,
  FieldValidationError,
} from "@einfachvermieter/shared";
import {
  type EntityData,
  EntityManager,
  type FilterQuery,
  type QueryOrderMap,
} from "@mikro-orm/core";
import { Injectable, NotFoundException } from "@nestjs/common";
import { FieldValidationException } from "../common/field-validation.exception.js";
import { likeContains } from "../common/like-search.js";
import { getI18n } from "../i18n/i18n.registry.js";
import { notFoundMessage } from "../i18n/notFound.js";
import { StorageService } from "../storage/storage.service.js";

type CostTypeSort = "name" | "category";

type CostEntrySort = "invoiceDate" | "amount" | "vendor" | "period";

type CostEntryListParams = {
  buildingId?: string;
  costTypeId?: string;
  page: number;
  pageSize: number;
  sort?: CostEntrySort;
  order?: "asc" | "desc";
  q?: string;
};

type CostEntryItemRow = {
  id: string;
  costTypeId: string;
  costTypeName: string;
  unitId: string | null;
  amountCents: number;
  unitPriceCents: number | null;
  laborCostsCents: number | null;
  co2AmountGrams: number | null;
  co2CostCents: number | null;
  periodStart: string;
  periodEnd: string;
  position: number;
};

export type CostEntryDetail = {
  id: string;
  invoiceDate: string;
  invoiceNumber: string | null;
  vendor: string | null;
  notes: string | null;
  updatedAt: string;
  items: CostEntryItemRow[];
};

type CostEntryOverviewRow = {
  id: string;
  invoiceDate: string;
  invoiceNumber: string | null;
  vendor: string | null;
  notes: string | null;
  amountCents: number;
  periodStart: string;
  periodEnd: string;
  costTypeNames: string[];
  buildingId: string;
};

export type CostEntryListResult = {
  items: CostEntryOverviewRow[];
  total: number;
  totalAmountCents: number;
};

/**
 * Aggregierte Kennzahlen einer Kostenart für Hero und Infospalte der
 * Bearbeiten-Seite.
 */
export type CostTypeStats = {
  /**
   * Bezugsjahr (Serverjahr)
   */
  year: number;
  /**
   * Rechnungen mit einer Position dieser Kostenart, Rechnungsdatum im Jahr
   */
  entryCount: number;
  /**
   * Summe der Positionsbeträge dieser Kostenart im Jahr
   */
  totalAmountCents: number;
  /**
   * Anzahl zugeordneter Zähler (Messquellen)
   */
  assignedMetersCount: number;
  /**
   * Jüngste Rechnung mit dieser Kostenart (über alle Jahre)
   */
  lastEntry: { id: string; invoiceDate: string; amountCents: number } | null;
};

export type CostTypeDetail = CostType & { stats: CostTypeStats };

@Injectable()
export class CostsService {
  constructor(
    private readonly em: EntityManager,
    private readonly storage: StorageService,
  ) {}

  /**
   * Paginierte, sortierbare Kostenartenliste, optional auf ein Gebäude gefiltert.
   *
   * @param params.q Freitextsuche im Namen
   */
  async listCostTypes(params: {
    buildingId?: string;
    page: number;
    pageSize: number;
    sort?: CostTypeSort;
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

    const filters: FilterQuery<CostType>[] = [];

    if (buildingId) {
      filters.push({ buildingId });
    }

    if (q) {
      filters.push(likeContains("name", q) as FilterQuery<CostType>);
    }

    const where: FilterQuery<CostType> =
      filters.length > 0 ? { $and: filters } : {};

    const [items, total] = await Promise.all([
      this.em.find(CostTypeSchema, where, {
        orderBy: { [sort]: order } as QueryOrderMap<CostType>,
        limit: pageSize,
        offset: page * pageSize,
      }),

      this.em.count(CostTypeSchema, where),
    ]);

    return { items, total };
  }

  /**
   * Alle Kostenarten unpaginiert
   * Für die Zähler-Zuordnung und die Abrechnungsberechnung
   */
  listAllCostTypes(buildingId?: string) {
    return this.em.find(CostTypeSchema, buildingId ? { buildingId } : {}, {
      orderBy: { name: "asc" },
    });
  }

  /**
   * Kostenart anlegen
   */
  async createCostType(dto: CostTypeCreateDto) {
    const created = this.em.create(CostTypeSchema, dto);

    this.em.persist(created);
    await this.em.flush();

    return created;
  }

  /**
   * Kostenart aktualisieren
   */
  async updateCostType(id: string, patch: CostTypeUpdateDto) {
    const costType = await this.em.findOne(CostTypeSchema, { id });
    if (!costType) {
      throw new NotFoundException(notFoundMessage("costType", id));
    }

    this.em.assign(costType, { ...patch, updatedAt: new Date().toISOString() });
    await this.em.flush();

    return costType;
  }

  /**
   * Einzelne Kostenart samt aggregierter Kennzahlen (Rechnungen/Summe im
   * laufenden Jahr, zugeordnete Zähler, letzte Rechnung) laden.
   */
  async getCostType(id: string): Promise<CostTypeDetail> {
    const costType = await this.em.findOne(CostTypeSchema, { id });
    if (!costType) {
      throw new NotFoundException(notFoundMessage("costType", id));
    }

    const items = await this.em.find(CostEntryItemSchema, { costTypeId: id });
    const entryIds = [...new Set(items.map((item) => item.costEntryId))];
    const entries =
      entryIds.length > 0
        ? await this.em.find(CostEntrySchema, { id: { $in: entryIds } })
        : [];
    const entryById = new Map(entries.map((entry) => [entry.id, entry]));

    const latest = entries.reduce<CostEntry | null>(
      (max, entry) =>
        !max || entry.invoiceDate > max.invoiceDate ? entry : max,
      null,
    );

    // Bezugsjahr ist das Jahr der jüngsten Rechnung, nicht das Kalenderjahr
    const year = latest
      ? Number(latest.invoiceDate.slice(0, 4))
      : new Date().getFullYear();
    const isInYear = (item: CostEntryItem): boolean =>
      entryById.get(item.costEntryId)?.invoiceDate.slice(0, 4) === String(year);

    const entriesInYear = new Set(
      items.filter(isInYear).map((item) => item.costEntryId),
    );
    const totalAmountCents = items
      .filter(isInYear)
      .reduce((sum, item) => sum + item.amountCents, 0);
    const lastEntry = latest
      ? {
          id: latest.id,
          invoiceDate: latest.invoiceDate,
          amountCents: items
            .filter((item) => item.costEntryId === latest.id)
            .reduce((sum, item) => sum + item.amountCents, 0),
        }
      : null;

    const assignedMetersCount = await this.em.count(
      MeterCostTypeAssignmentSchema,
      { costTypeId: id },
    );

    return {
      ...costType,
      stats: {
        year,
        entryCount: entriesInYear.size,
        totalAmountCents,
        assignedMetersCount,
        lastEntry,
      },
    };
  }

  /**
   * Kostenart löschen
   */
  async deleteCostType(id: string) {
    const costType = await this.em.findOne(CostTypeSchema, { id });
    if (!costType) {
      throw new NotFoundException(notFoundMessage("costType", id));
    }

    this.em.remove(costType);
    await this.em.flush();

    return costType;
  }

  /**
   * Paginierte, sortierbare Übersicht der Kostenrechnungen (Belege), optional auf
   * Gebäude/Kostenart gefiltert, eine Zeile pro Beleg.
   *
   * @param params.q Freitextsuche in Kostenart-Name, Rechnungsnummer und Lieferant
   */
  async listCostEntriesOverview(
    params: CostEntryListParams,
  ): Promise<CostEntryListResult> {
    const {
      buildingId,
      costTypeId,
      page,
      pageSize,
      sort = "invoiceDate",
      order = "desc",
      q,
    } = params;

    const costTypes = await this.em.find(
      CostTypeSchema,
      buildingId ? { buildingId } : {},
    );
    const items = await this.em.find(CostEntryItemSchema, {
      costTypeId: { $in: costTypes.map((ct) => ct.id) },
    });
    const entries = await this.em.find(CostEntrySchema, {
      id: { $in: [...new Set(items.map((item) => item.costEntryId))] },
    });

    const costTypeById = new Map(costTypes.map((ct) => [ct.id, ct]));
    const itemsByEntry = new Map<string, CostEntryItem[]>();

    for (const item of items) {
      const list = itemsByEntry.get(item.costEntryId) ?? [];
      list.push(item);
      itemsByEntry.set(item.costEntryId, list);
    }

    const needle = q?.toLowerCase();
    const entryMatches = (
      entry: CostEntry,
      entryItems: CostEntryItem[],
    ): boolean =>
      entryItems.some((item) => {
        const costType = costTypeById.get(item.costTypeId);
        if (!costType) {
          return false;
        }

        if (buildingId && costType.buildingId !== buildingId) {
          return false;
        }

        if (costTypeId && item.costTypeId !== costTypeId) {
          return false;
        }

        if (needle) {
          const matchesNeedle =
            costType.name.toLowerCase().includes(needle) ||
            (entry.invoiceNumber ?? "").toLowerCase().includes(needle) ||
            (entry.vendor ?? "").toLowerCase().includes(needle);

          if (!matchesNeedle) {
            return false;
          }
        }

        return true;
      });

    const collator = new Intl.Collator("de", { sensitivity: "base" });
    const matched = entries.filter((entry) =>
      entryMatches(entry, itemsByEntry.get(entry.id) ?? []),
    );

    let rows: CostEntryOverviewRow[] = matched.map((entry) => {
      const entryItems = itemsByEntry.get(entry.id) ?? [];
      const ordered = [...entryItems].sort(
        (a, b) => a.position - b.position || a.id.localeCompare(b.id),
      );
      const names = new Set<string>();

      let firstBuildingId = "";

      for (const item of ordered) {
        const costType = costTypeById.get(item.costTypeId);
        if (costType) {
          names.add(costType.name);
          if (!firstBuildingId) {
            firstBuildingId = costType.buildingId;
          }
        }
      }

      return {
        id: entry.id,
        invoiceDate: entry.invoiceDate,
        invoiceNumber: entry.invoiceNumber,
        vendor: entry.vendor,
        notes: entry.notes,
        amountCents: entryItems.reduce((sum, it) => sum + it.amountCents, 0),
        periodStart: entryItems.reduce(
          (min, it) => (it.periodStart < min ? it.periodStart : min),
          ordered[0]?.periodStart ?? "",
        ),
        periodEnd: entryItems.reduce(
          (max, it) => (it.periodEnd > max ? it.periodEnd : max),
          ordered[0]?.periodEnd ?? "",
        ),
        costTypeNames: Array.from(names).sort(collator.compare),
        buildingId: firstBuildingId,
      };
    });

    const dir = order === "desc" ? -1 : 1;
    rows = rows.sort((a, b) => {
      let primary = 0;
      if (sort === "amount") {
        primary = a.amountCents - b.amountCents;
      } else if (sort === "vendor") {
        primary = (a.vendor ?? "")
          .toLowerCase()
          .localeCompare((b.vendor ?? "").toLowerCase());
      } else if (sort === "period") {
        primary = a.periodStart.localeCompare(b.periodStart);
      } else {
        primary = a.invoiceDate.localeCompare(b.invoiceDate);
      }
      if (primary !== 0) {
        return primary * dir;
      }
      return b.invoiceDate.localeCompare(a.invoiceDate);
    });

    const total = rows.length;
    // Jahressumme über alle Treffer der Filterung, nicht nur der Seite
    const totalAmountCents = rows.reduce(
      (sum, row) => sum + row.amountCents,
      0,
    );
    const pageItems = rows.slice(page * pageSize, page * pageSize + pageSize);

    return { items: pageItems, total, totalAmountCents };
  }

  /**
   * Einzelne Rechnung samt ihrer Positionen laden
   */
  async getCostEntry(id: string): Promise<CostEntryDetail> {
    const entry = await this.em.findOne(CostEntrySchema, { id });
    if (!entry) {
      throw new NotFoundException(notFoundMessage("costEntry", id));
    }
    const items = await this.loadItems(id);
    return {
      id: entry.id,
      invoiceDate: entry.invoiceDate,
      invoiceNumber: entry.invoiceNumber,
      vendor: entry.vendor,
      notes: entry.notes,
      updatedAt: entry.updatedAt,
      items,
    };
  }

  /**
   * Rechnung mit ihren Positionen anlegen
   */
  async createCostEntry(dto: CostEntryCreateDto): Promise<CostEntryDetail> {
    await this.assertItemUnitAssignments(dto.items);

    const newId = await this.em.transactional(async (em) => {
      const entry = em.create(CostEntrySchema, {
        invoiceDate: dto.invoiceDate,
        invoiceNumber: dto.invoiceNumber ?? null,
        vendor: dto.vendor ?? null,
        notes: dto.notes ?? null,
      });

      em.persist(entry);
      await em.flush();

      this.insertItems(em, entry.id, dto.items);

      await em.flush();
      return entry.id;
    });

    return this.getCostEntry(newId);
  }

  /**
   * Rechnung aktualisieren. Sind Positionen im Patch enthalten, werden die
   * bestehenden komplett ersetzt (löschen und neu einfügen)
   */
  async updateCostEntry(
    id: string,
    patch: CostEntryUpdateDto,
  ): Promise<CostEntryDetail> {
    if (patch.items !== undefined) {
      await this.assertItemUnitAssignments(patch.items);
    }

    await this.em.transactional(async (em) => {
      const entry = await em.findOne(CostEntrySchema, { id });

      if (!entry) {
        throw new NotFoundException(notFoundMessage("costEntry", id));
      }

      const updates: EntityData<CostEntry> = {
        updatedAt: new Date().toISOString(),
      };
      if (patch.invoiceDate !== undefined) {
        updates.invoiceDate = patch.invoiceDate;
      }
      if (patch.invoiceNumber !== undefined) {
        updates.invoiceNumber = patch.invoiceNumber;
      }
      if (patch.vendor !== undefined) {
        updates.vendor = patch.vendor;
      }
      if (patch.notes !== undefined) {
        updates.notes = patch.notes;
      }

      em.assign(entry, updates);

      if (patch.items !== undefined) {
        await em.nativeDelete(CostEntryItemSchema, { costEntryId: id });
        this.insertItems(em, id, patch.items);
      }

      await em.flush();
    });

    return this.getCostEntry(id);
  }

  /**
   * Prüft die Wohnungs-Direktzuordnung der Positionen (Pflicht bei
   * `fixed`-Kostenarten, sonst verboten). Liefert strukturierte Feldfehler
   */
  private async assertItemUnitAssignments(
    items: CostEntryItemDto[],
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }

    const costTypeIds = [...new Set(items.map((item) => item.costTypeId))];
    const costTypeRows = await this.em.find(
      CostTypeSchema,
      { id: { $in: costTypeIds } },
      { fields: ["id", "buildingId", "defaultAllocationKey"] },
    );

    const costTypeById = new Map(costTypeRows.map((row) => [row.id, row]));

    const unitIds = [
      ...new Set(
        items
          .map((item) => item.unitId)
          .filter((unitId): unitId is string => Boolean(unitId)),
      ),
    ];
    const unitRows =
      unitIds.length > 0
        ? await this.em.find(
            UnitSchema,
            { id: { $in: unitIds } },
            { fields: ["id", "buildingId"] },
          )
        : [];
    const unitById = new Map(unitRows.map((row) => [row.id, row]));

    const i18n = getI18n();
    const errors: FieldValidationError[] = [];

    items.forEach((item, index) => {
      const costType = costTypeById.get(item.costTypeId);
      const isFixed = costType?.defaultAllocationKey === "fixed";

      if (isFixed) {
        if (!item.unitId) {
          errors.push({
            path: ["items", index, "unitId"],
            message: i18n.t("validation.fixedUnitRequired"),
          });
          return;
        }

        const unit = unitById.get(item.unitId);

        if (!unit || unit.buildingId !== costType?.buildingId) {
          errors.push({
            path: ["items", index, "unitId"],
            message: i18n.t("validation.fixedUnitWrongBuilding"),
          });
        }
      } else if (item.unitId) {
        errors.push({
          path: ["items", index, "unitId"],
          message: i18n.t("validation.unitOnlyForFixed"),
        });
      }
    });

    if (errors.length > 0) {
      throw new FieldValidationException(errors);
    }
  }

  /**
   * Rechnung löschen
   */
  async deleteCostEntry(id: string) {
    const entry = await this.em.findOne(CostEntrySchema, { id });
    if (!entry) {
      throw new NotFoundException(notFoundMessage("costEntry", id));
    }

    this.em.remove(entry);
    await this.em.flush();

    // Anhangs-Zeilen sind über die FK kaskadiert mit weg. Die Dateien liegen
    // unter `cost-entries/<id>/` und werden hier explizit entfernt.
    await this.storage
      .deleteDirectory(`cost-entries/${id}`)
      .catch(() => undefined);

    return entry;
  }

  /**
   * Alle Positionen einer Kostenart, optional gefiltert nach Periode
   * (Überlappung mit [from, to]) für die Abrechnungsberechnung. Jede
   * Zeile enthält die Rechnungs-Metadaten der zugehörigen Rechnung.
   */
  async listItems(costTypeId?: string, from?: string, to?: string) {
    const where: FilterQuery<CostEntryItem> = {};
    if (costTypeId) {
      where.costTypeId = costTypeId;
    }

    if (from && to) {
      where.periodStart = { $lte: to };
      where.periodEnd = { $gte: from };
    }

    const items = await this.em.find(CostEntryItemSchema, where);
    const entryIds = [...new Set(items.map((item) => item.costEntryId))];
    const entries = await this.em.find(CostEntrySchema, {
      id: { $in: entryIds },
    });

    const entryById = new Map(entries.map((entry) => [entry.id, entry]));
    const rows = items.map((item) => {
      const entry = entryById.get(item.costEntryId);
      return {
        id: item.id,
        costEntryId: item.costEntryId,
        costTypeId: item.costTypeId,
        amountCents: item.amountCents,
        periodStart: item.periodStart,
        periodEnd: item.periodEnd,
        position: item.position,
        invoiceDate: entry?.invoiceDate ?? "",
        invoiceNumber: entry?.invoiceNumber ?? null,
        vendor: entry?.vendor ?? null,
      };
    });

    rows.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));

    return rows;
  }

  /**
   * Positionen einer Rechnung in Anzeige-Reihenfolge laden und je Position
   * den Kostenart-Namen ergänzen.
   */
  private async loadItems(entryId: string): Promise<CostEntryItemRow[]> {
    const items = await this.em.find(
      CostEntryItemSchema,
      { costEntryId: entryId },
      { orderBy: { position: "asc", id: "asc" } },
    );

    const costTypeIds = [...new Set(items.map((item) => item.costTypeId))];
    const costTypes = await this.em.find(
      CostTypeSchema,
      { id: { $in: costTypeIds } },
      { fields: ["id", "name"] },
    );
    const nameById = new Map(costTypes.map((ct) => [ct.id, ct.name]));
    return items.map((item) => ({
      id: item.id,
      costTypeId: item.costTypeId,
      costTypeName: nameById.get(item.costTypeId) ?? "",
      unitId: item.unitId,
      amountCents: item.amountCents,
      unitPriceCents: item.unitPriceCents,
      laborCostsCents: item.laborCostsCents,
      co2AmountGrams: item.co2AmountGrams,
      co2CostCents: item.co2CostCents,
      periodStart: item.periodStart,
      periodEnd: item.periodEnd,
      position: item.position,
    }));
  }

  /**
   * Positionen einer Rechnung persistieren. Die `position` ergibt sich aus
   * der Reihenfolge im Array.
   */
  private insertItems(
    em: EntityManager,
    entryId: string,
    items: CostEntryItemDto[],
  ) {
    items.forEach((item, index) => {
      em.persist(
        em.create(CostEntryItemSchema, {
          costEntryId: entryId,
          costTypeId: item.costTypeId,
          unitId: item.unitId ?? null,
          amountCents: item.amountCents,
          unitPriceCents: item.unitPriceCents ?? null,
          laborCostsCents: item.laborCostsCents ?? null,
          co2AmountGrams: item.co2AmountGrams ?? null,
          co2CostCents: item.co2CostCents ?? null,
          periodStart: item.periodStart,
          periodEnd: item.periodEnd,
          position: index,
        }),
      );
    });
  }
}
