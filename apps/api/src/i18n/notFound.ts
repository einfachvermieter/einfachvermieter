import { getI18n } from "./i18n.registry.js";

type EntityKey =
  | "building"
  | "unit"
  | "tenant"
  | "resident"
  | "meter"
  | "reading"
  | "payment"
  | "statement"
  | "costType"
  | "costEntry"
  | "costEntryAttachment"
  | "externalHeatingEntry"
  | "heatingSettings";

/**
 * Baut eine lokalisierte "nicht gefunden"-Meldung fuer eine Entitaet auf,
 * inklusive uebersetztem Entitaetsnamen und der gesuchten Id
 */
export const notFoundMessage = (entity: EntityKey, id: string): string => {
  const i18n = getI18n();
  return i18n.t("errors.notFound", {
    // Die Entitätsnamen liegen als { one, other }-Objekt vor (kein
    // i18next-Plural), deshalb die Singularform direkt lesen.
    entity: i18n.t(`entities.${entity}.one`),
    id,
  });
};
