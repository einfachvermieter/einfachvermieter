import { RiPencilLine } from "@remixicon/react";
import { ResultRows } from "@/components/common/ResultRows";
import { SectionCard } from "@/components/common/SectionCard";
import { Button } from "@/components/ui/Button";
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
      <Button type="button" variant="addLink" size="text" onClick={onEdit}>
        <RiPencilLine />
        {t("ui.common.action.edit")}
      </Button>
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
