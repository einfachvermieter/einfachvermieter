import type { PotState } from "@einfachvermieter/shared";
import { formatEur } from "@einfachvermieter/shared";
import { t } from "@/lib/i18n";
import { AccountStatusBadge } from "./AccountStatusBadge";

/**
 * Kompakte Topf-Darstellung (Ist groß, Soll klein, Status) für eine Zelle
 */
export const PotCell = ({ pot }: { pot: PotState }) => (
  <div className="flex flex-col items-end gap-1 tabular-nums">
    <div className="font-semibold">{formatEur(pot.istCents)}</div>
    <div className="text-xs text-muted-foreground">
      {/* Negatives Soll heisst: der Vermieter schuldet, nicht der Mieter */}
      {pot.sollCents < 0
        ? t("ui.account.creditLabel", {
            amount: formatEur(Math.abs(pot.sollCents)),
          })
        : t("ui.account.sollLabel", { amount: formatEur(pot.sollCents) })}
    </div>
    <div>
      <AccountStatusBadge pot={pot} />
    </div>
  </div>
);
