import type { ReactNode } from "react";
import type { Building } from "@/lib/buildings";
import { t } from "@/lib/i18n";
import { InfoCard } from "./InfoCard";

/**
 * "Auf einen Blick"-Karte der Infospalte auf Anlege-Seiten: das Gebäude,
 * für das der Datensatz entsteht. Statt der Bestandszahlen steht hier die
 * Adresse. Die Zahlen zeigt die Navigation bereits als Zähl-Badges, die
 * Adresse steht sonst nirgends und sichert bei ähnlich benannten Gebäuden
 * ab, dass der Datensatz im richtigen Haus landet.
 */
export const BuildingContextCard = ({
  building,
  extraRows = [],
}: {
  building: Building | undefined;

  /**
   * Zusätzliche Zeilen unter der Adresse, z.B. Kostenarten-Anzahl
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
        label: t("ui.common.columns.address"),
        value: building
          ? [
              building.addressStreet,
              `${building.addressPostalCode} ${building.addressCity}`,
            ].join(t("ui.common.separators.comma"))
          : t("ui.common.emptyValue"),
      },
      ...extraRows,
    ]}
  />
);
