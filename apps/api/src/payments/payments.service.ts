import {
  type Payment,
  PaymentSchema,
  TenantSchema,
  UnitSchema,
} from "@einfachvermieter/db";
import type {
  PaymentCreateDto,
  PaymentPurpose,
  PaymentUpdateDto,
} from "@einfachvermieter/shared";
import {
  type EntityData,
  EntityManager,
  type FilterQuery,
  type QueryOrderMap,
  type RequiredEntityData,
  raw,
} from "@mikro-orm/core";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { assertDateRangeNotFinalized } from "../common/finalized-period-lock.js";
import { likeContains } from "../common/like-search.js";
import { getI18n } from "../i18n/i18n.registry.js";
import { notFoundMessage } from "../i18n/notFound.js";

type PaymentSort = "date" | "amount" | "reference";

type PaymentListParams = {
  tenantId?: string;
  buildingId?: string;
  page: number;
  pageSize: number;
  sort?: PaymentSort;
  order?: "asc" | "desc";
  q?: string;
};

export type PaymentListResult = {
  items: Payment[];
  total: number;
};

/**
 * Payments: Bewegungen auf dem Mieterkonto, jede mit genau einem
 * Zahlungszweck (`month` / `statement` / `deposit` / `fee`). Der Zweck
 * bestimmt, gegen welchen Sollwert die Zahlung wirkt.
 *
 * Locking: Zahlungen mit Zweck `month`, deren Monat innerhalb einer
 * finalisierten NK-Periode des Tenants liegt, sind unveränderlich.
 */
