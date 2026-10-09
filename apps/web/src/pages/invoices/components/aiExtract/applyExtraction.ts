import type { CostEntryExtractionResult } from "@einfachvermieter/shared";
import { centsToEurInput } from "@einfachvermieter/shared";
import type { CostType } from "../../../../lib/costs";
import {
  type CostEntryFormValues,
  type CostEntryItemFormValues,
  costEntryToFormValues,
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

type Co2Inputs = Pick<
  CostEntryItemFormValues,
  | "co2AmountInput"
  | "co2CostInput"
  | "co2EnergyInput"
  | "co2EmissionFactorInput"
>;

/**
 * CO2-Angaben der Rechnung als Formularwerte. Nur bei Kostenarten mit
 * CO2-Erfassung, sonst bleiben die Felder leer. Der Emissionsfaktor wird
 * auf die sechs Nachkommastellen gerundet, die das Formular annimmt.
 */
const co2Inputs = (
  item: CostEntryExtractionResult["items"][number],
  costType: CostType | undefined,
): Co2Inputs => {
  const tracked = costType?.co2Tracked === true;
  const [values] = costEntryToFormValues(
    {
      buildingId: "",
      invoiceDate: "",
      invoiceNumber: null,
      vendor: null,
      items: [
        {
          costTypeId: costType?.id ?? "",
          amountCents: 0,
          periodStart: "",
          periodEnd: "",
          co2AmountGrams: tracked ? item.co2AmountGrams : null,
          co2CostCents: tracked ? item.co2CostCents : null,
          co2EnergyKwh: tracked ? item.co2EnergyKwh : null,
          co2EmissionFactorKgPerKwh: tracked
            ? item.co2EmissionFactorKgPerKwh
            : null,
        },
      ],
    },
    costType ? [costType] : [],
  ).items;

  return {
    co2AmountInput: values?.co2AmountInput ?? "",
    co2CostInput: values?.co2CostInput ?? "",
    co2EnergyInput: values?.co2EnergyInput ?? "",
    co2EmissionFactorInput: values?.co2EmissionFactorInput ?? "",
  };
};

/**
 * Erkannte Rechnungsdaten über die vorhandenen Werte legen. Was die
 * Erkennung nicht liefert, bleibt stehen.
 */
export const applyExtraction = (
  current: CostEntryFormValues,
  result: CostEntryExtractionResult,
  costTypes: CostType[],
): CostEntryFormValues => {
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
        ...co2Inputs(item, matchedCostType),
        // KI extrahiert keine Steuer-/Abgaben-Anteile; Felder bleiben leer.
        containedTaxesInput: "",
        containedTaxKinds: [],
        periodStart: isIsoDate(item.periodStart) ? item.periodStart : "",
        periodEnd: isIsoDate(item.periodEnd) ? item.periodEnd : "",
      };
    });
  }

  return {
    buildingId: current.buildingId,
    invoiceDate,
    invoiceNumber,
    vendor,
    items,
  };
};
