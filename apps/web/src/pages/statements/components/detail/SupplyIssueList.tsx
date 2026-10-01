import { formatDate } from "@einfachvermieter/shared";
import { DomainLink } from "@/components/common/DomainLink";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { t } from "../../../../lib/i18n";
import type { SupplyIssue } from "../../../../lib/unitSupply";

const issueText = (issue: SupplyIssue): string => {
  if (issue.kind === "boundary") {
    return t("ui.substitutions.gapSupplyBoundary", {
      unit: issue.unit,
      meter: issue.meter,
      date: formatDate(issue.date),
    });
  }

  if (issue.kind === "unsupportedCombination") {
    return t("ui.substitutions.unsupportedCombination", { unit: issue.unit });
  }

  return t(
    issue.scope === "heating"
      ? "ui.substitutions.meterMissingHeating"
      : "ui.substitutions.meterMissingHotWater",
    { unit: issue.unit },
  );
};

/**
 * Offene Punkte zur zentralen Versorgung: fehlender Zähler, fehlender Stand
 * zur Umstellung, nicht unterstützte Kombination.
 */
export const SupplyIssueList = ({
  issues,
  buildingId,
  isDraft,
}: {
  issues: SupplyIssue[];
  buildingId: string;
  isDraft: boolean;
}) => (
  <section className="space-y-2">
    {issues.map((issue) => (
      <Alert key={issue.key} variant="warning">
        <AlertDescription>
          <p>{issueText(issue)}</p>
          {isDraft ? (
            <div className="mt-2 flex flex-wrap gap-4">
              {issue.kind === "boundary" ? (
                <DomainLink
                  to="/zaehler/$meterId/zaehlerstaende"
                  params={{ meterId: issue.meterId }}
                >
                  {t("ui.substitutions.recordReading")}
                </DomainLink>
              ) : null}
              {issue.kind === "meterMissing" ? (
                <DomainLink
                  to="/zaehler"
                  search={{
                    buildingId,
                    unitId: issue.unitId,
                    type: undefined,
                  }}
                >
                  {t("ui.substitutions.createMeter")}
                </DomainLink>
              ) : null}
              {issue.kind === "boundary" ? null : (
                <DomainLink
                  to="/wohnungen/$unitId"
                  params={{ unitId: issue.unitId }}
                >
                  {t("ui.substitutions.editSupply")}
                </DomainLink>
              )}
            </div>
          ) : null}
        </AlertDescription>
      </Alert>
    ))}
  </section>
);
