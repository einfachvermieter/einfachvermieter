type FallbackOption = {
  /**
   * Rückgabe für null/undefined-Eingabe. Default `"-"`.
   */
  fallback?: string;
};

/**
 * Cent -> "1.234,56 €". null/undefined -> fallback (Default "-").
 * Zwischen Wert und € steht ein geschütztes Leerzeichen (U+00A0)
 */
export const formatEur = (
  cents: number | null | undefined,
  opts: FallbackOption = {},
): string => {
  if (cents === null || cents === undefined) {
    return opts.fallback ?? "-";
  }

  return `${(cents / 100).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}\u00A0€`;
};

/**
 * ISO YYYY-MM-DD -> "DD.MM.YYYY". null/undefined/"" -> fallback (Default "-").
 */
export const formatDate = (
  iso: string | null | undefined,
  opts: FallbackOption = {},
): string => {
  if (!iso) {
    return opts.fallback ?? "-";
  }

  const [y, m, d] = iso.split("-");

  return `${d}.${m}.${y}`;
};

/**
 * Bereitet die Parameter einer Calc-Warnung für die Anzeige auf: das
 * konventionelle `date`-Feld (ISO `YYYY-MM-DD` aus der sprachneutralen
 * Calc-Schicht) wird ins deutsche `DD.MM.YYYY` übersetzt.
 */
export const formatWarningParams = (
  params: Record<string, string | number> | undefined,
): Record<string, string | number> => {
  if (!params) {
    return {};
  }

  if (typeof params.date !== "string") {
    return params;
  }

  return { ...params, date: formatDate(params.date) };
};

/**
 * Dezimalzahl im DE-Format. Default 2 Nachkommastelle
 */
export const formatNumber = (value: number, digits = 2): string =>
  value.toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

/**
 * Dezimalzahl im DE-Format mit bis zu `maxDigits` Nachkommastellen, ohne
 * trailing zeros. Für Strings, in denen Float-Summen sonst als
 * 187.26999999999998 erscheinen würden.
 */
export const formatNumberLoose = (value: number, maxDigits = 2): string =>
  value.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDigits,
  });

/**
 * Formatiert eine IBAN in 4er-Blöcken, getrennt durch ein
 * schmales Leerzeichen. Nur für die Anzeige.
 */
export const formatIban = (iban: string): string =>
  iban
    .replace(/\s+/gu, "")
    .match(/.{1,4}/gu)
    ?.join(" ") ?? "";

/**
 * Bytes in lesbarer Größe (B / KB / MB).
 */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Personennamen als "Vorname Nachname".
 */
export const formatName = (
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string => [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ");

/**
 * Konvertiert Eingabe in Euro (als String) zu Cent.
 * Akzeptiert "1234,56", "1234.56", "1.234,56".
 */
export const parseEurToCents = (input: string): number => {
  const cleaned = input
    .replace(/\s/gu, "")
    .replace(/\./gu, "")
    .replace(",", ".");

  const value = Number.parseFloat(cleaned);

  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.round(value * 100);
};

/**
 * Cent -> "1234,56" (für form-input).
 */
export const centsToEurInput = (cents: number): string =>
  (cents / 100).toFixed(2).replace(".", ",");

/**
 * Externe Abrechnungs-ID im Format `NK-{year}-{seq4}-{rev2}`, z. B.
 * `NK-2025-0001-01`. Im Draft-Status (noch keine vergebenen Nummern) werden
 * die ungesetzten Stellen mit `X` aufgefüllt, z. B. `NK-2025-XXXX-XX`,
 * damit das Anschreiben schon eine Platzhalter-ID tragen kann.
 *
 * @returns Immer einen String, nie `null`.
 */
export const formatStatementReference = (
  year: number,
  sequenceNumber: number | null,
  revisionNumber: number | null,
): string => {
  const seq =
    sequenceNumber === null ? "XXXX" : String(sequenceNumber).padStart(4, "0");

  const rev =
    revisionNumber === null ? "XX" : String(revisionNumber).padStart(2, "0");

  return `NK-${year}-${seq}-${rev}`;
};
