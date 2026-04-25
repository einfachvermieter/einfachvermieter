import type { CostEntryExtractionResult } from "@einfachvermieter/shared";
import { centsToEurInput } from "@einfachvermieter/shared";
import type { UseFormReturn } from "react-hook-form";
import type { CostType } from "../../../../lib/costs";
import {
  type CostEntryFormValues,
  type CostEntryItemFormValues,
  unitPriceDisplayConfig,
} from "../baseData/costEntryForm.schema";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/u;

const isIsoDate = (value: string | null | undefined): value is string =>
  typeof value === "string" && ISO_DATE_REGEX.test(value);

const trimOrNull = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const unitPriceStorageToInput = (
  stored: number | null | undefined,
  inputScale: number,
): string => {
  if (stored === null || stored === undefined || stored === 0) {
    return "";
  }

  return (stored / inputScale).toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
    useGrouping: false,
  });
};

export const applyExtractionToForm = (
  form: UseFormReturn<CostEntryFormValues>,
  result: CostEntryExtractionResult,
  costTypes: CostType[],
): void => {
  const current = form.getValues();

  const vendor = trimOrNull(result.vendor) ?? current.vendor;
  const invoiceNumber =
    trimOrNull(result.invoiceNumber) ?? current.invoiceNumber;
  const invoiceDate = isIsoDate(result.invoiceDate)
    ? result.invoiceDate
    : current.invoiceDate;

  const usableItems = result.items.filter(
    (item) => typeof item.amountCents === "number" && item.amountCents > 0,
  );

  let items: CostEntryItemFormValues[] = current.items;

  if (usableItems.length > 0) {
    const fallbackCostTypeId = costTypes[0]?.id ?? "";
    items = usableItems.map((item) => {
      const costTypeId = item.costTypeId ?? fallbackCostTypeId;
      const matchedCostType = costTypes.find((c) => c.id === costTypeId);
      const config = matchedCostType
        ? unitPriceDisplayConfig(
            matchedCostType.category,
            matchedCostType.defaultAllocationKey,
          )
        : null;

      const hasUnitPrice =
        typeof item.unitPriceCents === "number" && item.unitPriceCents > 0;

      return {
        costTypeId,
        // KI liefert keine Wohnungs-Direktzuordnung. Bei `fixed`-Kostenarten
        // wählt der User die Wohnung manuell nach.
        unitId: "",
        priceMode: hasUnitPrice ? ("per_unit" as const) : ("fixed" as const),
        amountInput: centsToEurInput(item.amountCents ?? 0),
        unitPriceInput: unitPriceStorageToInput(
          item.unitPriceCents,
          config?.inputScale ?? 10_000,
        ),
        // KI liefert keine Lohnkosten-Schätzung. Feld bleibt leer, der
        // User trägt den auf der Rechnung ausgewiesenen Betrag bei Bedarf
        // selbst nach.
        laborCostsInput: "",
        // KI extrahiert keine CO2-Werte (der enthaltene CO2-Preis steckt
        // bereits im Bruttobetrag). Felder bleiben leer.
        co2AmountInput: "",
        co2CostInput: "",
        periodStart: isIsoDate(item.periodStart) ? item.periodStart : "",
        periodEnd: isIsoDate(item.periodEnd) ? item.periodEnd : "",
      };
    });
  }

  form.reset(
    {
      invoiceDate,
      invoiceNumber,
      vendor,
      items,
    },
    { keepDirty: false, keepErrors: false },
  );
};
