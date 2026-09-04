import { formatEur } from "@einfachvermieter/shared";
import { RiKey2Line, RiPencilLine } from "@remixicon/react";
import { ResultRows } from "@/components/common/ResultRows";
import { SectionCard } from "@/components/common/SectionCard";
import { Button } from "@/components/ui/Button";
import { formatPeriod } from "../../../lib/format";
import { t } from "../../../lib/i18n";
import { type Tenant, tenantKindLabel } from "../../../lib/tenants";
import type { Unit } from "../../../lib/units";

/**
 * View-Card der Vertragsdaten; Bearbeiten öffnet das Vertrags-Sheet
 */
export const TenantContractCard = ({
  tenant,
  unit,
  onEdit,
}: {
  tenant: Tenant;
  unit: Unit | undefined;
  onEdit: () => void;
}) => (
  <SectionCard
    icon={RiKey2Line}
    title={t("ui.tenant.sections.contract.title")}
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
          label: t("ui.tenant.fields.unit"),
          value: unit?.name ?? t("ui.common.emptyValue"),
        },
        {
          label: t("ui.tenant.fields.kind"),
          value: tenantKindLabel(tenant.kind),
        },
        {
          label: t("ui.tenants.columns.term"),
          value: formatPeriod(tenant.startDate, tenant.endDate),
        },
        {
          label: t("ui.tenant.fields.deposit"),
          value:
            tenant.depositCents > 0
              ? formatEur(tenant.depositCents)
              : t("ui.common.emptyValue"),
        },
      ]}
    />
  </SectionCard>
);
