import { type ContainedTaxKind, containedTaxKinds } from "../schemas/core.js";
import type {
  HeatingBaseMethod,
  HeatingFuelType,
  HeatingProrationMethod,
} from "../schemas/heating.js";
import type {
  AreaDistributionReason,
  HeatingConfig,
  HeatingDetail,
  MeterInfo,
  Period,
  PeriodShare,
  ReadingPoint,
  SupplySnapshotRow,
  UnitInfo,
} from "../types/index.js";
import { CalculationError, type CalcWarning } from "./diagnostics.js";
import { consumptionBetween, isDerivedConsumption } from "./meters.js";
import { bpsToFactor, distributeCents } from "./money.js";
import {
  daysBetween,
  daysInYear,
  intersect,
  periodShareOfYear,
} from "./period.js";
import {
  applyCompensations,
  type CompensationInput,
  compensationSnapshots,
  evaluateSubstitutionScope,
  type ReadingInvalidation,
  type ScopeEvaluation,
  type ScopeMeter,
  type SubstitutedPeriodMeters,
  type SubstitutionInput,
} from "./substitution.js";
import {
  buildUnitSupply,
  daysOfPeriods,
  intersectPeriods,
  readingsForSuppliedPeriod,
  type SupplyExclusion,
  type SupplyScope,
  suppliedPeriodsOf,
  supplyStateOf,
  type UnitSupply,
} from "./supply.js";

/**
 * Monatliche Gradtagszahlen als Promille des Jahresbedarfs (Summe 1.000 ‰).
 * § 9b Abs. 2 HeizkostenV lässt die Verteilung bei Mieterwechsel nach
 * Gradtagszahlen zu, nennt aber keine Werte: die Tabelle selbst stammt aus
 * den anerkannten Regeln der Technik (VDI 2077) und ist in der Branche
 * (ista, Techem) und vor Gericht die übliche Grundlage.
 *
 * Juni/Juli/August führt die Tabelle zusammen mit 40 ‰.
 * Tagesgewichtet verteilt (92 Sommer-Tage -> 0,4348 ‰/Tag):
 *   Juni  30 Tage x 0,4348 ~= 13 ‰
 *   Juli  31 Tage x 0,4348 ~= 14 ‰
 *   August 31 Tage x 0,4348 ~= 13 ‰
 */
export const DEGREE_DAYS_PROMILLE_PER_MONTH = [
  170, 150, 130, 80, 40, 13, 14, 13, 30, 80, 120, 160,
] as const;

const isoToYearMonth = (iso: string): [number, number] => [
  Number(iso.slice(0, 4)),
  Number(iso.slice(5, 7)),
];

const daysInMonth = (year: number, month: number): number =>
  new Date(year, month, 0).getDate();

/**
 * Summe der Gradtagszahlen-Promille über eine
 * Periode (inklusive Endpunkte). Tagweise gewichtet mit der Monats-Promille
 * pro Tag des jeweiligen Monats.
 */
export const sumDegreeDays = (period: Period): number => {
  const [startYear, startMonth] = isoToYearMonth(period.start);
  const [endYear, endMonth] = isoToYearMonth(period.end);
  const startDay = Number(period.start.slice(8, 10));
  const endDay = Number(period.end.slice(8, 10));

  let total = 0;
  for (let year = startYear; year <= endYear; year++) {
    const fromMonth = year === startYear ? startMonth : 1;
    const toMonth = year === endYear ? endMonth : 12;

    for (let month = fromMonth; month <= toMonth; month++) {
      const dim = daysInMonth(year, month);
      const monthPromille = DEGREE_DAYS_PROMILLE_PER_MONTH[month - 1] ?? 0;
      const promillePerDay = monthPromille / dim;
      const firstDay =
        year === startYear && month === startMonth ? startDay : 1;
      const lastDay = year === endYear && month === endMonth ? endDay : dim;

      total += promillePerDay * (lastDay - firstDay + 1);
    }
  }

  return total;
};

export type DegreeDaysMonthRow = {
  monthIndex: number;
  calendarDays: number;
  /**
   * Gradtage-Promille des Monats, anteilig zur Periode. Über alle 12
   * Monatszeilen summiert ergibt sich `sumDegreeDays(period)`.
   */
  degreeDayPromille: number;
};

/**
 * Monatliche Aufschlüsselung der Gradtage über eine Periode (Mietzeit).
 * Liefert für jeden Kalendermonat die Anzahl Tage in der Periode
 * und die anteiligen Gradtage-Promille der Tabelle. Monate ohne
 * Überlappung tragen 0.
 *
 * Bei jahresübergreifenden Perioden werden gleichnamige Monate addiert
 * (auch wenn so etwas eigentlich unüblich ist).
 */
export const degreeDaysMonthlyBreakdown = (
  period: Period,
): DegreeDaysMonthRow[] => {
  const rows: DegreeDaysMonthRow[] = Array.from({ length: 12 }, (_, idx) => ({
    monthIndex: idx,
    calendarDays: 0,
    degreeDayPromille: 0,
  }));

  const [startYear, startMonth] = isoToYearMonth(period.start);
  const [endYear, endMonth] = isoToYearMonth(period.end);
  const startDay = Number(period.start.slice(8, 10));
  const endDay = Number(period.end.slice(8, 10));

  for (let year = startYear; year <= endYear; year++) {
    const fromMonth = year === startYear ? startMonth : 1;
    const toMonth = year === endYear ? endMonth : 12;

    for (let month = fromMonth; month <= toMonth; month++) {
      const dim = daysInMonth(year, month);
      const monthPromille = DEGREE_DAYS_PROMILLE_PER_MONTH[month - 1] ?? 0;
      const firstDay =
        year === startYear && month === startMonth ? startDay : 1;
      const lastDay = year === endYear && month === endMonth ? endDay : dim;
      const daysInPeriod = lastDay - firstDay + 1;
      const row = rows[month - 1];

      if (row === undefined) {
        continue;
      }

      row.calendarDays += daysInPeriod;
      row.degreeDayPromille += (monthPromille / dim) * daysInPeriod;
    }
  }

  return rows;
};

type HeatingCostItem = {
  costTypeId?: string;
  amountCents: number;
  periodStart: string;
  periodEnd: string;
  co2CostCents?: number | null;
  co2AmountGrams?: number | null;
  co2EnergyKwh?: number | null;
  co2EmissionFactorKgPerKwh?: number | null;
  containedTaxesCents?: number | null;
  containedTaxKinds?: ContainedTaxKind[] | null;
};

/**
 * Brennstoffpositionen einer Kostenart mit demselben Emissionsfaktor,
 * anteilig zur Periode. Energiegehalt, Menge und Kosten sind `null`, sobald
 * der Wert einer Position der Gruppe fehlt: eine Teilsumme sähe wie eine
 * vollständige aus. Eine eingetragene 0 ist ein Wert und fehlt nicht.
 */
export type Co2FuelGroup = {
  costTypeId: string;
  emissionFactorKgPerKwh: number | null;
  energyKwh: number | null;
  amountGrams: number | null;
  costCents: number | null;
};

/**
 * Summe, die unvollständig bleibt, sobald ein Summand fehlt.
 */
const addOrMissing = (sum: number | null, value: number | null) =>
  sum === null || value === null ? null : sum + value;

const scaledOrMissing = (
  value: number | null | undefined,
  periodFactor: number,
): number | null =>
  value === null || value === undefined ? null : value * periodFactor;

export type AggregatedHeatingCosts = {
  totalCents: number;
  perItemAttributedCents: number[];
  totalCo2CostCents: number;
  totalCo2AmountGrams: number;
  /**
   * Gruppen in der Reihenfolge ihres ersten Auftretens. Jede Position mit
   * CO2-Menge oder CO2-Kosten gehört zu einer Gruppe, damit die Gruppen
   * zusammen genau die beiden Gesamtwerte ergeben.
   */
  co2Groups: Co2FuelGroup[];
  totalContainedTaxesCents: number;
  containedTaxKindsFound: ContainedTaxKind[];
};

/**
 * Rechnet eine Brennstoffposition ihrer Gruppe zu (Kostenart und
 * Emissionsfaktor). Menge und Kosten werden je Position gerundet wie in den
 * Gesamtwerten, der Energiegehalt bekommt denselben Periodenfaktor.
 */
const addToCo2Groups = (
  groups: Map<string, Co2FuelGroup>,
  item: HeatingCostItem,
  periodFactor: number,
): void => {
  const roundedOrMissing = (value: number | null | undefined) => {
    const scaled = scaledOrMissing(value, periodFactor);
    return scaled === null ? null : Math.round(scaled);
  };
  const amountGrams = roundedOrMissing(item.co2AmountGrams);
  const costCents = roundedOrMissing(item.co2CostCents);
  const emissionFactor = item.co2EmissionFactorKgPerKwh ?? null;
  // Faktor als ganze Zahl in Millionstel, damit keine Gleitkommazahlen
  // verglichen werden (0,1 + 0,2 und 0,3 sind derselbe Faktor).
  const factorKey =
    emissionFactor === null ? "missing" : Math.round(emissionFactor * 1e6);
  const groupKey = `${item.costTypeId ?? ""}|${factorKey}`;
  const energyKwh = scaledOrMissing(item.co2EnergyKwh, periodFactor);
  const group = groups.get(groupKey);

  if (!group) {
    groups.set(groupKey, {
      costTypeId: item.costTypeId ?? "",
      emissionFactorKgPerKwh: emissionFactor,
      energyKwh,
      amountGrams,
      costCents,
    });
    return;
  }

  group.energyKwh = addOrMissing(group.energyKwh, energyKwh);
  group.amountGrams = addOrMissing(group.amountGrams, amountGrams);
  group.costCents = addOrMissing(group.costCents, costCents);
};

/**
 * Aggregiert Heizkostenpositionen für eine Abrechnungsperiode (Mieter-
 * Mietzeit). Pro Position wird der Anteil bestimmt, der in die Periode
 * fällt:
 *
 * - "linear": tagesproportional (overlapTage / itemTage).
 * - "degree_days": gewichtet nach der Gradtagstabelle
 *
 * Liefert sowohl die Gesamtsumme als auch die Einzel-Attribution pro Item.
 */
export const aggregateHeatingCosts = (
  items: readonly HeatingCostItem[],
  period: Period,
  method: HeatingProrationMethod = "linear",
): AggregatedHeatingCosts => {
  const perItemAttributedCents: number[] = [];

  let total = 0;
  let totalCo2CostCents = 0;
  let totalCo2AmountGrams = 0;
  let totalContainedTaxesCents = 0;
  const kindsFound = new Set<ContainedTaxKind>();
  const co2Groups = new Map<string, Co2FuelGroup>();

  for (const item of items) {
    const itemPeriod: Period = {
      start: item.periodStart,
      end: item.periodEnd,
    };

    const overlap = intersect(itemPeriod, period);

    if (!overlap) {
      perItemAttributedCents.push(0);
      continue;
    }

    // Periodenfaktor (0..1) identisch für Betrag, CO2-Kosten und CO2-Menge,
    // damit alle drei konsistent derselben Abrechnungsperiode zugerechnet
    // werden.
    let factor = 0;
    if (method === "degree_days") {
      const itemGtz = sumDegreeDays(itemPeriod);
      if (itemGtz > 0) {
        factor = sumDegreeDays(overlap) / itemGtz;
      }
    }

    if (factor === 0) {
      // Linear oder Fallback aus dem degree_days-Pfad (Summe GTZ = 0)
      const overlapDays = daysBetween(overlap.start, overlap.end);
      const itemDays = daysBetween(itemPeriod.start, itemPeriod.end);

      factor = overlapDays / itemDays;
    }

    const rounded = Math.round(item.amountCents * factor);
    perItemAttributedCents.push(rounded);

    total += rounded;
    const co2CostCents = Math.round((item.co2CostCents ?? 0) * factor);
    const co2AmountGrams = Math.round((item.co2AmountGrams ?? 0) * factor);
    totalCo2CostCents += co2CostCents;
    totalCo2AmountGrams += co2AmountGrams;

    if ((item.co2AmountGrams ?? 0) > 0 || (item.co2CostCents ?? 0) > 0) {
      addToCo2Groups(co2Groups, item, factor);
    }
    totalContainedTaxesCents += Math.round(
      (item.containedTaxesCents ?? 0) * factor,
    );
    for (const kind of item.containedTaxKinds ?? []) {
      kindsFound.add(kind);
    }
  }

  return {
    totalCents: total,
    perItemAttributedCents,
    totalCo2CostCents,
    totalCo2AmountGrams,
    co2Groups: [...co2Groups.values()].map((group) => ({
      ...group,
      energyKwh: group.energyKwh === null ? null : Math.round(group.energyKwh),
    })),
    totalContainedTaxesCents,
    containedTaxKindsFound: containedTaxKinds.filter((kind) =>
      kindsFound.has(kind),
    ),
  };
};

