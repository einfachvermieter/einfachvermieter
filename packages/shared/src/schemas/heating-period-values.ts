import { messageKey } from "@einfachvermieter/i18n";
import { z } from "zod";
import { normalizeNumberInput } from "../format.js";
import { isoDate } from "./common.js";
import type { HeatingSettings } from "./heating.js";

/**
 * Werte eines Abrechnungszeitraums je Gebäude: Gesamt-Wärmemenge und die
 * Fernwärme-Angaben nach § 6a Abs. 3 HeizkostenV. NULL = nicht eingetragen.
 */
export type HeatingPeriodValueSet = {
  /**
   * Gesamt-Wärmemenge der Anlage in kWh (Q_gesamt), Nenner der Warmwasser-
   * Abspaltung nach § 9 Abs. 2 HeizkostenV
   */
  totalHeatEnergyKwh: number | null;
  /**
   * Jährliche Treibhausgasemissionen in kg, wie der Wärmelieferant sie
   * ausweist
   */
  districtHeatEmissionsKgPerYear: number | null;
  districtHeatPrimaryEnergyFactor: number | null;
};

export const emptyHeatingPeriodValueSet: HeatingPeriodValueSet = {
  totalHeatEnergyKwh: null,
  districtHeatEmissionsKgPerYear: null,
  districtHeatPrimaryEnergyFactor: null,
};

/**
 * Welche Werte des Abrechnungszeitraums die Berechnung verwendet
 */
export type HeatingPeriodValueRelevance = {
  totalHeatEnergy: boolean;
  districtHeat: boolean;
};

/**
 * Bestimmt, welche Werte des Abrechnungszeitraums Bedeutung haben, über
 * alle Versionen der Heizkostenkonfiguration im Zeitraum. Die Berechnung
 * und die Eingabe an der Abrechnung fragen beide hier: die
 * Gesamt-Wärmemenge zählt, wenn eine Version eine Warmwasser-Abspaltung
 * rechnet, die Fernwärme-Werte, wenn eine Version Fernwärme-Angaben
 * ausgibt.
 */
export const heatingPeriodValueRelevance = (
  versions: readonly Pick<
    HeatingSettings,
    "mode" | "heatingType" | "fuelType"
  >[],
): HeatingPeriodValueRelevance => ({
  totalHeatEnergy: versions.some(
    (settings) =>
      settings.mode === "internal" &&
      settings.heatingType === "central_with_hot_water",
  ),
  districtHeat: versions.some(
    (settings) =>
      settings.mode === "internal" && settings.fuelType === "district_heat",
  ),
});

/**
 * Antwort der API für Gebäude und Zeitraum. Ohne gespeicherte Zeile sind
 * alle Werte NULL.
 */
export type HeatingPeriodValues = HeatingPeriodValueSet & {
  relevance: HeatingPeriodValueRelevance;
  /**
   * Ohne eingetragene Gesamt-Wärmemenge zählt die Differenz dieses Zählers.
   */
  hasMainHeatMeter: boolean;
  /**
   * Finalisierte Abrechnung des Gebäudes für genau diesen Zeitraum; solange
   * es sie gibt, sind die Werte gesperrt.
   */
  lockedByStatementId: string | null;
};

/**
 * Setzt die Werte eines Zeitraums vollständig. Alle drei Felder sind
 * Pflicht (Zahl oder NULL); ein fehlendes Feld heißt nicht "unverändert".
 */
export const heatingPeriodValuesWriteSchema = z
  .object({
    periodStart: isoDate(),
    periodEnd: isoDate(),
    totalHeatEnergyKwh: z.number().positive().nullable(),
    districtHeatEmissionsKgPerYear: z.number().nonnegative().nullable(),
    districtHeatPrimaryEnergyFactor: z.number().positive().max(10).nullable(),
  })
  .strict()
  .refine((value) => value.periodStart <= value.periodEnd, {
    path: ["periodEnd"],
    message: messageKey("ui.heatingPeriodValues.validation.periodRange"),
  });

