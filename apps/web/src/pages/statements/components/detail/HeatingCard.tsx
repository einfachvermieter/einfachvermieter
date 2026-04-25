import {
  co2Tier,
  degreeDaysMonthlyBreakdown,
  formatEur,
  formatNumber,
  HKVO_DEGREE_DAYS_PROMILLE_PER_MONTH,
  type Period,
  type StatementResult,
} from "@einfachvermieter/shared";
import { Description } from "../../../../components/common/Description";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/Card";
import { t } from "../../../../lib/i18n";

const MONTH_LABELS_DE = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

// Synchronisiert mit `VALUATION_POINTS_THRESHOLD` in
// packages/pdf/src/components/HeatingAppendix.tsx, solange Ganzzahlen
// ohne Nachkommastellen gerendert werden, bleibt selbst die roh-Anzeige
// gut lesbar; daher praktisch oft nie aktiv.
const VALUATION_POINTS_THRESHOLD = 10_000_000;

const allInteger = (values: number[]): boolean =>
  values.every((v) => Number.isInteger(v));

const consumptionUnitHeader = (
  method: NonNullable<StatementResult["heatingDetail"]>["consumptionMethod"],
  useValuationPoints: boolean,
): string => {
  if (method !== "heat_cost_allocator") {
    return t("statements.pdf.heating.consumptionKwh");
  }
  return useValuationPoints
    ? t("statements.pdf.heating.consumptionUnits")
    : t("statements.pdf.heating.consumptionUnitsRaw");
};

/**
 * CO2KostAufG-Einstufungs-Label (Stufe des Gebäude-Ausstoßes), analog zur
 * PDF-Anlage.
 */
const formatCo2TierLabel = (emissionsKgPerSqmYear: number): string => {
  const tier = co2Tier(emissionsKgPerSqmYear);
  if (!Number.isFinite(tier.maxExclusive)) {
    return t("statements.pdf.heating.co2.tierAbove", {
      min: formatNumber(tier.minInclusive, 0),
    });
  }

  if (tier.minInclusive === 0) {
    return t("statements.pdf.heating.co2.tierBelow", {
      max: formatNumber(tier.maxExclusive, 0),
    });
  }

  return t("statements.pdf.heating.co2.tierRange", {
    min: formatNumber(tier.minInclusive, 0),
    max: formatNumber(tier.maxExclusive, 0),
  });
};

/**
 * Spiegel der PDF-Anlage `HeatingAppendix` im Browser. Im Gegensatz zur
 * PDF-Variante (für den Mieter, mit § 12 HeizkostenV-Anonymisierung
 * fremder Wohnungen) zeigt diese Card alle Wohnungen und alle Zähler.
 * Die Übersicht ist nur für den Vermieter sichtbar.
 */