/**
 * 10-Stufen-Modell des CO2-Kostenaufteilungsgesetzes für **Wohngebäude**.
 * Die Tabelle steht in der Anlage zum CO2KostAufG, § 5 Abs. 2 ordnet den
 * Gebäude-Ausstoß dort ein; § 7 regelt nur die Abrechnung.
 *
 * Je höher der spezifische CO2-Ausstoß des Gebäudes (kg CO2 je qm Wohnfläche
 * und Jahr), desto größer der Anteil der CO2-Kosten, den der Vermieter trägt.
 * Schlecht gedämmte Gebäude entlasten so den Mieter. Die Schwellen sind
 * auf kg CO2/qm x **Jahr** bezogen. Bei einem Abrechnungszeitraum unter
 * einem Jahr werden sie anteilig gekürzt (§ 5 Abs. 1 Satz 4), der Ausstoß
 * wird nicht hochgerechnet (siehe `co2Tier`).
 * Nichtwohngebäude (50/50-Pauschale) sind hier bewusst nicht abgebildet.
 */
const CO2_LANDLORD_SHARE_TIERS: ReadonlyArray<{
  maxExclusive: number;
  /**
   * Vermieteranteil
   */
  percent: number;
}> = [
  { maxExclusive: 12, percent: 0 },
  { maxExclusive: 17, percent: 10 },
  { maxExclusive: 22, percent: 20 },
  { maxExclusive: 27, percent: 30 },
  { maxExclusive: 32, percent: 40 },
  { maxExclusive: 37, percent: 50 },
  { maxExclusive: 42, percent: 60 },
  { maxExclusive: 47, percent: 70 },
  { maxExclusive: 52, percent: 80 },
  { maxExclusive: Number.POSITIVE_INFINITY, percent: 95 },
];

export type Co2Tier = {
  /**
   * Untere Grenze (inklusiv) in kg CO2/qm x a - 0 für die unterste Stufe.
   * Immer der Wert der Anlage, auch bei kurzem Zeitraum.
   */
  minInclusive: number;
  /**
   * Obere Grenze (exklusiv); `Infinity` für die oberste Stufe.
   */
  maxExclusive: number;
  /**
   * Vermieteranteil
   */
  landlordPercent: number;
};

/**
 * Stufe des 10-Stufen-Modells, in die ein spezifischer CO2-Ausstoß fällt.
 * Inklusive Grenzwerte für die Anzeige der Einstufung.
 *
 * Ohne `periodShare` ist der Ausstoß ein Jahreswert (kg/qm x a). Mit
 * `periodShare` ist er der auf eine Nachkommastelle gerundete Ausstoß eines
 * kurzen Abrechnungszeitraums und wird mit den anteilig gekürzten
 * Grenzwerten verglichen. Der Vergleich läuft in ganzen Zahlen (Ausstoß in
 * Zehnteln), weil ein gekürzter Grenzwert wie 34/3 als Gleitkommazahl
 * genau an der Grenze kippen kann.
 */
export const co2Tier = (
  emissionsKgPerSqm: number,
  periodShare?: PeriodShare,
): Co2Tier => {
  const tiers = CO2_LANDLORD_SHARE_TIERS;
  const isBelow = (limit: number): boolean =>
    periodShare
      ? Math.round(emissionsKgPerSqm * 10) * periodShare.denominator <
        10 * limit * periodShare.numerator
      : emissionsKgPerSqm < limit;

  for (let index = 0; index < tiers.length; index++) {
    const current = tiers[index];

    if (current && isBelow(current.maxExclusive)) {
      const previous = index === 0 ? undefined : tiers[index - 1];

      return {
        minInclusive: previous?.maxExclusive ?? 0,
        maxExclusive: current.maxExclusive,
        landlordPercent: current.percent,
      };
    }
  }

  // Fallback auf die oberste Stufe
  const top = tiers.at(-1);

  return {
    minInclusive: tiers.at(-2)?.maxExclusive ?? 0,
    maxExclusive: Number.POSITIVE_INFINITY,
    landlordPercent: top?.percent ?? 95,
  };
};

/**
 * Vermieteranteil (%) für einen spezifischen CO2-Ausstoß, Parameter wie
 * bei `co2Tier`.
 */
export const co2LandlordSharePercent = (
  emissionsKgPerSqm: number,
  periodShare?: PeriodShare,
): number => co2Tier(emissionsKgPerSqm, periodShare).landlordPercent;

/**
 * Angaben des Vermieters zu einer Beschränkung nach § 9 CO2KostAufG:
 * welchem Bereich öffentlich-rechtliche Vorgaben entgegenstehen und sein
 * Text zum Nachweis.
 */
export type Co2Restriction = {
  building: boolean;
  supply: boolean;
  evidenceNote: string;
};

/**
 * Von der Beschränkung betroffener Bereich, geschrieben wie die Endung der
 * zugehörigen Textschlüssel.
 */
export type Co2RestrictionScope = "None" | "Building" | "Supply" | "Both";

export const co2RestrictionScope = (
  buildingRestricted: boolean,
  supplyRestricted: boolean,
): Co2RestrictionScope => {
  if (buildingRestricted && supplyRestricted) {
    return "Both";
  }
  if (buildingRestricted) {
    return "Building";
  }

  return supplyRestricted ? "Supply" : "None";
};

/**
 * Angewendeter Vermieteranteil (%) nach § 9 CO2KostAufG: Steht eine
 * Beschränkung dem Gebäude oder der Versorgung entgegen, wird der Anteil
 * laut Tabelle halbiert (Abs. 1), bei beiden entfällt er (Abs. 2). Der
 * halbe Wert wird nicht gerundet, 95 % ergeben 47,5 %.
 */
export const co2AppliedLandlordSharePercent = (
  tableLandlordSharePercent: number,
  buildingRestricted: boolean,
  supplyRestricted: boolean,
): number => {
  if (buildingRestricted && supplyRestricted) {
    return 0;
  }

  return buildingRestricted || supplyRestricted
    ? tableLandlordSharePercent / 2
    : tableLandlordSharePercent;
};

/**
 * Berechnungsgrundlage je Brennstoffgruppe, wie sie die Abrechnung nach
 * § 7 Abs. 3 CO2KostAufG ausweist. `label` ist der Name der Kostenart.
 */
export type Co2FuelBasisEntry = Omit<Co2FuelGroup, "costTypeId"> & {
  label: string;
};

/**
 * Meldet, ob Energiegehalt mal Emissionsfaktor um mehr als 2 % von der
 * eingetragenen CO2-Menge abweicht. Ein auf zwei bis drei Stellen
 * gerundeter Faktor liegt darunter. Liefert die errechnete Menge in kg
 * oder `null`, wenn die Werte zusammenpassen.
 */
export const co2BasisMismatchKg = (
  amountGrams: number,
  energyKwh: number,
  emissionFactorKgPerKwh: number,
): number | null => {
  const computedKg = energyKwh * emissionFactorKgPerKwh;
  const enteredKg = amountGrams / 1000;

  if (enteredKg <= 0 || Math.abs(computedKg - enteredKg) / enteredKg <= 0.02) {
    return null;
  }

  return computedKg;
};

export type Co2SplitInput = {
  totalCostCents: number;
  totalAmountGrams: number;
  livingAreaSqm: number;
  /**
   * Abrechnungszeitraum des Gebäudes, nicht die Mietzeit
   */
  periodStart: string;
  periodEnd: string;
  /**
   * Wird unverändert ins Ergebnis durchgereicht, die Aufteilung rechnet
   * damit nicht.
   */
  fuelBasis?: Co2FuelBasisEntry[];
  /**
   * Beschränkung nach § 9 CO2KostAufG. Gesetzt, wenn Vorgaben dem Gebäude
   * oder der Versorgung entgegenstehen.
   */
  restriction?: Co2Restriction;
};

export type Co2SplitResult = {
  totalCostCents: number;
  totalAmountGrams: number;
  emissionsKgPerSqmYear?: number;
  emissionsKgPerSqmPeriod?: number;
  periodShare?: PeriodShare;
  /**
   * Angewendeter Vermieteranteil, mit dem der Abzug gerechnet ist. Mit
   * einer Beschränkung nach § 9 CO2KostAufG die Hälfte des Anteils laut
   * Tabelle (auch halbe Prozent) oder 0.
   */
  landlordSharePercent: number;
  landlordDeductionCents: number;
  /**
   * Fläche, auf die der spezifische Ausstoß bezogen ist. Wird ausgewiesen,
   * damit die kg/qm-Basis nachvollziehbar ist.
   */
  livingAreaSqm: number;
  fuelBasis?: Co2FuelBasisEntry[];
  /**
   * Vermieteranteil laut Stufe. Nur zusammen mit `restriction` gesetzt.
   */
  tableLandlordSharePercent?: number;
  restriction?: Co2Restriction;
};

/**
 * CO2KostAufG-Aufteilung für Wohngebäude. Bezieht die CO2-Menge auf die
 * Wohnfläche, liest daraus den Vermieteranteil aus dem Stufenmodell und
 * wendet diesen Prozentsatz auf die CO2-Kosten des Zeitraums an.
 *
 * Bei einem Abrechnungszeitraum unter einem Jahr wird der Ausstoß nicht
 * hochgerechnet. Gekürzt werden die Grenzwerte der Stufen (§ 5 Abs. 1
 * Satz 4 CO2KostAufG).
 *
 * Eine Beschränkung nach § 9 CO2KostAufG ändert den Anteil laut Tabelle zum
 * angewendeten Anteil. Die Stufe bleibt die aus dem Ausstoß.
 */
export const calculateCo2Split = (input: Co2SplitInput): Co2SplitResult => {
  // § 5 Abs. 1 S. 3 CO2KostAufG: erst auf eine Nachkommastelle runden,
  // dann einstufen, sonst kippt der Vermieteranteil an Stufengrenzen.
  // Gerundet wird der Ausstoß des Abrechnungszeitraums.
  const emissionsKgPerSqm =
    Math.round((input.totalAmountGrams / 1000 / input.livingAreaSqm) * 10) / 10;
  const periodShare =
    periodShareOfYear({ start: input.periodStart, end: input.periodEnd }) ??
    undefined;

  const tableLandlordSharePercent = co2LandlordSharePercent(
    emissionsKgPerSqm,
    periodShare,
  );
  const restriction =
    input.restriction?.building || input.restriction?.supply
      ? input.restriction
      : undefined;
  const landlordSharePercent = co2AppliedLandlordSharePercent(
    tableLandlordSharePercent,
    restriction?.building ?? false,
    restriction?.supply ?? false,
  );
  // Einmal runden, in ganzen Zahlen: Der halbe Prozentsatz wird über den
  // Nenner 200 gerechnet, nicht als vorher gerundeter Zwischenwert.
  const landlordDeductionCents = Math.round(
    (input.totalCostCents * landlordSharePercent * 2) / 200,
  );

  return {
    totalCostCents: input.totalCostCents,
    totalAmountGrams: input.totalAmountGrams,
    ...(periodShare
      ? { emissionsKgPerSqmPeriod: emissionsKgPerSqm, periodShare }
      : { emissionsKgPerSqmYear: emissionsKgPerSqm }),
    landlordSharePercent,
    landlordDeductionCents,
    livingAreaSqm: input.livingAreaSqm,
    ...(input.fuelBasis ? { fuelBasis: input.fuelBasis } : {}),
    ...(restriction ? { tableLandlordSharePercent, restriction } : {}),
  };
};

