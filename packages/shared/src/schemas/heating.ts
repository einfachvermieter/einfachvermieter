import { messageKey } from "@einfachvermieter/i18n";
import { z } from "zod";
import { isoDate } from "./common.js";

export const heatingModes = ["internal", "external"] as const;
export type HeatingMode = (typeof heatingModes)[number];

export const heatingBaseMethods = ["area"] as const;
export type HeatingBaseMethod = (typeof heatingBaseMethods)[number];

/**
 * Aufteilungsmethode für Heizkostenpositionen, deren Rechnungsperiode
 * mit der Mietzeit nur teilweise überlappt:
 * - "linear":       tagesproportional (ignoriert Saisonalität).
 * - "degree_days":  gewichtet nach der Gradtagstabelle aus der Anlage zu
 *                   § 9 Abs. 3 HeizkostenV (Summe = 1.000 ‰). Wintertage
 *                   haben deutlich höheres Gewicht. Rechtlich verbindliche
 *                   Verteilung für tagesgenaue Mieter-Abgrenzung.
 */
export const heatingProrationMethods = ["linear", "degree_days"] as const;
export type HeatingProrationMethod = (typeof heatingProrationMethods)[number];

/**
 * Verbrauchserfassung der internen Heizkostenabrechnung:
 * - "heat_meter":          Wärmemengenzähler (kWh-Direktmessung pro Wohnung)
 * - "heat_cost_allocator": Heizkostenverteiler am Heizkörper
 *                          (HKV-Anzeigewerte mit Bewertungsfaktor kTotal
 *                          je Heizkörper).
 */
export const heatingConsumptionMethods = [
  "heat_meter",
  "heat_cost_allocator",
] as const;
export type HeatingConsumptionMethod =
  (typeof heatingConsumptionMethods)[number];

/**
 * Bauliche Heizungsart eines Gebäudes. Entscheidend für die spätere
 * Aufteilung Heizung vs. Warmwasser bei zentraler Versorgung.
 */
export const heatingTypes = [
  "central_with_hot_water",
  "central_without_hot_water",
  "decentralized",
] as const;
export type HeatingType = (typeof heatingTypes)[number];

/**
 * Eingesetzter Energieträger der Heizungsanlage. Pflichtangabe nach
 * § 6a HeizkostenV gegenüber den Mietern und Grundlage für den CO2-Faktor
 * nach CO2KostAufG.
 */
export const heatingFuelTypes = [
  "gas",
  "oil",
  "district_heat",
  "pellets",
  "wood",
  "electricity",
  "heat_pump",
  "other",
] as const;
export type HeatingFuelType = (typeof heatingFuelTypes)[number];

/**
 * Write-Schema für die Heizkosten-Konfiguration. Wird sowohl beim
 * Anlegen einer neuen Version als auch beim Aktualisieren einer
 * bestehenden Version verwendet.
 *
 * - validFrom ist Pflicht (inklusiv).
 * - validTo ist optional (inklusiv); NULL = noch offen.
 * - Im Modus "internal" sind alle Verteilungs- und Anlagenfelder Pflicht.
 * - Im Modus "external" sind die Verteilungsfelder bedeutungslos;
 *   Endbeträge werden über externalHeatingEntries erfasst.
 */
const internalSchema = z.object({
  mode: z.literal("internal"),
  validFrom: isoDate(),
  validTo: isoDate().nullable(),
  baseSharePercent: z.number().int().min(0).max(100),
  consumptionSharePercent: z.number().int().min(0).max(100),
  baseMethod: z.enum(heatingBaseMethods),
  consumptionMethod: z.enum(heatingConsumptionMethods),
  prorationMethod: z.enum(heatingProrationMethods),
  heatingType: z.enum(heatingTypes),
  fuelType: z.enum(heatingFuelTypes),
  hotWaterMeterId: z.guid().nullable(),
  hotWaterSupplyTemperatureCelsius: z.number().int().min(20).max(95),
  totalHeatEnergyKwh: z.number().positive().nullable(),
  co2CostShareEnabled: z.boolean(),
});

