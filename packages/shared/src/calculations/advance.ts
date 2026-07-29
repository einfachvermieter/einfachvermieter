/**
 * Vorschlag für die künftige NK-Vorauszahlung und Default-Stichtag
 * (Gültig-ab) der Anpassung.
 */

import type { Period } from "../types/index.js";
import { addDaysIso, daysBetween, daysInYear, intersect } from "./period.js";

/**
 * Pseudo-Kostenart-ID für die zusammengefasste Heizkosten-Zeile im
 * `StatementResult`. Wird sowohl in `CostLineResult.costTypeId` als auch
 * als Schlüssel in `tariffAdjustmentBps` verwendet, damit Heizkosten
 * eine eigene Tarif-Erwartung tragen können.
 */
export const STATEMENT_HEATING_COST_TYPE_ID = "__heating__";

/**
 * Pseudo-Kostenart-ID für die separate Warmwasser-Zeile im
 * `StatementResult`. Entsteht, wenn bei zentraler Warmwasserbereitung der
 * Warmwasseranteil aus dem Heizkostentopf herausgerechnet wird.
 */
export const STATEMENT_HOT_WATER_COST_TYPE_ID = "__hot_water__";

/**
 * Rundet einen Cent-Betrag kaufmännisch auf den nächsten vollen Euro
 * und stellt sicher, dass mindestens 1 € (100 Cent) herauskommen. Wird
 * von den Vorschlags-Helfern intern verwendet.
 */
const roundToFullEuroCents = (cents: number): number => {
  const rounded = Math.round(cents / 100) * 100;

  return Math.max(100, rounded);
};

/**
 * Vorschlag für die monatliche NK-Vorauszahlung in Cent.
 *
 * Gesamtkosten der Abrechnungsperiode auf ein volles Jahr hochrechnen,
 * durch 12 teilen, kaufmännisch auf volle Euro runden. Mindestens 1 €.
 * `daysInBaseYear` ist im Schaltjahr 366, damit eine volle Periode
 * unverändert bleibt.
 */
export const suggestNextMonthlyAdvanceCents = (
  totalCostsCents: number,
  periodDays: number,
  daysInBaseYear = 365,
): number => {
  if (periodDays <= 0) {
    return 100;
  }

  const annualizedCents = (totalCostsCents * daysInBaseYear) / periodDays;
  const monthlyCents = annualizedCents / 12;

  return roundToFullEuroCents(monthlyCents);
};

/**
 * Eingabezeile für die Auto-Detection von Tarif-Anpassungen aus den
 * Folge-Rechnungen. Eine Zeile pro `cost_entry_items`-Position.
 */
export type TariffInferenceItem = {
  costTypeId: string;

  /**
   * Allocation-Key der zugehörigen Kostenart. Wird genutzt, um Verbrauchs-
   * Kostenarten (per_consumption_*) von pauschalen zu unterscheiden.
   */
  allocationKey:
    | "per_living_area"
    | "per_heating_area"
    | "per_person"
    | "per_unit"
    | "per_consumption_m3"
    | "per_consumption_kwh"
    | "heating_ordinance"
    | "fixed";

  amountCents: number;
  unitPriceCents: number | null;
  periodStart: string;
  periodEnd: string;
};

/**
 * Pseudo-Kostenart-ID, unter der alle Heizkostenarten in der Tarif-
 * Auto-Detection gebündelt werden. Passt zur Bündelung im
 * `StatementResult` (eine Heizkosten-Zeile).
 */
const HEATING_ALLOCATION = "heating_ordinance";

