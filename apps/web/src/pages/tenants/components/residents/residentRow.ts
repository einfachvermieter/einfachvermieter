import {
  formatName,
  type TenantFormValues,
  tenantFormSchema,
  todayIso,
} from "@einfachvermieter/shared";

export type ResidentRowValues = TenantFormValues["residents"][number];

export const residentRowSchema = tenantFormSchema.shape.residents.element;

export const emptyResidentRow = (): ResidentRowValues => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  moveInDate: "",
  moveOutDate: "",
  isContractParty: true,
});

/**
 * Sort-Reihenfolge für die Bewohner-Anzeige im Formular:
 * 1. Vertragspartner vor Mitbewohner
 * 2. Aktiv (heute im Vertragszeitraum) vor inaktiv
 * 3. Spätestes (oder fehlendes) Auszugsdatum zuerst
 * 4. Spätestes (oder fehlendes) Einzugsdatum zuerst
 * 5. Alphabetisch nach Vorname Nachname
 *
 * Liefert eine Liste der Original-Indizes in der Anzeige-Reihenfolge.
 */
export const buildResidentSortIndex = (
  residents: ResidentRowValues[],
  tenantStartDate: string,
  tenantEndDate: string,
): number[] => {
  const today = todayIso();
  const isActive = (r: ResidentRowValues) => {
    const start = r.moveInDate || tenantStartDate;
    const end = r.moveOutDate || tenantEndDate;
    if (start && start > today) {
      return false;
    }
    if (end && end < today) {
      return false;
    }
    return Boolean(start);
  };

  // "Später oder kein Datum" -> leerer String wird höher sortiert als jedes
  // gefüllte ISO-Datum (Sentinel "9999-12-31").
  const sentinelHigh = (value: string) => value || "9999-12-31";

  return residents
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      // 1. Vertragspartner zuerst
      if (a.row.isContractParty !== b.row.isContractParty) {
        return a.row.isContractParty ? -1 : 1;
      }

      // 2. Aktiv zuerst
      const aActive = isActive(a.row);
      const bActive = isActive(b.row);
      if (aActive !== bActive) {
        return aActive ? -1 : 1;
      }

      // 3. Spätestes (oder fehlendes) Auszugsdatum zuerst
      const aOut = sentinelHigh(a.row.moveOutDate);
      const bOut = sentinelHigh(b.row.moveOutDate);
      if (aOut !== bOut) {
        return aOut > bOut ? -1 : 1;
      }

      // 4. Spätestes (oder fehlendes) Einzugsdatum zuerst
      const aIn = sentinelHigh(a.row.moveInDate);
      const bIn = sentinelHigh(b.row.moveInDate);
      if (aIn !== bIn) {
        return aIn > bIn ? -1 : 1;
      }

      // 5. Alphabetisch Vorname Nachname
      const aName = formatName(a.row.firstName, a.row.lastName);
      const bName = formatName(b.row.firstName, b.row.lastName);
      return aName.localeCompare(bName, "de");
    })
    .map((entry) => entry.index);
};
