import { messageKey } from "@einfachvermieter/i18n";
import {
  amountRegex,
  type ContainedTaxKind,
  centsToEurInput,
  containedTaxKinds,
  parseEurToCents,
} from "@einfachvermieter/shared";
import { z } from "zod";
import type {
  CostType,
  CostTypeAllocationKey,
  CostTypeCategory,
} from "../../../../lib/costs";
import { t } from "../../../../lib/i18n";

const unitPriceRegex = /^\d+([.,]\d{1,4})?$/u;
/**
 * CO2-Menge wird in kg eingegeben, intern in Gramm (Integer) gespeichert.
 * Daher bis zu drei Nachkommastellen zulässig.
 */
const co2AmountRegex = /^\d+([.,]\d{1,3})?$/u;

/**
 * `unit_price_cents` speichert Tarife mit Skalierung x 10000 (= 1/10000 €).
 * So bleibt auch bei €/kWh-Tarifen wie 0,0789 €/kWh die Genauigkeit erhalten
 * (-> 789). Bei 2,07 €/m3 -> 20700.
 */
const STORAGE_SCALE_PER_EURO = 10_000;
const STORAGE_SCALE_PER_CENT = 100;

export type UnitPriceDisplayConfig = {
  suffix: string;
  inputScale: number;
};

/**
 * Liefert Anzeige-Suffix und Eingabe-Skalierung für eine Kostenart. Bei
 * Heizungs- und Strom-Tarifen wird `ct/kWh` verwendet (x100), weil das die
 * übliche Tarif-Darstellung auf der Rechnung ist. Bei Wasser, Fläche etc.
 * bleibt es bei €/Einheit (x10000). `null` -> kein sinnvoller Einheitspreis
 * (z. B. `fixed`).
 */
export const unitPriceDisplayConfig = (
  category: CostTypeCategory | null,
  allocationKey: CostTypeAllocationKey | null,
): UnitPriceDisplayConfig | null => {
  if (category === "heating") {
    return {
      suffix: t("ui.common.unitPrices.ctPerKwh"),
      inputScale: STORAGE_SCALE_PER_CENT,
    };
  }

  switch (allocationKey) {
    case "per_consumption_m3":
      return {
        suffix: t("ui.common.unitPrices.eurPerCubicMeter"),
        inputScale: STORAGE_SCALE_PER_EURO,
      };

    case "per_consumption_kwh":
      return {
        suffix: t("ui.common.unitPrices.ctPerKwh"),
        inputScale: STORAGE_SCALE_PER_CENT,
      };

    case "per_person":
      return {
        suffix: t("ui.common.unitPrices.eurPerPerson"),
        inputScale: STORAGE_SCALE_PER_EURO,
      };

    case "per_living_area":
    case "per_heating_area":
      return {
        suffix: t("ui.common.unitPrices.eurPerSqm"),
        inputScale: STORAGE_SCALE_PER_EURO,
      };

    case "per_unit":
      return {
        suffix: t("ui.common.unitPrices.eurPerUnit"),
        inputScale: STORAGE_SCALE_PER_EURO,
      };

    default:
      return null;
  }
};

const findUnitPriceConfig = (
  costTypeId: string,
  costTypes: CostType[],
): UnitPriceDisplayConfig | null => {
  const ct = costTypes.find((c) => c.id === costTypeId);
  if (!ct) {
    return null;
  }

  return unitPriceDisplayConfig(ct.category, ct.defaultAllocationKey);
};

const parseUnitPriceWithScale = (value: string, scale: number): number => {
  const normalized = value.replace(",", ".").trim();
  if (normalized === "") {
    return 0;
  }

  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed)) {
    return 0;
  }

  return Math.round(parsed * scale);
};

const formatUnitPriceForInput = (
  storedValue: number | null | undefined,
  scale: number,
): string => {
  if (!storedValue) {
    return "";
  }

  return (storedValue / scale).toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
    useGrouping: false,
  });
};

const CO2_GRAMS_PER_KG = 1000;

