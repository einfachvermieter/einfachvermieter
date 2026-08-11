import {
  type AccountFee,
  AccountFeeSchema,
  type AccountSettlement,
  AccountSettlementSchema,
  type Payment,
  PaymentSchema,
  type Tenant,
  type TenantRent,
  TenantRentSchema,
  TenantSchema,
  UnitSchema,
} from "@einfachvermieter/db";
import {
  type AccountFeeCreateDto,
  type AccountFeeUpdateDto,
  type DepositRow,
  enumerateMonths,
  type FeeRow,
  type MonthGridRow,
  makePot,
  maxDate,
  minDate,
  pickRentForMonth,
  type SettlementRow,
  type TenantBalanceResult,
} from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import { Injectable, NotFoundException } from "@nestjs/common";
import { assertDateRangeNotFinalized } from "../common/finalized-period-lock.js";
import { notFoundMessage } from "../i18n/notFound.js";

/**
 * Monatszeilen bauen und jeder Soll-Miete ihre Monats-Zahlungen zuordnen
 */
const buildMonthRows = (
  tenant: Tenant,
  rents: TenantRent[],
  payments: Payment[],
  rangeStart: string,
  rangeEnd: string,
): MonthGridRow[] => {
  if (rents.length === 0) {
    return [];
  }

  const start = maxDate(tenant.startDate, rangeStart);
  const end = minDate(tenant.endDate ?? rangeEnd, rangeEnd);
  if (start > end) {
    return [];
  }

  const months = enumerateMonths(start, end);
  const byMonth = new Map<
    string,
    { baseRents: number[]; advances: number[]; ids: string[] }
  >();
  for (const month of months) {
    byMonth.set(month, { baseRents: [], advances: [], ids: [] });
  }

  for (const payment of payments) {
    if (!payment.forMonth) {
      continue;
    }
    const bucket = byMonth.get(payment.forMonth);
    if (!bucket) {
      continue;
    }
    bucket.baseRents.push(payment.baseRentCents ?? 0);
    bucket.advances.push(payment.advanceCents ?? 0);
    bucket.ids.push(payment.id);
  }

  const rows: MonthGridRow[] = [];
  for (const month of months) {
    const rent = pickRentForMonth(rents, month);
    if (!rent) {
      continue;
    }
    const bucket = byMonth.get(month);
    rows.push({
      tenantId: tenant.id,
      forMonth: month,
      baseRent: makePot(rent.monthlyBaseRentCents, bucket?.baseRents ?? []),
      advance: makePot(rent.monthlyAdvanceCents, bucket?.advances ?? []),
      paymentIds: bucket?.ids ?? [],
    });
  }
  return rows;
};

/**
 * Jeder Abrechnungs-Forderung ihre Zahlungen zuordnen (Soll vs. Ist)
 */
const buildSettlementRows = (
  settlements: AccountSettlement[],
  payments: Payment[],
): SettlementRow[] => {
  const statementIds = new Set(settlements.map((s) => s.statementId));
  const paymentsByStatement = new Map<
    string,
    { amounts: number[]; ids: string[] }
  >();
  for (const payment of payments) {
    if (!payment.forStatementId || !statementIds.has(payment.forStatementId)) {
      continue;
    }
    const bucket = paymentsByStatement.get(payment.forStatementId) ?? {
      amounts: [],
      ids: [],
    };
    bucket.amounts.push(payment.amountCents ?? 0);
    bucket.ids.push(payment.id);
    paymentsByStatement.set(payment.forStatementId, bucket);
  }

  return settlements.map((settlement) => {
    const bucket = paymentsByStatement.get(settlement.statementId);
    return {
      statementId: settlement.statementId,
      date: settlement.date,
      pot: makePot(settlement.amountCents, bucket?.amounts ?? []),
      paymentIds: bucket?.ids ?? [],
    };
  });
};

/**
 * Jeder Gebühr ihre Zahlungen zuordnen (Soll vs. Ist)
 */
