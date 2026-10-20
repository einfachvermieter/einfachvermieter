import type { TaxableLaborCosts } from "@einfachvermieter/shared";
import { formatEur } from "@einfachvermieter/shared";
import { RiGovernmentLine } from "@remixicon/react";
import { TableFrame } from "@/components/common/TableFrame";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { EmptyNote } from "../../../../components/common/EmptyNote";
import { SectionCard } from "../../../../components/common/SectionCard";
import { QUIET_TABLE_GROUP_HEAD } from "../../../../components/common/tableStyles";
import { t } from "../../../../lib/i18n";

type Category = "household_service" | "craftsman";

/**
 * Feste Reihenfolge wie in der PDF-Anlage: § 35a Abs. 2 (haushaltsnah) vor
 * Abs. 3 (Handwerker). Leere Kategorien werden mit Hinweis gezeigt, damit
 * beide Absätze sichtbar bleiben.
 */
const CATEGORY_ORDER: Category[] = ["household_service", "craftsman"];

export const TaxableLaborCard = ({ detail }: { detail: TaxableLaborCosts }) => {
  const categoryTitle = (category: Category): string =>
    category === "craftsman"
      ? t("statements.pdf.taxableLabor.craftsman")
      : t("statements.pdf.taxableLabor.householdService");

  return (
    <SectionCard
      icon={RiGovernmentLine}
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
                <TableFrame>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          {t("statements.pdf.taxableLabor.position")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("statements.pdf.taxableLabor.tenantAmount")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.lines.map((line) => (
                        <TableRow key={line.costTypeId}>
                          <TableCell className="font-semibold text-foreground">
                            {line.costTypeName}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatEur(line.tenantAmountCents)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell className="font-semibold">
                          {t("statements.pdf.taxableLabor.subtotal")}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatEur(group.tenantTotalCents)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableFrame>
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