const externalSchema = z.object({
  mode: z.literal("external"),
  validFrom: isoDate(),
  validTo: isoDate().nullable(),
});

export const heatingSettingsWriteSchema = z
  .discriminatedUnion("mode", [internalSchema, externalSchema])
  .refine(
    (value) =>
      value.mode !== "internal" ||
      value.baseSharePercent + value.consumptionSharePercent === 100,
    {
      path: ["consumptionSharePercent"],
      message: messageKey("ui.heating.validation.percentSum"),
    },
  )
  .refine(
    // § 7 Abs. 1 HeizkostenV: Verbrauchsanteil mindestens 50 %, höchstens
    // 70 % (Grundkosten also 30-50 %). Sonderfälle (z. B. Passivhäuser)
    // sind bewusst nicht abgebildet - die App erzwingt die Standard-
    // Bandbreite hart.
    (value) =>
      value.mode !== "internal" ||
      (value.consumptionSharePercent >= 50 &&
        value.consumptionSharePercent <= 70),
    {
      path: ["consumptionSharePercent"],
      message: messageKey("ui.heating.validation.consumptionShareBandwidth"),
    },
  )
  .refine(
    (value) => value.validTo === null || value.validTo >= value.validFrom,
    {
      path: ["validTo"],
      message: messageKey("ui.heating.validation.validToBeforeFrom"),
    },
  );

export type HeatingSettingsWriteDto = z.infer<
  typeof heatingSettingsWriteSchema
>;

/**
 * Vollständige Heizkosten-Konfiguration, wie sie von der API zurück-
 * gegeben wird. Die Verteilungsfelder werden im externen Modus zwar
 * mit Defaults gespeichert, sind fachlich aber bedeutungslos.
 */
export type HeatingSettings = {
  id: string;
  buildingId: string;
  mode: HeatingMode;
  baseSharePercent: number;
  consumptionSharePercent: number;
  baseMethod: HeatingBaseMethod;
  consumptionMethod: HeatingConsumptionMethod;
  /**
   * Aufteilungsmethode bei nur teilweise überlappenden Rechnungs-/
   * Mietperioden. Default: "linear" (tagesproportional).
   */
  prorationMethod: HeatingProrationMethod;
  heatingType: HeatingType;
  fuelType: HeatingFuelType;
  /**
   * Verknüpfter WMZ am Warmwasserboiler. NULL -> Schätzformel nach
   * § 9 Abs. 2 HeizkostenV.
   */
  hotWaterMeterId: string | null;
  hotWaterSupplyTemperatureCelsius: number;
  /**
   * Gesamt-Wärmemenge der Anlage in kWh (Q_gesamt) - Nenner der Warmwasser-
   * Abspaltung nach § 9 Abs. 2 HeizkostenV. NULL -> keine Abspaltung.
   */
  totalHeatEnergyKwh: number | null;
  co2CostShareEnabled: boolean;
  /**
   * Inklusiver Start-Stichtag (YYYY-MM-DD).
   */
  validFrom: string;
  /**
   * Inklusives Ende-Stichtag oder NULL für "noch offen".
   */
  validTo: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Formular-Werte. Verbrauchsanteil und Grundkostenanteil sind beide
 * Eingabefelder; das UI hält sie reziprok in Summe = 100. Der Grund-
 * kosten-Verteilschlüssel ist im MVP fest auf "area". Verbrauchs-
 * erfassung, Heizungsart und Brennstoff sind im internen Modus Pflicht.
 */
/**
 * Sentinel für "kein Boiler-WMZ" im Form-Select.
 */
export const HOT_WATER_METER_NONE = "__none__";
export type HotWaterMeterNone = typeof HOT_WATER_METER_NONE;

export type HeatingFormValues = {
  /**
   * Gebäude, zu dem die Konfiguration gehört.
   */
  buildingId: string;
  mode: HeatingMode;
  /**
   * YYYY-MM-DD, Pflicht.
   */
  validFrom: string;
  /**
   * YYYY-MM-DD oder leerer String ("noch offen").
   */
  validTo: string;
  consumptionSharePercent: string;
  baseSharePercent: string;
  consumptionMethod: HeatingConsumptionMethod;
  prorationMethod: HeatingProrationMethod;
  heatingType: HeatingType;
  fuelType: HeatingFuelType;
  hotWaterMeterId: string | HotWaterMeterNone;
  hotWaterSupplyTemperatureCelsius: string;
  /**
   * Gesamt-Wärmemenge in kWh (Q_gesamt), als String im Formular.
   */
  totalHeatEnergyKwh: string;
  co2CostShareEnabled: boolean;
};

const percentIntRegex = /^\d{1,3}$/u;

const validatePercentField = (
  raw: string,
  path: "consumptionSharePercent" | "baseSharePercent",
  ctx: z.RefinementCtx,
): number | null => {
  if (raw.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [path],
      message: messageKey("validation.required"),
    });
    return null;
  }
  if (!percentIntRegex.test(raw)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [path],
      message: messageKey("ui.heating.validation.percentRange"),
    });
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (parsed < 0 || parsed > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [path],
      message: messageKey("ui.heating.validation.percentRange"),
    });
    return null;
  }
  return parsed;
};

