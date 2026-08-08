import { messageKey } from "@einfachvermieter/i18n";
import { z } from "zod";
import { centsToEurInputOrEmpty } from "../format.js";
import { isoDate } from "./common.js";

export const heatingModes = ["internal", "external"] as const;
export type HeatingMode = (typeof heatingModes)[number];

export const heatingBaseMethods = ["area"] as const;
export type HeatingBaseMethod = (typeof heatingBaseMethods)[number];

/**
 * Aufteilungsmethode für Heizkostenpositionen, deren Rechnungsperiode
 * mit der Mietzeit nur teilweise überlappt:
 * - "linear":       tagesproportional (ignoriert Saisonalität).
 * - "degree_days":  gewichtet nach Gradtagszahlen (Summe = 1.000 ‰).
 *                   Wintertage haben deutlich höheres Gewicht. § 9b Abs. 2
 *                   HeizkostenV lässt diese Verteilung bei Mieterwechsel
 *                   ausdrücklich zu.
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
 * Energieträger, für die überhaupt ein CO2-Preis nach BEHG/CO2KostAufG anfällt
 * und eine CO2-Kostenaufteilung damit fachlich zulässig ist: fossile
 * Brennstoffe (Heizöl, Erdgas) sowie Fernwärme (der Versorger reicht seine
 * CO2-Kosten durch).
 */
const CO2_PRICE_ELIGIBLE_FUELS = new Set<HeatingFuelType>([
  "gas",
  "oil",
  "district_heat",
]);

/**
 * True, wenn für den Energieträger kein CO2-Preis anfällt und eine aktive
 * CO2-Kostenaufteilung damit fachlich widersprüchlich ist (Holz, Pellets,
 * Strom, Wärmepumpe). "other" bleibt unbewertet (kann z. B. Flüssiggas sein).
 */
export const isCo2SplitInapplicableFuel = (
  fuelType: HeatingFuelType,
): boolean => fuelType !== "other" && !CO2_PRICE_ELIGIBLE_FUELS.has(fuelType);

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
const internalSchema = z
  .object({
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
    // Mit Default, damit Aufrufer die Sonderfall-Schalter weglassen können.
    // Der Normalfall ist "trifft nicht zu".
    gasBillingByCalorificValue: z.boolean().default(false),
    heatPumpMonovalent: z.boolean().default(false),
    mandatorySeventyPercent: z.boolean().default(false),
    // Fernwärme-Kennwerte für die Abrechnungsinformationen nach § 6a
    // Abs. 3 HeizkostenV; nur bei fuelType = "district_heat" sinnvoll.
    districtHeatEmissionsKgPerYear: z
      .number()
      .nonnegative()
      .nullable()
      .default(null),
    districtHeatPrimaryEnergyFactor: z
      .number()
      .positive()
      .max(10)
      .nullable()
      .default(null),
    co2CostShareEnabled: z.boolean(),
  })
  .strict();

