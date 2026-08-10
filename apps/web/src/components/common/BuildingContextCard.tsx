import type { ReactNode } from "react";
import type { Building } from "@/lib/buildings";
import { t } from "@/lib/i18n";
import { InfoCard } from "./InfoCard";

/**
 * "Auf einen Blick"-Karte der Infospalte auf Anlege-Seiten: das Gebäude,
 * für das der Datensatz entsteht, samt Bestandszahlen. Solange die Daten
 * laden, stehen Platzhalter in den Zeilen.
 */
export const BuildingContextCard = ({
  building,
  extraRows = [],
}: {
  building: Building | undefined;

  /**
   * Zusätzliche Zeilen unter den Gebäude-Zahlen, z.B. Kostenarten-Anzahl
   */
  extraRows?: { label: string; value: ReactNode }[];
}) => (
  <InfoCard
    title={t("ui.common.infoCards.atAGlance")}
    rows={[
      {
        label: t("ui.buildings.title"),
        value: building?.name ?? t("ui.common.emptyValue"),
      },
      {
        label: t("ui.navigation.units"),
        value: building?.unitsCount ?? t("ui.common.emptyValue"),
      },
      {
        label: t("ui.navigation.tenants"),
        value: building?.activeTenantsCount ?? t("ui.common.emptyValue"),
      },
      ...extraRows,
    ]}
  />
);