type HeatingCalculationInput = {
  totalHeatingCostsCents: number;
  config: HeatingConfig;
  units: UnitInfo[];
  /**
   * Verbrauchszähler je nach `consumptionMethod`:
   * - `heat_meter`: Wärmemengenzähler (`type = "heat_meter"`,
   *   Einheit kWh) - höchstens einer pro Wohnung üblich, mehrere möglich.
   * - `heat_cost_allocator`: Heizkostenverteiler (`type =
   *   "heat_cost_allocator"`, dimensionslose Anzeigewerte). Pflicht: jeder HKV trägt
   *   `kTotal` (Bewertungsfaktor des Heizkörpers). Üblicherweise mehrere
   *   HKV pro Wohnung (ein Gerät pro Heizkörper).
   *
   * Externe HKV-Abrechnungen (Dienstleister liefert fertige Endbeträge)
   * laufen weiterhin über `calculateExternalHeating` im externen Modus.
   */
  consumptionMeters: Array<{
    meter: MeterInfo;
    readings: ReadingPoint[];
  }>;

  consumptionMethod: "heat_meter" | "heat_cost_allocator";

  /**
   * Bezugsrahmen für Verbrauchsablesung. Bei Mieter-Wechsel oder Teilbe-
   * legung weichen `targetUnitId` und andere Wohnungen ab:
   *
   * - Für Zähler der Ziel-Wohnung wird `tenantPeriodStart`/`End` benutzt
   *   (nur Mieter-Verbrauch zählt für sein Statement).
   * - Für Zähler aller anderen Wohnungen wird `periodStart`/`End` benutzt
   *   (deren Jahresverbrauch fließt ein, damit der Verteilungs-Nenner
   *   konsistent zu den Total-Heizkosten ist).
   *
   * Wenn `tenantPeriodStart`/`End` fehlt, fällt es auf `periodStart`/`End`
   * zurück (Standardfall: Mieter ganzjährig vermietet).
   */
  periodStart: string;
  periodEnd: string;
  tenantPeriodStart?: string;
  tenantPeriodEnd?: string;

  /**
   * Ziel-Wohnung dieser Abrechnung. Steuert, welche Zähler-Periode
   * verwendet wird (siehe oben). Ohne Angabe gilt `periodStart`/`End`
   * für alle Wohnungen.
   */
  targetUnitId?: string;

  /**
   * Aufteilungsmethode für die zeitanteilige Verteilung der Grundkosten:
   * - "linear":      Tagesproportional (Flächentage = qm x occupiedDays).
   * - "degree_days": Gradtagsgewichtet (Flächen-Gradtage = qm x Summe
   *                  Gradtag-Promille der belegten Tage).
   */
  prorationMethod?: HeatingProrationMethod;

  /**
   * CO2KostAufG-Eingaben. Ist `enabled` (entspricht
   * `heating_settings.co2CostShareEnabled`) und liegen CO2-Kosten vor, wird
   * der Vermieteranteil aus dem Kostentopf herausgerechnet
   */
  co2?: { enabled: boolean } & Omit<
    Co2SplitInput,
    "livingAreaSqm" | "periodStart" | "periodEnd"
  >;

  /**
   * Warmwasser-Abspaltung nach § 9 Abs. 2 HeizkostenV. Nur gesetzt, wenn das
   * Gebäude zentrales Warmwasser über die Heizung bereitstellt
   * (`heatingType = central_with_hot_water`).
   */
  hotWater?: HotWaterInput;

  /**
   * Erfassungsausfälle nach § 9a HeizkostenV dieser Periode
   */
  substitutions?: SubstitutionInput[];

  /**
   * Ausgleichsstände aus Ersatzverbräuchen früherer Perioden
   */
  compensations?: CompensationInput[];

  /**
   * Ablesungen, die ein früherer Geräteausfall ohne Weiterzählen entwertet
   */
  readingInvalidations?: ReadingInvalidation[];

  /**
   * Zähler mit Ablesungen der Vergleichszeiträume für Verfahren a
   */
  referenceMeters?: { heating?: ScopeMeter[]; hotWater?: ScopeMeter[] };

  /**
   * Zähler, deren Verbrauch in früheren Perioden selbst ersetzt wurde
   */
  substitutedPeriods?: SubstitutedPeriodMeters[];

  /**
   * Belegte Tage je Wohnung über die volle Periode
   */
  fullOccupiedDaysByUnit?: Map<string, number>;

  /**
   * Teilnahme an der zentralen Versorgung: Zeiträume ohne Versorgung und die
   * Belegung je Wohnung (Ziel-Wohnung: nur die Mietzeit). Ohne Angabe sind
   * alle Wohnungen die ganze Periode versorgt.
   */
  supply?: {
    exclusions: SupplyExclusion[];
    occupiedSpansByUnit: Map<string, Period[]>;
  };
};

export type HotWaterInput = {
  totalHeatEnergyKwh: number | null;
  boilerHeatKwh: number | null;
  hotWaterVolumeM3: number | null;
  supplyTemperatureCelsius: number;
  unitHotWaterM3: Array<{ unitId: string; m3: number }>;

  /**
   * Warmwasserzähler der Wohnungen mit Ablesungen. Gesetzt, rechnet die
   * Heizkostenberechnung die Wohnungsverbräuche selbst (für Lückenerkennung
   * und Ersatzverbräuche nach § 9a); `unitHotWaterM3` und `landlordM3`
   * werden dann nicht verwendet.
   */
  unitMeters?: ScopeMeter[];

  /**
   * Warmwasserverbrauch der Ziel-Wohnung außerhalb der Mietzeit
   * (Vor-/Nachmieter, Leerstand). Fällt als Kostenanteil auf den Vermieter.
   */
  landlordM3?: number;

  /**
   * Korrekturfaktor nach § 9 Abs. 2 Satz 5 HeizkostenV.
   * Wirkt nur auf eine über die Formeln bestimmte Wärmemenge,
   * nicht auf einen gemessenen Boiler-Wert.
   */
  correctionFactor?: number;
};

/**
 * Korrekturfaktor für die Warmwasser-Wärmemenge nach § 9 Abs. 2 Satz 5
 * HeizkostenV: brennwertbezogene Erdgas-Abrechnung x 1,11, eigenständige
 * gewerbliche Wärmelieferung : 1,15, monovalente Wärmepumpe x 0,30.
 *
 * Die Verordnung bezieht die Faktoren ausdrücklich auf die *nach den
 * Zahlenwertgleichungen* (Satz 2 oder 4) bestimmte Wärmemenge. Ein am
 * Wärmezähler gemessener Wert bleibt unverändert.
 *
 * Mehrere Konstellationen können sich überlagern (z. B. gewerbliche
 * Wärmelieferung aus einer Wärmepumpe), deshalb werden die Faktoren
 * multipliziert. 1 = kein Faktor
 */
export const hotWaterCorrectionFactor = (settings: {
  fuelType: HeatingFuelType;
  gasBillingByCalorificValue: boolean;
  heatPumpMonovalent: boolean;
}): number => {
  let factor = 1;
  if (settings.fuelType === "gas" && settings.gasBillingByCalorificValue) {
    factor *= 1.11;
  }

  if (settings.fuelType === "district_heat") {
    factor /= 1.15;
  }

  if (settings.fuelType === "heat_pump" && settings.heatPumpMonovalent) {
    factor *= 0.3;
  }

  return factor;
};

/**
 * Faktor der Schätzformel aus § 9 Abs. 2 HeizkostenV: Q_WW [kWh] =
 * 2,5 x V_WW [m3] x (t_WW - 10) [K]. Der Wert 2,5 bündelt Dichte und
 * spezifische Wärmekapazität von Wasser samt Einheitenumrechnung auf kWh;
 * 10 Grad C ist die unterstellte Kaltwasser-Zulauftemperatur.
 */
const HOT_WATER_ESTIMATION_FACTOR = 2.5;
const COLD_WATER_INLET_TEMPERATURE_CELSIUS = 10;

/**
 * HeizkostenV-Pauschalformel, wenn weder Boiler-WMZ noch Warmwasser-
 * verbrauch vorliegen: 32 kWh je Quadratmeter Wohnfläche und Jahr, auf
 * die tatsächliche Periodenlänge anteilig umgerechnet.
 */
const HOT_WATER_FLAT_RATE_KWH_PER_SQM_YEAR = 32;

type HotWaterSplitMeta = {
  method: "boiler_meter" | "estimated" | "flat_rate_fallback";
  totalHeatEnergyKwh: number;
  hotWaterHeatKwh: number;
  hotWaterShareBps: number;
  hotWaterPotCents: number;
  supplyTemperatureCelsius?: number;
  hotWaterVolumeM3?: number;
  /**
   * Angewendeter Korrekturfaktor nach § 9 Abs. 2 Satz 5 HeizkostenV. Fehlt,
   * wenn keiner greift, damit Altbestände weiter passen.
   */
  correctionFactor?: number;
};

/**
 * Bestimmt Q_WW und den Anteil am Netto-Topf. Liefert `undefined` (und
 * setzt eine Warnung), wenn Q_gesamt fehlt oder Q_WW nicht ermittelbar ist.
 * Dann unterbleibt die Abspaltung und alles zählt als Heizung.
 */
const computeHotWaterSplit = (
  hotWater: HotWaterInput | undefined,
  distributablePotCents: number,
  totalLivingAreaSqm: number,
  periodDays: number,
  daysInBaseYear: number,
  warnings: CalcWarning[],
): HotWaterSplitMeta | undefined => {
  if (!hotWater) {
    return;
  }

  const { totalHeatEnergyKwh } = hotWater;
  if (totalHeatEnergyKwh === null || totalHeatEnergyKwh <= 0) {
    warnings.push({ code: "hotWaterTotalHeatMissing" });
    return;
  }

  // Q_WW bestimmen: bevorzugt am Boiler-WMZ gemessen, sonst über die
  // Schätzformel aus Warmwasservolumen und -temperatur.
  let core: Pick<HotWaterSplitMeta, "method" | "hotWaterHeatKwh"> & {
    supplyTemperatureCelsius?: number;
    hotWaterVolumeM3?: number;
  };

  if (hotWater.boilerHeatKwh !== null && hotWater.boilerHeatKwh > 0) {
    core = { method: "boiler_meter", hotWaterHeatKwh: hotWater.boilerHeatKwh };
  } else if (
    hotWater.hotWaterVolumeM3 !== null &&
    hotWater.hotWaterVolumeM3 > 0
  ) {
    core = {
      method: "estimated",
      hotWaterHeatKwh:
        HOT_WATER_ESTIMATION_FACTOR *
        hotWater.hotWaterVolumeM3 *
        (hotWater.supplyTemperatureCelsius -
          COLD_WATER_INLET_TEMPERATURE_CELSIUS),
      supplyTemperatureCelsius: hotWater.supplyTemperatureCelsius,
      hotWaterVolumeM3: hotWater.hotWaterVolumeM3,
    };
  } else if (totalLivingAreaSqm > 0 && periodDays > 0) {
    core = {
      method: "flat_rate_fallback",
      hotWaterHeatKwh:
        HOT_WATER_FLAT_RATE_KWH_PER_SQM_YEAR *
        totalLivingAreaSqm *
        (periodDays / daysInBaseYear),
    };
    warnings.push({ code: "hotWaterFlatRateFallback" });
  } else {
    warnings.push({ code: "hotWaterSourceMissing" });
    return;
  }

  // § 9 Abs. 2 Satz 5 HeizkostenV: die Faktoren gelten nur für die nach den
  // Zahlenwertgleichungen bestimmte Wärmemenge, ein gemessener Boiler-Wert
  // bleibt unverändert.
  const correctionFactor =
    core.method === "boiler_meter" ? 1 : (hotWater.correctionFactor ?? 1);
  if (correctionFactor !== 1) {
    core = {
      ...core,
      hotWaterHeatKwh: core.hotWaterHeatKwh * correctionFactor,
    };
  }

  // Anteil hart auf [0,1] begrenzen, damit eine fehlerhafte Erfassung
  // (Q_WW > Q_gesamt) nicht den ganzen Heiztopf auffrisst.
  const rawShare = core.hotWaterHeatKwh / totalHeatEnergyKwh;
  const share = Math.min(1, Math.max(0, rawShare));
  if (rawShare > 1) {
    warnings.push({ code: "hotWaterShareCapped" });
  }

  return {
    ...core,
    totalHeatEnergyKwh,
    ...(correctionFactor === 1 ? {} : { correctionFactor }),
    hotWaterShareBps: Math.round(share * 10_000),
    hotWaterPotCents: Math.round(distributablePotCents * share),
  };
};

type HotWaterDistributionInput = {
  potCents: number;
  consumptionShareBps: number;
  units: UnitInfo[];
  unitHotWaterM3: Map<string, number>;
  landlordM3: number;
  areaWeightsWithLandlord: number[];
  totalAreaDays: number;
  warnings: CalcWarning[];
  substitutionLimitExceeded?: boolean;
  substitutedUnitIds?: Set<string>;
};

/**
 * Verteilt den abgespaltenen Warmwasser-Topf auf die Wohnungen: eigener
 * Grund-/Verbrauchs-Split (gleicher %-Schlüssel wie die Heizung). Der
 * Verbrauchsanteil läuft nach Warmwasserzählern (`water_hot`), der
 * Grundanteil nach Wohnfläche x Tagen inkl. Vermieter-Leerstand.
 */
const distributeHotWater = (
  input: HotWaterDistributionInput,
): Pick<
  NonNullable<HeatingDetail["hotWaterDetail"]>,
  | "consumptionPortionCents"
  | "basicPortionCents"
  | "consumptionDistributionMethod"
  | "areaDistributionReason"
  | "perUnit"
  | "landlordBasicCostCents"
  | "landlordConsumptionCostCents"
