import type { PotState } from "@einfachvermieter/shared";
import { Badge } from "@/components/ui/Badge";
import { t } from "@/lib/i18n";

/**
 * Topf-Status als Badge: ausgeglichen / Guthaben / teilweise / offen.
 */
export const AccountStatusBadge = ({ pot }: { pot: PotState }) => {
  if (pot.status === "balanced") {
    return (
      <Badge variant="lightGreen">{t("ui.account.status.balanced")}</Badge>
    );
  }

  if (pot.status === "credit") {
    return <Badge variant="lightBlue">{t("ui.account.status.credit")}</Badge>;
  }

  // Bei negativem Soll steht eine Erstattung an den Mieter aus, keine
  // Forderung gegen ihn.
  if (pot.sollCents < 0) {
    return (
      <Badge variant="lightBlue">{t("ui.account.status.refundOpen")}</Badge>
    );
  }

  // Offener Posten: teilweise gezahlt (Warnung) vs. gar nichts gezahlt.
  if (pot.istCents !== 0) {
    return (
      <Badge variant="lightYellow">{t("ui.account.status.partial")}</Badge>
    );
  }

  return <Badge variant="lightRed">{t("ui.account.status.open")}</Badge>;
};
