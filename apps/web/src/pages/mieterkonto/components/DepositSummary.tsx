import type { DepositRow } from "@einfachvermieter/shared";
import { formatEur } from "@einfachvermieter/shared";
import { t } from "@/lib/i18n";
import { AccountStatusBadge } from "./AccountStatusBadge";

/**
 * Kautions-Übersicht: vereinbart (Soll) vs. hinterlegt (Ist) + Status
 */
export const DepositSummary = ({ row }: { row: DepositRow | null }) => {
  if (!row) {
    return (
      <p className="text-muted-foreground">{t("ui.account.depositEmpty")}</p>
    );
  }

  if (row.pot.sollCents === 0 && row.pot.istCents === 0) {
    return (
      <p className="text-muted-foreground">{t("ui.account.depositNone")}</p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-8">
      <div className="flex flex-col">
        <span className="text-sm text-muted-foreground">
          {t("ui.account.depositSoll")}
        </span>
        <span className="text-lg font-semibold tabular-nums">
          {formatEur(row.pot.sollCents)}
        </span>
      </div>
      <div className="flex flex-col">
        <span className="text-sm text-muted-foreground">
          {t("ui.account.depositIst")}
        </span>
        <span className="text-lg font-semibold tabular-nums">
          {formatEur(row.pot.istCents)}
        </span>
      </div>
      <div>
        <AccountStatusBadge pot={row.pot} />
      </div>
    </div>
  );
};
