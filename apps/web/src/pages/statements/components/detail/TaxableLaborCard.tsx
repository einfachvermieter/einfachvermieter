import type { TaxableLaborCosts } from "@einfachvermieter/shared";
import { formatEur } from "@einfachvermieter/shared";
import { Description } from "../../../../components/common/Description";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/Card";
import { t } from "../../../../lib/i18n";

export const TaxableLaborCard = ({ detail }: { detail: TaxableLaborCosts }) => {
  const categoryTitle = (
    category: "craftsman" | "household_service",
  ): string =>
    category === "craftsman"
      ? t("statements.pdf.taxableLabor.craftsman")
      : t("statements.pdf.taxableLabor.householdService");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("statements.pdf.taxableLabor.title")}</CardTitle>
        <Description>{t("statements.pdf.taxableLabor.intro")}</Description>
      </CardHeader>
      <CardContent className="space-y-6">
        {detail.byCategory.map((group) => (
          <section key={group.category}>
            <h3 className="mb-2 text-sm font-semibold">
              {categoryTitle(group.category)}
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                  <th className="py-1.5">
                    {t("statements.pdf.taxableLabor.position")}
                  </th>
                  <th className="py-1.5 text-right">
                    {t("statements.pdf.taxableLabor.tenantAmount")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.lines.map((line) => (
                  <tr key={line.costTypeId} className="border-b border-border">
                    <td className="py-1.5">{line.costTypeName}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatEur(line.tenantAmountCents)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-foreground">
                  <td className="py-1.5 font-semibold">
                    {t("statements.pdf.taxableLabor.subtotal")}
                  </td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">
                    {formatEur(group.tenantTotalCents)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        ))}
        <p className="text-xs text-muted-foreground">
          {t("statements.pdf.taxableLabor.disclaimer")}
        </p>
      </CardContent>
    </Card>
  );
};