const tempIntRegex = /^\d{1,2}$/u;

const energyKwhRegex = /^\d{1,9}([.,]\d{1,3})?$/u;

/**
 * Parst "12345" oder "12345,5" in eine kWh-Zahl. NaN bei Unfug.
 */
const parseEnergyKwh = (raw: string): number =>
  Number.parseFloat(raw.replace(/\./gu, "").replace(",", "."));

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/u;

export const heatingFormSchema = z
  .object({
    buildingId: z.guid(),
    mode: z.enum(heatingModes),
    validFrom: z.string(),
    validTo: z.string(),
    consumptionSharePercent: z.string(),
    baseSharePercent: z.string(),
    consumptionMethod: z.enum(heatingConsumptionMethods),
    prorationMethod: z.enum(heatingProrationMethods),
    heatingType: z.enum(heatingTypes),
    fuelType: z.enum(heatingFuelTypes),
    hotWaterMeterId: z.string().min(1),
    hotWaterSupplyTemperatureCelsius: z.string(),
    totalHeatEnergyKwh: z.string(),
    co2CostShareEnabled: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!isoDateRegex.test(value.validFrom)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["validFrom"],
        message: messageKey("validation.invalidDate"),
      });
    }
    if (value.validTo.length > 0) {
      if (!isoDateRegex.test(value.validTo)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["validTo"],
          message: messageKey("validation.invalidDate"),
        });
      } else if (
        isoDateRegex.test(value.validFrom) &&
        value.validTo < value.validFrom
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["validTo"],
          message: messageKey("ui.heating.validation.validToBeforeFrom"),
        });
      }
    }
    if (value.mode !== "internal") {
      return;
    }
    const consumption = validatePercentField(
      value.consumptionSharePercent,
      "consumptionSharePercent",
      ctx,
    );
    const base = validatePercentField(
      value.baseSharePercent,
      "baseSharePercent",
      ctx,
    );
    if (consumption !== null && base !== null && consumption + base !== 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["consumptionSharePercent"],
        message: messageKey("ui.heating.validation.percentSum"),
      });
    }
    // § 7 Abs. 1 HeizkostenV: Verbrauchsanteil 50-70 % (Grundkosten 30-50 %).
    if (consumption !== null && (consumption < 50 || consumption > 70)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["consumptionSharePercent"],
        message: messageKey("ui.heating.validation.consumptionShareBandwidth"),
      });
    }
    if (value.heatingType === "central_with_hot_water") {
      const raw = value.hotWaterSupplyTemperatureCelsius;
      if (!tempIntRegex.test(raw)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["hotWaterSupplyTemperatureCelsius"],
          message: messageKey("ui.heating.validation.tempRange"),
        });
      } else {
        const temp = Number.parseInt(raw, 10);
        if (temp < 20 || temp > 95) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["hotWaterSupplyTemperatureCelsius"],
            message: messageKey("ui.heating.validation.tempRange"),
          });
        }
      }
      // Q_gesamt ist bei zentralem Warmwasser Pflicht - ohne den Nenner
      // kann der Warmwasseranteil (§ 9 Abs. 2 HeizkostenV) nicht
      // herausgerechnet werden.
      const energyRaw = value.totalHeatEnergyKwh.trim();
      if (energyRaw.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["totalHeatEnergyKwh"],
          message: messageKey("validation.required"),
        });
      } else if (
        !energyKwhRegex.test(energyRaw) ||
        parseEnergyKwh(energyRaw) <= 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["totalHeatEnergyKwh"],
          message: messageKey("ui.heating.validation.totalHeatEnergyInvalid"),
        });
      }
    }
  });

