import {
  type AdvanceAdjustmentDetail,
  type CostLineResult,
  formatDate,
  formatEur,
} from "@einfachvermieter/shared";
import { RiCalendarScheduleLine, RiPencilLine } from "@remixicon/react";
import { useState } from "react";
import { SectionCard } from "@/components/common/SectionCard";
import { Button } from "@/components/ui/Button";
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
            <Button
              type="button"
              variant="addLink"
              size="text"
              onClick={() => setSheetOpen(true)}
            >
              <RiPencilLine />
              {t("ui.common.action.edit")}
            </Button>
          ) : undefined
        }
      >
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 text-muted-foreground">
                {t("ui.statements.advanceAdjustment.currentLabel")}
              </td>
              <td className="py-1 text-right tabular-nums">
                {formatEur(currentCents)}
              </td>
            </tr>
            <tr>
              <td className="py-1 text-muted-foreground">
                {t("ui.statements.advanceAdjustment.suggestedLabel")}
              </td>
              <td className="py-1 text-right tabular-nums">
                {formatEur(suggestedCents)}
              </td>
            </tr>
            {showWithTariffs ? (
              <tr>
                <td className="py-1 text-muted-foreground">
                  {t(
                    "ui.statements.advanceAdjustment.suggestedWithTariffsLabel",
                  )}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {formatEur(suggestedApplyCents)}
                </td>
              </tr>
            ) : null}
            {hasAdjustment ? (
              <tr className="border-t border-border font-semibold">
                <td className="py-1.5">
                  {t("ui.statements.advanceAdjustment.adjustedLabel", {
                    date: formatDate(adjustedValidFrom),
                  })}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatEur(adjustedCents)}
                </td>
              </tr>
            ) : (
              <tr className="border-t border-border text-muted-foreground">
                <td className="py-1.5" colSpan={2}>
                  {t("ui.statements.advanceAdjustment.noAdjustment")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
