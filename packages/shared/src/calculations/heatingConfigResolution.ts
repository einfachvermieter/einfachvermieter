import type { HeatingSettings } from "../schemas/heating.js";
import type { CalcWarning, Period } from "../types/index.js";
import { uncoveredHeatingConfigPeriods } from "./heatingConfigGaps.js";
import { intersect } from "./period.js";

/**
 * Heizkostenkonfiguration, die für einen Abrechnungszeitraum ermittelt
 * wurde, mit den Versionen im Zeitraum und den Warnungen dazu.
 */
export type HeatingConfigResolution = {
  /**
   * Konfiguration, mit der gerechnet wird. NULL, wenn sich keine bilden
   * lässt (Überlappung oder keine Version im Zeitraum); dann enthält
   * `warnings` den Grund.
   */
  settings: HeatingSettings | null;
  /**
   * Versionen, die an mindestens einem Tag des Zeitraums gelten, nach
   * Beginn aufsteigend
   */
  versions: HeatingSettings[];
  warnings: CalcWarning[];
};

const coversDay = (version: HeatingSettings, day: string): boolean =>
  version.validFrom <= day &&
  (version.validTo === null || version.validTo >= day);

const validityOf = (version: HeatingSettings, period: Period): Period | null =>
  intersect(
    { start: version.validFrom, end: version.validTo ?? period.end },
    period,
  );

/**
 * Festlegungen für die Abrechnung: gelten in einer Fassung je Abrechnung
 * (§ 6 Abs. 4 Satz 3 HeizkostenV; Gradtage oder Tage, damit Vor- und
 * Nachmieter zusammen 100 % ergeben). Nur im internen Modus belegt, sonst
 * stehen dort Füllwerte.
 */
const scalesDiffer = (left: HeatingSettings, right: HeatingSettings) =>
  left.baseSharePercent !== right.baseSharePercent ||
  left.consumptionSharePercent !== right.consumptionSharePercent ||
  left.mandatorySeventyPercent !== right.mandatorySeventyPercent ||
  left.baseMethod !== right.baseMethod ||
  left.prorationMethod !== right.prorationMethod;

const fuelDiffers = (left: HeatingSettings, right: HeatingSettings) =>
  left.fuelType !== right.fuelType ||
  left.gasBillingByCalorificValue !== right.gasBillingByCalorificValue ||
  left.heatPumpMonovalent !== right.heatPumpMonovalent;

/**
 * Warnungen zum Wechsel von `previous` auf `next` am Zustand der Anlage.
 * Verglichen werden nur Felder, die in der jeweiligen Abrechnungsart
 * Bedeutung haben. Wechsel, die noch nicht abschnittsweise gerechnet
 * werden, blockieren.
 */
const plantChangeWarnings = (
  previous: HeatingSettings,
  next: HeatingSettings,
  periodHasCentralHotWater: boolean,
): CalcWarning[] => {
  const params = { date: next.validFrom };

  if (previous.mode !== next.mode) {
    const bothCentral = previous.mode !== "none" && next.mode !== "none";
    return [
      {
        code: bothCentral
          ? "heatingConfigModeChangedInPeriod"
          : "heatingConfigPlantChangedInPeriod",
        params,
      },
    ];
  }
  if (next.mode !== "internal") {
    return [];
  }

  const warnings: CalcWarning[] = [];
  if (previous.consumptionMethod !== next.consumptionMethod) {
    warnings.push({
      code: "heatingConfigConsumptionMethodChangedInPeriod",
      params,
    });
  }
  const fuelChanged = fuelDiffers(previous, next);
  if (fuelChanged && periodHasCentralHotWater) {
    warnings.push({ code: "heatingConfigFuelChangedInPeriod", params });
  }
  // ponytail: Versorgung, Warmwasser und Energieträger werden noch nicht
  // abschnittsweise gerechnet; mit der Rechnung je Abschnitt fallen diese
  // Wechsel hier einzeln heraus
  const notYetSupported =
    previous.heatingType !== next.heatingType ||
    previous.hotWaterMeterId !== next.hotWaterMeterId ||
    previous.hotWaterSupplyTemperatureCelsius !==
      next.hotWaterSupplyTemperatureCelsius ||
    (fuelChanged && !periodHasCentralHotWater);
  if (notYetSupported) {
    warnings.push({ code: "heatingConfigPlantChangedInPeriod", params });
  }

  return warnings;
};

