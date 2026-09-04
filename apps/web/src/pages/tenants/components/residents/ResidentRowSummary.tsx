import { formatName } from "@einfachvermieter/shared";
import { Badge } from "@/components/ui/Badge";
import { formatPeriod, getPeriodStatusToday } from "../../../../lib/format";
import { t } from "../../../../lib/i18n";
import type { ResidentRowValues } from "./residentRow";

/**
 * Zusammenfassung eines Bewohners in der Ansichts-Liste: Name, Rollen-
 * und Status-Badges, Zeitraum
 */
export const ResidentRowSummary = ({
  row,
  index,
  tenantStartDate,
  tenantEndDate,
}: {
  row: ResidentRowValues;
  index: number;
  tenantStartDate: string;
  tenantEndDate: string;
}) => {
  const effectiveMoveIn = row.moveInDate || tenantStartDate;
  const effectiveMoveOut = row.moveOutDate || tenantEndDate;
  const periodStatus = getPeriodStatusToday(
    effectiveMoveIn,
    effectiveMoveOut,
    tenantEndDate,
  );

  return (
    <>
      <div className="flex items-center gap-2">
        <p className="truncate font-semibold">
          {row.firstName && row.lastName
            ? formatName(row.firstName, row.lastName)
            : t("ui.tenant.residentIndex", { index: index + 1 })}
        </p>
        {row.isContractParty ? (
          <Badge variant="info">{t("ui.tenant.fields.isContractParty")}</Badge>
        ) : null}
        {periodStatus === "active" ? (
          <Badge variant="ok">{t("ui.tenant.active")}</Badge>
        ) : null}
        {periodStatus === "last" ? (
          <Badge variant="warn">{t("ui.tenant.lastResident")}</Badge>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">
        {formatPeriod(effectiveMoveIn, effectiveMoveOut)}
      </p>
    </>
  );
};
