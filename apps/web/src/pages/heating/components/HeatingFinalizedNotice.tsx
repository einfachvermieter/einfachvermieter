import { formatDate, type HeatingSettings } from "@einfachvermieter/shared";
import { DomainLink } from "../../../components/common/DomainLink";
import { Alert, AlertDescription } from "../../../components/ui/Alert";
import { t } from "../../../lib/i18n";
import { useSettledPeriods } from "../../meters/components/readings/useSettledPeriods";

/**
 * Hinweis, dass die Version finalisierte Zeiträume berührt. Was sich dort
 * noch ändern lässt, entscheidet die API; der Hinweis nennt nur den
 * Zeitraum vom frühesten Beginn bis zum spätesten Ende.
 */
export const HeatingFinalizedNotice = ({
  version,
}: {
  version: HeatingSettings;
}) => {
  const touched = useSettledPeriods(version.buildingId).filter(
    (period) =>
      period.end >= version.validFrom &&
      (version.validTo === null || period.start <= version.validTo),
  );
  const [first] = touched;
  if (first === undefined) {
    return null;
  }

  const periodStart = touched.reduce(
    (earliest, period) => (period.start < earliest ? period.start : earliest),
    first.start,
  );
  const periodEnd = touched.reduce(
    (latest, period) => (period.end > latest ? period.end : latest),
    first.end,
  );

  return (
    <Alert variant="info">
      <AlertDescription>
        {t("ui.heating.versions.finalizedNotice", {
          periodStart: formatDate(periodStart),
          periodEnd: formatDate(periodEnd),
        })}{" "}
        <DomainLink
          to="/abrechnungen"
          search={{ buildingId: version.buildingId }}
        >
          {t("ui.heating.versions.finalizedNoticeLink")}
        </DomainLink>
      </AlertDescription>
    </Alert>
  );
};
