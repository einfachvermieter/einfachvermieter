import { formatNumberLoose, type Period } from "@einfachvermieter/shared";
import { RiPencilLine, RiTempHotLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DomainLink } from "@/components/common/DomainLink";
import type { ResultRow } from "@/components/common/ResultRows";
import { ResultRows } from "@/components/common/ResultRows";
import { SectionCard } from "@/components/common/SectionCard";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { heatingPeriodValuesQueryOptions } from "../../../../lib/heatingPeriodValues";
import { t } from "../../../../lib/i18n";
import { PeriodValuesSheet } from "./PeriodValuesSheet";

/**
 * Werte des Abrechnungszeitraums an der offenen Abrechnung:
 * Gesamt-Wärmemenge und Fernwärme-Angaben. Welche Felder erscheinen,
 * bestimmt die API mit derselben Regel wie die Berechnung.
 */
export const PeriodValuesCard = ({
  buildingId,
  period,
  isDraft,
}: {
  buildingId: string;
  period: Period;
  isDraft: boolean;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  // Nur an offenen Abrechnungen: Der Snapshot einer finalisierten hält die
  // eingetragenen Werte nicht fest, eine Anzeige daraus wäre geraten.
  const { data: values } = useQuery({
    ...heatingPeriodValuesQueryOptions(buildingId, period),
    enabled: isDraft,
  });

  if (!(values?.relevance.totalHeatEnergy || values?.relevance.districtHeat)) {
    return null;
  }

  const dash = t("ui.common.emptyValue");
  const rows: ResultRow[] = [];

  if (values.relevance.totalHeatEnergy) {
    let totalHeat = values.hasMainHeatMeter
      ? t("ui.heatingPeriodValues.fromMainMeter")
      : dash;
    if (values.totalHeatEnergyKwh !== null) {
      totalHeat = t("ui.common.measures.kwh", {
        value: formatNumberLoose(values.totalHeatEnergyKwh),
      });
    }
    rows.push({
      label: t("ui.heatingPeriodValues.fields.totalHeatEnergyKwh"),
      value: totalHeat,
    });
  }

  if (values.relevance.districtHeat) {
    rows.push(
      {
        label: t(
          "ui.heatingPeriodValues.fields.districtHeatEmissionsKgPerYear",
        ),
        value:
          values.districtHeatEmissionsKgPerYear === null
            ? dash
            : t("ui.common.measures.kg", {
                value: formatNumberLoose(values.districtHeatEmissionsKgPerYear),
              }),
      },
      {
        label: t(
          "ui.heatingPeriodValues.fields.districtHeatPrimaryEnergyFactor",
        ),
        value:
          values.districtHeatPrimaryEnergyFactor === null
            ? dash
            : formatNumberLoose(values.districtHeatPrimaryEnergyFactor, 3),
      },
    );
  }

  return (
    <SectionCard
      icon={RiTempHotLine}
      title={t("ui.heatingPeriodValues.title")}
      description={t("ui.heatingPeriodValues.description")}
      action={
        values.lockedByStatementId === null ? (
          <Button
            type="button"
            variant="addLink"
            size="text"
            onClick={() => setIsEditing(true)}
          >
            <RiPencilLine />
            {t("ui.common.action.edit")}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {values.lockedByStatementId === null ? null : (
          <Alert variant="info">
            <AlertDescription>
              {t("ui.heatingPeriodValues.locked")}{" "}
              <DomainLink
                to="/abrechnungen/$statementId"
                params={{ statementId: values.lockedByStatementId }}
              >
                {t("ui.heatingPeriodValues.lockedLink")}
              </DomainLink>
            </AlertDescription>
          </Alert>
        )}
        <ResultRows rows={rows} />
      </div>

      {isEditing ? (
        <PeriodValuesSheet
          buildingId={buildingId}
          period={period}
          values={values}
          onClose={() => setIsEditing(false)}
        />
      ) : null}
    </SectionCard>
  );
};