export type HeatingPeriodValuesWriteDto = z.infer<
  typeof heatingPeriodValuesWriteSchema
>;

export type HeatingPeriodValuesFormValues = {
  totalHeatEnergyKwh: string;
  districtHeatEmissionsKgPerYear: string;
  districtHeatPrimaryEnergyFactor: string;
};

const energyKwhRegex = /^\d{1,9}([.,]\d{1,3})?$/u;

const decimalRegex = /^\d+([.,]\d+)?$/u;

/**
 * "12.345" ist bei kWh die Tausenderschreibweise, bei einem Faktor wie
 * "0.280" aber eine Dezimalzahl. Deshalb zwei Lesarten.
 */
const parseEnergyKwh = (raw: string): number =>
  Number.parseFloat(normalizeNumberInput(raw));

const parseDecimal = (raw: string): number =>
  Number.parseFloat(raw.replace(",", "."));

/**
 * Alle Felder dürfen leer sein; fehlende Werte meldet erst die Berechnung.
 */
export const heatingPeriodValuesFormSchema = z
  .object({
    totalHeatEnergyKwh: z.string(),
    districtHeatEmissionsKgPerYear: z.string(),
    districtHeatPrimaryEnergyFactor: z.string(),
  })
  .superRefine((value, ctx) => {
    const energyRaw = value.totalHeatEnergyKwh.trim();
    if (
      energyRaw.length > 0 &&
      !(energyKwhRegex.test(energyRaw) && parseEnergyKwh(energyRaw) > 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["totalHeatEnergyKwh"],
        message: messageKey(
          "ui.heatingPeriodValues.validation.totalHeatEnergyInvalid",
        ),
      });
    }

    const emissionsRaw = value.districtHeatEmissionsKgPerYear.trim();
    if (emissionsRaw.length > 0 && !decimalRegex.test(emissionsRaw)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["districtHeatEmissionsKgPerYear"],
        message: messageKey(
          "ui.heatingPeriodValues.validation.districtHeatEmissionsInvalid",
        ),
      });
    }

    const factorRaw = value.districtHeatPrimaryEnergyFactor.trim();
    if (
      factorRaw.length > 0 &&
      !(
        decimalRegex.test(factorRaw) &&
        parseDecimal(factorRaw) > 0 &&
        parseDecimal(factorRaw) <= 10
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["districtHeatPrimaryEnergyFactor"],
        message: messageKey(
          "ui.heatingPeriodValues.validation.districtHeatFactorInvalid",
        ),
      });
    }
  });

const parseOptional = (
  raw: string,
  parse: (value: string) => number = parseDecimal,
): number | null => (raw.trim().length === 0 ? null : parse(raw.trim()));

export const heatingPeriodValuesFormToDto = (
  values: HeatingPeriodValuesFormValues,
  period: { start: string; end: string },
): HeatingPeriodValuesWriteDto => ({
  periodStart: period.start,
  periodEnd: period.end,
  totalHeatEnergyKwh: parseOptional(values.totalHeatEnergyKwh, parseEnergyKwh),
  districtHeatEmissionsKgPerYear: parseOptional(
    values.districtHeatEmissionsKgPerYear,
  ),
  districtHeatPrimaryEnergyFactor: parseOptional(
    values.districtHeatPrimaryEnergyFactor,
  ),
});

const toInput = (value: number | null): string =>
  value === null ? "" : String(value).replace(".", ",");

export const heatingPeriodValuesToFormValues = (
  values: HeatingPeriodValueSet,
): HeatingPeriodValuesFormValues => ({
  totalHeatEnergyKwh: toInput(values.totalHeatEnergyKwh),
  districtHeatEmissionsKgPerYear: toInput(
    values.districtHeatEmissionsKgPerYear,
  ),
  districtHeatPrimaryEnergyFactor: toInput(
    values.districtHeatPrimaryEnergyFactor,
  ),
});