/**
 * Ermittelt automatisch erwartete Tarif-Anpassungen pro Kostenart aus
 * den erfassten Rechnungs-Positionen.
 *
 * Zwei Vergleichs-Modi pro Kostenart-Bucket:
 *
 * **Tarif-Modus** (wenn alle relevanten Positionen `unitPriceCents` tragen):
 * Positionen werden nach `periodStart` sortiert. Der Tarif der spätesten
 * Position gilt als "neuer Tarif" - er ist der zuletzt gültige und wird
 * voraussichtlich auch in der Folgeperiode wirken. Der Durschnitt-Tarif aller
 * älteren Positionen gilt als "alter Tarif". `bps = neu/alt − 1`. So
 * wirkt z. B. eine Tarif-Erhöhung im letzten Monat der aktuellen Periode
 * korrekt für die Folgeperiode, obwohl sie nur einen Bruchteil des
 * Vorjahres-Anteils ausmacht.
 *
 * **Pauschal-Modus** (Fallback): Positionen werden nach Mehrheits-
 * Überlappung in current- bzw. follow-Bucket gesteckt (>= 50 % der Tage).
 * Pro Bucket wird der aufs Jahr hochgerechnete Jahres-Betrag gebildet
 * (`Summe amountCents x 365 / Summe itemDays`). Vergleich der Jahres-Beträge.
 *
 * Heizkostenpositionen werden unter `heatingPseudoId` aggregiert.
 * Kostenarten ohne ausreichende Datenlage (z. B. "Grundsteuer-Bescheid
 * noch nicht da") landen NICHT im Map - der Vorschlag nimmt sie mit
 * Vorjahres-Wert (0 % bps) in die Prognose mit.
 */
export const inferTariffAdjustmentBpsFromInvoices = ({
  items,
  currentPeriod,
  followUpPeriod,
  heatingPseudoId,
}: {
  items: TariffInferenceItem[];
  currentPeriod: Period;
  followUpPeriod: Period;
  heatingPseudoId: string;
}): Record<string, number> => {
  const bucketKey = (item: TariffInferenceItem): string =>
    item.allocationKey === HEATING_ALLOCATION
      ? heatingPseudoId
      : item.costTypeId;

  // Items dem Bucket-Key zuordnen. Bezugsgrenze ist das Intervall
  // [currentPeriod.start, followUpPeriod.end]. alles, was damit
  // überlappt, fließt mit ein.
  const overallStart = currentPeriod.start;
  const overallEnd = followUpPeriod.end;
  const itemsByKey = new Map<string, TariffInferenceItem[]>();
  for (const item of items) {
    if (item.periodEnd < overallStart || item.periodStart > overallEnd) {
      continue;
    }

    const key = bucketKey(item);
    const slot = itemsByKey.get(key) ?? [];

    slot.push(item);
    itemsByKey.set(key, slot);
  }

  const result: Record<string, number> = {};
  for (const [key, bucketItems] of itemsByKey.entries()) {
    const bps = inferBpsForBucket(bucketItems, currentPeriod, followUpPeriod);

    if (bps !== null) {
      result[key] = bps;
    }
  }

  return result;
};

type CostTypeComparison = {
  oldCents: number;
  forecastCents: number;
};

/**
 * Anzahl Tage, die von mindestens einem der Items abgedeckt werden.
 * Überlappende Tage zählen nur einmal
 */
const compareByPeriodStart = (
  a: TariffInferenceItem,
  b: TariffInferenceItem,
): number => {
  if (a.periodStart < b.periodStart) {
    return -1;
  }

  if (a.periodStart > b.periodStart) {
    return 1;
  }

  return 0;
};

const unionPeriodDays = (items: TariffInferenceItem[]): number => {
  const [first, ...rest] = [...items].sort(compareByPeriodStart);
  if (!first) {
    return 0;
  }

  const { periodStart: firstStart, periodEnd: firstEnd } = first;
  let total = 0;
  let mergeStart = firstStart;
  let mergeEnd = firstEnd;

  for (const item of rest) {
    // Direkt anschließende Items (Tag X / Tag X+1) zählen als
    // zusammenhängend, weil Tagesperioden inklusiv sind.
    if (item.periodStart <= addDaysIso(mergeEnd, 1)) {
      if (item.periodEnd > mergeEnd) {
        mergeEnd = item.periodEnd;
      }
    } else {
      total += daysBetween(mergeStart, mergeEnd);
      mergeStart = item.periodStart;
      mergeEnd = item.periodEnd;
    }
  }

  total += daysBetween(mergeStart, mergeEnd);

  return total;
};

