import { ResultRows } from "@/components/common/ResultRows";
import { SectionAction } from "@/components/common/SectionAction";
import { SectionCard } from "@/components/common/SectionCard";
import type { Building } from "../../../lib/buildings";
import { domainVisuals } from "../../../lib/domainVisuals";
import { t } from "../../../lib/i18n";

/**
 * View-Card der Gebäude-Stammdaten
 */
export const BuildingBaseCard = ({
  building,
  onEdit,
}: {
  building: Building;
  onEdit: () => void;
}) => (
  <SectionCard
    icon={domainVisuals.buildings.icon}
    title={t("ui.buildings.sections.baseData.title")}
    action={
      <SectionAction
        kind="edit"
        label={t("ui.common.action.edit")}
        onClick={onEdit}
      />
    }
  >
    <ResultRows
      rows={[
        { label: t("ui.buildings.fields.name"), value: building.name },
        {
          label: t("ui.buildings.fields.street"),
          value: building.addressStreet,
        },
        {
          label: t("ui.buildings.fields.postalCode"),
          value: building.addressPostalCode,
        },
        { label: t("ui.buildings.fields.city"), value: building.addressCity },
      ]}
    />
  </SectionCard>
);