const externalSchema = z
  .object({
    mode: z.literal("external"),
    validFrom: isoDate(),
    validTo: isoDate().nullable(),
    // § 6a-Informationsseite mitdrucken; abwählbar nur extern, wenn die
    // Angaben auf der Abrechnung des Wärmedienstleisters stehen.
    includeBillingInfo: z.boolean().default(true),
  })
  .strict();

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
    // § 7 Abs. 1 Satz 2 HeizkostenV: Gebäude unter dem Anforderungsniveau der
    // WSchV 1994 mit Öl-/Gas-Zentralheizung und überwiegend gedämmten
    // freiliegenden Leitungen müssen 70 % nach Verbrauch verteilen.
    (value) =>
      value.mode !== "internal" ||
      !value.mandatorySeventyPercent ||
      value.consumptionSharePercent === 70,
    {
      path: ["consumptionSharePercent"],
      message: messageKey("ui.heating.validation.seventyPercentMandatory"),
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
  /**
   * Brennwertbezogene Erdgas-Abrechnung: Faktor 1,11 auf die nach den Formeln
   * des § 9 Abs. 2 HeizkostenV bestimmte Warmwasser-Wärmemenge.
   */
  gasBillingByCalorificValue: boolean;
  /**
   * Monovalent betriebene Wärmepumpe: Faktor 0,30 (§ 9 Abs. 2 HeizkostenV).
   */
  heatPumpMonovalent: boolean;
  /**
   * Gebäude mit zwingenden 70 % Verbrauchsanteil nach
   * § 7 Abs. 1 Satz 2 HeizkostenV.
   */
  mandatorySeventyPercent: boolean;
  /**
   * Jährliche Treibhausgasemissionen des Fernwärmenetzes in kg
   * (§ 6a Abs. 3 HeizkostenV). Nur bei Fernwärme; NULL = nicht erfasst.
   */
  districtHeatEmissionsKgPerYear: number | null;
  /**
   * Primärenergiefaktor des Fernwärmenetzes (§ 6a Abs. 3 HeizkostenV).
   * Nur bei Fernwärme; NULL = nicht erfasst.
   */
  districtHeatPrimaryEnergyFactor: number | null;
  /**
   * Ob die § 6a-Informationsseite mit der Abrechnung gedruckt wird. Nur im
   * externen Modus abwählbar; intern immer true.
   */
  includeBillingInfo: boolean;
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
  gasBillingByCalorificValue: boolean;
  heatPumpMonovalent: boolean;
  mandatorySeventyPercent: boolean;
  /**
   * Jährliche THG-Emissionen des Fernwärmenetzes in kg, als String im
   * Formular; leer = nicht erfasst.
   */
  districtHeatEmissionsKgPerYear: string;
  /**
   * Primärenergiefaktor des Fernwärmenetzes, als String im Formular
   * ("0,28"); leer = nicht erfasst.
   */
  districtHeatPrimaryEnergyFactor: string;
  /**
   * § 6a-Informationsseite mitdrucken; nur im externen Modus abwählbar.
   */
  includeBillingInfo: boolean;
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

const decimalRegex = /^\d+([.,]\d+)?$/u;

const parseDecimal = (value: string): number =>
  Number.parseFloat(value.replace(",", "."));

/**
 * Formatprüfung der optionalen Fernwärme-Kennwerte (§ 6a Abs. 3
 * HeizkostenV). Leere Felder sind zulässig, fehlende Werte melden
 * erst die Berechnung als Warnung.
 */
const validateDistrictHeatFields = (
  value: {
    districtHeatEmissionsKgPerYear: string;
    districtHeatPrimaryEnergyFactor: string;
  },
  ctx: z.RefinementCtx,
): void => {
  const emissionsRaw = value.districtHeatEmissionsKgPerYear.trim();
  if (emissionsRaw.length > 0 && !decimalRegex.test(emissionsRaw)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["districtHeatEmissionsKgPerYear"],
      message: messageKey("ui.heating.validation.districtHeatEmissionsInvalid"),
    });
  }

  const factorRaw = value.districtHeatPrimaryEnergyFactor.trim();
  if (
    factorRaw.length > 0 &&
    (!decimalRegex.test(factorRaw) ||
      !(parseDecimal(factorRaw) > 0 && parseDecimal(factorRaw) <= 10))
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["districtHeatPrimaryEnergyFactor"],
      message: messageKey("ui.heating.validation.districtHeatFactorInvalid"),
    });
  }
};

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
    gasBillingByCalorificValue: z.boolean(),
    heatPumpMonovalent: z.boolean(),
    mandatorySeventyPercent: z.boolean(),
    districtHeatEmissionsKgPerYear: z.string(),
    districtHeatPrimaryEnergyFactor: z.string(),
    includeBillingInfo: z.boolean(),
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

    if (value.fuelType === "district_heat") {
      validateDistrictHeatFields(value, ctx);
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
      includeBillingInfo: values.includeBillingInfo,
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
    gasBillingByCalorificValue: values.gasBillingByCalorificValue,
    heatPumpMonovalent: values.heatPumpMonovalent,
    mandatorySeventyPercent: values.mandatorySeventyPercent,
    districtHeatEmissionsKgPerYear:
      values.fuelType === "district_heat"
        ? parseOptionalDecimal(values.districtHeatEmissionsKgPerYear)
        : null,
    districtHeatPrimaryEnergyFactor:
      values.fuelType === "district_heat"
        ? parseOptionalDecimal(values.districtHeatPrimaryEnergyFactor)
        : null,
    co2CostShareEnabled: values.co2CostShareEnabled,
  };
};

/**
 * Parst "1250" oder "0,28" in eine Zahl; leere/unlesbare Eingaben
 * werden zu NULL (= nicht erfasst).
 */
const parseOptionalDecimal = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || !decimalRegex.test(trimmed)) {
    return null;
  }

  const parsed = parseDecimal(trimmed);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
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
  gasBillingByCalorificValue: false,
  heatPumpMonovalent: false,
  mandatorySeventyPercent: false,
  districtHeatEmissionsKgPerYear: "",
  districtHeatPrimaryEnergyFactor: "",
  includeBillingInfo: true,
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
  gasBillingByCalorificValue: settings.gasBillingByCalorificValue,
  heatPumpMonovalent: settings.heatPumpMonovalent,
  mandatorySeventyPercent: settings.mandatorySeventyPercent,
  districtHeatEmissionsKgPerYear:
    settings.districtHeatEmissionsKgPerYear === null
      ? ""
      : String(settings.districtHeatEmissionsKgPerYear).replace(".", ","),
  districtHeatPrimaryEnergyFactor:
    settings.districtHeatPrimaryEnergyFactor === null
      ? ""
      : String(settings.districtHeatPrimaryEnergyFactor).replace(".", ","),
  includeBillingInfo: settings.includeBillingInfo,
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
  .strict()
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

export const externalHeatingEntryToFormValues = (
  entry: ExternalHeatingEntry,
): ExternalHeatingEntryFormValues => ({
  unitId: entry.unitId,
  periodStart: entry.periodStart,
  periodEnd: entry.periodEnd,
  totalCents: centsToEurInputOrEmpty(entry.totalCents),
  baseCostCents: centsToEurInputOrEmpty(entry.baseCostCents),
  consumptionCostCents: centsToEurInputOrEmpty(entry.consumptionCostCents),
  notes: entry.notes ?? "",
});

/**
 * Manuell erfassten Klimafaktor setzen (Witterungsbereinigung).
 * Der Zeitraum muss ein Abrechnungszeitraum (12-Monats-Fenster) sein.
 */
export const climateFactorWriteSchema = z
  .object({
    buildingId: z.guid(),
    periodStart: isoDate(),
    periodEnd: isoDate(),
    factor: z.number().positive().max(5),
  })
  .strict();
export type ClimateFactorWriteDto = z.infer<typeof climateFactorWriteSchema>;

/**
 * Klimafaktor eines Zeitraums frisch vom DWD laden (überschreibt auch
 * manuell erfasste Werte).
 */
export const climateFactorReloadSchema = z
  .object({
    buildingId: z.guid(),
    periodStart: isoDate(),
    periodEnd: isoDate(),
  })
  .strict();
export type ClimateFactorReloadDto = z.infer<typeof climateFactorReloadSchema>;