/**
 * Ermittelt aus den Versionen der Heizkostenkonfiguration die eine
 * Konfiguration, mit der ein Abrechnungszeitraum gerechnet wird.
 *
 * - Festlegungen (Prozentsatz, Grundkostenmaßstab, Aufteilung nach
 *   Gradtagen oder Tagen) kommen aus der maßgeblichen Version, der
 *   frühesten mit zentraler Versorgung. Weicht eine spätere ab, bleibt sie
 *   für diese Abrechnung unberücksichtigt.
 * - Der Zustand der Anlage kommt aus der Version am ersten Tag. Jeder
 *   Wechsel daran blockiert, bis er abschnittsweise gerechnet wird.
 *   Deshalb ist die Version am ersten Tag, wenn sie zentral versorgt,
 *   zugleich die maßgebliche, und `settings` ist diese Version.
 * - Lücken und Überlappungen blockieren. Bei einer Überlappung gibt es
 *   keine Vorrangregel und deshalb keine Konfiguration.
 *
 * Grundregel: Die App rechnet nie still falsch. Entweder gibt es eine
 * Konfiguration, mit der ohne Annahmen gerechnet werden kann, oder
 * mindestens eine Warnung, die das Finalisieren sperrt.
 * Die CO2-Angaben prüft `co2SettingsForPeriod`.
 */
export const resolveHeatingConfigForPeriod = (
  allVersions: readonly HeatingSettings[],
  period: Period,
): HeatingConfigResolution => {
  const versions = allVersions
    .filter((version) => validityOf(version, period) !== null)
    .sort((left, right) => left.validFrom.localeCompare(right.validFrom));

  const warnings: CalcWarning[] = uncoveredHeatingConfigPeriods(
    versions,
    period.start,
    period.end,
  ).map((gap) => ({
    code: "heatingConfigGapInPeriod",
    params: { fromDate: gap.start, toDate: gap.end },
  }));

  const overlapStarts = new Set<string>();
  versions.forEach((version, index) => {
    for (const later of versions.slice(index + 1)) {
      const shared = intersect(
        validityOf(version, period) as Period,
        validityOf(later, period) as Period,
      );
      if (shared) {
        overlapStarts.add(shared.start);
      }
    }
  });
  for (const date of [...overlapStarts].sort()) {
    warnings.push({ code: "heatingConfigOverlapInPeriod", params: { date } });
  }

  const [first] = versions;
  if (first === undefined || overlapStarts.size > 0) {
    return { settings: null, versions, warnings };
  }

  const governing =
    versions.find((version) => version.mode !== "none") ?? first;
  const startVersion =
    versions.find((version) => coversDay(version, period.start)) ?? first;
  const periodHasCentralHotWater = versions.some(
    (version) =>
      version.mode === "internal" &&
      version.heatingType === "central_with_hot_water",
  );

  versions.forEach((version, index) => {
    const previous = versions[index - 1];
    if (previous === undefined) {
      return;
    }
    warnings.push(
      ...plantChangeWarnings(previous, version, periodHasCentralHotWater),
    );
    if (
      version !== governing &&
      version.validFrom > governing.validFrom &&
      version.mode === "internal" &&
      governing.mode === "internal" &&
      scalesDiffer(governing, version)
    ) {
      warnings.push({
        code: "heatingConfigScalesNotApplied",
        params: { date: version.validFrom },
      });
    }
  });

  const settings: HeatingSettings = {
    ...startVersion,
    // Eine gedruckte Seite mit den Angaben nach § 6a schadet nie, eine
    // fehlende kann eine Pflichtangabe unterschlagen.
    includeBillingInfo:
      startVersion.includeBillingInfo ||
      versions.some(
        (version) => version.mode === "external" && version.includeBillingInfo,
      ),
  };

  return { settings, versions, warnings };
};