export const HeatingCard = ({
  detail,
  tenantPeriod,
  statementPeriod,
}: {
  detail: NonNullable<StatementResult["heatingDetail"]>;
  tenantPeriod: Period;
  statementPeriod: Period;
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Spiegel der PDF-Anlage.
}) => {
  const consumptionPct = detail.consumptionShareBps / 100;
  const basicPct = 100 - consumptionPct;

  // CO2KostAufG-Aufteilung (nur bei aktiver Aufteilung mit erfassten CO2-
  // Werten gesetzt). Steuert die Abzugszeile im Breakdown und die separate
  // CO2-Tabelle daneben.
  const co2 = detail.co2Detail;

  // Warmwasser-Abspaltung (§ 9 Abs. 2 HeizkostenV): reduziert die Heizungs-
  // Verteilung auf den Heiztopf und erhält eine eigene Sektion.
  const hw = detail.hotWaterDetail;
  const heatingPotForDisplay = hw
    ? (detail.heatingPotCents ??
      detail.totalHeatingCostsCents - hw.hotWaterPotCents)
    : detail.totalHeatingCostsCents;
  const hotWaterConsumptionPct = hw ? hw.consumptionShareBps / 100 : 0;
  const hotWaterBasicPct = 100 - hotWaterConsumptionPct;

  // Einstufungs-Label (Stufe des Gebäude-Ausstoßes), analog zur PDF-Anlage.
  const co2TierLabel = co2 ? formatCo2TierLabel(co2.emissionsKgPerSqmYear) : "";

  // Unterjährige Nutzung: Mietzeit deckt die Abrechnungsperiode nicht voll ab.
  const isPartialPeriod =
    tenantPeriod.start !== statementPeriod.start ||
    tenantPeriod.end !== statementPeriod.end;
  const isHkv = detail.consumptionMethod === "heat_cost_allocator";
  const distributionMethod =
    detail.consumptionDistributionMethod ?? "consumption";
  const totalConsumption = detail.perUnit.reduce(
    (acc, row) => acc + row.consumptionKwh,
    0,
  );
  const totalArea = detail.perUnit.reduce((acc, row) => acc + row.areaSqm, 0);
  const useValuationPoints =
    isHkv && totalConsumption >= VALUATION_POINTS_THRESHOLD;
  const perMeter = detail.perMeter ?? [];
  const perMeterKTotalValues = perMeter
    .map((row) => row.kTotal)
    .filter((v): v is number => v !== null && v !== undefined);
  const consumptionRawDigits = allInteger(
    perMeter.map((row) => row.consumptionRaw),
  )
    ? 0
    : 2;
  const kTotalDigits = allInteger(perMeterKTotalValues) ? 0 : 3;
  const consumptionWeightedDigits = allInteger(
    perMeter.map((row) => row.consumptionWeighted),
  )
    ? 0
    : 2;
  const aggregatedAllInteger = allInteger(
    detail.perUnit.map((u) => u.consumptionKwh),
  );
  let aggregatedConsumptionDigits = 2;
  if (useValuationPoints) {
    aggregatedConsumptionDigits = 3;
  } else if (aggregatedAllInteger) {
    aggregatedConsumptionDigits = 0;
  }

  // Bewertungspunkte-Skalierung: bei HKVs (Anzeigewert x KGesamt) / 1.000,
  // bei Wärmemengenzählern unverändert kWh. Reine Anzeige-Skalierung.
  const formatAggregatedConsumption = (value: number): string => {
    if (!isHkv) {
      return formatNumber(value, aggregatedConsumptionDigits);
    }
    return useValuationPoints
      ? formatNumber(value / 1000, 3)
      : formatNumber(value, aggregatedConsumptionDigits);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("ui.statements.detail.heatingTabTitle")}</CardTitle>
        <Description>
          {t("ui.statements.detail.heatingTabDescription")}
        </Description>
      </CardHeader>
      <CardContent className="space-y-6">
        {detail.costBreakdown && detail.costBreakdown.length > 0 ? (
          <div className={co2 ? "grid gap-6 md:grid-cols-2" : undefined}>
            <section>
              <h3 className="mb-2 text-sm font-semibold">
                {t("statements.pdf.heating.breakdown.title")}
              </h3>
              {detail.fuelType ? (
                <p className="mb-2 text-sm text-muted-foreground">
                  {t("statements.pdf.heating.breakdown.fuelTypeNote", {
                    fuel: t(`ui.heating.fuelTypes.${detail.fuelType}`),
                  })}
                </p>
              ) : null}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                    <th className="py-1.5">
                      {t("statements.pdf.heating.breakdown.position")}
                    </th>
                    <th className="py-1.5 text-right">
                      {t("statements.pdf.heating.breakdown.amount")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detail.costBreakdown.map((row) => (
                    <tr key={row.label} className="border-b border-border">
                      <td className="py-1.5">{row.label}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatEur(row.amountCents)}
                      </td>
                    </tr>
                  ))}
                  {co2 ? (
                    <tr className="border-b border-border">
                      <td className="py-1.5">
                        {t("statements.pdf.heating.breakdown.co2LandlordShare")}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatEur(-co2.landlordDeductionCents)}
                      </td>
                    </tr>
                  ) : null}
                  <tr className="border-t-2 border-foreground">
                    <td className="py-1.5 font-semibold">
                      {t("statements.pdf.heating.breakdown.total")}
                    </td>
                    <td className="py-1.5 text-right font-semibold tabular-nums">
                      {formatEur(detail.totalHeatingCostsCents)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
            {co2 ? (
              <section>
                <h3 className="mb-2 text-sm font-semibold">
                  {t("statements.pdf.heating.co2.title")}
                </h3>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-border">
                      <th
                        scope="row"
                        className="py-1.5 text-left font-medium text-muted-foreground"
                      >
                        {t("statements.pdf.heating.co2.totalCost")}
                      </th>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatEur(co2.totalCostCents)}
                      </td>
                    </tr>
                    <tr className="border-b border-border">
                      <th
                        scope="row"
                        className="py-1.5 text-left font-medium text-muted-foreground"
                      >
                        {t("statements.pdf.heating.co2.emissions")}
                      </th>
                      <td className="py-1.5 text-right tabular-nums">
                        {`${formatNumber(co2.emissionsKgPerSqmYear, 1)} kg/m²a`}
                      </td>
                    </tr>
                    <tr className="border-b border-border">
                      <th
                        scope="row"
                        className="py-1.5 text-left font-medium text-muted-foreground"
                      >
                        {t("statements.pdf.heating.co2.tier")}
                      </th>
                      <td className="py-1.5 text-right tabular-nums">
                        {co2TierLabel}
                      </td>
                    </tr>
                    <tr className="border-b border-border">
                      <th
                        scope="row"
                        className="py-1.5 text-left font-medium text-muted-foreground"
                      >
                        {t("statements.pdf.heating.co2.sharePair")}
                      </th>
                      <td className="py-1.5 text-right tabular-nums">
                        {`${formatNumber(100 - co2.landlordSharePercent, 0)} % / ${formatNumber(co2.landlordSharePercent, 0)} %`}
                      </td>
                    </tr>
                    <tr className="border-b border-border">
                      <th
                        scope="row"
                        className="py-1.5 text-left font-medium text-muted-foreground"
                      >
                        {t("statements.pdf.heating.co2.landlordDeduction")}
                      </th>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatEur(co2.landlordDeductionCents)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>
            ) : null}
          </div>
        ) : null}

        <section>
          <h3 className="mb-2 text-sm font-semibold">
            {isHkv
              ? t("statements.pdf.heating.perMeterHeadingHkv")
              : t("statements.pdf.heating.perMeterHeading")}
          </h3>
          {perMeter.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("statements.pdf.heating.perMeterEmpty")}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                  <th className="py-1.5">
                    {t("statements.pdf.heating.perMeterMeter")}
                  </th>
                  <th className="py-1.5">
                    {t("ui.statements.detail.occupancyMeterUnitColumn")}
                  </th>
                  <th className="py-1.5">
                    {t("statements.pdf.heating.perMeterSerial")}
                  </th>
                  <th className="py-1.5 text-right">
                    {t("statements.pdf.heating.perMeterDelta")}
                  </th>
                  {isHkv ? (
                    <th className="py-1.5 text-right">
                      {t("statements.pdf.heating.perMeterKTotal")}
                    </th>
                  ) : null}
                  <th className="whitespace-pre-line py-1.5 text-right">
                    {t("statements.pdf.heating.perMeterWeighted")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {perMeter.map((row) => (
                  <tr key={row.meterId} className="border-b border-border">
                    <td className="py-1.5">
                      {isHkv
                        ? row.meterLabel
                            .replace(/^Heizkostenverteiler\s*/u, "")
                            .trim() || row.meterLabel
                        : row.meterLabel}
                    </td>
                    <td className="py-1.5 text-muted-foreground">
                      {row.unitName ?? t("ui.common.emptyValue")}
                    </td>
                    <td className="py-1.5 text-muted-foreground">
                      {row.serialNumber ?? t("ui.common.emptyValue")}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatNumber(row.consumptionRaw, consumptionRawDigits)}
                      {isHkv ? (
                        <span className="ml-1 text-muted-foreground">
                          {t("statements.pdf.costTable.operatorMultiply")}
                        </span>
                      ) : null}
                    </td>
                    {isHkv ? (
                      <td className="py-1.5 text-right tabular-nums">
                        {row.kTotal === null || row.kTotal === undefined
                          ? t("ui.common.emptyValue")
                          : formatNumber(row.kTotal, kTotalDigits)}
                        <span className="ml-1 text-muted-foreground">
                          {t("statements.pdf.costTable.operatorEquals")}
                        </span>
                      </td>
                    ) : null}
                    <td className="py-1.5 text-right tabular-nums">
                      {formatNumber(
                        row.consumptionWeighted,
                        consumptionWeightedDigits,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">
            {t("statements.pdf.heating.distributionPerUnit")}
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                <th className="py-1.5">{t("statements.pdf.heating.unit")}</th>
                <th className="py-1.5 text-right">
                  {t("statements.pdf.heating.heatingArea")}
                </th>
                <th className="whitespace-pre-line py-1.5 text-right">
                  {consumptionUnitHeader(
                    detail.consumptionMethod,
                    useValuationPoints,
                  )}
                </th>
                <th className="whitespace-pre-line py-1.5 text-right">
                  {t("statements.pdf.heating.consumptionShareHeader", {
                    percent: formatNumber(consumptionPct, 0),
                  })}
                </th>
                <th className="whitespace-pre-line py-1.5 text-right">
                  {t("statements.pdf.heating.basicShareHeader", {
                    percent: formatNumber(basicPct, 0),
                  })}
                </th>
                <th className="py-1.5 text-right">
                  {t("statements.pdf.heating.total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {detail.perUnit.map((unit) => (
                <tr key={unit.unitId} className="border-b border-border">
                  <td className="py-1.5">{unit.unitName}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {`${formatNumber(unit.areaSqm, 2)} m²`}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatAggregatedConsumption(unit.consumptionKwh)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatEur(unit.consumptionCostCents)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatEur(unit.basicCostCents)}
                  </td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">
                    {formatEur(unit.totalCents)}
                  </td>
                </tr>
              ))}
              {/* "Haus gesamt": Summenzeile (vormals die separate
                  Übersichtstabelle). EUR-Werte aus den maßgeblichen
                  Gesamtsummen, nicht aus den gerundeten Zeilenwerten. */}
              <tr className="border-t-2 border-foreground font-semibold">
                <td className="py-1.5">
                  {t("statements.pdf.heating.totalHouse")}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {`${formatNumber(totalArea, 2)} m²`}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatAggregatedConsumption(totalConsumption)}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatEur(detail.consumptionPortionCents)}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatEur(detail.basicPortionCents)}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatEur(heatingPotForDisplay)}
                </td>
              </tr>
            </tbody>
          </table>
          {distributionMethod === "heating_area" ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("statements.pdf.heating.consumptionDistributionHeatingArea")}
            </p>
          ) : null}
          {useValuationPoints ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("statements.pdf.heating.valuationPointsNote")}
            </p>
          ) : null}
          {detail.heatingAreaDiffersFromLivingArea ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("statements.pdf.heating.heatingAreaNote")}
            </p>
          ) : null}
          {/* Hinweis zur zeitanteiligen Verteilung, nur bei unterjähriger
              Nutzung und nur bei interner Berechnung (im external-Modus ist
              `prorationMethod` undefiniert). Bei voller Nutzung findet keine
              Abgrenzung statt, der Hinweis entfällt. */}
          {detail.prorationMethod !== undefined && isPartialPeriod ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {prorationNote(detail, tenantPeriod)}
            </p>
          ) : null}
        </section>

        {hw ? (
          <section>
            <h3 className="mb-2 text-sm font-semibold">
              {t("statements.pdf.heating.hotWater.title")}
            </h3>
            <p className="mb-2 text-sm text-muted-foreground">
              {t(`statements.pdf.heating.hotWater.method.${hw.method}`, {
                heat: formatNumber(hw.hotWaterHeatKwh, 0),
                total: formatNumber(hw.totalHeatEnergyKwh, 0),
                share: formatNumber(hw.hotWaterShareBps / 100, 1),
                pot: formatEur(hw.hotWaterPotCents),
              })}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                  <th className="py-1.5">{t("statements.pdf.heating.unit")}</th>
                  <th className="py-1.5 text-right">
                    {t("statements.pdf.heating.hotWater.consumptionM3")}
                  </th>
                  <th className="whitespace-pre-line py-1.5 text-right">
                    {t("statements.pdf.heating.consumptionShareHeader", {
                      percent: formatNumber(hotWaterConsumptionPct, 0),
                    })}
                  </th>
                  <th className="whitespace-pre-line py-1.5 text-right">
                    {t("statements.pdf.heating.basicShareHeader", {
                      percent: formatNumber(hotWaterBasicPct, 0),
                    })}
                  </th>
                  <th className="py-1.5 text-right">
                    {t("statements.pdf.heating.total")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {hw.perUnit.map((unit) => (
                  <tr key={unit.unitId} className="border-b border-border">
                    <td className="py-1.5">{unit.unitName}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {`${formatNumber(unit.hotWaterM3, 2)} m³`}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatEur(unit.consumptionCostCents)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatEur(unit.basicCostCents)}
                    </td>
                    <td className="py-1.5 text-right font-semibold tabular-nums">
                      {formatEur(unit.totalCents)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-foreground font-semibold">
                  <td className="py-1.5">
                    {t("statements.pdf.heating.totalHouse")}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {`${formatNumber(
                      hw.perUnit.reduce((acc, u) => acc + u.hotWaterM3, 0),
                      2,
                    )} m³`}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatEur(hw.consumptionPortionCents)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatEur(hw.basicPortionCents)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatEur(hw.hotWaterPotCents)}
                  </td>
                </tr>
              </tbody>
            </table>
            {hw.consumptionDistributionMethod === "heating_area" ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("statements.pdf.heating.hotWater.consumptionFallbackArea")}
              </p>
            ) : null}
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
};

/**
 * Liste der bewohnten Monate mit ihrem festen HKVO-Monatsanteil (Anlage zu
 * § 9 Abs. 3 HeizkostenV), z. B. "Jan 170 ‰, Feb 150 ‰". Nur Monate, in die
 * die Mietzeit (teilweise) fällt. Dient als {months}-Platzhalter im
 * Gradtagszahlen-Hinweis.
 */
const residentMonthsPromille = (period: Period): string =>
  degreeDaysMonthlyBreakdown(period)
    .filter((row) => row.calendarDays > 0)
    .map(
      (row) =>
        `${MONTH_LABELS_DE[row.monthIndex]} ${formatNumber(
          HKVO_DEGREE_DAYS_PROMILLE_PER_MONTH[row.monthIndex] ?? 0,
          0,
        )} ‰`,
    )
    .join(", ");

/**
 * Hinweis zur zeitanteiligen Verteilung bei unterjähriger Nutzung. Spiegelt
 * `prorationNote` aus packages/pdf/src/components/HeatingAppendix.tsx: wählt
 * nach Zwischenablesung (nur Grundkosten vs. gesamte Heizkosten) und
 * Aufteilungsmethode (Gradtagszahlen vs. Nutzungstage).
 */
const prorationNote = (
  detail: NonNullable<StatementResult["heatingDetail"]>,
  tenantPeriod: Period,
): string => {
  const distributesAll =
    (detail.consumptionDistributionMethod ?? "consumption") === "heating_area";

  if (detail.prorationMethod === "degree_days") {
    const months = residentMonthsPromille(tenantPeriod);
    return distributesAll
      ? t("statements.pdf.heating.prorationNoteDegreeDaysAll", { months })
      : t("statements.pdf.heating.prorationNoteDegreeDaysBase", { months });
  }

  return distributesAll
    ? t("statements.pdf.heating.prorationNoteLinearAll")
    : t("statements.pdf.heating.prorationNoteLinearBase");
};