@Injectable()
export class PaymentsService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Paginierte, sortierbare Zahlungsliste, optional auf Mieter/Gebäude gefiltert.
   * Der `amount`-Sort fällt für Monatszahlungen auf base+advance zurück.
   *
   * @param params.q Freitextsuche in der Referenz (Verwendungszweck)
   * @param params.buildingId Wird über unit -> tenant in Tenant-Ids aufgelöst
   */
  async listPaginated(params: PaymentListParams): Promise<PaymentListResult> {
    const {
      tenantId,
      buildingId,
      page,
      pageSize,
      sort = "date",
      order = "desc",
      q,
    } = params;

    const filters: FilterQuery<Payment>[] = [];
    if (tenantId) {
      filters.push({ tenantId });
    }

    if (buildingId) {
      // Payments hängen über tenant -> unit am Gebäude. Tenant-Ids auflösen
      const units = await this.em.find(
        UnitSchema,
        { buildingId },
        { fields: ["id"] },
      );
      const tenants = await this.em.find(
        TenantSchema,
        { unitId: { $in: units.map((unit) => unit.id) } },
        { fields: ["id"] },
      );
      filters.push({ tenantId: { $in: tenants.map((tenant) => tenant.id) } });
    }

    if (q) {
      filters.push(likeContains("reference", q) as FilterQuery<Payment>);
    }

    const where: FilterQuery<Payment> =
      filters.length > 0 ? { $and: filters } : {};

    const sortExpr: Record<PaymentSort, (alias: string) => string> = {
      date: (alias) => `${alias}.payment_date`,
      amount: (alias) =>
        `coalesce(${alias}.amount_cents, coalesce(${alias}.base_rent_cents, 0) + coalesce(${alias}.advance_cents, 0))`,
      reference: (alias) => `lower(${alias}.reference)`,
    };

    const orderExpr = [
      { [raw((alias) => sortExpr[sort](alias))]: order },
      { id: "asc" },
    ];

    const [items, total] = await Promise.all([
      this.em.find(PaymentSchema, where, {
        orderBy: orderExpr as QueryOrderMap<Payment>[],
        limit: pageSize,
        offset: page * pageSize,
      }),
      this.em.count(PaymentSchema, where),
    ]);

    return { items, total };
  }

  /**
   * Lädt eine Zahlung
   */
  async getById(id: string) {
    const payment = await this.em.findOne(PaymentSchema, { id });
    if (!payment) {
      throw new NotFoundException(notFoundMessage("payment", id));
    }
    return payment;
  }

  /**
   * Legt eine Zahlung an. Bei Zweck `month` wird vorab geprüft, dass der
   * Monat nicht in einer finalisierten NK-Periode liegt.
   */
  async create(dto: PaymentCreateDto) {
    if (dto.purpose.kind === "month") {
      await this.assertMonthMutable(dto.tenantId, dto.purpose.forMonth);
    }

    const created = this.em.create(PaymentSchema, this.toInsertValues(dto));

    this.em.persist(created);
    await this.em.flush();

    return created;
  }

  /**
   * Aktualisiert eine Zahlung. Der Zahlungszweck (kind) ist unveränderlich;
   * nur Felder des bestehenden Zwecks dürfen geändert werden. Lock-Prüfung
   * für Monatszahlungen vor und nach dem Patch.
   */
  async update(id: string, dto: PaymentUpdateDto) {
    const existing = await this.getById(id);
    if (existing.forMonth) {
      await this.assertMonthMutable(existing.tenantId, existing.forMonth);
    }

    const patch: EntityData<Payment> = {
      updatedAt: new Date().toISOString(),
    };

    if (dto.paymentDate) {
      patch.paymentDate = dto.paymentDate;
    }

    if (dto.reference !== undefined) {
      patch.reference = dto.reference;
    }

    if (dto.purpose) {
      this.assertSamePurposeKind(existing, dto.purpose);
      if (dto.purpose.kind === "month") {
        await this.assertMonthMutable(existing.tenantId, dto.purpose.forMonth);
        patch.forMonth = dto.purpose.forMonth;
        patch.baseRentCents = dto.purpose.baseRentCents;
        patch.advanceCents = dto.purpose.advanceCents;
      } else if (dto.purpose.kind === "statement") {
        patch.forStatementId = dto.purpose.forStatementId;
        patch.amountCents = dto.purpose.amountCents;
      } else if (dto.purpose.kind === "deposit") {
        patch.amountCents = dto.purpose.amountCents;
      } else {
        patch.forFeeId = dto.purpose.forFeeId;
        patch.amountCents = dto.purpose.amountCents;
      }
    }

    this.em.assign(existing, patch);
    await this.em.flush();

    return existing;
  }

  /**
   * Löscht eine Zahlung; Monatszahlungen in finalisierter Periode sind
   * gesperrt.
   */
  async delete(id: string) {
    const existing = await this.getById(id);
    if (existing.forMonth) {
      await this.assertMonthMutable(existing.tenantId, existing.forMonth);
    }

    this.em.remove(existing);
    await this.em.flush();

    return existing;
  }

  /**
   * Übersetzt das Create-DTO in die Insert-Spalten und setzt je nach Zweck
   * die passenden Felder (forMonth+base/advance, forStatementId, forDeposit
   * oder forFeeId).
   */
  private toInsertValues(dto: PaymentCreateDto): RequiredEntityData<Payment> {
    const base = {
      tenantId: dto.tenantId,
      paymentDate: dto.paymentDate,
      reference: dto.reference ?? null,
    };

    if (dto.purpose.kind === "month") {
      return {
        ...base,
        forMonth: dto.purpose.forMonth,
        baseRentCents: dto.purpose.baseRentCents,
        advanceCents: dto.purpose.advanceCents,
      };
    }

    if (dto.purpose.kind === "statement") {
      return {
        ...base,
        forStatementId: dto.purpose.forStatementId,
        amountCents: dto.purpose.amountCents,
      };
    }

    if (dto.purpose.kind === "deposit") {
      return {
        ...base,
        forDeposit: true,
        amountCents: dto.purpose.amountCents,
      };
    }

    return {
      ...base,
      forFeeId: dto.purpose.forFeeId,
      amountCents: dto.purpose.amountCents,
    };
  }

  /**
   * Stellt sicher, dass ein Update den Zahlungszweck nicht wechselt; sonst
   * `BadRequestException`.
   */
  private assertSamePurposeKind(existing: Payment, purpose: PaymentPurpose) {
    const existingKind = derivePurposeKindFromRow(existing);

    if (existingKind !== purpose.kind) {
      throw new BadRequestException(
        getI18n().t("errors.paymentPurposeKindImmutable"),
      );
    }
  }

  /**
   * Prüft, ob der Mietmonat in einer finalisierten Statement-Periode
   * desselben Tenants liegt. Falls ja, sind Inserts/Updates/Deletes
   * für diesen Zweck gesperrt.
   */
  private async assertMonthMutable(tenantId: string, forMonth: string) {
    const monthStart = `${forMonth}-01`;
    const monthEnd = `${forMonth}-31`; // grober oberer Rand reicht für den Range-Test

    await assertDateRangeNotFinalized(this.em, tenantId, monthStart, monthEnd);
  }
}

/**
 * Leitet den Zahlungszweck aus den gesetzten Anker-Feldern der Zeile ab
 * (forMonth/forStatementId/forDeposit/forFeeId).
 */
const derivePurposeKindFromRow = (
  row: Payment,
): "month" | "statement" | "deposit" | "fee" | null => {
  if (row.forMonth) {
    return "month";
  }

  if (row.forStatementId) {
    return "statement";
  }

  if (row.forDeposit) {
    return "deposit";
  }

  if (row.forFeeId) {
    return "fee";
  }

  return null;
};