export const heatingFormToDto = (
  values: HeatingFormValues,
): HeatingSettingsWriteDto => {
  const validTo = values.validTo.length === 0 ? null : values.validTo;
  if (values.mode === "external") {
    return {
      mode: "external",
      validFrom: values.validFrom,
      validTo,
    };
  }
  const consumption = Number.parseInt(values.consumptionSharePercent, 10);
  const base = Number.parseInt(values.baseSharePercent, 10);
  const tempRaw = values.hotWaterSupplyTemperatureCelsius;
  const temp = tempIntRegex.test(tempRaw) ? Number.parseInt(tempRaw, 10) : 60;
  const energyRaw = values.totalHeatEnergyKwh.trim();
  const totalHeatEnergyKwh =
    energyKwhRegex.test(energyRaw) && parseEnergyKwh(energyRaw) > 0
      ? parseEnergyKwh(energyRaw)
      : null;
  return {
    mode: "internal",
    validFrom: values.validFrom,
    validTo,
    baseSharePercent: base,
    consumptionSharePercent: consumption,
    baseMethod: "area",
    consumptionMethod: values.consumptionMethod,
    prorationMethod: values.prorationMethod,
    heatingType: values.heatingType,
    fuelType: values.fuelType,
    hotWaterMeterId:
      values.hotWaterMeterId === HOT_WATER_METER_NONE
        ? null
        : values.hotWaterMeterId,
    hotWaterSupplyTemperatureCelsius: temp,
    totalHeatEnergyKwh,
    co2CostShareEnabled: values.co2CostShareEnabled,
  };
};

/**
 * Default-Werte für eine neue Heizkosten-Version. Werden vom Form
 * verwendet, wenn keine Vorlage vorhanden ist.
 */
export const emptyHeatingFormValues = (
  buildingId: string,
  validFrom: string,
): HeatingFormValues => ({
  buildingId,
  mode: "internal",
  validFrom,
  validTo: "",
  consumptionSharePercent: "70",
  baseSharePercent: "30",
  consumptionMethod: "heat_meter",
  prorationMethod: "linear",
  heatingType: "central_without_hot_water",
  fuelType: "gas",
  hotWaterMeterId: HOT_WATER_METER_NONE,
  hotWaterSupplyTemperatureCelsius: "60",
  totalHeatEnergyKwh: "",
  co2CostShareEnabled: true,
});

export const heatingSettingsToFormValues = (
  settings: HeatingSettings,
): HeatingFormValues => ({
  buildingId: settings.buildingId,
  mode: settings.mode,
  validFrom: settings.validFrom,
  validTo: settings.validTo ?? "",
  consumptionSharePercent: String(settings.consumptionSharePercent),
  baseSharePercent: String(settings.baseSharePercent),
  consumptionMethod: settings.consumptionMethod,
  prorationMethod: settings.prorationMethod,
  heatingType: settings.heatingType,
  fuelType: settings.fuelType,
  hotWaterMeterId: settings.hotWaterMeterId ?? HOT_WATER_METER_NONE,
  hotWaterSupplyTemperatureCelsius: String(
    settings.hotWaterSupplyTemperatureCelsius,
  ),
  totalHeatEnergyKwh:
    settings.totalHeatEnergyKwh === null
      ? ""
      : String(settings.totalHeatEnergyKwh),
  co2CostShareEnabled: settings.co2CostShareEnabled,
});