/**
 * Aufs Jahr gerechnete Pauschal-Items eines Buckets:
 * `Summe amountCents x Jahrestage / |Vereinigung der Item-Tage|`. Items mit
 * derselben Periode summieren ihre Beträge, ohne dass die Tage
 * doppelt gezählt werden. Bezugsjahr ist das des frühesten Items.
 */
const annualizeBucketCents = (items: TariffInferenceItem[]): number => {
  if (items.length === 0) {
    return 0;
  }
  let totalAmountCents = 0;
  let earliestStart = items[0]?.periodStart ?? "";
  for (const item of items) {
    totalAmountCents += item.amountCents;
    if (item.periodStart < earliestStart) {
      earliestStart = item.periodStart;
    }
  }
  const coveredDays = unionPeriodDays(items);
  return coveredDays > 0
    ? (totalAmountCents * daysInYear(earliestStart)) / coveredDays
    : 0;
};

/**
 * Überlappungstage zwischen dem Zeitraum eines Items und einer Periode
 */
const overlapDays = (item: TariffInferenceItem, period: Period): number => {
  const o = intersect({ start: item.periodStart, end: item.periodEnd }, period);
  return o ? daysBetween(o.start, o.end) : 0;
};

type InferenceComponent = {
  oldCents: number;
  forecastCents: number;
  comparedAt: boolean;
};

/**
 * Tarif-Komponente: "alter Verbrauch x neuer Tarif". altSumme = Summe amountCents
 * der älteren Tarif-Items; Prognose = Summe(amount/unitPrice) der älteren x
 * unitPrice des jüngsten Items. Braucht ≥2 Items mit Einheitspreis.
 */
const inferTariffComponent = (
  tariffItems: TariffInferenceItem[],
): InferenceComponent => {
  const none: InferenceComponent = {
    oldCents: 0,
    forecastCents: 0,
    comparedAt: false,
  };

  if (tariffItems.length < 2) {
    return none;
  }

  const sorted = [...tariffItems].sort(compareByPeriodStart);
  const latest = sorted.at(-1);
  const earlier = sorted.slice(0, -1);
  const latestUnit = latest?.unitPriceCents ?? 0;

  if (!latest || earlier.length === 0 || latestUnit <= 0) {
    return none;
  }

  let earlierAmount = 0;
  let earlierVolumeUnits = 0;
  for (const item of earlier) {
    const unit = item.unitPriceCents ?? 0;

    if (unit > 0) {
      earlierAmount += item.amountCents;
      earlierVolumeUnits += item.amountCents / unit;
    }
  }

  if (earlierVolumeUnits <= 0) {
    return none;
  }

  return {
    oldCents: earlierAmount,
    forecastCents: earlierVolumeUnits * latestUnit,
    comparedAt: true,
  };
};

/**
 * Pauschal-Komponente: Mehrheits-Zuordnung der Items in current-/follow-Bucket,
 * dann aufs Jahr gerechnet über die VEREINIGUNG der Item-Tage im Bucket (statt
 * Summe itemDays). Dadurch werden parallel laufende kumulative Positionen korrekt
 * aufaddiert; bei überlappungsfreieb Items ist das Ergebnis identisch zur
 * Summenformel. Ohne follow-Item bleibt der current-Jahresbetrag als Prognose.
 */
