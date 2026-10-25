import type { DepositRow } from "@einfachvermieter/shared";
import { formatEur } from "@einfachvermieter/shared";
import { ResultRows } from "@/components/common/ResultRows";
import { Badge } from "@/components/ui/Badge";
import { t } from "@/lib/i18n";

/**
 * Kautions-Übersicht als Wertezeilen: vereinbart (Soll), eingegangen (Ist)
 * und Status
 */
export const DepositSummary = ({ row }: { row: DepositRow | null }) => {
  if (!row) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("ui.account.depositEmpty")}
      </p>
    );
  }

  if (row.pot.sollCents === 0 && row.pot.istCents === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("ui.account.depositNone")}
      </p>
    );
  }

  const openCents = row.pot.sollCents - row.pot.istCents;
  const status =
    openCents <= 0 ? (
      <Badge variant="ok">{t("ui.account.depositComplete")}</Badge>
    ) : (
      <Badge variant="warn">
        {t("ui.account.depositOpen", { amount: formatEur(openCents) })}
      </Badge>
    );

  return (
    <ResultRows
      rows={[
        {
          label: t("ui.account.depositSoll"),
          value: formatEur(row.pot.sollCents),
        },
        {
          label: t("ui.account.depositIst"),
          value: formatEur(row.pot.istCents),
        },
        { label: t("ui.common.columns.status"), value: status },
      ]}
    />
  );
};