> => {
  const {
    potCents,
    consumptionShareBps,
    units,
    unitHotWaterM3,
    landlordM3,
    areaWeightsWithLandlord,
    totalAreaDays,
    warnings,
    substitutionLimitExceeded,
    substitutedUnitIds,
  } = input;
  const consumptionFactor = bpsToFactor(consumptionShareBps);
  const consumptionPortionCents = Math.round(potCents * consumptionFactor);
  const basicPortionCents = potCents - consumptionPortionCents;

  // Vermieter-Slot (letzte Position) = Warmwasserverbrauch der Ziel-Wohnung
  // außerhalb der Mietzeit (Vor-/Nachmieter, Leerstand).
  const wwWeights = [
    ...units.map((unit) => unitHotWaterM3.get(unit.id) ?? 0),
    landlordM3,
  ];
  const totalWw = wwWeights.reduce((acc, value) => acc + value, 0);

  let consumptionDistributionMethod: "consumption" | "heating_area" =
    "consumption";
  let areaDistributionReason: AreaDistributionReason | undefined;
  let consumptionShares: number[];

  if (substitutionLimitExceeded) {
    consumptionDistributionMethod = "heating_area";
    areaDistributionReason = "substitution_limit_exceeded";
    consumptionShares =
      totalAreaDays > 0
        ? distributeCents(consumptionPortionCents, areaWeightsWithLandlord)
        : [...units.map(() => 0), 0];
  } else if (totalWw > 0) {
    consumptionShares = distributeCents(consumptionPortionCents, wwWeights);
  } else {
    consumptionDistributionMethod = "heating_area";
    areaDistributionReason = "fallback";
    consumptionShares =
      totalAreaDays > 0
        ? distributeCents(consumptionPortionCents, areaWeightsWithLandlord)
        : [...units.map(() => 0), 0];

    if (consumptionPortionCents > 0) {
      warnings.push({ code: "hotWaterConsumptionFallbackArea" });
    }
  }

  const landlordConsumptionCostCents = consumptionShares.at(-1) ?? 0;

  const basicShares =
    totalAreaDays > 0
      ? distributeCents(basicPortionCents, areaWeightsWithLandlord)
      : [...units.map(() => 0), 0];
  const landlordBasicCostCents = basicShares.at(-1) ?? 0;

  const perUnit = units.map((unit, idx) => {
    const consumptionCostCents = consumptionShares[idx] ?? 0;
    const basicCostCents = basicShares[idx] ?? 0;

    return {
      unitId: unit.id,
      unitName: unit.name,
      hotWaterM3: unitHotWaterM3.get(unit.id) ?? 0,
      consumptionCostCents,
      areaSqm: unit.areaSqm,
      basicCostCents,
      totalCents: consumptionCostCents + basicCostCents,
      ...(substitutedUnitIds?.has(unit.id)
        ? { hotWaterIsSubstituted: true }
        : {}),
    };
  });

  return {
    consumptionPortionCents,
    basicPortionCents,
    consumptionDistributionMethod,
    ...(areaDistributionReason ? { areaDistributionReason } : {}),
    perUnit,
    landlordBasicCostCents,
    landlordConsumptionCostCents,
  };
};

/**
 * Heizfläche (Fallback Wohnfläche) einer Wohnung
 */
const heatingAreaFor = (
  unit: Pick<UnitInfo, "areaSqm" | "heatingAreaSqm">,
): number => unit.heatingAreaSqm ?? unit.areaSqm;

/**
 * Fläche einer Wohnung im Grundkostenmaßstab des Bereichs. Heizung nach
 * § 7 Abs. 1 Satz 5 HeizkostenV nach dem gewählten Maßstab, Warmwasser
 * nach § 8 Abs. 1 immer nach Wohn- oder Nutzfläche.
 */
export const baseCostAreaFor = (
  scope: "heating" | "hot_water",
  unit: Pick<UnitInfo, "areaSqm" | "heatingAreaSqm">,
  baseMethod: HeatingBaseMethod,
): number =>
  scope === "heating" && baseMethod === "heated_area"
    ? heatingAreaFor(unit)
    : unit.areaSqm;

/**
 * Grundkosten-Gewichte des Warmwassers je Wohnung = Wohnfläche x belegte
 * Tage. Anders als bei der Heizung immer zeitanteilig nach Tagen,
 * auch bei Gradtag-Abrechnung. Leerstand fällt als Differenz auf den Vermieter.
 */
const computeHotWaterAreaWeights = (
  units: UnitInfo[],
): { areaWeightsWithLandlord: number[]; totalAreaDays: number } => {
  const areaDayWeights = units.map((unit) => unit.areaSqm * unit.occupiedDays);
  const totalAreaDays = units.some((unit) => unit.suppliedDays !== undefined)
    ? units.reduce(
        (acc, unit) =>
          acc + unit.areaSqm * (unit.suppliedDays ?? unit.periodDays),
        0,
      )
    : units.reduce((acc, unit) => acc + unit.areaSqm, 0) *
      (units[0]?.periodDays ?? 0);
  const sumAreaDayWeights = areaDayWeights.reduce((a, b) => a + b, 0);

  return {
    areaWeightsWithLandlord: [
      ...areaDayWeights,
      Math.max(0, totalAreaDays - sumAreaDayWeights),
    ],
    totalAreaDays,
  };
};

/**
 * Wohnfläche der versorgten Wohnungen eines Bereichs, nach versorgten Tagen
 * gewichtet
 */
const suppliedLivingAreaSqm = (units: UnitInfo[]): number =>
  units.reduce(
    (acc, unit) =>
      acc +
      (unit.suppliedDays === undefined
        ? unit.areaSqm
        : (unit.areaSqm * unit.suppliedDays) / unit.periodDays),
    0,
  );

type ScopedUnits = {
  /**
   * Wohnungen mit versorgten Tagen im Bereich. Bei teilweiser Versorgung
   * ist die Belegung auf die versorgte Zeit begrenzt.
   */
  units: UnitInfo[];
  supply: UnitSupply | undefined;
};

/**
 * Kombiniert Versorgung und Belegung für die Kostenaufteilung eines
 * Bereichs. Nicht versorgte Tage erzeugen weder einen Anteil der Wohnung
 * noch Leerstand.
 */
const scopeUnits = (
  input: HeatingCalculationInput,
  scope: SupplyScope,
  period: Period,
): ScopedUnits => {
  if (!input.supply) {
    return { units: input.units, supply: undefined };
  }

  const supply = buildUnitSupply(
    input.supply.exclusions,
    input.units.map((unit) => unit.id),
    scope,
    period,
  );
  const occupiedSpans = input.supply.occupiedSpansByUnit;

  const units = input.units.flatMap((unit) => {
    const state = supplyStateOf(supply, unit.id, period);
    if (state === "full") {
      return [unit];
    }
    if (state === "none") {
      return [];
    }

    const supplied = supply.get(unit.id) ?? [];
    const occupied = intersectPeriods(
      occupiedSpans.get(unit.id) ?? [],
      supplied,
    );

    return [
      {
        ...unit,
        occupiedDays: daysOfPeriods(occupied),
        occupiedDegreeDayPromille: sumDegreeDaysOf(occupied),
        suppliedDays: daysOfPeriods(supplied),
        suppliedDegreeDayPromille: sumDegreeDaysOf(supplied),
      },
    ];
  });

  return { units, supply };
};

const sumDegreeDaysOf = (periods: Period[]): number =>
  periods.reduce((acc, entry) => acc + sumDegreeDays(entry), 0);

/**
 * Versorgung je Wohnung für den Snapshot, rein technisch ohne Belegung.
 * Nur, wenn mindestens eine Wohnung nicht die ganze Periode versorgt war.
 */
const supplySnapshotRows = (
  units: UnitInfo[],
  supply: UnitSupply | undefined,
  period: Period,
): SupplySnapshotRow[] | undefined => {
  if (
    !supply ||
    units.every((unit) => supplyStateOf(supply, unit.id, period) === "full")
  ) {
    return;
  }

  const periodDays = daysBetween(period.start, period.end);

  return units.map((unit) => {
    const supplied = supply.get(unit.id) ?? [];

    return {
      unitId: unit.id,
      unitName: unit.name,
      suppliedDays: daysOfPeriods(supplied),
      periodDays,
      suppliedPeriods: supplied.map(({ start, end }) => ({ start, end })),
    };
  });
};

/**
 * Snapshot-Feld zur Versorgung und der Hinweis fürs Mieterdokument
 */
const supplyDetailFields = (params: {
  units: UnitInfo[];
  heating: UnitSupply | undefined;
  hotWater: UnitSupply | undefined;
  period: Period;
  warnings: CalcWarning[];
}): Pick<HeatingDetail, "supply"> => {
  const heating = supplySnapshotRows(
    params.units,
    params.heating,
    params.period,
  );
  const hotWater = supplySnapshotRows(
    params.units,
    params.hotWater,
    params.period,
  );
  if (!(heating || hotWater)) {
    return {};
  }

  params.warnings.push({ code: "supplyPartialParticipation" });

  return {
    supply: {
      ...(heating ? { heating } : {}),
      ...(hotWater ? { hotWater } : {}),
    },
  };
};

/**
 * Wohnungen, die an mindestens einem Tag aus der zentralen Anlage nur
 * Warmwasser bekommen. Das CO2KostAufG regelt den Fall nicht ausdrücklich;
 * ihre Wohnfläche zählt an diesen Tagen nicht zur Einstufung.
 */
const pushHotWaterOnlyWarnings = (params: {
  units: UnitInfo[];
  heating: UnitSupply | undefined;
  hotWater: UnitSupply | undefined;
  period: Period;
  warnings: CalcWarning[];
}): void => {
  for (const unit of params.units) {
    const hotWater = suppliedPeriodsOf(params.hotWater, unit.id, params.period);
    const both = intersectPeriods(
      hotWater,
      suppliedPeriodsOf(params.heating, unit.id, params.period),
    );

    if (daysOfPeriods(hotWater) > daysOfPeriods(both)) {
      params.warnings.push({
        code: "co2AreaHotWaterOnly",
        params: { unit: unit.name, unitId: unit.id },
      });
    }
  }
};

/**
 * Versorgte Wohnungen ohne Zähler im Bereich. Die Ausstattungspflicht ist
 * verletzt, ein Erfassungsausfall nach § 9a kommt dafür nicht in Betracht.
 */
const pushMissingMeterWarnings = (
  scope: SupplyScope,
  units: UnitInfo[],
  meters: Array<{ meter: MeterInfo }>,
  warnings: CalcWarning[],
): void => {
  const metered = new Set(meters.map((entry) => entry.meter.unitId));

  for (const unit of units) {
    if (!metered.has(unit.id)) {
      warnings.push({
        code: `consumptionMeterMissing${scopeCodeSuffix(scope)}`,
        params: { unit: unit.name, unitId: unit.id, scope },
      });
    }
  }
};

/**
 * Heizfläche 0 heißt: Die Wohnung gibt keine Wärme aus der zentralen Anlage
 * ab. Verbrauch widerspricht dem. Beim Maßstab "beheizte Fläche" trägt sie
 * keine Grundkosten, das erhöht den Anteil aller anderen; ist die Fläche
 * insgesamt 0, lassen sich die Grundkosten nicht verteilen.
 */
const pushHeatingAreaWarnings = (params: {
  units: UnitInfo[];
  unitConsumption: Map<string, number>;
  baseMethod: HeatingBaseMethod;
  heatingPotCents: number;
  warnings: CalcWarning[];
}): void => {
  const { units, unitConsumption, baseMethod, warnings } = params;

  for (const unit of units) {
    if (unit.heatingAreaSqm !== 0) {
      continue;
    }
    const unitParams = { unit: unit.name, unitId: unit.id };

    if ((unitConsumption.get(unit.id) ?? 0) > 0) {
      warnings.push({
        code: "heatingAreaZeroWithConsumption",
        params: unitParams,
      });
    }
    if (baseMethod === "heated_area") {
      warnings.push({ code: "heatingAreaZero", params: unitParams });
    }
  }

  const totalBaseArea = units.reduce(
    (acc, unit) => acc + baseCostAreaFor("heating", unit, baseMethod),
    0,
  );
  if (units.length > 0 && params.heatingPotCents > 0 && totalBaseArea <= 0) {
    warnings.push({ code: "heatingAreaNoAllocationBase" });
  }
};

/**
 * CO2KostAufG: Vermieter-CO2-Anteil ermitteln, der vor der Grund-/Verbrauchs-
 * Aufteilung aus dem Topf herausgerechnet wird.
 */
