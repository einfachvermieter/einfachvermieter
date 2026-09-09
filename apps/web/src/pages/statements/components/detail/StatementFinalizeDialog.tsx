import type { AdvanceAdjustmentDetail } from "@einfachvermieter/shared";
import { formatDate, formatEur } from "@einfachvermieter/shared";
import {
  RiCheckboxCircleFill,
  RiErrorWarningFill,
  RiInformationFill,
  RiLockLine,
} from "@remixicon/react";
import type { ReactNode } from "react";
import { Button } from "../../../../components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/Dialog";
import { t } from "../../../../lib/i18n";
import { cn } from "../../../../lib/utils";

const CHECK_ICONS = {
  ok: (
    <RiCheckboxCircleFill
      aria-hidden={true}
      className="mt-px size-4.25 shrink-0 text-limette-600"
    />
  ),
  warn: (
    <RiErrorWarningFill
      aria-hidden={true}
      className="mt-px size-4.25 shrink-0 text-honig-500"
    />
  ),
  info: (
    <RiInformationFill
      aria-hidden={true}
      className="mt-px size-4.25 shrink-0 text-azur-500"
    />
  ),
} as const;

/**
 * Eine Prüfzeile der Finalisieren-Checkliste: Status-Icon, Text und
 * optionale Unterzeile
 */
const CheckRow = ({
  kind,
  children,
  sub,
}: {
  kind: keyof typeof CHECK_ICONS;
  children: ReactNode;
  sub?: ReactNode;
}) => (
  <div className="flex gap-2.5 border-b border-schiefer-100 py-2.5 text-sm last:border-b-0">
    {CHECK_ICONS[kind]}
    <div className="min-w-0">
      <div>{children}</div>
      {sub ? (
        <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
      ) : null}
    </div>
  </div>
);

/**
 * Bestätigungsdialog fürs Finalisieren: bündelt alle Hinweise (Berechnungs-
 * Warnungen, Frist, Klimafaktor-Frage, künftige Vorauszahlung) als
 * Checkliste und zeigt das Ergebnis.
 */
export const StatementFinalizeDialog = ({
  open,
  onOpenChange,
  subtitle,
  warnings,
  deadlineWarning,
  climateFactorQuestionOpen,
  advanceDetail,
  balanceCents,
  tenantName,
  isPending,
  blocked,
  onConfirm,
  onAdjustAdvance,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subtitle: string;
  warnings: string[];
  deadlineWarning: boolean;
  climateFactorQuestionOpen: boolean;
  advanceDetail: AdvanceAdjustmentDetail | undefined;
  balanceCents: number;
  tenantName: string;
  isPending: boolean;
  blocked: boolean;
  onConfirm: () => void;
  onAdjustAdvance: () => void;
}) => {
  const isRefund = balanceCents <= 0;
  const tenant = tenantName || t("ui.statements.detail.info.tenant");

  const hasAdjustment =
    advanceDetail !== undefined &&
    advanceDetail.adjustedMonthlyAdvanceCents !== null &&
    advanceDetail.adjustedAdvanceValidFrom !== null;
  const suggestionDiffers =
    advanceDetail !== undefined &&
    advanceDetail.suggestedMonthlyAdvanceWithTariffsCents !==
      advanceDetail.currentMonthlyAdvanceCents;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("ui.statements.detail.finalizeStatement")}
          </DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <div>
          {warnings.length === 0 ? (
            <CheckRow kind="ok">
              {t("ui.statements.detail.finalizeDialog.noIssues")}
            </CheckRow>
          ) : (
            warnings.map((warning) => (
              <CheckRow key={warning} kind="warn">
                {warning}
              </CheckRow>
            ))
          )}
          {deadlineWarning ? (
            <CheckRow kind="warn">
              {t("ui.statements.detail.finalizeDeadlineWarning")}
            </CheckRow>
          ) : null}
          {climateFactorQuestionOpen ? (
            <CheckRow kind="warn">
              {t("ui.statements.detail.finalizeClimateFactorWarning")}
            </CheckRow>
          ) : null}
          {blocked ? (
            <CheckRow kind="warn">
              {t("ui.statements.detail.finalizeDialog.blocked")}
            </CheckRow>
          ) : null}
          {advanceDetail ? (
            <CheckRow
              kind="info"
              sub={
                !hasAdjustment && suggestionDiffers ? (
                  <span className="flex flex-wrap items-center gap-x-1.5">
                    {t(
                      "ui.statements.detail.finalizeDialog.advanceSuggestionHint",
                      {
                        amount: formatEur(
                          advanceDetail.suggestedMonthlyAdvanceWithTariffsCents,
                        ),
                      },
                    )}
                    <Button
                      variant="addLink"
                      size="text"
                      onClick={onAdjustAdvance}
                    >
                      {t("ui.statements.detail.finalizeDialog.adjustNow")}
                    </Button>
                  </span>
                ) : undefined
              }
            >
              {hasAdjustment
                ? t("ui.statements.detail.finalizeDialog.advanceAdjusted", {
                    amount: formatEur(
                      advanceDetail.adjustedMonthlyAdvanceCents as number,
                    ),
                    date: formatDate(
                      advanceDetail.adjustedAdvanceValidFrom as string,
                    ),
                  })
                : t("ui.statements.detail.finalizeDialog.advanceKept", {
                    amount: formatEur(advanceDetail.currentMonthlyAdvanceCents),
                  })}
            </CheckRow>
          ) : null}
          <CheckRow kind="info">
            {t("ui.statements.detail.info.hintText")}
          </CheckRow>
        </div>

        <div
          className={cn(
            "rounded-lg px-4 py-3 text-sm font-medium",
            isRefund
              ? "bg-limette-50 text-limette-700"
              : "bg-himbeere-50 text-himbeere-500",
          )}
        >
          {isRefund
            ? t("ui.statements.detail.finalizeDialog.resultRefund", {
                tenant,
                amount: formatEur(Math.abs(balanceCents)),
              })
            : t("ui.statements.detail.finalizeDialog.resultArrears", {
                tenant,
                amount: formatEur(balanceCents),
              })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("ui.common.action.cancel")}
          </Button>
          <Button disabled={isPending || blocked} onClick={onConfirm}>
            <RiLockLine data-icon="inline-start" />
            {t("ui.statements.detail.finalizeDialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
