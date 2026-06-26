import type { TaxableLaborCosts } from "@einfachvermieter/shared";
import { formatEur } from "@einfachvermieter/shared";
import { RiGovernmentLine } from "@remixicon/react";
import { EmptyNote } from "../../../../components/common/EmptyNote";
import { SectionCard } from "../../../../components/common/SectionCard";
import {
  QUIET_TABLE_GROUP_HEAD,
  QUIET_TABLE_HEAD_ROW,
} from "../../../../components/common/tableStyles";
import { gradients } from "../../../../lib/domainVisuals";
import { t } from "../../../../lib/i18n";

type Category = "household_service" | "craftsman";

// Feste Reihenfolge wie in der PDF-Anlage: § 35a Abs. 2 (haushaltsnah) vor
// Abs. 3 (Handwerker). Leere Kategorien werden mit Hinweis gezeigt, damit
// beide Absätze sichtbar bleiben.
const CATEGORY_ORDER: Category[] = ["household_service", "craftsman"];

export const TaxableLaborCard = ({ detail }: { detail: TaxableLaborCosts }) => {
  const categoryTitle = (category: Category): string =>
    category === "craftsman"
      ? t("statements.pdf.taxableLabor.craftsman")
      : t("statements.pdf.taxableLabor.householdService");

  return (
    <SectionCard
      icon={RiGovernmentLine}
      iconBackground={gradients.commercial}
      title={t("statements.pdf.taxableLabor.title")}
      description={t("statements.pdf.taxableLabor.intro")}
    >
      <div className="space-y-5">
        {CATEGORY_ORDER.map((category) => {
          const group = detail.byCategory.find((g) => g.category === category);
          return (
            <section key={category}>
              <h3 className={`mb-2.5 ${QUIET_TABLE_GROUP_HEAD}`}>
                {categoryTitle(category)}
              </h3>
              {group ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={QUIET_TABLE_HEAD_ROW}>
                        <th className="py-2.5">
                          {t("statements.pdf.taxableLabor.position")}
                        </th>
                        <th className="py-2.5 text-right">
                          {t("statements.pdf.taxableLabor.tenantAmount")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.lines.map((line) => (
                        <tr
                          key={line.costTypeId}
                          className="border-b border-border"
                        >
                          <td className="py-2.5 font-semibold text-foreground">
                            {line.costTypeName}
                          </td>
                          <td className="py-2.5 text-right tabular-nums">
                            {formatEur(line.tenantAmountCents)}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-foreground">
                        <td className="py-2.5 font-semibold">
                          {t("statements.pdf.taxableLabor.subtotal")}
                        </td>
                        <td className="py-2.5 text-right font-semibold tabular-nums">
                          {formatEur(group.tenantTotalCents)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyNote>
                  {t("ui.statements.detail.taxableLaborEmptyGroup")}
                </EmptyNote>
              )}
            </section>
          );
        })}
        <p className="text-xs text-muted-foreground">
          {t("statements.pdf.taxableLabor.disclaimer")}
        </p>
      </div>
    </SectionCard>
  );
};