const computeCo2Deduction = (
  co2: HeatingCalculationInput["co2"],
  livingAreaSqm: number,
  statementPeriod: Period,
  warnings: CalcWarning[],
): {
  co2Detail: Co2SplitResult | undefined;
  landlordCo2DeductionCents: number;
} => {
  if (!co2?.enabled) {
    if (co2 && co2.totalCostCents > 0) {
      warnings.push({ code: "co2DataWithoutSplit" });
    }
    return { co2Detail: undefined, landlordCo2DeductionCents: 0 };
  }

  // Menge und Kosten gehen in die Rechnung ein. Fehlt einer Position mit
  // CO2-Daten einer der beiden Werte, wäre das Ergebnis erkennbar
  // unvollständig; die Warnung sperrt deshalb das Finalisieren.
  if (
    co2.fuelBasis?.some(
      (group) => group.amountGrams === null || group.costCents === null,
    )
  ) {
    warnings.push({ code: "co2SplitValuesIncomplete" });
  }

  if (co2.totalCostCents === 0) {
    warnings.push({ code: "co2SplitEnabledNoData" });
    return { co2Detail: undefined, landlordCo2DeductionCents: 0 };
  }

  if (co2.totalAmountGrams > 0 && livingAreaSqm > 0) {
    const co2Detail = calculateCo2Split({
      ...co2,
      livingAreaSqm,
      periodStart: statementPeriod.start,
      periodEnd: statementPeriod.end,
    });
    // Energiegehalt und Faktor werden nur ausgewiesen, gerechnet wird damit
    // nicht. Fehlen sie, bleibt es bei einem Hinweis.
    if (
      co2.fuelBasis?.some(
        (group) =>
          group.energyKwh === null || group.emissionFactorKgPerKwh === null,
      )
    ) {
      warnings.push({ code: "co2BasisIncomplete" });
    }
    return {
      co2Detail,
      landlordCo2DeductionCents: co2Detail.landlordDeductionCents,
    };
  }

  warnings.push({ code: "co2SplitMissingData" });

  return { co2Detail: undefined, landlordCo2DeductionCents: 0 };
};

/**
 * Gemessener Verbrauch eines Zählers. Ziel-Wohnung: Mietzeit, der Rest der
 * Periode (Vor-/Nachmieter, Leerstand) fällt auf den Vermieter. HKV werden
 * mit `kTotal` gewichtet.
 */
const measuredMeterConsumption = (params: {
  meter: MeterInfo;
  readings: ReadingPoint[];
  isTarget: boolean;
  isZeroed: boolean;
  period: Period;
  tenantPeriod: Period;
  consumptionMethod: "heat_meter" | "heat_cost_allocator";
  intervalWeight?: (fromDate: string, toDate: string) => number;
  warnings: CalcWarning[];
  unitName: string | null;
}): {
  landlordConsumption: number;
  row: NonNullable<HeatingDetail["perMeter"]>[number];
} => {
  const { meter, readings, isTarget, period, tenantPeriod } = params;
  // Ziel-Wohnung: Mietzeit innerhalb des gemessenen Zeitraums. Ohne
  // Überschneidung zählt der ganze Zeitraum als Verbrauch außerhalb der
  // Mietzeit.
  const tenantPart = isTarget ? intersect(period, tenantPeriod) : period;
  const isZeroed = params.isZeroed || tenantPart === null;
  const meterPeriod = tenantPart ?? period;

  // Aus Sicht des Ziel-Mieters sind Lücken in Zählerständen außerhalb seines
  // Mietzeitraums irrelevant; `relevantPeriod` unterdrückt nur die Warnungen.
  const measuredDelta = consumptionBetween(
    readings,
    meterPeriod.start,
    meterPeriod.end,
    {
      warnings: isZeroed ? [] : params.warnings,
      label: meter.label,
      relevantPeriod: tenantPeriod,
      resetDay: meter.resetDay,
      intervalWeight: params.intervalWeight,
    },
  );
  const delta = isZeroed ? 0 : measuredDelta;

  let kTotal: number | null = null;
  if (params.consumptionMethod === "heat_cost_allocator") {
    if (meter.kTotal === null || meter.kTotal === undefined) {
      throw new CalculationError("heatingAllocatorNoKTotal", {
        label: meter.label,
      });
    }
    ({ kTotal } = meter);
  }
  const weighted = kTotal === null ? delta : delta * kTotal;

  const landlordConsumption =
    isTarget && !params.isZeroed
      ? residualTargetConsumption({
          readings,
          weighted,
          kTotal,
          periodStart: period.start,
          periodEnd: period.end,
          intervalWeight: params.intervalWeight,
        })
      : 0;

  // Mindestens ein Stichtagsstand nicht direkt abgelesen -> der Verbrauch
  // ist rechnerisch ermittelt und wird so ausgewiesen.
  const consumptionIsDerived =
    tenantPart !== null &&
    isDerivedConsumption(readings, meterPeriod.start, meterPeriod.end);

  return {
    landlordConsumption,
    row: {
      meterId: meter.id,
      meterLabel: meter.label,
      serialNumber: meter.serialNumber ?? null,
      unitId: meter.unitId,
      unitName: params.unitName,
      consumptionRaw: delta,
      kTotal,
      consumptionWeighted: weighted,
      ...(consumptionIsDerived ? { consumptionIsDerived } : {}),
    },
  };
};

/**
 * Ersatzverbrauch eines Zählers statt Messung. Er gilt für die volle
 * Periode; ohne Zwischenablesung wird er wie nach § 9b Abs. 3 nach
 * Gradtagen bzw. Tagen auf Mieter und Vermieter aufgeteilt.
 */
const substitutedMeterConsumption = (params: {
  meter: MeterInfo;
  substitute: number;
  tenantShare: number;
  consumptionMethod: "heat_meter" | "heat_cost_allocator";
  unitName: string | null;
}): {
  landlordConsumption: number;
  row: NonNullable<HeatingDetail["perMeter"]>[number];
} => {
  const { meter, substitute, tenantShare } = params;
  const weighted = substitute * tenantShare;
  const kTotal =
    params.consumptionMethod === "heat_cost_allocator"
      ? (meter.kTotal ?? null)
      : null;

  return {
    landlordConsumption: substitute - weighted,
    row: {
      meterId: meter.id,
      meterLabel: meter.label,
      serialNumber: meter.serialNumber ?? null,
      unitId: meter.unitId,
      unitName: params.unitName,
      consumptionRaw: kTotal ? weighted / kTotal : weighted,
      kTotal,
      consumptionWeighted: weighted,
      consumptionIsSubstituted: true,
    },
  };
};

/**
 * Anteil eines Teilzeitraums an der Periode, nach Gradtagen oder Tagen
 */
const periodFraction = (
  part: Period,
  whole: Period,
  intervalWeight?: (fromDate: string, toDate: string) => number,
): number => {
  const weight = (period: Period) =>
    intervalWeight
      ? intervalWeight(period.start, period.end)
      : daysBetween(period.start, period.end);
  const total = weight(whole);

  return total > 0 ? weight(part) / total : 0;
};

/**
 * Voll-Perioden-Verbrauch eines Ziel-Wohnungs-Zählers abzüglich des bereits
 * dem Mieter zugerechneten Mietzeit-Anteils (gewichtet). Existieren nur
 * Ablesungen innerhalb der Mietzeit (Zähler ab Einzug/bis Auszug), clampt
 * `interpolateReading` und die Differenz bleibt 0.
 */
const residualTargetConsumption = (params: {
  readings: ReadingPoint[];
  weighted: number;
  kTotal: number | null;
  periodStart: string;
  periodEnd: string;
  intervalWeight?: (fromDate: string, toDate: string) => number;
}): number => {
  const { readings, weighted, kTotal, periodStart, periodEnd, intervalWeight } =
    params;

  const fullDelta = consumptionBetween(readings, periodStart, periodEnd, {
    warnings: [],
    intervalWeight,
  });

  const fullWeighted = kTotal === null ? fullDelta : fullDelta * kTotal;

  return Math.max(0, fullWeighted - weighted);
};

type MeterPart = ReturnType<typeof measuredMeterConsumption>;

/**
 * Fasst die Messung eines Zählers über mehrere versorgte Zeiträume zusammen
 */
const mergeMeterParts = (parts: MeterPart[]): MeterPart => {
  const [first, ...rest] = parts;
  if (!first) {
    throw new Error("Meter without supplied period");
  }

  return rest.reduce(
    (acc, part) => ({
      landlordConsumption: acc.landlordConsumption + part.landlordConsumption,
      row: {
        ...acc.row,
        consumptionRaw: acc.row.consumptionRaw + part.row.consumptionRaw,
        consumptionWeighted:
          acc.row.consumptionWeighted + part.row.consumptionWeighted,
        ...(acc.row.consumptionIsDerived || part.row.consumptionIsDerived
          ? { consumptionIsDerived: true }
          : {}),
      },
    }),
    first,
  );
};

/**
 * Liest den (gewichteten) Verbrauch je Zähler ab und aggregiert ihn pro
 * Wohnung. Ziel-Wohnung: Mieter-Zeitraum als Zähler, zusätzlich volle
 * Statement-Periode für den Verteilungs-Nenner. Die Differenz (Verbrauch
 * von Vor-/Nachmieter bzw. Leerstand) fällt als `landlordConsumption` auf
 * den Vermieter, damit die Summe über alle Statements einer Wohnung den
 * Topf nicht übersteigt (Mieterwechsel-Fall). Andere Wohnungen: voller
 * Statement-Zeitraum. HKV werden mit `kTotal` gewichtet; WMZ liefern kWh
 * direkt.
 */
const measureUnitConsumption = (params: {
  consumptionMeters: HeatingCalculationInput["consumptionMeters"];
  units: UnitInfo[];
  consumptionMethod: "heat_meter" | "heat_cost_allocator";
  targetUnitId: string | undefined;
  tenantStart: string;
  tenantEnd: string;
  periodStart: string;
  periodEnd: string;
  prorationMethod: HeatingProrationMethod;
  warnings: CalcWarning[];
  substituteByMeter?: Map<string, number>;
  zeroMeterIds?: Set<string>;
  supply?: UnitSupply;
}): {
  unitConsumption: Map<string, number>;
  perMeter: NonNullable<HeatingDetail["perMeter"]>;
  totalConsumption: number;
  landlordConsumption: number;
} => {
  const {
    consumptionMeters,
    units,
    consumptionMethod,
    targetUnitId,
    tenantStart,
    tenantEnd,
    periodStart,
    periodEnd,
    prorationMethod,
    warnings,
    substituteByMeter,
    zeroMeterIds,
  } = params;

  // § 9b HeizkostenV: Fehlt eine Zwischenablesung am Ein-/Auszugsdatum, wird der
  // Zählerstand geschätzt.
  const consumptionIntervalWeight =
    prorationMethod === "degree_days"
      ? (fromDate: string, toDate: string) =>
          sumDegreeDays({ start: fromDate, end: toDate })
      : undefined;
  const unitConsumption = new Map<string, number>();

  for (const unit of units) {
    unitConsumption.set(unit.id, 0);
  }

  const expectedType =
    consumptionMethod === "heat_cost_allocator"
      ? "heat_cost_allocator"
      : "heat_meter";

  const perMeter: NonNullable<HeatingDetail["perMeter"]> = [];
  let landlordConsumption = 0;

  for (const { meter, readings } of consumptionMeters) {
    if (!meter.unitId) {
      throw new CalculationError("heatingMeterNoUnit", { label: meter.label });
    }

    if (meter.type !== expectedType) {
      throw new Error(
        `Heating meter ${meter.id} has type=${meter.type}, expected ${expectedType} for consumptionMethod=${consumptionMethod}`,
      );
    }

    // Ziel-Wohnung: nur Mieter-Verbrauch ablesen. Andere Wohnungen: voller
    // Statement-Zeitraum, damit ihre Jahresverbräuche konsistent zu den
    // ungekürzten Gesamtkosten skaliert werden.
    const isTarget =
      targetUnitId !== undefined && meter.unitId === targetUnitId;

    const unitName = units.find((u) => u.id === meter.unitId)?.name ?? null;
    const substitute = substituteByMeter?.get(meter.id);
    const measured =
      substitute === undefined
        ? mergeMeterParts(
            // Je versorgtem Zeitraum der Wohnung: Stände außerhalb zählen
            // nicht, auch wenn der Zähler weiterläuft.
            suppliedPeriodsOf(params.supply, meter.unitId, {
              start: periodStart,
              end: periodEnd,
            }).map((supplied) =>
              measuredMeterConsumption({
                meter,
                readings: readingsForSuppliedPeriod(
                  readings,
                  supplied,
                  meter.resetDay,
                ),
                isTarget,
                // Negativer Ausgleich: nur vorläufig mit 0, ohne die
                // allgemeine Warnung zum negativen Verbrauch (die eigene
                // blockiert schon).
                isZeroed: zeroMeterIds?.has(meter.id) ?? false,
                period: { start: supplied.start, end: supplied.end },
                tenantPeriod: { start: tenantStart, end: tenantEnd },
                consumptionMethod,
                intervalWeight: consumptionIntervalWeight,
                warnings,
                unitName,
              }),
            ),
          )
        : substitutedMeterConsumption({
            meter,
            substitute,
            tenantShare: isTarget
              ? periodFraction(
                  { start: tenantStart, end: tenantEnd },
                  { start: periodStart, end: periodEnd },
                  consumptionIntervalWeight,
                )
              : 1,
            consumptionMethod,
            unitName,
          });

    landlordConsumption += measured.landlordConsumption;
    unitConsumption.set(
      meter.unitId,
      (unitConsumption.get(meter.unitId) ?? 0) +
        measured.row.consumptionWeighted,
    );
    perMeter.push(measured.row);
  }

  const totalConsumption =
    [...unitConsumption.values()].reduce((acc, v) => acc + v, 0) +
    landlordConsumption;

  return { unitConsumption, perMeter, totalConsumption, landlordConsumption };
};

