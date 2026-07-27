import type { Resident, Tenant, TenantResident } from "@einfachvermieter/db";

/**
 * Stichtag für die "Snapshot"-Anzeige eines Mietvertrags: heute, wenn aktiv;
 * bei noch nicht begonnenen Verträgen Vertragsbeginn; bei abgelaufenen
 * Vertragsende
 */
export const referenceDateFor = (
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
 * moveIn/moveOut-Daten fallen auf den Vertragszeitraum zurueck
 */
export const isPresent = (
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

export type UnitOccupancy = {
  status: "rented" | "vacant" | "vacant_from" | "owner";
  /**
   * Vertragsende des aktuellen Vertrags, wenn Status vacant_from
   */
  vacantFrom: string | null;
  tenantId: string | null;
  /**
   * Vertragspartner des aktuellen Vertrags ("Vorname Nachname")
   */
  tenantNames: string[];
};

/**
 * Belegung einer Wohnung zum Stichtag heute:
 * aktueller Vertrag = startDate <= heute und (endDate leer oder >= heute);
 * vacant_from, wenn der aktuelle Vertrag ein endDate hat und kein
 * Folgevertrag existiert.
 */
export const deriveUnitOccupancy = (
  unitTenants: Tenant[],
  linksByTenant: Map<string, TenantResident[]>,
  residentById: Map<string, Resident>,
  today: string,
): UnitOccupancy => {
  const current = unitTenants.find(
    (tenant) =>
      tenant.startDate <= today &&
      (tenant.endDate === null || tenant.endDate >= today),
  );

  if (!current) {
    return {
      status: "vacant",
      vacantFrom: null,
      tenantId: null,
      tenantNames: [],
    };
  }

  const refDate = referenceDateFor(current.startDate, current.endDate, today);
  const tenantNames = (linksByTenant.get(current.id) ?? [])
    .filter(
      (link) =>
        link.isContractParty === 1 &&
        isPresent(
          refDate,
          link.moveInDate,
          link.moveOutDate,
          current.startDate,
          current.endDate,
        ),
    )
    .map((link) => {
      const resident = residentById.get(link.residentId);
      return resident
        ? `${resident.firstName} ${resident.lastName}`.trim()
        : "";
    })
    .filter((name) => name.length > 0)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const currentEnd = current.endDate;
  let status: UnitOccupancy["status"] = "rented";
  let vacantFrom: string | null = null;
  if (current.kind === "owner") {
    status = "owner";
  } else if (currentEnd !== null) {
    const hasSuccessor = unitTenants.some(
      (tenant) => tenant.startDate > currentEnd,
    );
    if (!hasSuccessor) {
      status = "vacant_from";
      vacantFrom = currentEnd;
    }
  }

  return {
    status,
    vacantFrom,
    tenantId: current.id,
    tenantNames,
  };
};