const parseKgToGrams = (value: string): number | null => {
  const normalized = value.replace(",", ".").trim();
  if (normalized === "") {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.round(parsed * CO2_GRAMS_PER_KG);
};

const formatGramsToKgInput = (grams: number | null | undefined): string => {
  if (grams === null || grams === undefined) {
    return "";
  }

  return (grams / CO2_GRAMS_PER_KG).toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
    useGrouping: false,
  });
};

export type PriceMode = "fixed" | "per_unit";

export type CostEntryItemFormValues = {
  costTypeId: string;
  /**
   * Direktzuordnung an eine Wohnung. Nur bei `fixed`-Kostenarten relevant und
   * dort Pflicht; leer bei allen anderen Schlüsseln. Die Server-Validierung
   * ist hier die maßgebliche Prüfung (das Formular-Schema kennt den
   * Allocation-Key der gewählten Kostenart nicht).
   */
  unitId: string;
  /**
   * Pro Position: Fixpreis (pauschal, ohne Einheitspreis) oder
   * Verbrauchspreis (mit Einheitspreis für den Tarifvergleich zwischen
   * Perioden). Bei "fixed" wird `unitPriceInput` ignoriert.
   */
  priceMode: PriceMode;
  amountInput: string;
  /**
   * Einheitspreis als String (€). Wird nur ausgewertet, wenn
   * `priceMode === "per_unit"`. Die Einheit ergibt sich aus dem
   * Allocation-Key der Kostenart (m3, kWh, qm, Person, Wohnung).
   */
  unitPriceInput: string;
  /**
   * Lohnkostenanteil der Position als €-String. Wird nur eingeblendet,
   * wenn die zugehörige Kostenart eine § 35a-EStG-Kategorie trägt; leer
   * = kein Lohnkostenanteil ausgewiesen.
   */
  laborCostsInput: string;
  /**
   * CO2-Menge als kg-String. Wird nur eingeblendet, wenn die zugehörige
   * Kostenart `co2Tracked` trägt; leer = nicht erfasst. Intern in Gramm.
   */
  co2AmountInput: string;
  /**
   * Im Gesamtbetrag enthaltener CO2-Kostenanteil als €-String. Gleiche
   * Sichtbarkeitsregel wie `co2AmountInput`.
   */
  co2CostInput: string;
  /**
   * Im Gesamtbetrag enthaltene Steuern, Abgaben und Zölle als €-String
   * (§ 6a Abs. 3 Nr. 1b HeizkostenV). Wird nur bei Heiz-Kostenarten
   * eingeblendet; leer = nicht erfasst.
   */
  containedTaxesInput: string;
  /**
   * Arten der enthaltenen Steuern und Abgaben. Gleiche Sichtbarkeitsregel
   * wie `containedTaxesInput`.
   */
  containedTaxKinds: ContainedTaxKind[];
  periodStart: string;
  periodEnd: string;
};

export type CostEntryFormValues = {
  buildingId: string;
  invoiceDate: string;
  invoiceNumber: string;
  vendor: string;
  items: CostEntryItemFormValues[];
};