/**
 * Heizkostenposition, soweit sie für die CO2-Aufteilung zählt
 */
export type Co2CostItem = {
  periodStart: string;
  periodEnd: string;
  co2CostCents: number | null;
  co2AmountGrams: number | null;
};

/**
 * CO2-Angaben einer Abrechnung
 */
export type Co2PeriodSettings = {
  enabled: boolean;
  buildingRestricted: boolean;
  supplyRestricted: boolean;
  evidenceNote: string | null;
  /**
   * Gesetzt, wenn die Aufteilung für diese Abrechnung nicht bestimmt ist;
   * sie wird dann nicht gerechnet.
   */
  conflict: CalcWarning | null;
};

const co2Enabled = (version: HeatingSettings) =>
  version.mode === "internal" && version.co2CostShareEnabled;

/**
 * CO2-Aufteilung für einen Abrechnungszeitraum. Es zählt, was an den Tagen
 * der Heizkostenpositionen mit CO2-Angaben gilt (der Teil ihres Zeitraums
 * in der Periode), nicht ein ODER über die Versionen: Das CO2KostAufG
 * stuft das Gebäude nach dem Ausstoß des ganzen Zeitraums ein, eine
 * Aufteilung nur für einen Teil der Rechnungen hat keine Grundlage.
 *
 * - Aufteilung an diesen Tagen einheitlich ein oder aus: so gerechnet.
 * - Gemischt: Konflikt `co2ShareConflictInPeriod`.
 * - Bei eingeschalteter Aufteilung müssen die Angaben nach § 9 CO2KostAufG
 *   an diesen Tagen gleich sein, sonst `co2RestrictionConflictInPeriod`.
 *   Der Text kommt aus der Version, die am letzten dieser Tage gilt.
 * - Ohne Position mit CO2-Angaben ist die Aufteilung eingeschaltet, sobald
 *   eine Version des Zeitraums sie einschaltet.
 */
export const co2SettingsForPeriod = (
  versions: readonly HeatingSettings[],
  items: readonly Co2CostItem[],
  period: Period,
): Co2PeriodSettings => {
  const itemDays = items
    .filter(
      (item) => (item.co2CostCents ?? 0) > 0 || (item.co2AmountGrams ?? 0) > 0,
    )
    .map((item) =>
      intersect({ start: item.periodStart, end: item.periodEnd }, period),
    )
    .filter((days): days is Period => days !== null);

  const inPeriod = versions
    .filter((version) => validityOf(version, period) !== null)
    .sort((left, right) => left.validFrom.localeCompare(right.validFrom));
  const touched =
    itemDays.length === 0
      ? inPeriod.filter(co2Enabled)
      : inPeriod.filter((version) =>
          itemDays.some(
            (days) =>
              intersect(validityOf(version, period) as Period, days) !== null,
          ),
        );
  const lastDay = itemDays.reduce(
    (latest, days) => (days.end > latest ? days.end : latest),
    "",
  );
  const noteSource =
    touched.find((version) => coversDay(version, lastDay)) ?? touched.at(-1);
  const [first] = touched;
  const settings: Co2PeriodSettings = {
    enabled: first !== undefined && co2Enabled(first),
    buildingRestricted: first?.co2BuildingRestricted ?? false,
    supplyRestricted: first?.co2SupplyRestricted ?? false,
    evidenceNote: noteSource?.co2RestrictionEvidenceNote ?? null,
    conflict: null,
  };

  if (touched.some((version) => co2Enabled(version) !== settings.enabled)) {
    return { ...settings, conflict: { code: "co2ShareConflictInPeriod" } };
  }
  const restrictionConflict =
    settings.enabled &&
    touched.some(
      (version) =>
        version.co2BuildingRestricted !== settings.buildingRestricted ||
        version.co2SupplyRestricted !== settings.supplyRestricted,
    );

  return restrictionConflict
    ? { ...settings, conflict: { code: "co2RestrictionConflictInPeriod" } }
    : settings;
};