/**
 * Extern berechnete Heizkosten pro Wohnung und Zeitraum.
 * Wird nur im externen Modus ausgewertet; die App übernimmt die
 * Endbeträge unverändert in die Abrechnung.
 */
export type ExternalHeatingEntry = {
  id: string;
  buildingId: string;
  unitId: string;
  periodStart: string;
  periodEnd: string;
  totalCents: number;
  baseCostCents: number | null;
  consumptionCostCents: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

const externalEntryBaseSchema = z
  .object({
    unitId: z.string().min(1),
    periodStart: isoDate(),
    periodEnd: isoDate(),
    totalCents: z.number().int().nonnegative(),
    baseCostCents: z.number().int().nonnegative().nullable().optional(),
    consumptionCostCents: z.number().int().nonnegative().nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.periodEnd < value.periodStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["periodEnd"],
        message: messageKey("ui.heating.external.validation.periodRange"),
      });
    }
    const base = value.baseCostCents ?? 0;
    const consumption = value.consumptionCostCents ?? 0;
    if (base + consumption > value.totalCents) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["consumptionCostCents"],
        message: messageKey("ui.heating.external.validation.splitExceedsTotal"),
      });
    }
  });

export const externalHeatingEntryCreateSchema = externalEntryBaseSchema;
export const externalHeatingEntryUpdateSchema = externalEntryBaseSchema;

export type ExternalHeatingEntryCreateDto = z.infer<
  typeof externalHeatingEntryCreateSchema
>;
export type ExternalHeatingEntryUpdateDto = z.infer<
  typeof externalHeatingEntryUpdateSchema
>;

export type ExternalHeatingEntryFormValues = {
  unitId: string;
  periodStart: string;
  periodEnd: string;
  totalCents: string;
  baseCostCents: string;
  consumptionCostCents: string;
  notes: string;
};

export const emptyExternalHeatingEntryFormValues: ExternalHeatingEntryFormValues =
  {
    unitId: "",
    periodStart: "",
    periodEnd: "",
    totalCents: "",
    baseCostCents: "",
    consumptionCostCents: "",
    notes: "",
  };

/**
 * Konvertiert Formularwerte (alles Strings) in den API-DTO. Leere
 * optionale Felder werden zu `null`, Cent-Beträge werden aus
 * "123,45"-Notation in Integer-Cents geparst.
 */
const parseCents = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const normalized = trimmed.replace(/\./gu, "").replace(",", ".");
  const euros = Number.parseFloat(normalized);
  if (!Number.isFinite(euros)) {
    return null;
  }
  return Math.round(euros * 100);
};

export const externalHeatingEntryFormToDto = (
  values: ExternalHeatingEntryFormValues,
): ExternalHeatingEntryCreateDto => ({
  unitId: values.unitId,
  periodStart: values.periodStart,
  periodEnd: values.periodEnd,
  totalCents: parseCents(values.totalCents) ?? 0,
  baseCostCents: parseCents(values.baseCostCents),
  consumptionCostCents: parseCents(values.consumptionCostCents),
  notes: values.notes.trim().length === 0 ? null : values.notes.trim(),
});

const formatCents = (cents: number | null | undefined): string => {
  if (cents === null || cents === undefined) {
    return "";
  }
  return (cents / 100).toFixed(2).replace(".", ",");
};

export const externalHeatingEntryToFormValues = (
  entry: ExternalHeatingEntry,
): ExternalHeatingEntryFormValues => ({
  unitId: entry.unitId,
  periodStart: entry.periodStart,
  periodEnd: entry.periodEnd,
  totalCents: formatCents(entry.totalCents),
  baseCostCents: formatCents(entry.baseCostCents),
  consumptionCostCents: formatCents(entry.consumptionCostCents),
  notes: entry.notes ?? "",
});
