import { formatDate, formatEur } from "@einfachvermieter/shared";
import { DomainLink } from "@/components/common/DomainLink";
import { EmptyNote } from "@/components/common/EmptyNote";
import { SectionAction } from "@/components/common/SectionAction";
import { SectionCard } from "@/components/common/SectionCard";
import { TableFrame } from "@/components/common/TableFrame";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { IconReceipt } from "@/lib/icons";
import type { CostTypeEntryRow } from "../../../lib/costs";
import { formatPeriod } from "../../../lib/format";
import { t } from "../../../lib/i18n";

/**
 * Rechnungen dieser Kostenart, je Position eine Zeile mit Querverweis auf
 * die Rechnung
 */
export const CostTypeEntriesCard = ({
  rows,
  onAdd,
}: {
  rows: CostTypeEntryRow[];
  onAdd: () => void;
}) => (
  <SectionCard
    icon={IconReceipt}
    title={t("ui.costs.entriesTitle")}
    action={
      <SectionAction
        kind="add"
        label={t("ui.costs.addEntry")}
        onClick={onAdd}
      />
    }
  >
    {rows.length === 0 ? (
      <EmptyNote>{t("ui.costs.detail.entriesEmpty")}</EmptyNote>
    ) : (
      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("ui.common.columns.invoiceDate")}</TableHead>
              <TableHead>{t("ui.costs.columns.vendor")}</TableHead>
              <TableHead>{t("ui.common.columns.period")}</TableHead>
              <TableHead className="text-right">
                {t("ui.common.columns.amount")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="tabular-nums">
                  <DomainLink
                    to="/rechnungen/$costEntryId"
                    params={{ costEntryId: row.costEntryId }}
                    search={{ costTypeId: undefined, extract: undefined }}
                  >
                    {formatDate(row.invoiceDate)}
                  </DomainLink>
                </TableCell>
                <TableCell>
                  {row.vendor ?? row.invoiceNumber ?? t("ui.common.emptyValue")}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatPeriod(row.periodStart, row.periodEnd)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatEur(row.amountCents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableFrame>
    )}
  </SectionCard>
);