/**
 * Grundkosten-Flächengewichte je Wohnung = Heizfläche x Zeitgewicht der
 * belegten Tage ("linear": Kalendertage, "degree_days": Summe Gradtag-Promille).
 * Leerstand fällt als Differenz auf den Vermieter (§ 9 Abs. 2 HeizkostenV).
 * Fallback auf linear, wenn Gradtag-Promille fehlen.
 */
const computeAreaWeights = (
  units: UnitInfo[],
  prorationMethod: HeatingProrationMethod,
  baseMethod: HeatingBaseMethod,
): {
  heatingAreaDiffersFromLivingArea: boolean;
  areaWeightsWithLandlord: number[];
  totalAreaDays: number;
} => {
  const heatingAreaDiffersFromLivingArea =
    baseMethod === "heated_area" &&
    units.some(
      (u) =>
        u.heatingAreaSqm !== null &&
        u.heatingAreaSqm !== undefined &&
        u.heatingAreaSqm !== u.areaSqm,
    );

  const totalHeatingAreaSqm = units.reduce(
    (acc, u) => acc + baseCostAreaFor("heating", u, baseMethod),
    0,
  );

  const useDegreeDays =
    prorationMethod === "degree_days" &&
    (units[0]?.periodDegreeDayPromille ?? 0) > 0;

  const periodTimeWeight = useDegreeDays
    ? (units[0]?.periodDegreeDayPromille ?? 0)
    : (units[0]?.periodDays ?? 0);

  const unitTimeWeight = (unit: UnitInfo) =>
    useDegreeDays ? (unit.occupiedDegreeDayPromille ?? 0) : unit.occupiedDays;

  const areaDayWeights = units.map(
    (unit) =>
      baseCostAreaFor("heating", unit, baseMethod) * unitTimeWeight(unit),
  );

  // Gesamt nur über versorgte Zeit: Nicht versorgte Tage sind kein Leerstand.
  const suppliedTimeWeight = (unit: UnitInfo) =>
    (useDegreeDays ? unit.suppliedDegreeDayPromille : unit.suppliedDays) ??
    periodTimeWeight;
  const totalAreaDays = units.some((unit) => unit.suppliedDays !== undefined)
    ? units.reduce(
        (acc, unit) =>
          acc +
          baseCostAreaFor("heating", unit, baseMethod) *
            suppliedTimeWeight(unit),
        0,
      )
    : totalHeatingAreaSqm * periodTimeWeight;
  const sumAreaDayWeights = areaDayWeights.reduce((a, b) => a + b, 0);
  const landlordAreaDayWeight = Math.max(0, totalAreaDays - sumAreaDayWeights);

  return {
    heatingAreaDiffersFromLivingArea,
    areaWeightsWithLandlord: [...areaDayWeights, landlordAreaDayWeight],
    totalAreaDays,
  };
};

/**
 * Codes, deren Text die Fläche der Heizung benennt, gibt es je Maßstab.
 * Ohne Endung nennen sie die Heizfläche.
 */
const areaCodeSuffix = (baseMethod: HeatingBaseMethod): string =>
  baseMethod === "living_area" ? "LivingArea" : "";

/**
 * Verteilt den Verbrauchsanteil
 */
const computeConsumptionShares = (params: {
  totalConsumption: number;
  consumptionPortionCents: number;
  units: UnitInfo[];
  unitConsumption: Map<string, number>;
  landlordConsumption: number;
  areaWeightsWithLandlord: number[];
  totalAreaDays: number;
  consumptionMeters: HeatingCalculationInput["consumptionMeters"];
  consumptionMethod: "heat_meter" | "heat_cost_allocator";
  baseMethod: HeatingBaseMethod;
  warnings: CalcWarning[];
  substitutionLimitExceeded?: boolean;
}): {
  consumptionDistributionMethod: "consumption" | "heating_area";
  areaDistributionReason?: AreaDistributionReason;
  consumptionShares: number[];
} => {
  const {
    totalConsumption,
    consumptionPortionCents,
    units,
    unitConsumption,
    landlordConsumption,
    areaWeightsWithLandlord,
    totalAreaDays,
    consumptionMeters,
    consumptionMethod,
    baseMethod,
    warnings,
    substitutionLimitExceeded,
  } = params;

  if (substitutionLimitExceeded) {
    return {
      consumptionDistributionMethod: "heating_area",
      areaDistributionReason: "substitution_limit_exceeded",
      consumptionShares:
        totalAreaDays > 0
          ? distributeCents(consumptionPortionCents, areaWeightsWithLandlord)
          : [...units.map(() => 0), 0],
    };
  }

  if (totalConsumption > 0) {
    const consumptionWeights = [
      ...units.map((u) => unitConsumption.get(u.id) ?? 0),
      landlordConsumption,
    ];

    return {
      consumptionDistributionMethod: "consumption",
      consumptionShares: distributeCents(
        consumptionPortionCents,
        consumptionWeights,
      ),
    };
  }

  // Keine Verbrauchsmessung (kein Zähler oder Delta überall 0): Fallback nach
  // (Heiz-)Fläche; wird in der PDF-Anlage als Hinweis ausgewiesen.
  const consumptionShares =
    totalAreaDays > 0
      ? distributeCents(consumptionPortionCents, areaWeightsWithLandlord)
      : [...units.map(() => 0), 0];

  if (consumptionPortionCents > 0) {
    let code: CalcWarning["code"];

    if (consumptionMeters.length > 0) {
      code = "consumptionFallbackZeroDelta";
    } else {
      code =
        consumptionMethod === "heat_cost_allocator"
          ? "consumptionFallbackNoAllocators"
          : "consumptionFallbackNoHeatMeters";
    }

    warnings.push({ code: `${code}${areaCodeSuffix(baseMethod)}` });
  }

  return {
    consumptionDistributionMethod: "heating_area",
    areaDistributionReason: "fallback",
    consumptionShares,
  };
};

/**
 * Verteilt den Warmwasser-Topf (§ 9 Abs. 2) mit eigenem Grund-/Verbrauchs-
 * Split und eigenen Flächengewichten (Wohnfläche, zeitanteilig).
 */
const buildHotWaterDetail = (params: {
  hotWaterSplit: ReturnType<typeof computeHotWaterSplit>;
  config: HeatingConfig;
  units: UnitInfo[];
  hotWater: HotWaterInput | undefined;
  warnings: CalcWarning[];
  measured?: { unitHotWaterM3: Map<string, number>; landlordM3: number };
  substitutionLimitExceeded?: boolean;
  substitutedUnitIds?: Set<string>;
}): HeatingDetail["hotWaterDetail"] => {
  const {
    hotWaterSplit,
    config,
    units,
    hotWater,
    warnings,
    measured,
    substitutionLimitExceeded,
    substitutedUnitIds,
  } = params;
  if (!hotWaterSplit) {
    return;
  }

  const { areaWeightsWithLandlord, totalAreaDays } =
    computeHotWaterAreaWeights(units);

  return {
    ...hotWaterSplit,
    consumptionShareBps: config.consumptionShareBps,
    basicAreaBasis: "living_area",
    ...distributeHotWater({
      potCents: hotWaterSplit.hotWaterPotCents,
      consumptionShareBps: config.consumptionShareBps,
      units,
      unitHotWaterM3:
        measured?.unitHotWaterM3 ??
        new Map(
          (hotWater?.unitHotWaterM3 ?? []).map((entry) => [
            entry.unitId,
            entry.m3,
          ]),
        ),
      landlordM3: measured?.landlordM3 ?? hotWater?.landlordM3 ?? 0,
      areaWeightsWithLandlord,
      totalAreaDays,
      warnings,
      substitutionLimitExceeded,
      substitutedUnitIds,
    }),
  };
};

/**
 * Topf-Aufteilung: CO2KostAufG-Vermieteranteil vorab abziehen, dann den
 * Warmwasseranteil nach § 9 Abs. 2 abspalten (bei fehlender Q_gesamt/Q_WW
 * bleibt `hotWaterSplit` undefined, mit Warnung) und den Heizungstopf in
 * Verbrauchs- und Grundanteil teilen.
 */
const splitHeatingPot = (
  input: HeatingCalculationInput,
  heatingScoped: ScopedUnits,
  hotWaterScoped: ScopedUnits,
  warnings: CalcWarning[],
) => {
  const { units, periodStart, config } = input;
  const yearDays = daysInYear(periodStart);
  const { co2Detail, landlordCo2DeductionCents } = computeCo2Deduction(
    input.co2,
    // § 5 Abs. 1 Satz 2 CO2KostAufG: Maßgeblich ist die Wohnfläche der
    // Wohnungen, die aus der Anlage beheizt werden. Warmwasser allein
    // zählt nicht, die Belegung spielt keine Rolle.
    suppliedLivingAreaSqm(heatingScoped.units),
    { start: periodStart, end: input.periodEnd },
    warnings,
  );
  if (co2Detail && input.hotWater) {
    pushHotWaterOnlyWarnings({
      units,
      heating: heatingScoped.supply,
      hotWater: hotWaterScoped.supply,
      period: { start: periodStart, end: input.periodEnd },
      warnings,
    });
  }
  const distributablePotCents =
    input.totalHeatingCostsCents - landlordCo2DeductionCents;

  const hotWaterSplit = computeHotWaterSplit(
    input.hotWater,
    distributablePotCents,
    // § 9 Abs. 2 Satz 5: nur die zentral mit Warmwasser versorgte Fläche,
    // nach versorgten Tagen gewichtet.
    suppliedLivingAreaSqm(hotWaterScoped.units),
    units[0]?.periodDays ?? 0,
    yearDays,
    warnings,
  );
  const heatingPotCents =
    distributablePotCents - (hotWaterSplit?.hotWaterPotCents ?? 0);
  const consumptionPortionCents = Math.round(
    heatingPotCents * bpsToFactor(config.consumptionShareBps),
  );

  return {
    co2Detail,
    distributablePotCents,
    hotWaterSplit,
    heatingPotCents,
    consumptionPortionCents,
    basicPortionCents: heatingPotCents - consumptionPortionCents,
  };
};

/**
 * § 9a für die Heizung: Lücken, Ersatzverbräuche, 25%-Grenze und
 * Ausgleichsstände
 */