const itemSchema = z
  .object({
    costTypeId: z
      .string()
      .min(1, messageKey("ui.costs.validation.costTypeRequired")),
    // Pflicht-/Gebäude-Prüfung passiert serverseitig (der Allocation-Key der
    // Kostenart ist hier nicht bekannt). Fehler kommen als Feld-Fehler zurück.
    unitId: z.string(),
    priceMode: z.enum(["fixed", "per_unit"]),
    amountInput: z
      .string()
      .min(1, messageKey("ui.costs.validation.amountRequired"))
      .regex(amountRegex, messageKey("ui.form.amountFormat"))
      .refine((value) => parseEurToCents(value) > 0, {
        message: messageKey("ui.costs.validation.amountRequired"),
      }),
    unitPriceInput: z
      .string()
      .refine(
        (value) => value === "" || unitPriceRegex.test(value),
        messageKey("ui.costs.validation.unitPriceFormat"),
      ),
    laborCostsInput: z
      .string()
      .refine(
        (value) => value === "" || amountRegex.test(value),
        messageKey("ui.costs.validation.laborFormat"),
      ),
    co2AmountInput: z
      .string()
      .refine(
        (value) => value === "" || co2AmountRegex.test(value),
        messageKey("ui.costs.validation.co2AmountFormat"),
      ),
    co2CostInput: z
      .string()
      .refine(
        (value) => value === "" || amountRegex.test(value),
        messageKey("ui.costs.validation.co2CostFormat"),
      ),
    containedTaxesInput: z
      .string()
      .refine(
        (value) => value === "" || amountRegex.test(value),
        messageKey("ui.costs.validation.containedTaxesFormat"),
      ),
    containedTaxKinds: z.array(z.enum(containedTaxKinds)),
    periodStart: z
      .string()
      .min(1, messageKey("ui.costs.validation.periodStartRequired")),
    periodEnd: z
      .string()
      .min(1, messageKey("ui.costs.validation.periodEndRequired")),
  })
  .refine((d) => d.periodStart <= d.periodEnd, {
    message: messageKey("ui.costs.validation.periodOrder"),
    path: ["periodEnd"],
  })
  .refine(
    (d) => {
      if (d.priceMode !== "per_unit") {
        return true;
      }

      const normalized = d.unitPriceInput.replace(",", ".").trim();
      if (normalized === "") {
        return false;
      }

      const parsed = Number.parseFloat(normalized);

      return !Number.isNaN(parsed) && parsed > 0;
    },
    {
      message: messageKey("ui.costs.validation.unitPriceRequired"),
      path: ["unitPriceInput"],
    },
  )
  .refine(
    (d) => {
      if (d.laborCostsInput.trim() === "") {
        return true;
      }

      const labor = parseEurToCents(d.laborCostsInput);
      const amount = parseEurToCents(d.amountInput);
      return labor <= amount;
    },
    {
      message: messageKey("ui.costs.validation.laborExceedsAmount"),
      path: ["laborCostsInput"],
    },
  )
  .refine(
    (d) => {
      if (d.co2CostInput.trim() === "") {
        return true;
      }

      const co2Cost = parseEurToCents(d.co2CostInput);
      const amount = parseEurToCents(d.amountInput);

      return co2Cost <= amount;
    },
    {
      message: messageKey("ui.costs.validation.co2CostExceedsAmount"),
      path: ["co2CostInput"],
    },
  )
  .refine(
    (d) => {
      if (d.containedTaxesInput.trim() === "") {
        return true;
      }

      const taxes = parseEurToCents(d.containedTaxesInput);
      const amount = parseEurToCents(d.amountInput);

      return taxes <= amount;
    },
    {
      message: messageKey("ui.costs.validation.containedTaxesExceedAmount"),
      path: ["containedTaxesInput"],
    },
  );

export const costEntryFormSchema = z.object({
  buildingId: z
    .string()
    .min(1, messageKey("ui.costs.validation.buildingRequired"))
    .pipe(z.guid()),
  invoiceDate: z
    .string()
    .min(1, messageKey("ui.costs.validation.invoiceDateRequired")),
  invoiceNumber: z.string(),
  vendor: z.string(),
  // Positionen dürfen fehlen: eine aus einem Beleg angelegte Rechnung
  // bekommt sie erst auf der Rechnung.
  items: z.array(itemSchema),
});

export type CostEntryItemSubmitValues = {
  costTypeId: string;
  unitId: string | null;
  amountCents: number;
  unitPriceCents: number | null;
  laborCostsCents: number | null;
  co2AmountGrams: number | null;
  co2CostCents: number | null;
  containedTaxesCents: number | null;
  containedTaxKinds: ContainedTaxKind[] | null;
  periodStart: string;
  periodEnd: string;
};

export type CostEntrySubmitValues = {
  buildingId: string;
  invoiceDate: string;
  invoiceNumber: string | null;
  vendor: string | null;
  notes: string | null;
  items: CostEntryItemSubmitValues[];
};

