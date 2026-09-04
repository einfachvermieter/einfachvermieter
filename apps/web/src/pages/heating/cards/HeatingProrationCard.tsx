import type { HeatingSettings } from "@einfachvermieter/shared";
import { RiCalendarLine, RiPencilLine } from "@remixicon/react";
import { ResultRows } from "@/components/common/ResultRows";
import { SectionCard } from "@/components/common/SectionCard";
import { Button } from "@/components/ui/Button";
import { t } from "../../../lib/i18n";
import { HeatingProrationChart } from "../components/settings/HeatingProrationChart";

/**
 * View-Card der zeitlichen Aufteilung: nach welchem Verfahren ein
 * angebrochener Zeitraum bei Mieter- oder Leerstandswechsel aufgeteilt wird
 */
export const HeatingProrationCard = ({
  version,
  onEdit,
}: {
  version: HeatingSettings;
  onEdit: () => void;
}) => (
  <SectionCard
    icon={RiCalendarLine}
    title={t("ui.heating.cards.proration")}
    action={
      <Button type="button" variant="addLink" size="text" onClick={onEdit}>
        <RiPencilLine />
        {t("ui.common.action.edit")}
      </Button>
    }
  >
    <ResultRows
      rows={[
        {
          label: t("ui.heating.detail.prorationMethodRow"),
          value: t(`ui.heating.prorationMethods.${version.prorationMethod}`),
        },
      ]}
    />
    <HeatingProrationChart method={version.prorationMethod} />
  </SectionCard>
);