const evaluateHeatingScope = (params: {
  input: HeatingCalculationInput;
  scoped: ScopedUnits;
  period: Period;
  prorationMethod: HeatingProrationMethod;
  warnings: CalcWarning[];
}): {
  heatingMeters: ScopeMeter[];
  heatingEvaluation: ScopeEvaluation;
  heatingCompensations: ReturnType<typeof compensationSnapshots>;
  withCompensations: (bundle: ScopeMeter) => ScopeMeter;
} => {
  const { input, period, warnings } = params;
  const compensations = input.compensations ?? [];
  const withCompensations = (bundle: ScopeMeter): ScopeMeter => ({
    meter: bundle.meter,
    readings: applyCompensations(
      bundle.meter.id,
      bundle.readings,
      compensations,
      input.readingInvalidations ?? [],
    ),
  });
  const heatingMeters = input.consumptionMeters
    .filter(
      (entry) =>
        supplyStateOf(
          params.scoped.supply,
          entry.meter.unitId ?? "",
          period,
        ) !== "none",
    )
    .map(withCompensations);
  const heatingEvaluation = evaluateSubstitutionScope({
    scope: "heating",
    supply: params.scoped.supply,
    period,
    units: input.units,
    baseAreaByUnit: new Map(
      input.units.map((unit) => [
        unit.id,
        baseCostAreaFor("heating", unit, input.config.baseMethod),
      ]),
    ),
    fullOccupiedDaysByUnit: input.fullOccupiedDaysByUnit,
    meters: heatingMeters,
    shareMethod: input.consumptionMethod === "heat_cost_allocator",
    substitutions: input.substitutions ?? [],
    referenceMeters: input.referenceMeters?.heating ?? [],
    substitutedPeriods: input.substitutedPeriods ?? [],
    intervalWeight:
      params.prorationMethod === "degree_days"
        ? (fromDate: string, toDate: string) =>
            sumDegreeDays({ start: fromDate, end: toDate })
        : undefined,
  });
  warnings.push(...heatingEvaluation.warnings);
  // Heizfläche 0: keine Wärmeabgabe aus der Anlage, also auch kein Zähler.
  pushMissingMeterWarnings(
    "heating",
    params.scoped.units.filter((unit) => unit.heatingAreaSqm !== 0),
    heatingMeters,
    warnings,
  );

  return {
    heatingMeters,
    heatingEvaluation,
    heatingCompensations: compensationSnapshots(
      "heating",
      heatingMeters,
      compensations,
      period,
      warnings,
    ),
    withCompensations,
  };
};

const hotWaterScopeResult = (evaluation: ScopeEvaluation) => ({
  substitutionLimitExceeded: evaluation.limitExceeded,
  substitutedUnitIds: substitutedUnitIds(evaluation),
});

type ScopeResult = {
  evaluation: ScopeEvaluation;
  compensations: NonNullable<HeatingDetail["compensations"]>;
};

/**
 * Snapshot-Felder zu § 9a und die Hinweise fürs Mieterdokument
 */
const substitutionDetailFields = (params: {
  heating: ScopeResult;
  hotWater: ScopeResult | undefined;
  substitutions: SubstitutionInput[];
  targetUnitId: string | undefined;
  baseMethod: HeatingBaseMethod;
  warnings: CalcWarning[];
}): Pick<
  HeatingDetail,
  "substitutions" | "compensations" | "substitutionArea"
> => {
  const { heating, hotWater } = params;
  pushSubstitutionNotices({ scope: "heating", ...heating, ...params });
  if (hotWater) {
    pushSubstitutionNotices({ scope: "hot_water", ...hotWater, ...params });
  }

  const substitutions = [
    ...toSubstitutionSnapshots(heating.evaluation),
    ...(hotWater ? toSubstitutionSnapshots(hotWater.evaluation) : []),
  ];
  const compensations = [
    ...heating.compensations,
    ...(hotWater?.compensations ?? []),
  ];
  const substitutionArea = {
    ...(heating.evaluation.resolved.length > 0
      ? { heating: toAreaSnapshot(heating.evaluation) }
      : {}),
    ...(hotWater && hotWater.evaluation.resolved.length > 0
      ? { hotWater: toAreaSnapshot(hotWater.evaluation) }
      : {}),
  };

  return {
    ...(substitutions.length > 0 ? { substitutions } : {}),
    ...(compensations.length > 0 ? { compensations } : {}),
    ...(Object.keys(substitutionArea).length > 0 ? { substitutionArea } : {}),
  };
};

/**
 * Wohnungen mit gültigem Ersatzverbrauch
 */
const substitutedUnitIds = (evaluation: ScopeEvaluation): Set<string> =>
  new Set(
    evaluation.resolved
      .filter((entry) => entry.isValid)
      .map((entry) => entry.unitId),
  );

const toSubstitutionSnapshots = (
  evaluation: ScopeEvaluation,
): NonNullable<HeatingDetail["substitutions"]> =>
  evaluation.resolved.map(({ isValid, ...entry }) => ({
    ...entry,
    appliedToDistribution: isValid && !evaluation.limitExceeded,
  }));

const toAreaSnapshot = (evaluation: ScopeEvaluation) => ({
  affectedAreaSqm: evaluation.affectedAreaSqm,
  totalAreaSqm: evaluation.totalAreaSqm,
  limitExceeded: evaluation.limitExceeded,
});

/**
 * Warmwasser nach § 9a: nur, wenn die Wohnungszähler mit Ablesungen
 * übergeben sind. Liefert die Wohnungsverbräuche einschließlich
 * Ersatzverbrauch; meldet ein unvollständiges Volumen V, wenn Q_WW über die
 * Formel mit V bestimmt wird (§ 9 Abs. 2 verlangt ein gemessenes V).
 */
const evaluateHotWaterScope = (params: {
  input: HeatingCalculationInput;
  scoped: ScopedUnits;
  hotWaterSplit: ReturnType<typeof computeHotWaterSplit>;
  period: Period;
  tenantPeriod: Period;
  withCompensations: (bundle: ScopeMeter) => ScopeMeter;
  compensations: CompensationInput[];
  warnings: CalcWarning[];
}):
  | {
      evaluation: ScopeEvaluation;
      compensations: NonNullable<HeatingDetail["compensations"]>;
      measured: { unitHotWaterM3: Map<string, number>; landlordM3: number };
    }
  | undefined => {
  const { input, hotWaterSplit, period, tenantPeriod, warnings } = params;
  const unitMeters = input.hotWater?.unitMeters;
  if (!unitMeters || !hotWaterSplit) {
    return;
  }

  const { supply } = params.scoped;
  const meters = unitMeters
    .filter(
      (entry) =>
        supplyStateOf(supply, entry.meter.unitId ?? "", period) !== "none",
    )
    .map(params.withCompensations);
  pushMissingMeterWarnings("hot_water", params.scoped.units, meters, warnings);
  const evaluation = evaluateSubstitutionScope({
    scope: "hot_water",
    supply,
    period,
    units: input.units,
    baseAreaByUnit: new Map(input.units.map((unit) => [unit.id, unit.areaSqm])),
    fullOccupiedDaysByUnit: input.fullOccupiedDaysByUnit,
    meters,
    shareMethod: false,
    substitutions: input.substitutions ?? [],
    referenceMeters: input.referenceMeters?.hotWater ?? [],
    substitutedPeriods: input.substitutedPeriods ?? [],
  });
  warnings.push(...evaluation.warnings);
  const compensation = compensationSnapshots(
    "hot_water",
    meters,
    params.compensations,
    period,
    warnings,
  );

  if (
    hotWaterSplit.method === "estimated" &&
    (evaluation.gaps.length > 0 ||
      evaluation.resolved.length > 0 ||
      compensation.snapshots.length > 0)
  ) {
    warnings.push({ code: "hotWaterVolumeIncomplete" });
  }

  const measured = measureHotWaterUnits({
    unitMeters: meters,
    supply,
    units: input.units,
    targetUnitId: input.targetUnitId,
    period,
    tenantPeriod,
    warnings: [],
    substituteByMeter: evaluation.substituteByMeter,
    zeroMeterIds: compensation.negativeMeterIds,
  });

  return {
    evaluation,
    compensations: compensation.snapshots,
    measured: {
      unitHotWaterM3: new Map(
        measured.unitHotWaterM3.map((entry) => [entry.unitId, entry.m3]),
      ),
      landlordM3: measured.landlordM3,
    },
  };
};

/**
 * Heizkosten je versorgter Wohnung aus Verbrauchs- und Grundkostenanteil
 */
const heatingPerUnit = (params: {
  units: UnitInfo[];
  consumptionShares: number[];
  basicShares: number[];
  unitConsumption: Map<string, number>;
  substitutedUnits: Set<string>;
  baseMethod: HeatingBaseMethod;
}): HeatingDetail["perUnit"] =>
  params.units.map((unit, idx) => {
    const consumptionCostCents = params.consumptionShares[idx] ?? 0;
    const basicCostCents = params.basicShares[idx] ?? 0;

    return {
      unitId: unit.id,
      unitName: unit.name,
      consumptionKwh: params.unitConsumption.get(unit.id) ?? 0,
      consumptionCostCents,
      areaSqm: baseCostAreaFor("heating", unit, params.baseMethod),
      basicCostCents,
      totalCents: consumptionCostCents + basicCostCents,
      ...(params.substitutedUnits.has(unit.id)
        ? { consumptionIsSubstituted: true }
        : {}),
    };
  });

/**
 * Warmwasser: § 9a-Auswertung der Wohnungszähler und Verteilung des
 * abgespaltenen Topfs auf die zentral versorgten Wohnungen
 */
const computeHotWater = (params: {
  input: HeatingCalculationInput;
  scoped: ScopedUnits;
  hotWaterSplit: ReturnType<typeof computeHotWaterSplit>;
  period: Period;
  tenantPeriod: Period;
  withCompensations: (bundle: ScopeMeter) => ScopeMeter;
  warnings: CalcWarning[];
}) => {
  const { input, scoped, hotWaterSplit, warnings } = params;
  const hotWaterScope = evaluateHotWaterScope({
    ...params,
    compensations: input.compensations ?? [],
  });
  if (
    hotWaterSplit &&
    hotWaterSplit.hotWaterPotCents > 0 &&
    scoped.units.length === 0
  ) {
    warnings.push({ code: "supplyNoParticipantsHotWater" });
  }

  const hotWaterDetail = buildHotWaterDetail({
    hotWaterSplit,
    config: input.config,
    units: scoped.units,
    hotWater: input.hotWater,
    warnings,
    ...(hotWaterScope ? hotWaterScopeResult(hotWaterScope.evaluation) : {}),
    measured: hotWaterScope?.measured,
  });

  return { hotWaterScope, hotWaterDetail };
};

const scopeCodeSuffix = (scope: "heating" | "hot_water"): string =>
  scope === "heating" ? "Heating" : "HotWater";

/**
 * Teil des Warncodes für das Verfahren; beim Durchschnitt unterscheidet
 * die Nutzergruppe (ausgewählte Wohnungen) vom ganzen Gebäude
 */
const methodCodeSuffix = (
  method: SubstitutionInput["method"],
  hasComparisonUnits: boolean,
): string => {
  if (method === "same_rooms_comparable_period") {
    return "SameRooms";
  }

  if (method === "comparable_rooms") {
    return "ComparableRooms";
  }

  return hasComparisonUnits ? "GroupAverage" : "BuildingAverage";
};

/**
 * Hinweise fürs Mieterdokument: Ersatzverbrauch der eigenen Wohnung (mit
 * Verfahren), Ersatzverbräuche anderer Wohnungen (ohne Namen), § 9a Abs. 2
 * und Ausgleich aus der Vorperiode
 */
const pushSubstitutionNotices = (params: {
  scope: "heating" | "hot_water";
  evaluation: ScopeEvaluation;
  compensations: NonNullable<HeatingDetail["compensations"]>;
  substitutions: SubstitutionInput[];
  targetUnitId: string | undefined;
  baseMethod: HeatingBaseMethod;
  warnings: CalcWarning[];
}): void => {
  const { scope, evaluation, compensations, targetUnitId, warnings } = params;
  const suffix = scopeCodeSuffix(scope);
  const valid = evaluation.resolved.filter((entry) => entry.isValid);

  if (evaluation.limitExceeded) {
    const areaSuffix =
      scope === "heating" ? areaCodeSuffix(params.baseMethod) : "";
    warnings.push({
      code: `substitutionAreaDistribution${suffix}${areaSuffix}`,
    });
  } else {
    const own = valid.find((entry) => entry.unitId === targetUnitId);
    if (own) {
      const input = params.substitutions.find(
        (entry) => entry.id === own.substitutionId,
      );

      const method = methodCodeSuffix(
        own.method,
        (input?.comparisonUnitIds ?? null) !== null,
      );

      warnings.push({ code: `substitution${suffix}${method}` });
    }

    if (valid.some((entry) => entry.unitId !== targetUnitId)) {
      warnings.push({ code: `substitutionOtherUnits${suffix}` });
    }
  }

  if (compensations.some((entry) => entry.unitId === targetUnitId)) {
    warnings.push({ code: `substitutionCompensation${suffix}` });
  }
};

type HotWaterMeasureParams = {
  period: Period;
  tenantPeriod: Period;
  warnings: CalcWarning[];
  substituteByMeter?: Map<string, number>;
  zeroMeterIds?: Set<string>;
  supply?: UnitSupply;
};

/**
 * Verbrauch eines Warmwasserzählers über die Periode und über die Mietzeit.
 * Gemessen wird je versorgtem Zeitraum der Wohnung: Stände außerhalb zählen
 * nicht, auch wenn der Zähler weiterläuft.
 */
