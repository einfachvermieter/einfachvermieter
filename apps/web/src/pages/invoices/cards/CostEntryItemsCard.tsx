import { formatEur, formatNumberLoose } from "@einfachvermieter/shared";
import { RiAddLine, RiListCheck2 } from "@remixicon/react";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { EmptyNote } from "@/components/common/EmptyNote";
import { SectionCard } from "@/components/common/SectionCard";
import { DestructiveConfirmDialog } from "@/components/DestructiveConfirmDialog";
import { RowActions } from "@/components/RowActions";
import { Button } from "@/components/ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import type { CostEntryItem, CostType } from "../../../lib/costs";
import { formatPeriod } from "../../../lib/format";
import { t } from "../../../lib/i18n";
import type { Unit } from "../../../lib/units";
import { unitPriceDisplayConfig } from "../components/baseData/costEntryForm.schema";

const CO2_GRAMS_PER_KG = 1000;

/**
 * Angaben einer Position, die neben Kostenart, Zeitraum und Betrag erfasst
 * sind
 */
const itemExtras = (
  item: CostEntryItem,
  costType: CostType | undefined,
  units: Unit[],
): { label: string; value: string }[] => {
  const extras: { label: string; value: string }[] = [];

  const unit = units.find((entry) => entry.id === item.unitId);
  if (unit) {
    extras.push({ label: t("ui.costs.entryFields.unit"), value: unit.name });
  }

  const config = unitPriceDisplayConfig(
    costType?.category ?? null,
    costType?.defaultAllocationKey ?? null,
  );
  if (item.unitPriceCents !== null && config) {
    extras.push({
      label: t("ui.costs.entryFields.unitPrice"),
      value: t("ui.common.measures.withUnit", {
        value: formatNumberLoose(item.unitPriceCents / config.inputScale, 4),
        unit: config.suffix,
      }),
    });
  }

  if (item.laborCostsCents !== null) {
    extras.push({
      label: t("ui.costs.entryFields.laborCosts"),
      value: formatEur(item.laborCostsCents),
    });
  }

  if (item.co2AmountGrams !== null) {
    extras.push({
      label: t("ui.costs.entryFields.co2Amount"),
      value: t("ui.common.measures.kg", {
        value: formatNumberLoose(item.co2AmountGrams / CO2_GRAMS_PER_KG, 3),
      }),
    });
  }

  if (item.co2CostCents !== null) {
    extras.push({
      label: t("ui.costs.entryFields.co2Cost"),
      value: formatEur(item.co2CostCents),
    });
  }

  if (item.containedTaxesCents !== null) {
    extras.push({
      label: t("ui.costs.entryFields.containedTaxes"),
      value: formatEur(item.containedTaxesCents),
    });
  }

  if (item.containedTaxKinds && item.containedTaxKinds.length > 0) {
    extras.push({
      label: t("ui.costs.entryFields.containedTaxKinds"),
      value: item.containedTaxKinds
        .map((kind) => t(`ui.costs.taxKinds.${kind}`))
        .join(t("ui.common.separators.comma")),
    });
  }

  return extras;
};

/**
 * Positionen der Rechnung als Ansicht: je Position eine Zeile mit
 * Bearbeiten und Löschen, darunter die Summe
 */
export const CostEntryItemsCard = ({
  items,
  costTypes,
  units,
  onAdd,
  onEdit,
  onDelete,
}: {
  items: CostEntryItem[];
  costTypes: CostType[];
  units: Unit[];
  onAdd: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => Promise<void>;
}) => {
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const totalCents = items.reduce((sum, item) => sum + item.amountCents, 0);

  // Eine Rechnung braucht mindestens eine Position
  const canDelete = items.length > 1;

  return (
    <SectionCard
      icon={RiListCheck2}
      title={t("ui.invoices.items.title")}
      description={t("ui.invoices.items.description")}
      action={
        <Button type="button" variant="addLink" size="text" onClick={onAdd}>
          <RiAddLine />
          {t("ui.invoices.items.add")}
        </Button>
      }
    >
      {items.length === 0 ? (
        <EmptyNote>{t("ui.invoices.items.empty")}</EmptyNote>
      ) : (
        <div className="-mx-3.5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("ui.costs.entryFields.costType")}</TableHead>
                <TableHead>{t("ui.common.columns.period")}</TableHead>
                <TableHead className="text-right">
                  {t("ui.common.columns.amount")}
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => {
                const costType = costTypes.find(
                  (entry) => entry.id === item.costTypeId,
                );
                const extras = itemExtras(item, costType, units);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-normal">
                      <span className="font-semibold">{item.costTypeName}</span>
                      {extras.length > 0 ? (
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          {extras.map((extra, extraIndex) => (
                            <Fragment key={extra.label}>
                              {extraIndex > 0
                                ? t("ui.common.separators.bullet")
                                : null}
                              {extra.label}{" "}
                              <span className="tabular-nums">
                                {extra.value}
                              </span>
                            </Fragment>
                          ))}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatPeriod(item.periodStart, item.periodEnd)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatEur(item.amountCents)}
                    </TableCell>
                    <TableCell>
                      <RowActions
                        onEdit={() => onEdit(index)}
                        onDelete={
                          canDelete ? () => setDeleteIndex(index) : undefined
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>{t("ui.invoices.items.sum")}</TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">
                  {formatEur(totalCents)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      <DestructiveConfirmDialog
        open={deleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteIndex(null);
          }
        }}
        title={t("ui.invoices.items.confirmRemove")}
        confirmLabel={t("ui.common.action.delete")}
        onConfirm={() => {
          const index = deleteIndex;
          setDeleteIndex(null);
          if (index !== null) {
            onDelete(index).catch((err) => {
              toast.error(
                err instanceof Error ? err.message : t("common.saveFailed"),
              );
            });
          }
        }}
      />
    </SectionCard>
  );
};
