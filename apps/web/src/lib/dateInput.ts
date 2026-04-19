import { format, isValid, parse } from "date-fns";

const ISO_DATE_FORMAT = "yyyy-MM-dd";
const DE_DISPLAY_FORMAT = "dd.MM.yyyy";
const DE_MONTH_DISPLAY_FORMAT = "MM.yyyy";

type ParseRule = {
  regex: RegExp;
  format: string;
};

// Nur Patterns mit 4-stelligem Jahr sind fürs Live-Parsing zugelassen. Eine
// 2-stellige Jahresregel würde mitten im Tippen greifen (z. B. "01.01.19" von
// "01.01.1983" parst als 2019 und überschreibt das Feld, bevor der User fertig
// getippt hat).
const DATE_PARSE_RULES: readonly ParseRule[] = [
  { regex: /^\d{1,2}\.\d{1,2}\.\d{4}$/u, format: "d.M.yyyy" },
  { regex: /^\d{8}$/u, format: "ddMMyyyy" },
  { regex: /^\d{4}-\d{2}-\d{2}$/u, format: "yyyy-MM-dd" },
];

const MONTH_PARSE_RULES: readonly ParseRule[] = [
  { regex: /^\d{1,2}\.\d{4}$/u, format: "M.yyyy" },
  { regex: /^\d{6}$/u, format: "MMyyyy" },
  { regex: /^\d{4}-\d{2}$/u, format: "yyyy-MM" },
];

const MIN_YEAR = 1900;
const MAX_YEAR = 2200;

const referenceDate = new Date(2000, 0, 1);

const yearInRange = (date: Date): boolean => {
  const year = date.getFullYear();
  return year >= MIN_YEAR && year <= MAX_YEAR;
};

export const formatIsoDateForDisplay = (iso: string): string => {
  if (!iso) {
    return "";
  }

  const parsed = parse(iso, ISO_DATE_FORMAT, referenceDate);
  return isValid(parsed) ? format(parsed, DE_DISPLAY_FORMAT) : "";
};

export const formatIsoMonthForDisplay = (iso: string): string => {
  if (!iso) {
    return "";
  }

  const parsed = parse(iso, ISO_DATE_FORMAT, referenceDate);
  return isValid(parsed) ? format(parsed, DE_MONTH_DISPLAY_FORMAT) : "";
};

export const parseDisplayDateToIso = (input: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  for (const rule of DATE_PARSE_RULES) {
    if (!rule.regex.test(trimmed)) {
      continue;
    }

    const candidate = parse(trimmed, rule.format, referenceDate);
    if (isValid(candidate) && yearInRange(candidate)) {
      return format(candidate, ISO_DATE_FORMAT);
    }
  }
  return null;
};

export const parseDisplayMonthToIso = (
  input: string,
  boundary: "start" | "end",
): string | null => {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }
  for (const rule of MONTH_PARSE_RULES) {
    if (!rule.regex.test(trimmed)) {
      continue;
    }

    const candidate = parse(trimmed, rule.format, referenceDate);
    if (isValid(candidate) && yearInRange(candidate)) {
      return isoForMonthBoundary(
        candidate.getFullYear(),
        candidate.getMonth(),
        boundary,
      );
    }
  }
  return null;
};

export const isoForMonthBoundary = (
  year: number,
  monthIndex: number,
  boundary: "start" | "end",
): string => {
  if (boundary === "start") {
    return format(new Date(year, monthIndex, 1), ISO_DATE_FORMAT);
  }

  return format(new Date(year, monthIndex + 1, 0), ISO_DATE_FORMAT);
};

export const isoToDate = (iso: string): Date | undefined => {
  if (!iso) {
    return;
  }

  const parsed = parse(iso, ISO_DATE_FORMAT, referenceDate);

  return isValid(parsed) ? parsed : undefined;
};

export const dateToIso = (date: Date): string => format(date, ISO_DATE_FORMAT);