const measureHotWaterMeter = (
  { meter, readings }: ScopeMeter,
  params: HotWaterMeasureParams,
): { fullM3: number; tenantM3: number } => {
  const { period, tenantPeriod } = params;
  const substitute = params.substituteByMeter?.get(meter.id);
  if (substitute !== undefined) {
    return {
      fullM3: substitute,
      tenantM3: substitute * periodFraction(tenantPeriod, period),
    };
  }

  if (params.zeroMeterIds?.has(meter.id) || readings.length === 0) {
    return { fullM3: 0, tenantM3: 0 };
  }

  const options = { warnings: params.warnings, label: meter.label };
  let fullM3 = 0;
  let tenantM3 = 0;
  for (const supplied of suppliedPeriodsOf(
    params.supply,
    meter.unitId,
    period,
  )) {
    const suppliedReadings = readingsForSuppliedPeriod(readings, supplied);
    const tenantPart = intersect(supplied, tenantPeriod);

    fullM3 += consumptionBetween(
      suppliedReadings,
      supplied.start,
      supplied.end,
      options,
    );
    tenantM3 += tenantPart
      ? consumptionBetween(
          suppliedReadings,
          tenantPart.start,
          tenantPart.end,
          options,
        )
      : 0;
  }

  return { fullM3, tenantM3 };
};

/**
 * Warmwasserverbrauch je Wohnung aus den Wohnungszählern (`water_hot`,
 * Rolle `unit`). Ziel-Wohnung: Mietzeit, der Rest der Periode fällt als
 * `landlordM3` auf den Vermieter. Ersatzverbräuche gelten für die volle
 * Periode und werden zeitanteilig aufgeteilt.
 */
export const measureHotWaterUnits = (params: {
  unitMeters: ScopeMeter[];
  units: Array<{ id: string }>;
  targetUnitId: string | undefined;
  period: Period;
  tenantPeriod: Period;
  warnings: CalcWarning[];
  substituteByMeter?: Map<string, number>;
  zeroMeterIds?: Set<string>;
  supply?: UnitSupply;
}): {
  unitHotWaterM3: Array<{ unitId: string; m3: number }>;
  landlordM3: number;
} => {
  const { unitMeters } = params;
  let landlordM3 = 0;

  const unitHotWaterM3 = params.units.map((unit) => {
    const isTarget = unit.id === params.targetUnitId;
    let fullM3 = 0;
    let m3 = 0;

    for (const { meter, readings } of unitMeters) {
      if (meter.unitId !== unit.id) {
        continue;
      }

      const { fullM3: meterFullM3, tenantM3: meterTenantM3 } =
        measureHotWaterMeter({ meter, readings }, params);

      fullM3 += meterFullM3;
      m3 += isTarget ? meterTenantM3 : meterFullM3;
    }

    if (isTarget) {
      landlordM3 += Math.max(0, fullM3 - m3);
    }

    return { unitId: unit.id, m3 };
  });

  return { unitHotWaterM3, landlordM3 };
};

/**
 * Interne Heizkostenberechnung nach HeizkostenV.
 *
 * 1. **Verbrauchsanteil** (consumptionShareBps, typ. 70 %):
 *    - Topf = `totalHeatingCostsCents x consumptionFactor` - **ungekürzt**
 *      (Jahres-Topf). Die zeitliche Zuordnung zum Mieter ergibt sich
 *      automatisch aus dem Zähler-Delta.
 *    - Verteilung anhand der Zählerwerte: Ziel-Wohnung liest über die
 *      Mietzeit (Zwischenablesung), andere Wohnungen über die volle
 *      Statement-Periode. Der Nenner enthält zusätzlich den Verbrauch der
 *      Ziel-Wohnung außerhalb der Mietzeit (Vor-/Nachmieter, Leerstand);
 *      dieser Anteil fällt auf den Vermieter und wird über das Statement
 *      des anderen Mieters wieder eingesammelt.
 *
 * 2. **Grundkostenanteil** (1 - consumptionShareBps, typ. 30 %):
 *    - Topf = `totalHeatingCostsCents x (1 - consumptionFactor)` -
 *      **ungekürzt** (Jahres-Topf).
 *    - Verteilung nach Flächentagen über alle Wohnungen (qm x belegte
 *      Tage). Bei `prorationMethod = "degree_days"` werden die Tage mit
 *      den Gradtagszahlen gewichtet (Flächen-Gradtage statt
 *      Flächentage). Leerstand fällt jeweils auf den Vermieter.
 *
 * Der Wärmemengenzähler misst kWh direkt; bei Heizkostenverteilern werden
 * die abgelesenen Anzeigewerte pro HKV mit dem heizkörperspezifischen
 * Bewertungsfaktor (KGesamt) multipliziert und über alle HKV der Wohnung
 * summiert.
 */
export const calculateHeating = (
  input: HeatingCalculationInput,
): HeatingDetail => {
  const {
    config,
    consumptionMethod,
    periodStart,
    periodEnd,
    tenantPeriodStart,
    tenantPeriodEnd,
    targetUnitId,
    prorationMethod = "linear",
  } = input;
  const tenantStart = tenantPeriodStart ?? periodStart;
  const tenantEnd = tenantPeriodEnd ?? periodEnd;
  const warnings: CalcWarning[] = [];
  const period = { start: periodStart, end: periodEnd };

  // Teilnahme an der zentralen Versorgung, getrennt je Bereich. Ab hier
  // rechnet jeder Bereich nur mit seinen versorgten Wohnungen.
  const heatingScoped = scopeUnits(input, "heating", period);
  const hotWaterScoped = scopeUnits(input, "hot_water", period);
  const { units } = heatingScoped;

  const {
    co2Detail,
    distributablePotCents,
    hotWaterSplit,
    heatingPotCents,
    consumptionPortionCents,
    basicPortionCents,
  } = splitHeatingPot(input, heatingScoped, hotWaterScoped, warnings);

  // § 9a HeizkostenV: Ausgleichsstände einfügen, Lücken erkennen,
  // Ersatzverbräuche und 25-%-Grenze je Bereich ermitteln.
  const {
    heatingMeters,
    heatingEvaluation,
    heatingCompensations,
    withCompensations,
  } = evaluateHeatingScope({
    input,
    scoped: heatingScoped,
    period,
    prorationMethod,
    warnings,
  });
  if (units.length === 0 && heatingPotCents > 0) {
    warnings.push({ code: "supplyNoParticipantsHeating" });
  }

  const { unitConsumption, perMeter, totalConsumption, landlordConsumption } =
    measureUnitConsumption({
      consumptionMeters: heatingMeters,
      units,
      consumptionMethod,
      targetUnitId,
      tenantStart,
      tenantEnd,
      periodStart,
      periodEnd,
      prorationMethod,
      warnings,
      substituteByMeter: heatingEvaluation.substituteByMeter,
      zeroMeterIds: heatingCompensations.negativeMeterIds,
      supply: heatingScoped.supply,
    });

  const {
    heatingAreaDiffersFromLivingArea,
    areaWeightsWithLandlord,
    totalAreaDays,
  } = computeAreaWeights(units, prorationMethod, config.baseMethod);
  pushHeatingAreaWarnings({
    units,
    unitConsumption,
    baseMethod: config.baseMethod,
    heatingPotCents,
    warnings,
  });

  const {
    consumptionDistributionMethod,
    areaDistributionReason,
    consumptionShares,
  } = computeConsumptionShares({
    totalConsumption,
    consumptionPortionCents,
    units,
    unitConsumption,
    landlordConsumption,
    areaWeightsWithLandlord,
    totalAreaDays,
    consumptionMeters: heatingMeters,
    consumptionMethod,
    baseMethod: config.baseMethod,
    warnings,
    substitutionLimitExceeded: heatingEvaluation.limitExceeded,
  });
  const basicShares =
    totalAreaDays > 0
      ? distributeCents(basicPortionCents, areaWeightsWithLandlord)
      : [...units.map(() => 0), 0];
  const perUnit = heatingPerUnit({
    units,
    consumptionShares,
    basicShares,
    unitConsumption,
    substitutedUnits: substitutedUnitIds(heatingEvaluation),
    baseMethod: config.baseMethod,
  });

  const { hotWaterScope, hotWaterDetail } = computeHotWater({
    input,
    scoped: hotWaterScoped,
    hotWaterSplit,
    period,
    tenantPeriod: { start: tenantStart, end: tenantEnd },
    withCompensations,
    warnings,
  });

  const substitutionFields = substitutionDetailFields({
    heating: {
      evaluation: heatingEvaluation,
      compensations: heatingCompensations.snapshots,
    },
    hotWater:
      hotWaterScope && hotWaterDetail
        ? {
            evaluation: hotWaterScope.evaluation,
            compensations: hotWaterScope.compensations,
          }
        : undefined,
    substitutions: input.substitutions ?? [],
    targetUnitId,
    baseMethod: config.baseMethod,
    warnings,
  });

  return {
    ...substitutionFields,
    ...supplyDetailFields({
      units: input.units,
      heating: heatingScoped.supply,
      hotWater: hotWaterDetail ? hotWaterScoped.supply : undefined,
      period,
      warnings,
    }),
    ...(areaDistributionReason ? { areaDistributionReason } : {}),
    mode: "internal",
    billingInfoOmitted: false,
    // Verteilter (Netto-)Topf nach CO2-Abzug (ohne CO2 = Brutto-Topf).
    totalHeatingCostsCents: distributablePotCents,
    heatingPotCents,
    consumptionShareBps: config.consumptionShareBps,
    baseMethod: config.baseMethod,
    consumptionPortionCents,
    basicPortionCents,
    consumptionMethod,
    consumptionDistributionMethod,
    prorationMethod,
    warnings,
    perMeter,
    perUnit,
    // Vermieter-Anteil = letzte Share-Array-Position: Leerstand bei den
    // Grundkosten, Vor-/Nachmieter-/Leerstandsverbrauch der Ziel-Wohnung bei
    // den Verbrauchskosten.
    landlordBasicCostCents: basicShares.at(-1) ?? 0,
    landlordConsumptionCostCents: consumptionShares.at(-1) ?? 0,
    heatingAreaDiffersFromLivingArea,
    co2Detail,
    hotWaterDetail,
  };
};

/**
 * Externe Heizkostenberechnung für den Modus "external".
 *
 * Die App führt keine eigene Verteilung durch, sondern übernimmt die vom
 * Dienstleister gelieferten Endbeträge pro Wohnung direkt. Es wird keine
 * Verbrauchs-Rekonstruktion versucht.
 */
type ExternalHeatingCalculationInput = {
  units: UnitInfo[];
  entries: Array<{
    unitId: string;
    totalCents: number;
    baseCostCents: number | null;
    consumptionCostCents: number | null;
  }>;
};

export const calculateExternalHeating = (
  input: ExternalHeatingCalculationInput,
): HeatingDetail => {
  const perUnit = input.units.map((unit) => {
    const entries = input.entries.filter((entry) => entry.unitId === unit.id);
    const totalCents = entries.reduce(
      (acc, entry) => acc + entry.totalCents,
      0,
    );

    const basicCostCents = entries.reduce(
      (acc, entry) => acc + (entry.baseCostCents ?? 0),
      0,
    );

    const consumptionCostCents = entries.reduce(
      (acc, entry) => acc + (entry.consumptionCostCents ?? 0),
      0,
    );

    return {
      unitId: unit.id,
      unitName: unit.name,
      consumptionKwh: 0,
      consumptionCostCents,
      areaSqm: unit.heatingAreaSqm ?? unit.areaSqm,
      basicCostCents,
      totalCents,
    };
  });

  const totalHeatingCostsCents = perUnit.reduce(
    (acc, unit) => acc + unit.totalCents,
    0,
  );

  const consumptionPortionCents = perUnit.reduce(
    (acc, unit) => acc + unit.consumptionCostCents,
    0,
  );

  const basicPortionCents = perUnit.reduce(
    (acc, unit) => acc + unit.basicCostCents,
    0,
  );

  const consumptionShareBps =
    totalHeatingCostsCents > 0
      ? Math.round((consumptionPortionCents / totalHeatingCostsCents) * 10_000)
      : 0;

  const heatingAreaDiffersFromLivingArea = input.units.some(
    (u) =>
      u.heatingAreaSqm !== null &&
      u.heatingAreaSqm !== undefined &&
      u.heatingAreaSqm !== u.areaSqm,
  );

  return {
    mode: "external",
    billingInfoOmitted: false,
    totalHeatingCostsCents,
    consumptionShareBps,
    consumptionPortionCents,
    basicPortionCents,
    perUnit,
    heatingAreaDiffersFromLivingArea,
  };
};
