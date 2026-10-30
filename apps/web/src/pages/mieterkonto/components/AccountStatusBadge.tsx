import type { PotState } from "@einfachvermieter/shared";
import { Badge } from "@/components/ui/Badge";
import { t } from "@/lib/i18n";
import { QuietStatus } from "./QuietStatus";

/**
 * Topf-Status: ausgeglichen unauffällig, Guthaben / teilweise / offen als Badge
 */
export const AccountStatusBadge = ({ pot }: { pot: PotState }) => {
  if (pot.status === "balanced") {
    return <QuietStatus label={t("ui.account.status.balanced")} />;
  }

  if (pot.status === "credit") {
    return <Badge variant="info">{t("ui.account.status.credit")}</Badge>;
  }

  // Bei negativem Soll steht eine Erstattung an den Mieter aus, keine
  // Forderung gegen ihn.
  if (pot.sollCents < 0) {
    return <Badge variant="info">{t("ui.account.status.refundOpen")}</Badge>;
  }

  // Offener Posten: teilweise gezahlt (Warnung) vs. gar nichts gezahlt.
  if (pot.istCents !== 0) {
    return <Badge variant="warn">{t("ui.account.status.partial")}</Badge>;
  }

  return <Badge variant="bad">{t("ui.account.status.open")}</Badge>;
};
