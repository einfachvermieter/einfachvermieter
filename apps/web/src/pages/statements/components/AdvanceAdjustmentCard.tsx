import {
  type AdvanceAdjustmentDetail,
  type CostLineResult,
  formatDate,
  formatEur,
} from "@einfachvermieter/shared";
import { RiCalendarScheduleLine } from "@remixicon/react";
import { useState } from "react";
import { ResultRows } from "@/components/common/ResultRows";
import { SectionAction } from "@/components/common/SectionAction";
import { SectionCard } from "@/components/common/SectionCard";
import { t } from "../../../lib/i18n";
import { AdvanceAdjustmentSheet } from "./AdvanceAdjustmentSheet";
import { resolveSuggestedApplyCents } from "./advanceAdjustment";

/**
 * Künftige Vorauszahlung: zeigt den aktuellen Stand und die festgelegte
 * Anpassung. Beim Entwurf öffnet "Bearbeiten" das Formular-Sheet.
 */
export const AdvanceAdjustmentCard = ({
  statementId,
  isDraft,
  detail,
  lines,
  periodEnd,
  documentDate,
}: {
  statementId: string;
  isDraft: boolean;
  detail: AdvanceAdjustmentDetail | undefined;
  lines: CostLineResult[];
  periodEnd: string;
  documentDate: string;
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);

  const currentCents = detail?.currentMonthlyAdvanceCents ?? 0;
  const suggestedCents = detail?.suggestedMonthlyAdvanceCents ?? 0;
  const adjustedCents = detail?.adjustedMonthlyAdvanceCents ?? null;
  const adjustedValidFrom = detail?.adjustedAdvanceValidFrom ?? null;
  const hasAdjustment = adjustedCents !== null && adjustedValidFrom !== null;

  const suggestedApplyCents = resolveSuggestedApplyCents(
    detail,
    lines,
    isDraft,
  );
  const showWithTariffs = suggestedApplyCents !== suggestedCents;

  return (
    <>
      <SectionCard
        icon={RiCalendarScheduleLine}
        title={t("ui.statements.advanceAdjustment.title")}
        description={t("ui.statements.advanceAdjustment.description")}
        action={
          isDraft ? (
            <SectionAction
              kind="edit"
              label={t("ui.common.action.edit")}
              onClick={() => setSheetOpen(true)}
            />
          ) : undefined
        }
      >
        <ResultRows
          rows={[
            {
              label: t("ui.statements.advanceAdjustment.currentLabel"),
              value: formatEur(currentCents),
            },
            {
              label: t("ui.statements.advanceAdjustment.suggestedLabel"),
              value: formatEur(suggestedCents),
            },
            ...(showWithTariffs
              ? [
                  {
                    label: t(
                      "ui.statements.advanceAdjustment.suggestedWithTariffsLabel",
                    ),
                    value: formatEur(suggestedApplyCents),
                  },
                ]
              : []),
            ...(hasAdjustment
              ? [
                  {
                    label: t("ui.statements.advanceAdjustment.adjustedLabel", {
                      date: formatDate(adjustedValidFrom),
                    }),
                    value: formatEur(adjustedCents),
                    kind: "sum" as const,
                  },
                ]
              : []),
          ]}
        />
        {hasAdjustment ? null : (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("ui.statements.advanceAdjustment.noAdjustment")}
          </p>
        )}
      </SectionCard>

      {sheetOpen ? (
        <AdvanceAdjustmentSheet
          statementId={statementId}
          detail={detail}
          lines={lines}
          periodEnd={periodEnd}
          documentDate={documentDate}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
    </>
  );
};
