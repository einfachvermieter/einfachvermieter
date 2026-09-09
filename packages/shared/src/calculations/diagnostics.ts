import type { CalcWarning, DiagnosticParams } from "../types/index.js";

export type { CalcWarning, DiagnosticParams };

/**
 * Warncodes, die als Transparenz-Hinweis an den Mieter ins Abrechnungs-PDF
 * gehören (Kennzeichnung geschätzter Werte, Ersatzverfahren mit
 * Kürzungsrecht). Alle übrigen Codes sind Datenqualitäts-Hinweise an den
 * Vermieter und erscheinen nur in der Web-Oberfläche.
 */
const TENANT_WARNING_CODES = new Set([
  "readingEstimated",
  "hotWaterFlatRateFallback",
  "consumptionFallbackZeroDelta",
  "consumptionFallbackNoAllocators",
  "consumptionFallbackNoHeatMeters",
  "hotWaterConsumptionFallbackArea",
]);

/**
 * Ob eine Berechnungs-Warnung im Mieterdokument ausgewiesen wird.
 */
export const isTenantWarning = (warning: CalcWarning): boolean =>
  TENANT_WARNING_CODES.has(warning.code);

/**
 * Warncodes, die das Finalisieren verhindern
 */
const BLOCKING_WARNING_CODES = new Set(["consumptionNegative"]);

/**
 * Ob eine Berechnung Warnungen enthält, die das Finalisieren blockieren.
 */
export const hasBlockingWarning = (result: {
  heatingDetail?: { warnings?: CalcWarning[] } | null;
  waterDetail?: { warnings?: CalcWarning[] } | null;
}): boolean =>
  [
    ...(result.heatingDetail?.warnings ?? []),
    ...(result.waterDetail?.warnings ?? []),
  ].some((warning) => BLOCKING_WARNING_CODES.has(warning.code));

export type CalcWarningGroup = {
  code: string;
  /**
   * Parameter der Warnung ohne `label`.
   */
  params?: DiagnosticParams;
  /**
   * Labels der betroffenen Zähler in Reihenfolge des Auftretens.
   * Leer, wenn die Warnung kein Label trägt.
   */
  labels: string[];
};

/**
 * Bündelt Warnungen mit gleichem Code und gleichen Parametern (bis auf
 * `label`) zu einer Gruppe, damit z. B. "Kein Zählerstand nach ..." nicht
 * pro Zähler wiederholt wird, sondern einmal mit Liste der Betroffenen
 * erscheint.
 */
export const groupCalcWarnings = (
  warnings: CalcWarning[],
): CalcWarningGroup[] => {
  const groups = new Map<string, CalcWarningGroup>();

  for (const warning of warnings) {
    const { label, ...params } = warning.params ?? {};
    const key = `${warning.code}:${JSON.stringify(params)}`;

    let group = groups.get(key);
    if (!group) {
      group = {
        code: warning.code,
        ...(Object.keys(params).length > 0 ? { params } : {}),
        labels: [],
      };
      groups.set(key, group);
    }
    if (typeof label === "string") {
      group.labels.push(label);
    }
  }

  return [...groups.values()];
};

export class CalculationError extends Error {
  readonly code: string;
  readonly params?: DiagnosticParams;

  constructor(code: string, params?: DiagnosticParams) {
    super(`CalculationError: ${code}`);

    this.name = "CalculationError";
    this.code = code;
    this.params = params;
  }
}
