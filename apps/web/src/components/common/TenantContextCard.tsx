import { formatName } from "@einfachvermieter/shared";
import { t } from "@/lib/i18n";
import type { TenantOverviewRow } from "@/lib/tenants";
import { InfoCard } from "./InfoCard";

/**
 * "Auf einen Blick"-Karte für mietergebundene Formulare (Zahlung, Gebühr):
 * Gebäude, Wohnung und Vertragspartner des Mietverhältnisses. Solange die
 * Daten laden, stehen Platzhalter in den Zeilen.
 */
export const TenantContextCard = ({
  tenant,
}: {
  tenant: TenantOverviewRow | undefined;
}) => (
  <InfoCard
    title={t("ui.common.infoCards.atAGlance")}
    rows={[
      {
        label: t("ui.buildings.title"),
        value: tenant?.buildingName ?? t("ui.common.emptyValue"),
      },
      {
        label: t("ui.common.columns.unit"),
        value: tenant?.unitName ?? t("ui.common.emptyValue"),
      },
      {
        label: t("ui.common.columns.tenant"),
        value:
          tenant && tenant.contractResidents.length > 0
            ? tenant.contractResidents
                .map((resident) =>
                  formatName(resident.firstName, resident.lastName),
                )
                .join(t("ui.common.separators.comma"))
            : t("ui.common.emptyValue"),
      },
    ]}
  />
);