export const costEntryFormToDto = (
  values: CostEntryFormValues,
  costTypes: CostType[],
): CostEntrySubmitValues => ({
  buildingId: values.buildingId,
  invoiceDate: values.invoiceDate,
  invoiceNumber: values.invoiceNumber.trim() || null,
  vendor: values.vendor.trim() || null,
  notes: null,
  items: values.items.map((item) => {
    const config = findUnitPriceConfig(item.costTypeId, costTypes);
    const inputScale = config?.inputScale ?? STORAGE_SCALE_PER_EURO;
    const costType = costTypes.find((c) => c.id === item.costTypeId);
    const isFixed = costType?.defaultAllocationKey === "fixed";
    return {
      costTypeId: item.costTypeId,
      // Wohnungs-Direktzuordnung nur bei Pauschal-Kostenarten übernehmen;
      // bei allen anderen Schlüsseln bewusst null senden.
      unitId: isFixed && item.unitId.trim() !== "" ? item.unitId : null,
      amountCents: parseEurToCents(item.amountInput),
      unitPriceCents:
        item.priceMode === "per_unit" && item.unitPriceInput.trim() !== ""
          ? parseUnitPriceWithScale(item.unitPriceInput, inputScale)
          : null,
      laborCostsCents:
        item.laborCostsInput.trim() === ""
          ? null
          : parseEurToCents(item.laborCostsInput),
      co2AmountGrams: parseKgToGrams(item.co2AmountInput),
      co2CostCents:
        item.co2CostInput.trim() === ""
          ? null
          : parseEurToCents(item.co2CostInput),
      containedTaxesCents:
        item.containedTaxesInput.trim() === ""
          ? null
          : parseEurToCents(item.containedTaxesInput),
      containedTaxKinds:
        item.containedTaxKinds.length > 0 ? item.containedTaxKinds : null,
      periodStart: item.periodStart,
      periodEnd: item.periodEnd,
    };
  }),
});

type CostEntryItemSource = {
  costTypeId: string;
  unitId?: string | null;
  amountCents: number;
  unitPriceCents?: number | null;
  laborCostsCents?: number | null;
  co2AmountGrams?: number | null;
  co2CostCents?: number | null;
  containedTaxesCents?: number | null;
  containedTaxKinds?: ContainedTaxKind[] | null;
  periodStart: string;
  periodEnd: string;
};

type CostEntrySource = {
  buildingId: string;
  invoiceDate: string;
  invoiceNumber: string | null;
  vendor: string | null;
  items: CostEntryItemSource[];
};

export const costEntryToFormValues = (
  entry: CostEntrySource,
  costTypes: CostType[],
): CostEntryFormValues => ({
  buildingId: entry.buildingId,
  invoiceDate: entry.invoiceDate,
  invoiceNumber: entry.invoiceNumber ?? "",
  vendor: entry.vendor ?? "",
  items: entry.items.map((item) => {
    const config = findUnitPriceConfig(item.costTypeId, costTypes);
    const inputScale = config?.inputScale ?? STORAGE_SCALE_PER_EURO;
    return {
      costTypeId: item.costTypeId,
      unitId: item.unitId ?? "",
      priceMode:
        item.unitPriceCents !== null && item.unitPriceCents !== undefined
          ? "per_unit"
          : "fixed",
      amountInput: centsToEurInput(item.amountCents),
      unitPriceInput: formatUnitPriceForInput(
        item.unitPriceCents ?? null,
        inputScale,
      ),
      laborCostsInput:
        item.laborCostsCents === null || item.laborCostsCents === undefined
          ? ""
          : centsToEurInput(item.laborCostsCents),
      co2AmountInput: formatGramsToKgInput(item.co2AmountGrams),
      co2CostInput:
        item.co2CostCents === null || item.co2CostCents === undefined
          ? ""
          : centsToEurInput(item.co2CostCents),
      containedTaxesInput:
        item.containedTaxesCents === null ||
        item.containedTaxesCents === undefined
          ? ""
          : centsToEurInput(item.containedTaxesCents),
      containedTaxKinds: item.containedTaxKinds ?? [],
      periodStart: item.periodStart,
      periodEnd: item.periodEnd,
    };
  }),
});

export const emptyItem = (defaultCostTypeId = ""): CostEntryItemFormValues => ({
  costTypeId: defaultCostTypeId,
  unitId: "",
  priceMode: "fixed",
  amountInput: centsToEurInput(0),
  unitPriceInput: "",
  laborCostsInput: "",
  co2AmountInput: "",
  co2CostInput: "",
  containedTaxesInput: "",
  containedTaxKinds: [],
  periodStart: "",
  periodEnd: "",
});
