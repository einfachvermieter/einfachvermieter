import { formatDate } from "@einfachvermieter/shared";
import { DomainLink } from "@/components/common/DomainLink";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { t } from "../../../../lib/i18n";
import type { SubstitutionGap } from "../../../../lib/substitutions";

/**
 * Offene Lücken mit den beiden Auflösungen: Zählerstände nachtragen oder
 * Erfassungsausfall erfassen
 */
export const SubstitutionGapList = ({
  gaps,
  isDraft,
  onRecord,
}: {
  gaps: SubstitutionGap[];
  isDraft: boolean;
  onRecord: (gap: SubstitutionGap) => void;
}) => (
  <section className="space-y-2">
    <h3 className="font-semibold">{t("ui.substitutions.gapsTitle")}</h3>
    {gaps.map((gap) => (
      <Alert key={gap.key} variant="warning">
        <AlertDescription>
          <p>
            {t(
              gap.scope === "heating"
                ? "ui.substitutions.gapHeating"
                : "ui.substitutions.gapHotWater",
              { unit: gap.unit, meter: gap.meter, date: formatDate(gap.date) },
            )}
          </p>
          {isDraft ? (
            <div className="mt-2 flex flex-wrap gap-4">
              <DomainLink
                to="/zaehler/$meterId/zaehlerstaende"
                params={{ meterId: gap.meterId }}
              >
                {t("ui.substitutions.editReadings")}
              </DomainLink>
              <Button
                variant="addLink"
                size="text"
                onClick={() => onRecord(gap)}
              >
                {t("ui.substitutions.add")}
              </Button>
            </div>
          ) : null}
        </AlertDescription>
      </Alert>
    ))}
  </section>
);