const inferFlatComponent = (
  flatItems: TariffInferenceItem[],
  currentPeriod: Period,
  followUpPeriod: Period,
): InferenceComponent => {
  const flatCurrentItems: TariffInferenceItem[] = [];
  const flatFollowItems: TariffInferenceItem[] = [];

  for (const item of flatItems) {
    const itemDays = daysBetween(item.periodStart, item.periodEnd);
    if (itemDays <= 0) {
      continue;
    }

    const halfDays = itemDays / 2;
    const currentOverlap = overlapDays(item, currentPeriod);
    const followOverlap = overlapDays(item, followUpPeriod);

    if (currentOverlap >= halfDays && currentOverlap >= followOverlap) {
      flatCurrentItems.push(item);
    } else if (followOverlap >= halfDays) {
      flatFollowItems.push(item);
    }
  }

  const oldCents = annualizeBucketCents(flatCurrentItems);

  return {
    oldCents,
    forecastCents:
      flatFollowItems.length > 0
        ? annualizeBucketCents(flatFollowItems)
        : oldCents,
    comparedAt: flatCurrentItems.length > 0 && flatFollowItems.length > 0,
  };
};

/**
 * Tarif- und Pauschal-Komponente für **eine** Kostenart. Wird vom Bucket-
 * Aggregator pro `costTypeId` aufgerufen, damit Einheitspreise nicht über
 * Kostenarten-Grenzen hinweg verglichen werden (z. B. Gas-m3 vs. Strom-
 * kWh im Heizkosten-Bucket).
 */
const inferComparisonForCostType = (
  items: TariffInferenceItem[],
  currentPeriod: Period,
  followUpPeriod: Period,
): CostTypeComparison | null => {
  // Aufteilen in Tarif-Items (Position mit Einheitspreis) und Pauschal-Items
  // (z. B. Grundpreis ohne Einheitspreis).
  const tariff = inferTariffComponent(
    items.filter(
      (item) => item.unitPriceCents !== null && item.unitPriceCents > 0,
    ),
  );

  const flat = inferFlatComponent(
    items.filter(
      (item) => item.unitPriceCents === null || item.unitPriceCents <= 0,
    ),
    currentPeriod,
    followUpPeriod,
  );

  // Wenn weder Tarif- noch Pauschal-Vergleich aussagekräftig sind, keine
  // Aussage für diese Kostenart. Eine reine Tarif-Ableitung UND ein reiner
  // Vorjahres-Pauschal-Anteil reichen aber: dann wird der Pauschal-Teil mit
  // 0 % beibehalten und der Tarif-Effekt gewichtet eingerechnet.
  if (!tariff.comparedAt && !flat.comparedAt) {
    return null;
  }

  return {
    oldCents: tariff.oldCents + flat.oldCents,
    forecastCents: tariff.forecastCents + flat.forecastCents,
  };
};

const inferBpsForBucket = (
  bucketItems: TariffInferenceItem[],
  currentPeriod: Period,
  followUpPeriod: Period,
): number | null => {
  // Innerhalb eines Buckets wird die Ermittlung pro `costTypeId` getrennt
  // durchgeführt und anschließend gewichtet zusammengeführt. Bei klassischen
  // Nicht-Heizkosten-Buckets enthält der Bucket genau eine Kostenart. Das
  // Ergebnis ist dann identisch zur Single-Bucket-Auswertung. Beim
  // Heizkosten-Pseudo-Bucket verhindert die Aufspaltung, dass Einheitspreise
  // unterschiedlicher Kostenarten (z. B. Gas-m3 vs. Hilfsstrom-kWh)
  // gegeneinander verglichen werden.
  const itemsByCostType = new Map<string, TariffInferenceItem[]>();
  for (const item of bucketItems) {
    const slot = itemsByCostType.get(item.costTypeId) ?? [];
    slot.push(item);
    itemsByCostType.set(item.costTypeId, slot);
  }

  let totalOld = 0;
  let totalForecast = 0;
  let comparedAny = false;
  for (const costTypeItems of itemsByCostType.values()) {
    const comparison = inferComparisonForCostType(
      costTypeItems,
      currentPeriod,
      followUpPeriod,
    );

    if (comparison === null) {
      continue;
    }

    totalOld += comparison.oldCents;
    totalForecast += comparison.forecastCents;
    comparedAny = true;
  }

  if (!comparedAny || totalOld <= 0) {
    return null;
  }
  return Math.round((totalForecast / totalOld - 1) * 10_000);
};