const buildFeeRows = (fees: AccountFee[], payments: Payment[]): FeeRow[] => {
  const feeIds = new Set(fees.map((fee) => fee.id));
  const paymentsByFee = new Map<string, { amounts: number[]; ids: string[] }>();
  for (const payment of payments) {
    if (!payment.forFeeId || !feeIds.has(payment.forFeeId)) {
      continue;
    }
    const bucket = paymentsByFee.get(payment.forFeeId) ?? {
      amounts: [],
      ids: [],
    };
    bucket.amounts.push(payment.amountCents ?? 0);
    bucket.ids.push(payment.id);
    paymentsByFee.set(payment.forFeeId, bucket);
  }

  return fees.map((fee) => {
    const bucket = paymentsByFee.get(fee.id);
    return {
      feeId: fee.id,
      date: fee.date,
      reason: fee.reason,
      pot: makePot(fee.amountCents, bucket?.amounts ?? []),
      paymentIds: bucket?.ids ?? [],
      updatedAt: fee.updatedAt,
    };
  });
};

/**
 * Ggegenüberstellen Soll-Kaution / Kautions-Zahlungen
 */
const buildDepositRow = (tenant: Tenant, payments: Payment[]): DepositRow => {
  const depositPayments = payments.filter((payment) => payment.forDeposit);
  return {
    pot: makePot(
      tenant.depositCents,
      depositPayments.map((payment) => payment.amountCents ?? 0),
    ),
    paymentIds: depositPayments.map((payment) => payment.id),
  };
};

/**
 * Summieren aller Töpfe (Ist - Soll) zu Gesamt- und Kautionssaldo
 */
const computeTenantBalance = (
  tenant: Tenant,
  rents: TenantRent[],
  payments: Payment[],
  settlements: AccountSettlement[],
  fees: AccountFee[],
  asOfDate: string,
): TenantBalanceResult => {
  const tenantEnd = tenant.endDate ?? asOfDate;
  const rangeEnd = minDate(tenantEnd, asOfDate);

  const monthRows = buildMonthRows(
    tenant,
    rents,
    payments,
    tenant.startDate,
    rangeEnd,
  );
  const settlementRows = buildSettlementRows(settlements, payments);
  const feeRows = buildFeeRows(fees, payments);
  const depositRow = buildDepositRow(tenant, payments);

  let balanceCents = 0;
  for (const row of monthRows) {
    balanceCents += row.baseRent.istCents - row.baseRent.sollCents;
    balanceCents += row.advance.istCents - row.advance.sollCents;
  }
  for (const row of settlementRows) {
    balanceCents += row.pot.istCents - row.pot.sollCents;
  }
  for (const row of feeRows) {
    balanceCents += row.pot.istCents - row.pot.sollCents;
  }

  const depositBalanceCents =
    depositRow.pot.istCents - depositRow.pot.sollCents;

  return { tenantId: tenant.id, asOfDate, balanceCents, depositBalanceCents };
};

/**
 * Gruppieren einer Zeilenliste nach `tenantId` für den Batch-Pfad
 */
const groupByTenant = <T extends { tenantId: string }>(
  rows: T[],
): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const list = grouped.get(row.tenantId) ?? [];
    list.push(row);
    grouped.set(row.tenantId, list);
  }

  return grouped;
};

/**
 * Mieterkonto-Service: stellt das Konto eines Mieters dar, was er schuldet
 * (Soll) gegen das, was er bezahlt hat (Ist).
 *
 * Jede Forderung und Zahlung gehört zu einem von vier Zahlungszwecken
 * Pro Forderung wird Soll und zugehöriges Ist zu einem Topf verrechnet,
 * dessen Differenz offen / ausgeglichen / Guthaben ergibt.
 *
 * Zahlungszwecke:
 * - Monat:      `tenantRents`        monatliche Kaltmiete + NK-Vorauszahlung
 * - Abrechnung: `accountSettlements` Nachzahlung/Guthaben aus einer NK-Abrechnung
 * - Kaution:    `tenants.depositCents`
 * - Gebühr:     `accountFees`        z.B. Mahngebühren
 *
 * Sperre: Sobald eine NK-Periode finalisiert ist, lassen sich Monats- und
 * Gebühren-Buchungen, die in diese Periode fallen, nicht mehr verändern
 */
