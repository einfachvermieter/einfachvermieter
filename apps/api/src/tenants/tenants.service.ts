import {
  type Building,
  BuildingSchema,
  OperatingCostStatementSchema,
  PaymentSchema,
  type Resident,
  ResidentSchema,
  type Tenant,
  type TenantAddress,
  TenantAddressSchema,
  type TenantBankAccount,
  TenantBankAccountSchema,
  type TenantRent,
  TenantRentSchema,
  type TenantResident,
  TenantResidentSchema,
  TenantSchema,
  type Unit,
  UnitSchema,
} from "@einfachvermieter/db";
import {
  daysBetween,
  enumerateMonths,
  maxDate,
  minDate,
  pad2,
  pad4,
  pickRentForDate,
  sumDegreeDays,
  type TenantResidentInput,
  type TenantSaveDto,
  todayIso,
} from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { getI18n } from "../i18n/i18n.registry.js";
import { notFoundMessage } from "../i18n/notFound.js";

/**
 * ISO-Datum (YYYY-MM-DD) um einen Tag erhoehen, UTC-basiert ohne
 * Zeitzonenverschiebung.
 */
const increaseOneDayIso = (iso: string): string => {
  const ms = Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
  );

  const next = new Date(ms + 86_400_000);

  return `${pad4(next.getUTCFullYear())}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
};

/**
 * Verschmilzt Belegungsintervalle einer Wohnung (Lücke <= 1 Tag gilt als
 * zusammenhängend) und summiert belegte Tage sowie Gradtag-Promille.
 */
const mergeOccupiedSpans = (
  intervals: [string, string][],
): { occupiedDays: number; occupiedDegreeDayPromille: number } => {
  const sorted = [...intervals].sort((a, b) => (a[0] < b[0] ? -1 : 1));

  let occupiedDays = 0;
  let occupiedDegreeDayPromille = 0;
  let curStart: string | null = null;
  let curEnd: string | null = null;

  const closeSpan = (spanStart: string, spanEnd: string): void => {
    occupiedDays += daysBetween(spanStart, spanEnd);
    occupiedDegreeDayPromille += sumDegreeDays({
      start: spanStart,
      end: spanEnd,
    });
  };

  for (const [start, end] of sorted) {
    if (curEnd === null || curStart === null) {
      curStart = start;
      curEnd = end;
      continue;
    }

    if (start <= increaseOneDayIso(curEnd)) {
      if (end > curEnd) {
        curEnd = end;
      }
    } else {
      closeSpan(curStart, curEnd);
      curStart = start;
      curEnd = end;
    }
  }

  if (curStart !== null && curEnd !== null) {
    closeSpan(curStart, curEnd);
  }

  return { occupiedDays, occupiedDegreeDayPromille };
};

/**
 * Stichtag für die "Snapshot"-Anzeige eines Mietvertrags: heute, wenn aktiv;
 * bei noch nicht begonnenen Verträgen Vertragsbeginn; bei abgelaufenen
 * Vertragsende
 */
const referenceDateFor = (
  tenantStart: string,
  tenantEnd: string | null,
  today: string,
): string => {
  if (tenantStart > today) {
    return tenantStart;
  }

  if (tenantEnd !== null && tenantEnd < today) {
    return tenantEnd;
  }

  return today;
};

/**
 * Prueft, ob ein Bewohner zum Stichtag praesent ist. Fehlende
 * moveIn/moveOut-Daten fallen auf den Vertragszeitraum zurueck (offenes
 * Ende = ferne Zukunft).
 */
const isPresent = (
  refDate: string,
  moveIn: string | null,
  moveOut: string | null,
  tenantStart: string,
  tenantEnd: string | null,
): boolean => {
  const effIn = moveIn ?? tenantStart;
  const effOut = moveOut ?? tenantEnd ?? "9999-12-31";

  return effIn <= refDate && effOut >= refDate;
};

export type TenantAggregate = {
  tenant: Tenant;
  residents: {
    tenantResidentId: string;
    residentId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    moveInDate: string | null;
    moveOutDate: string | null;
    isContractParty: boolean;
  }[];
  rents: TenantRent[];
  bankAccounts: TenantBankAccount[];
  addresses: TenantAddress[];
};

export type TenantSort =
  | "unit"
  | "building"
  | "kind"
  | "resident"
  | "term"
  | "rent"
  | "status"
  | "occupants";

export type TenantListParams = {
  buildingId?: string;
  page: number;
  pageSize: number;
  sort?: TenantSort;
  order?: "asc" | "desc";
  q?: string;
};

export type TenantOverviewRow = {
  id: string;
  unitId: string;
  unitName: string;
  buildingId: string;
  buildingName: string;
  kind: Tenant["kind"];
  startDate: string;
  endDate: string | null;
  contractResidents: { firstName: string; lastName: string }[];
  currentOccupants: number;
  currentRentCents: number | null;
  active: boolean;
};

export type TenantListResult = {
  items: TenantOverviewRow[];
  total: number;
};

type ComputedTenantRow = {
  row: TenantOverviewRow;
  residentSortKey: string;
};

type TenantRowContext = {
  unitById: Map<string, Unit>;
  buildingById: Map<string, Building>;
  residentById: Map<string, Resident>;
  linksByTenant: Map<string, TenantResident[]>;
  rentsByTenant: Map<string, TenantRent[]>;
  buildingId?: string;
  needle?: string;
  today: string;
};

/**
 * Leitet die Übersichtszeile eines Mietvertrags am vertragsindividuellen
 * Stichtag ab (aktuelle Miete, präsente Vertragspartner, Bewohnerzahl,
 * Sortierschlüssel). Liefert null, wenn der Tenant herausgefiltert wird
 * (fehlende Wohnung/Gebäude, Gebäudefilter, Freitextsuche ohne Treffer).
 */
const computeTenantRow = (
  tenant: Tenant,
  ctx: TenantRowContext,
): ComputedTenantRow | null => {
  const unit = ctx.unitById.get(tenant.unitId);
  if (!unit) {
    return null;
  }

  const building = ctx.buildingById.get(unit.buildingId);
  if (!building) {
    return null;
  }

  if (ctx.buildingId && unit.buildingId !== ctx.buildingId) {
    return null;
  }

  const tenantLinks = ctx.linksByTenant.get(tenant.id) ?? [];

  const { needle } = ctx;
  if (needle) {
    const matchesResident = tenantLinks.some((link) => {
      const resident = ctx.residentById.get(link.residentId);
      return (
        resident !== undefined &&
        (resident.firstName.toLowerCase().includes(needle) ||
          resident.lastName.toLowerCase().includes(needle))
      );
    });

    const matches =
      unit.name.toLowerCase().includes(needle) ||
      building.name.toLowerCase().includes(needle) ||
      matchesResident;

    if (!matches) {
      return null;
    }
  }

  const refDate = referenceDateFor(tenant.startDate, tenant.endDate, ctx.today);
  const presentContractParties = tenantLinks
    .filter(
      (link) =>
        link.isContractParty === 1 &&
        isPresent(
          refDate,
          link.moveInDate,
          link.moveOutDate,
          tenant.startDate,
          tenant.endDate,
        ),
    )
    .map((link) => {
      const resident = ctx.residentById.get(link.residentId);
      return {
        firstName: resident?.firstName ?? "",
        lastName: resident?.lastName ?? "",
      };
    })
    .sort(
      (a, b) =>
        a.lastName.toLowerCase().localeCompare(b.lastName.toLowerCase()) ||
        a.firstName.toLowerCase().localeCompare(b.firstName.toLowerCase()),
    );

  const currentOccupants = tenantLinks.filter((link) =>
    isPresent(
      refDate,
      link.moveInDate,
      link.moveOutDate,
      tenant.startDate,
      tenant.endDate,
    ),
  ).length;

  const currentRent = (ctx.rentsByTenant.get(tenant.id) ?? []).find(
    (rent) =>
      (rent.startDate === null || rent.startDate <= ctx.today) &&
      (rent.endDate === null || rent.endDate >= ctx.today),
  );

  const active =
    tenant.startDate <= ctx.today &&
    (tenant.endDate === null || tenant.endDate >= ctx.today);

  const [firstParty] = presentContractParties;
  const residentSortKey = firstParty
    ? `${firstParty.lastName.toLowerCase()} ${firstParty.firstName.toLowerCase()}`
    : "";

  return {
    residentSortKey,
    row: {
      id: tenant.id,
      unitId: tenant.unitId,
      unitName: unit.name,
      buildingId: unit.buildingId,
      buildingName: building.name,
      kind: tenant.kind,
      startDate: tenant.startDate,
      endDate: tenant.endDate,
      contractResidents: presentContractParties,
      currentOccupants,
      currentRentCents: currentRent?.monthlyBaseRentCents ?? null,
      active,
    },
  };
};

export type TenantLink = {
  tenantId: string;
  unitId: string;
  startDate: string;
  endDate: string | null;
  residentIds: string[];
};

@Injectable()
export class TenantsService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Paginierte, sortierbare Mieter-Übersicht, optional auf ein Gebäude gefiltert.
   * Die abgeleiteten Spalten (aktuelle Miete, präsente Vertragspartner,
   * Bewohnerzahl, Sortierschlüssel) hängen von einem mietvertrags-individuellen
   * Stichtag ab und werden portabel über alle Dialekte und bei kleinem
   * Datenvolumen im Speicher berechnet.
   *
   * @param params.q Freitextsuche in Wohnungs- und Gebäudename sowie Vor-/Nachname der Bewohner
   */
  async list(params: TenantListParams): Promise<TenantListResult> {
    const {
      buildingId,
      page,
      pageSize,
      sort = "term",
      order = "asc",
      q,
    } = params;
    const today = todayIso();

    const [tenants, units, buildings, residentLinks, residents, rents] =
      await Promise.all([
        this.em.find(TenantSchema, {}),
        this.em.find(UnitSchema, {}),
        this.em.find(BuildingSchema, {}),
        this.em.find(TenantResidentSchema, {}),
        this.em.find(ResidentSchema, {}),
        this.em.find(TenantRentSchema, {}, { orderBy: { startDate: "asc" } }),
      ]);

    const unitById = new Map(units.map((u) => [u.id, u]));
    const buildingById = new Map(buildings.map((b) => [b.id, b]));
    const residentById = new Map(residents.map((r) => [r.id, r]));
    const linksByTenant = new Map<string, typeof residentLinks>();

    for (const link of residentLinks) {
      const list = linksByTenant.get(link.tenantId) ?? [];
      list.push(link);
      linksByTenant.set(link.tenantId, list);
    }

    const rentsByTenant = new Map<string, TenantRent[]>();
    for (const rent of rents) {
      const list = rentsByTenant.get(rent.tenantId) ?? [];
      list.push(rent);
      rentsByTenant.set(rent.tenantId, list);
    }

    const needle = q?.toLowerCase();

    const rowContext: TenantRowContext = {
      unitById,
      buildingById,
      residentById,
      linksByTenant,
      rentsByTenant,
      buildingId,
      needle,
      today,
    };

    const computed: ComputedTenantRow[] = [];
    for (const tenant of tenants) {
      const entry = computeTenantRow(tenant, rowContext);
      if (entry) {
        computed.push(entry);
      }
    }

    const dir = order === "desc" ? -1 : 1;
    const sortKey = (entry: ComputedTenantRow): string | number => {
      const { row } = entry;
      switch (sort) {
        case "unit":
          return row.unitName.toLowerCase();
        case "building":
          return row.buildingName.toLowerCase();
        case "kind":
          return row.kind;
        case "resident":
          return entry.residentSortKey;
        case "rent":
          return row.currentRentCents ?? -1;
        case "status":
          return row.active ? 1 : 0;
        case "occupants":
          return row.currentOccupants;
        default:
          return row.startDate;
      }
    };

    computed.sort((a, b) => {
      const ka = sortKey(a);
      const kb = sortKey(b);
      let primary = 0;
      if (typeof ka === "number" && typeof kb === "number") {
        primary = ka - kb;
      } else {
        primary = String(ka).localeCompare(String(kb));
      }
      if (primary !== 0) {
        return primary * dir;
      }
      return a.row.id.localeCompare(b.row.id);
    });

    const total = computed.length;
    const items = computed
      .slice(page * pageSize, page * pageSize + pageSize)
      .map((entry) => entry.row);

    return { items, total };
  }

  /**
   * Schlanke Verknuepfungsliste aller Mietvertraege mit ihren Bewohner-Ids.
   * Fuer Stellen, die nur die Zuordnung, nicht die vollen Aggregate brauchen.
   */
  async listLinks(): Promise<TenantLink[]> {
    const tenantRows = await this.em.find(
      TenantSchema,
      {},
      { orderBy: { startDate: "asc" } },
    );
    if (tenantRows.length === 0) {
      return [];
    }

    const links = await this.em.find(
      TenantResidentSchema,
      {},
      { fields: ["tenantId", "residentId"] },
    );

    const residentsByTenant = new Map<string, string[]>();
    for (const link of links) {
      const list = residentsByTenant.get(link.tenantId) ?? [];
      list.push(link.residentId);
      residentsByTenant.set(link.tenantId, list);
    }

    return tenantRows.map((row) => ({
      tenantId: row.id,
      unitId: row.unitId,
      startDate: row.startDate,
      endDate: row.endDate,
      residentIds: residentsByTenant.get(row.id) ?? [],
    }));
  }

  /**
   * Alle Mietvertraege einer Wohnung samt Bewohnern, Mieten, Bankverbindungen
   * und Adressen laden
   */
  async listByUnit(unitId: string): Promise<TenantAggregate[]> {
    const tenants = await this.em.find(
      TenantSchema,
      { unitId },
      { orderBy: { startDate: "asc" } },
    );

    return this.hydrate(this.em, tenants);
  }

  /**
   * Reichert eine Menge geladener Mietvertraege in moeglichst wenigen Queries
   * mit ihren Detaildaten an (Bewohner-Links + aufgeloeste Residents, Mieten,
   * Bankverbindungen, Adressen) und baut die TenantAggregate-Struktur.
   */
  private async hydrate(
    em: EntityManager,
    tenants: Tenant[],
  ): Promise<TenantAggregate[]> {
    if (tenants.length === 0) {
      return [];
    }

    const tenantIds = tenants.map((tenant) => tenant.id);
    const [links, rents, banks, addresses] = await Promise.all([
      em.find(TenantResidentSchema, { tenantId: { $in: tenantIds } }),
      em.find(
        TenantRentSchema,
        { tenantId: { $in: tenantIds } },
        { orderBy: { startDate: "asc" } },
      ),
      em.find(
        TenantBankAccountSchema,
        { tenantId: { $in: tenantIds } },
        { orderBy: { startDate: "asc" } },
      ),
      em.find(
        TenantAddressSchema,
        { tenantId: { $in: tenantIds } },
        { orderBy: { startDate: "asc" } },
      ),
    ]);

    const residentIds = [...new Set(links.map((link) => link.residentId))];
    const residents = await em.find(ResidentSchema, {
      id: { $in: residentIds },
    });

    const residentById = new Map(residents.map((r) => [r.id, r]));
    return tenants.map((tenant) => ({
      tenant,
      residents: links
        .filter((link) => link.tenantId === tenant.id)
        .map((link) => {
          const resident = residentById.get(link.residentId);
          return {
            tenantResidentId: link.id,
            residentId: link.residentId,
            firstName: resident?.firstName ?? "",
            lastName: resident?.lastName ?? "",
            email: resident?.email ?? null,
            phone: resident?.phone ?? null,
            moveInDate: link.moveInDate,
            moveOutDate: link.moveOutDate,
            isContractParty: link.isContractParty === 1,
          };
        }),
      rents: rents.filter((rent) => rent.tenantId === tenant.id),
      bankAccounts: banks.filter((bank) => bank.tenantId === tenant.id),
      addresses: addresses.filter((addr) => addr.tenantId === tenant.id),
    }));
  }

  /**
   * Einzelnen Mietvertrag als vollstaendiges Aggregate laden
   */
  async getAggregate(id: string): Promise<TenantAggregate> {
    const tenant = await this.em.findOne(TenantSchema, { id });
    if (!tenant) {
      throw new NotFoundException(notFoundMessage("tenant", id));
    }

    const [aggregate] = await this.hydrate(this.em, [tenant]);
    if (!aggregate) {
      throw new NotFoundException(notFoundMessage("tenant", id));
    }

    return aggregate;
  }

  /**
   * Neuen Mietvertrag anlegen. Stellt vorab sicher, dass sich der Zeitraum
   * nicht mit einem bestehenden Vertrag derselben Wohnung ueberschneidet.
   */
  async create(dto: TenantSaveDto) {
    await this.assertNoOverlap(dto.unitId, dto.startDate, dto.endDate ?? null);

    return this.em.transactional((em) => this.persist(em, null, dto));
  }

  /**
   * Bestehenden Mietvertrag aktualisieren, inklusive Ueberlappungspruefung
   */
  async update(id: string, dto: TenantSaveDto) {
    const existing = await this.em.findOne(TenantSchema, { id });
    if (!existing) {
      throw new NotFoundException(notFoundMessage("tenant", id));
    }

    await this.assertNoOverlap(
      dto.unitId,
      dto.startDate,
      dto.endDate ?? null,
      id,
    );

    return this.em.transactional((em) => this.persist(em, id, dto));
  }

  /**
   * Mietvertrag loeschen.
   * Vertraege mit gebuchten Zahlungen oder Abrechnungen sind nicht loeschbar.
   * Buchungshistorie und Abrechnungs-Snapshots blieben sonst verwaist.
   */
  async delete(id: string) {
    const tenant = await this.em.findOne(TenantSchema, { id });
    if (!tenant) {
      throw new NotFoundException(notFoundMessage("tenant", id));
    }

    const paymentCount = await this.em.count(PaymentSchema, { tenantId: id });
    if (paymentCount > 0) {
      throw new BadRequestException(getI18n().t("errors.tenantHasPayments"));
    }

    const statementCount = await this.em.count(OperatingCostStatementSchema, {
      tenantId: id,
    });
    if (statementCount > 0) {
      throw new BadRequestException(getI18n().t("errors.tenantHasStatements"));
    }

    this.em.remove(tenant);
    await this.em.flush();

    return tenant;
  }

  /**
   * Zentrale Speicher-Routine in einer Transaktion: Tenant + tenantResidents
   * + tenantRents + tenantBankAccounts + tenantAddresses.
   */
  private async persist(
    em: EntityManager,
    existingTenantId: string | null,
    dto: TenantSaveDto,
  ): Promise<TenantAggregate> {
    const now = new Date().toISOString();
    const tenantId = await this.upsertTenantCore(
      em,
      existingTenantId,
      dto,
      now,
    );

    await this.syncResidents(em, tenantId, dto, now);
    await this.syncRents(em, tenantId, existingTenantId, dto);

    await em.nativeDelete(TenantBankAccountSchema, { tenantId });

    for (const b of dto.bankAccounts) {
      em.persist(
        em.create(TenantBankAccountSchema, {
          tenantId,
          startDate: b.startDate ?? null,
          endDate: b.endDate ?? null,
          iban: b.iban,
          bic: b.bic ?? null,
          accountHolder: b.accountHolder,
          mandateReference: b.mandateReference ?? null,
          mandateSignedAt: b.mandateSignedAt ?? null,
        }),
      );
    }

    await em.nativeDelete(TenantAddressSchema, { tenantId });
    for (const a of dto.addresses) {
      em.persist(
        em.create(TenantAddressSchema, {
          tenantId,
          startDate: a.startDate ?? null,
          endDate: a.endDate ?? null,
          street: a.street,
          postalCode: a.postalCode,
          city: a.city,
        }),
      );
    }

    await em.flush();

    const [aggregate] = await this.hydrate(em, [
      await em.findOneOrFail(TenantSchema, { id: tenantId }),
    ]);
    if (!aggregate) {
      throw new NotFoundException(notFoundMessage("tenant", tenantId));
    }

    return aggregate;
  }

  /**
   * Tenant-Stammsatz anlegen oder aktualisieren
   *
   * @returns Tenant-ID
   */
  private async upsertTenantCore(
    em: EntityManager,
    existingTenantId: string | null,
    dto: TenantSaveDto,
    now: string,
  ): Promise<string> {
    if (existingTenantId) {
      const tenant = await em.findOne(TenantSchema, { id: existingTenantId });
      if (!tenant) {
        throw new NotFoundException(
          notFoundMessage("tenant", existingTenantId),
        );
      }

      em.assign(tenant, {
        unitId: dto.unitId,
        kind: dto.kind,
        startDate: dto.startDate,
        endDate: dto.endDate ?? null,
        depositCents: dto.depositCents,
        notes: dto.notes ?? null,
        updatedAt: now,
      });

      await em.flush();
      return existingTenantId;
    }

    const tenant = em.create(TenantSchema, {
      unitId: dto.unitId,
      kind: dto.kind,
      startDate: dto.startDate,
      endDate: dto.endDate ?? null,
      depositCents: dto.depositCents,
      notes: dto.notes ?? null,
    });

    em.persist(tenant);
    await em.flush();

    return tenant.id;
  }

  /**
   * Bewohner-Verknüpfungen per Set-Semantik abgleichen: anlegen, ändern oder
   * löschen, je nachdem ob sie im Aggregatezustand noch vorkommen.
   */
  private async syncResidents(
    em: EntityManager,
    tenantId: string,
    dto: TenantSaveDto,
    now: string,
  ): Promise<void> {
    const existingLinks = await em.find(TenantResidentSchema, { tenantId });
    const incomingResidentIds = new Set<string>();

    for (const row of dto.residents) {
      const residentId = await this.upsertResident(em, row);
      incomingResidentIds.add(residentId);

      const existingLink = existingLinks.find(
        (link) => link.residentId === residentId,
      );

      if (existingLink) {
        em.assign(existingLink, {
          moveInDate: row.moveInDate ?? null,
          moveOutDate: row.moveOutDate ?? null,
          isContractParty: row.isContractParty ? 1 : 0,
          updatedAt: now,
        });
      } else {
        em.persist(
          em.create(TenantResidentSchema, {
            tenantId,
            residentId,
            moveInDate: row.moveInDate ?? null,
            moveOutDate: row.moveOutDate ?? null,
            isContractParty: row.isContractParty ? 1 : 0,
          }),
        );
      }
    }

    for (const link of existingLinks) {
      if (!incomingResidentIds.has(link.residentId)) {
        em.remove(link);
      }
    }
  }

  /**
   * Mietsätze ersetzen (delete+insert). Bei bestehenden Verträgen vorher
   * sicherstellen, dass kein in einer finalisierten Periode wirksamer Satz
   * verändert wird.
   */
  private async syncRents(
    em: EntityManager,
    tenantId: string,
    existingTenantId: string | null,
    dto: TenantSaveDto,
  ): Promise<void> {
    if (existingTenantId) {
      await this.assertRentsNotFinalized(em, existingTenantId, dto);
    }

    await em.nativeDelete(TenantRentSchema, { tenantId });

    for (const r of dto.rents) {
      em.persist(
        em.create(TenantRentSchema, {
          tenantId,
          startDate: r.startDate ?? null,
          endDate: r.endDate ?? null,
          monthlyBaseRentCents: r.monthlyBaseRentCents,
          monthlyAdvanceCents: r.monthlyAdvanceCents,
          reductionReason: r.reductionReason ?? null,
        }),
      );
    }
  }

  /**
   * Wirft, wenn ein für eine finalisierte Abrechnungsperiode wirksamer
   * Mietsatz (Grund- oder Vorauszahlungsbetrag) geändert würde.
   */
  private async assertRentsNotFinalized(
    em: EntityManager,
    existingTenantId: string,
    dto: TenantSaveDto,
  ): Promise<void> {
    const previousRents = await em.find(TenantRentSchema, {
      tenantId: existingTenantId,
    });

    const finalizedPeriods = await em.find(OperatingCostStatementSchema, {
      tenantId: existingTenantId,
      status: "finalized",
    });

    const incomingRents = dto.rents.map((r) => ({
      startDate: r.startDate ?? null,
      endDate: r.endDate ?? null,
      monthlyBaseRentCents: r.monthlyBaseRentCents,
      monthlyAdvanceCents: r.monthlyAdvanceCents,
    }));

    for (const period of finalizedPeriods) {
      const monthsToCheck = enumerateMonths(
        period.periodStart,
        period.periodEnd,
        { as: "ymStart" },
      );

      for (const monthStart of monthsToCheck) {
        const previousRent = pickRentForDate(previousRents, monthStart);
        const incomingRent = pickRentForDate(incomingRents, monthStart);

        if (
          (previousRent?.monthlyBaseRentCents ?? 0) !==
            (incomingRent?.monthlyBaseRentCents ?? 0) ||
          (previousRent?.monthlyAdvanceCents ?? 0) !==
            (incomingRent?.monthlyAdvanceCents ?? 0)
        ) {
          throw new BadRequestException(
            getI18n().t("errors.paymentFinalizedImmutable"),
          );
        }
      }
    }
  }

  /**
   * Bewohner anlegen oder aktualisieren
   */
  private async upsertResident(
    em: EntityManager,
    row: TenantResidentInput,
  ): Promise<string> {
    const now = new Date().toISOString();

    if (row.residentId) {
      const current = await em.findOne(ResidentSchema, { id: row.residentId });
      if (!current) {
        throw new NotFoundException(
          notFoundMessage("resident", row.residentId),
        );
      }

      em.assign(current, {
        firstName: row.resident.firstName,
        lastName: row.resident.lastName,
        email: row.resident.email ?? null,
        phone: row.resident.phone ?? null,
        updatedAt: now,
      });
      return row.residentId;
    }

    const created = em.create(ResidentSchema, {
      firstName: row.resident.firstName,
      lastName: row.resident.lastName,
      email: row.resident.email ?? null,
      phone: row.resident.phone ?? null,
    });

    em.persist(created);
    await em.flush();

    return created.id;
  }

  /**
   * Bewohneranzahl je Wohnung im Abrechnungszeitraum (Überlappung der
   * moveIn/moveOut-Fenster, Fallback auf den Vertragszeitraum).
   */
  async getOccupantCountPerUnit(
    buildingId: string,
    period: { start: string; end: string },
  ): Promise<Map<string, number>> {
    const { residentRows } = await this.loadBuildingOccupancyRows(buildingId);

    const byUnit = new Map<string, Set<string>>();
    for (const row of residentRows) {
      const tenantEnd = row.tenantEnd ?? "9999-12-31";
      if (!(row.tenantStart <= period.end && tenantEnd >= period.start)) {
        continue;
      }

      const moveIn = row.moveIn ?? row.tenantStart;
      const moveOut = row.moveOut ?? tenantEnd;
      if (!(moveIn <= period.end && moveOut >= period.start)) {
        continue;
      }

      const residents = byUnit.get(row.unitId) ?? new Set<string>();
      residents.add(row.residentId);
      byUnit.set(row.unitId, residents);
    }

    return new Map(
      Array.from(byUnit, ([unitId, residents]) => [unitId, residents.size]),
    );
  }

  /**
   * Zeitanteilige Belegungs-Kennzahlen pro Wohnung in der Periode
   * (personDays, occupiedDays, Gradtag-Promille, residentSpans)
   */
  async getOccupancyDaysPerUnit(
    buildingId: string,
    period: { start: string; end: string },
  ): Promise<
    Map<
      string,
      {
        personDays: number;
        occupiedDays: number;
        occupiedDegreeDayPromille: number;
        occupantCount: number;
        residentSpans: Array<{
          residentId: string;
          from: string;
          to: string;
          days: number;
        }>;
      }
    >
  > {
    const { residentRows, tenantRows } =
      await this.loadBuildingOccupancyRows(buildingId);

    type Acc = {
      personDays: number;
      occupiedDays: number;
      occupiedDegreeDayPromille: number;
      occupantCount: number;
      residentSpans: {
        residentId: string;
        from: string;
        to: string;
        days: number;
      }[];
    };
    const result = new Map<string, Acc>();
    const initAcc = (): Acc => ({
      personDays: 0,
      occupiedDays: 0,
      occupiedDegreeDayPromille: 0,
      occupantCount: 0,
      residentSpans: [],
    });

    for (const row of residentRows) {
      const tenantEnd = row.tenantEnd ?? "9999-12-31";
      const moveIn = row.moveIn ?? row.tenantStart;
      const moveOut = row.moveOut ?? tenantEnd;
      const start = maxDate(period.start, row.tenantStart, moveIn);
      const end = minDate(period.end, tenantEnd, moveOut);
      if (start > end) {
        continue;
      }

      const days = daysBetween(start, end);

      const acc = result.get(row.unitId) ?? initAcc();
      acc.personDays += days;
      acc.residentSpans.push({
        residentId: row.residentId,
        from: start,
        to: end,
        days,
      });

      result.set(row.unitId, acc);
    }

    for (const acc of result.values()) {
      acc.occupantCount = new Set(
        acc.residentSpans.map((s) => s.residentId),
      ).size;
      acc.residentSpans.sort((a, b) => {
        if (a.from < b.from) {
          return -1;
        }
        return a.from > b.from ? 1 : 0;
      });
    }

    const intervalsByUnit = new Map<string, [string, string][]>();
    for (const row of tenantRows) {
      const tenantEnd = row.tenantEnd ?? "9999-12-31";
      const start = maxDate(period.start, row.tenantStart);
      const end = minDate(period.end, tenantEnd);
      if (start > end) {
        continue;
      }

      const arr = intervalsByUnit.get(row.unitId) ?? [];
      arr.push([start, end]);
      intervalsByUnit.set(row.unitId, arr);
    }

    for (const [unitId, intervals] of intervalsByUnit) {
      const { occupiedDays, occupiedDegreeDayPromille } =
        mergeOccupiedSpans(intervals);
      const acc = result.get(unitId) ?? initAcc();
      acc.occupiedDays = occupiedDays;
      acc.occupiedDegreeDayPromille = occupiedDegreeDayPromille;

      result.set(unitId, acc);
    }

    return result;
  }

  /**
   * Lädt die Belegungs-Rohdaten eines Gebäudes (Residents-Spans + Tenant-Intervalle).
   */
  private async loadBuildingOccupancyRows(buildingId: string) {
    const units = await this.em.find(
      UnitSchema,
      { buildingId },
      { fields: ["id"] },
    );

    const unitIds = units.map((unit) => unit.id);
    const tenants = await this.em.find(TenantSchema, {
      unitId: { $in: unitIds },
    });
    const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));
    const links = await this.em.find(TenantResidentSchema, {
      tenantId: { $in: tenants.map((tenant) => tenant.id) },
    });

    const residentRows = links.flatMap((link) => {
      const tenant = tenantById.get(link.tenantId);
      if (!tenant) {
        return [];
      }
      return [
        {
          unitId: tenant.unitId,
          residentId: link.residentId,
          tenantId: tenant.id,
          tenantStart: tenant.startDate,
          tenantEnd: tenant.endDate,
          moveIn: link.moveInDate,
          moveOut: link.moveOutDate,
        },
      ];
    });

    const tenantRows = tenants.map((tenant) => ({
      unitId: tenant.unitId,
      tenantStart: tenant.startDate,
      tenantEnd: tenant.endDate,
    }));

    return { residentRows, tenantRows };
  }

  /**
   * Pro Unit darf zu keinem Zeitpunkt mehr als ein Tenant aktiv sein.
   */
  private async assertNoOverlap(
    unitId: string,
    startDate: string,
    endDate: string | null,
    excludeTenantId?: string,
  ) {
    const existing = await this.em.find(TenantSchema, { unitId });

    for (const t of existing) {
      if (excludeTenantId && t.id === excludeTenantId) {
        continue;
      }

      const tEnd = t.endDate ?? "9999-12-31";
      const nEnd = endDate ?? "9999-12-31";

      if (startDate <= tEnd && t.startDate <= nEnd) {
        const i18n = getI18n();
        throw new BadRequestException(
          i18n.t("errors.tenantOverlapsExisting", {
            id: t.id,
            start: t.startDate,
            end: t.endDate ?? i18n.t("errors.tenantOpenEnd"),
          }),
        );
      }
    }
  }
}