/**
 * Vorschlag mit erwarteten Tarif-Anpassungen pro Kostenart.
 *
 * Für jede Kostenposition (Cent-Betrag pro Kostenart-ID) wird der
 * angegebene Tarif-Adjustment-Wert in Basispunkten (100 bps = 1 %)
 * angewendet, danach analog zum Standard-Vorschlag hochgerechnet und
 * gerundet. Kostenart-IDs ohne Eintrag in `tariffAdjustmentBps` bleiben
 * unverändert (0 bps).
 *
 * @param linesByCostTypeId Map oder Plain-Object mit Kostenart-ID -> Cent.
 *   Heizkostenpositionen können unter einer Pseudo-Kostenart-ID gesammelt
 *   werden (z. B. der String `"heating"`).
 */
export const suggestNextMonthlyAdvanceCentsWithTariffs = (
  linesByCostTypeId: Record<string, number>,
  periodDays: number,
  tariffAdjustmentBps: Record<string, number> | null,
  daysInBaseYear = 365,
): number => {
  if (periodDays <= 0) {
    return 100;
  }

  const adjustments = tariffAdjustmentBps ?? {};
  let adjustedTotalCents = 0;

  for (const [costTypeId, amountCents] of Object.entries(linesByCostTypeId)) {
    const bps = adjustments[costTypeId] ?? 0;
    adjustedTotalCents += amountCents * (1 + bps / 10_000);
  }

  const annualizedCents = (adjustedTotalCents * daysInBaseYear) / periodDays;
  const monthlyCents = annualizedCents / 12;

  return roundToFullEuroCents(monthlyCents);
};

/**
 * ISO-Datum (YYYY-MM-01) für den 1. des Monats, der `offset` Monate
 * nach dem Monat von `iso` liegt.
 *
 * @param offset `offset = 0` -> aktueller Monat.
 */
export const firstOfMonthIso = (iso: string, offset: number): string => {
  const year = Number(iso.slice(0, 4));
  const monthIdx = Number(iso.slice(5, 7)) - 1;
  const target = new Date(Date.UTC(year, monthIdx + offset, 1));
  const ty = target.getUTCFullYear();
  const tm = String(target.getUTCMonth() + 1).padStart(2, "0");
  return `${ty}-${tm}-01`;
};

/**
 * Default-Stichtag für die Anpassung der Vorauszahlung.
 *
 * Regel: Wenn vom heutigen Datum noch ≥ `minLeadDays` Tage bis Monatsende
 * verbleiben, wird der 1. des Folgemonats gewählt, sonst der 1. des
 * übernächsten Monats. Damit hat der Mieter genug Zeit, den Dauerauftrag
 * anzupassen.
 *
 * @param today Wird ISO-YYYY-MM-DD erwartet.
 * @returns ISO-Datum.
 */
export const suggestAdvanceValidFromDate = (
  today: string,
  minLeadDays = 14,
): string => {
  const day = Number(today.slice(8, 10));
  const year = Number(today.slice(0, 4));
  const monthIdx = Number(today.slice(5, 7)) - 1;
  const lastDay = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  const daysLeft = lastDay - day;
  const monthsAhead = daysLeft >= minLeadDays ? 1 : 2;
  return firstOfMonthIso(today, monthsAhead);
};

/**
 * Die drei Monatsoptionen für den Gültig-ab-Dropdown: aktueller, nächster
 * und übernächster Monat. Jeder Eintrag liefert die ISO-Form (YYYY-MM-01)
 * und ein "MM.JJJJ"-Label.
 */
export const nextMonthOptions = (
  today: string,
): Array<{ iso: string; label: string }> =>
  [0, 1, 2].map((offset) => {
    const iso = firstOfMonthIso(today, offset);
    const label = `${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

    return { iso, label };
  });
