import { formatEur } from "@einfachvermieter/shared";
import { t } from "@/lib/i18n";

/**
 * Saldo als Klartext statt als Vorzeichen: Betrag ohne Vorzeichen plus Wort,
 * Farbe nach Richtung. `receivableCents` ist immer aus Vermietersicht,
 * positiv heißt, der Mieter schuldet noch.
 */
export const BalanceAmount = ({
  receivableCents,
  wording = "account",
}: {
  receivableCents: number;
  /**
   * offen/Guthaben im Mieterkonto, Nachzahlung/Guthaben bei Abrechnungen
   */
  wording?: "account" | "statement";
}) => {
  if (receivableCents === 0) {
    return <span>{t("ui.account.balance.balanced")}</span>;
  }

  const amount = formatEur(Math.abs(receivableCents));
  const owed = receivableCents > 0;
  const owedKey =
    wording === "statement"
      ? "ui.statements.balanceArrears"
      : "ui.account.balance.open";
  const key = owed ? owedKey : "ui.account.balance.credit";

  return (
    <span className={owed ? "text-himbeere-500" : "text-limette-700"}>
      {t(key, { amount })}
    </span>
  );
};