@Injectable()
export class AccountsService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Monatsgitter eines Mieters: Soll/Ist je Monat für Kaltmiete + NK-Voraus
   */
  async getMonthGrid(
    tenantId: string,
    rangeStart: string,
    rangeEnd: string,
  ): Promise<MonthGridRow[]> {
    const tenant = await this.em.findOne(TenantSchema, { id: tenantId });
    if (!tenant) {
      throw new NotFoundException(notFoundMessage("tenant", tenantId));
    }

    const rents = await this.em.find(
      TenantRentSchema,
      { tenantId },
      { orderBy: { startDate: "asc" } },
    );

    const monthPayments = await this.em.find(PaymentSchema, {
      tenantId,
      forMonth: { $ne: null },
    });

    return buildMonthRows(tenant, rents, monthPayments, rangeStart, rangeEnd);
  }

  /**
   * Soll/Ist je NK-Abrechnungs-Buchung des Mieters
   */
  async getSettlementRows(tenantId: string): Promise<SettlementRow[]> {
    const settlements = await this.em.find(
      AccountSettlementSchema,
      { tenantId },
      { orderBy: { date: "asc" } },
    );

    if (settlements.length === 0) {
      return [];
    }

    const payments = await this.em.find(PaymentSchema, { tenantId });

    return buildSettlementRows(settlements, payments);
  }

  /**
   * Soll/Ist der Kaution des Mieters
   */
  async getDepositRow(tenantId: string): Promise<DepositRow> {
    const tenant = await this.em.findOne(TenantSchema, { id: tenantId });
    if (!tenant) {
      throw new NotFoundException(notFoundMessage("tenant", tenantId));
    }

    const payments = await this.em.find(PaymentSchema, {
      tenantId,
      forDeposit: true,
    });

    return buildDepositRow(tenant, payments);
  }

  /**
   * Soll/Ist je Gebühr des Mieters
   */
  async getFeeRows(tenantId: string): Promise<FeeRow[]> {
    const fees = await this.em.find(
      AccountFeeSchema,
      { tenantId },
      { orderBy: { date: "asc" } },
    );

    if (fees.length === 0) {
      return [];
    }

    const payments = await this.em.find(PaymentSchema, { tenantId });

    return buildFeeRows(fees, payments);
  }

  /**
   * Gesamtsaldo eines einzelnen Mieters zum Stichtag
   */
  async getTenantBalance(
    tenantId: string,
    asOfDate: string,
  ): Promise<TenantBalanceResult> {
    const tenant = await this.em.findOne(TenantSchema, { id: tenantId });
    if (!tenant) {
      throw new NotFoundException(notFoundMessage("tenant", tenantId));
    }

    const [rents, payments, settlements, fees] = await Promise.all([
      this.em.find(
        TenantRentSchema,
        { tenantId },
        { orderBy: { startDate: "asc" } },
      ),
      this.em.find(PaymentSchema, { tenantId }),
      this.em.find(
        AccountSettlementSchema,
        { tenantId },
        { orderBy: { date: "asc" } },
      ),
      this.em.find(
        AccountFeeSchema,
        { tenantId },
        { orderBy: { date: "asc" } },
      ),
    ]);

    return computeTenantBalance(
      tenant,
      rents,
      payments,
      settlements,
      fees,
      asOfDate,
    );
  }

  /**
   * Gesamtsaldo je Mieter, für alle Mieter
   */
  async getAllBalances(
    asOfDate: string,
    buildingId?: string,
  ): Promise<
    { tenantId: string; balanceCents: number; depositCents: number }[]
  > {
    let tenantsList: Tenant[];

    if (buildingId) {
      const units = await this.em.find(
        UnitSchema,
        { buildingId },
        { fields: ["id"] },
      );
      tenantsList = await this.em.find(TenantSchema, {
        unitId: { $in: units.map((unit) => unit.id) },
      });
    } else {
      tenantsList = await this.em.find(TenantSchema, {});
    }

    const tenantIds = tenantsList.map((tenant) => tenant.id);

    const [rents, payments, settlements, fees] = await Promise.all([
      this.em.find(
        TenantRentSchema,
        { tenantId: { $in: tenantIds } },
        { orderBy: { startDate: "asc" } },
      ),
      this.em.find(PaymentSchema, { tenantId: { $in: tenantIds } }),
      this.em.find(
        AccountSettlementSchema,
        { tenantId: { $in: tenantIds } },
        { orderBy: { date: "asc" } },
      ),
      this.em.find(
        AccountFeeSchema,
        { tenantId: { $in: tenantIds } },
        { orderBy: { date: "asc" } },
      ),
    ]);

    const rentsByTenant = groupByTenant(rents);
    const paymentsByTenant = groupByTenant(payments);
    const settlementsByTenant = groupByTenant(settlements);
    const feesByTenant = groupByTenant(fees);

    return tenantsList.map((tenant) => {
      const balance = computeTenantBalance(
        tenant,
        rentsByTenant.get(tenant.id) ?? [],
        paymentsByTenant.get(tenant.id) ?? [],
        settlementsByTenant.get(tenant.id) ?? [],
        feesByTenant.get(tenant.id) ?? [],
        asOfDate,
      );
      return {
        tenantId: tenant.id,
        balanceCents: balance.balanceCents,
        depositCents: balance.depositBalanceCents,
      };
    });
  }

  /**
   * Wie viel NK-Vorauszahlung der Mieter im Zeitraum tatsächlich gezahlt hat.
   * Summiert über alle Monats-Zahlungen, deren `forMonth` in den Zeitraum
   * fällt, den NK-Vorauszahlungs-Anteil (`advanceCents`). Wird von der
   * NK-Abrechnung gebraucht, um Soll-Voraus gegen Ist-Voraus zu stellen.
   */
  async getReceivedAdvancesForPeriod(
    tenantId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<number> {
    const months = enumerateMonths(periodStart, periodEnd);
    if (months.length === 0) {
      return 0;
    }

    const rows = await this.em.find(PaymentSchema, {
      tenantId,
      forMonth: { $gte: months[0] ?? "", $lte: months.at(-1) ?? "" },
    });

    let total = 0;
    for (const row of rows) {
      total += row.advanceCents ?? 0;
    }

    return total;
  }

  /**
   * Legt eine Gebühr an. Gutschriften (negativer Betrag) sind jederzeit
   * möglich. Forderungen dürfen nicht in eine finalisierte Periode fallen.
   */
  async createFee(dto: AccountFeeCreateDto) {
    if (dto.amountCents > 0) {
      await this.assertFeeMutable(dto.tenantId, dto.date);
    }

    const created = this.em.create(AccountFeeSchema, dto);
    this.em.persist(created);
    await this.em.flush();

    return created;
  }

  /**
   * Ändert eine Gebühr (Datum muss übereinstimmen)
   */
  async updateFee(id: string, dto: AccountFeeUpdateDto) {
    const existing = await this.em.findOne(AccountFeeSchema, { id });
    if (!existing) {
      throw new NotFoundException(notFoundMessage("payment", id));
    }

    await this.assertFeeMutable(existing.tenantId, existing.date);
    if (dto.date && dto.date !== existing.date) {
      await this.assertFeeMutable(existing.tenantId, dto.date);
    }

    this.em.assign(existing, { ...dto, updatedAt: new Date().toISOString() });
    await this.em.flush();

    return existing;
  }

  /**
   * Löscht eine Gebühr (gesperrt in finalisierter Periode)
   */
  async deleteFee(id: string) {
    const existing = await this.em.findOne(AccountFeeSchema, { id });
    if (!existing) {
      throw new NotFoundException(notFoundMessage("payment", id));
    }

    await this.assertFeeMutable(existing.tenantId, existing.date);
    this.em.remove(existing);
    await this.em.flush();

    return { id };
  }

  /**
   * Schreibt das Ergebnis einer NK-Abrechnung (Nachzahlung oder Guthaben) als
   * Forderung aufs Mieterkonto.
   *
   * @param em - Optionaler EntityManager (z.B. für Aufruf in Transaction)
   */
  async recordSettlement(
    tenantId: string,
    statementId: string,
    date: string,
    amountCents: number,
    em: EntityManager = this.em,
  ) {
    if (amountCents === 0) {
      return null;
    }

    const created = em.create(AccountSettlementSchema, {
      tenantId,
      statementId,
      date,
      amountCents,
    });
    em.persist(created);
    await em.flush();

    return created;
  }

  /**
   * Löscht Konto-Buchung(en) (falls vorhanden) einer Abrechnung, so dass
   * deren Forderung  wieder vom Mieterkonto verschwindet.
   *
   * @param em - Optionaler EntityManager (z.B. für Aufruf in Transaction)
   */
  async removeSettlementForStatement(
    statementId: string,
    em: EntityManager = this.em,
  ) {
    const settlements = await em.find(AccountSettlementSchema, {
      statementId,
    });

    for (const settlement of settlements) {
      em.remove(settlement);
    }

    await em.flush();
  }

  /**
   * Wirft, wenn das Datum in eine finalisierte Periode fällt
   */
  private async assertFeeMutable(tenantId: string, date: string) {
    await assertDateRangeNotFinalized(this.em, tenantId, date);
  }
}
