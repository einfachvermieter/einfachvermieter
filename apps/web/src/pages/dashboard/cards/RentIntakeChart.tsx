import { formatEur } from "@einfachvermieter/shared";
import { RiBarChartLine } from "@remixicon/react";
import { SectionCard } from "@/components/common/SectionCard";
import { t } from "@/lib/i18n";
import type { DashboardResult } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { monthLabelShort } from "../monthLabel";

/**
 * Mieteingänge der letzten Monate als Balken
 */
export const RentIntakeChart = ({ data }: { data: DashboardResult }) => {
  const maxCents = Math.max(
    1,
    ...data.months.map((month) =>
      Math.max(month.targetCents, month.receivedCents),
    ),
  );
  return (
    <SectionCard icon={RiBarChartLine} title={t("ui.dashboard.intake.title")}>
      <div className="mt-2 flex h-29 items-end gap-3">
        {data.months.map((month, index) => {
          const open = month.targetCents - month.receivedCents > 0;
          const isCurrent = index === data.months.length - 1;
          // Heller Balken im Hintergrund: die Sollmiete. Darin der
          // Eingang, damit der Fehlbetrag als Lücke stehen bleibt.
          const targetHeight = `${Math.round((month.targetCents / maxCents) * 100)}%`;
          const filledHeight = `${Math.round((month.receivedCents / Math.max(1, month.targetCents)) * 100)}%`;

          return (
            <div
              key={month.month}
              className="relative h-full flex-1"
              title={t("ui.dashboard.intake.barTitle", {
                month: monthLabelShort(month.month),
                received: formatEur(month.receivedCents),
                target: formatEur(month.targetCents),
              })}
            >
              <span
                className="absolute inset-x-0 bottom-0 rounded-t-md bg-schiefer-100"
                style={{ height: targetHeight }}
              >
                <span
                  className={cn(
                    "absolute inset-x-0 bottom-0 block rounded-t-md",
                    open && "bg-honig-500",
                    !open && (isCurrent ? "bg-limette-600" : "bg-limette-500"),
                  )}
                  style={{ height: filledHeight }}
                />
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex gap-3">
        {data.months.map((month) => (
          <div key={month.month} className="flex-1 text-center">
            <span className="block text-2xs font-semibold text-muted-foreground">
              {monthLabelShort(month.month)}
            </span>
            <span className="block text-2xs text-muted-foreground tabular-nums">
              {formatEur(month.receivedCents)}
            </span>
            {month.targetCents > month.receivedCents ? (
              <span className="block text-2xs text-schiefer-400 tabular-nums">
                {t("ui.dashboard.intake.ofTarget", {
                  amount: formatEur(month.targetCents),
                })}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </SectionCard>
  );
};
