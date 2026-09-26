import { formatDate, type HeatingDetail } from "@einfachvermieter/shared";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { formatPeriod } from "../../../../lib/format";
import { t } from "../../../../lib/i18n";
import { formatSubstituteConsumption } from "../../../../lib/substitutions";

/**
 * Ausgleich aus Ersatzverbräuchen früherer Perioden; ein negativer
 * Ausgleich erscheint mit allen Werten als Fehler, weil er das
 * Finalisieren blockiert
 */
export const SubstitutionCompensationList = ({
  detail,
}: {
  detail: HeatingDetail;
}) => (
  <section className="space-y-2">
    <h3 className="font-semibold">
      {t("ui.substitutions.compensationsTitle")}
    </h3>
    {(detail.compensations ?? []).map((entry) => {
      const amount = (value: number) =>
        formatSubstituteConsumption(
          value,
          entry.scope,
          detail.consumptionMethod === "heat_cost_allocator",
        );
      const sourcePeriod = formatPeriod(
        entry.source.period.start,
        entry.source.period.end,
      );
      const key = `${entry.meterId}|${entry.source.period.start}`;
      const isNegative =
        entry.nextReading !== null &&
        entry.resultingConsumption !== null &&
        entry.resultingConsumption < 0;

      return isNegative && entry.nextReading ? (
        <Alert key={key} variant="error">
          <AlertDescription>
            {t("ui.substitutions.compensationNegative", {
              meter: entry.meterLabel,
              value: amount(entry.compensationValue),
              sourcePeriod,
              start: amount(entry.periodStartValue),
              substitute: amount(entry.substituteConsumption),
              reading: amount(entry.nextReading.value),
              date: formatDate(entry.nextReading.date),
              difference: amount(entry.resultingConsumption ?? 0),
            })}
          </AlertDescription>
        </Alert>
      ) : (
        <p key={key}>
          {t("ui.substitutions.compensation", {
            meter: entry.meterLabel,
            sourcePeriod,
            substitute: amount(entry.substituteConsumption),
            value: amount(entry.compensationValue),
          })}
        </p>
      );
    })}
  </section>
);
