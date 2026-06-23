import {
  co2TierLabel,
  degreeDaysMonthlyBreakdown,
  formatEur,
  formatNumber,
  HKVO_DEGREE_DAYS_PROMILLE_PER_MONTH,
  landlordShareRow,
  type Period,
  perMeterDisplayDigits,
  prepareHeatingDisplay,
  type StatementResult,
} from "@einfachvermieter/shared";
import { Description } from "../../../../components/common/Description";
import { Disclose } from "../../../../components/common/Disclose";
import { ResultRows } from "../../../../components/common/ResultRows";
import { SplitBar } from "../../../../components/common/SplitBar";
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
  // Gemeinsames Anzeige-View-Model (WYSIWYG-Pflicht Web <-> PDF).
  const {
    consumptionPct,
    basicPct,
    isHkv,
    distributionMethod,
    totalConsumption,
    totalArea,
    useValuationPoints,
    heatingPotForDisplay,
    isPartialPeriod,
    hotWaterConsumptionPct,
    hotWaterBasicPct,
    formatAggregatedConsumption,
  } = prepareHeatingDisplay(detail, tenantPeriod, statementPeriod);

  // CO2KostAufG-Aufteilung (nur bei aktiver Aufteilung mit erfassten CO2-
  // Werten gesetzt). Steuert die Abzugszeile im Breakdown und die separate
  // CO2-Tabelle daneben.
  const co2 = detail.co2Detail;
  const hw = detail.hotWaterDetail;

  // Vermieteranteil (Leerstand/Mieterwechsel) als eigene Tabellenzeile,
  // damit die Wohnungszeilen sichtbar auf "Haus gesamt" aufsummieren.
  const landlordRow = landlordShareRow(detail);
  const hwLandlordRow = hw ? landlordShareRow(hw) : null;

  // Einstufungs-Label (Stufe des Gebäude-Ausstoßes), analog zur PDF-Anlage.
  const co2TierText = co2
    ? (() => {
        const label = co2TierLabel(co2.emissionsKgPerSqmYear);
        return t(label.key, label.params);
      })()
    : "";

  const perMeter = detail.perMeter ?? [];
  const { consumptionRawDigits, kTotalDigits, consumptionWeightedDigits } =
    perMeterDisplayDigits(perMeter);

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
              <ResultRows
                rows={[
                  ...detail.costBreakdown.map((row) => ({
                    label: row.label,
                    value: formatEur(row.amountCents),
                  })),
                  ...(co2
                    ? [
                        {
                          label: t(
                            "statements.pdf.heating.breakdown.co2LandlordShare",
                          ),
                          value: formatEur(-co2.landlordDeductionCents),
                        },
                      ]
                    : []),
                  {
                    label: t("statements.pdf.heating.breakdown.total"),
                    value: formatEur(detail.totalHeatingCostsCents),
                    kind: "sum" as const,
                  },
                ]}
              />
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
                        {co2TierText}
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
            <Disclose label={t("ui.statements.detail.showMeters")}>
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
            </Disclose>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">
            {t("statements.pdf.heating.distributionPerUnit")}
          </h3>
          <div className="mb-4">
            <SplitBar
              aPercent={basicPct}
              aLabel={t("ui.heating.detail.splitBaseLegend", {
                percent: formatNumber(basicPct, 0),
              })}
              bLabel={t("ui.heating.detail.splitConsumptionLegend", {
                percent: formatNumber(consumptionPct, 0),
              })}
            />
          </div>
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
              {landlordRow ? (
                <tr className="border-b border-border">
                  <td className="py-1.5">
                    {t("statements.pdf.heating.landlordShare")}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {t("ui.common.emptyValue")}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {t("ui.common.emptyValue")}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatEur(landlordRow.consumptionCostCents)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatEur(landlordRow.basicCostCents)}
                  </td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">
                    {formatEur(landlordRow.totalCents)}
                  </td>
                </tr>
              ) : null}
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
                {hwLandlordRow ? (
                  <tr className="border-b border-border">
                    <td className="py-1.5">
                      {t("statements.pdf.heating.landlordShare")}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {t("ui.common.emptyValue")}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatEur(hwLandlordRow.consumptionCostCents)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatEur(hwLandlordRow.basicCostCents)}
                    </td>
                    <td className="py-1.5 text-right font-semibold tabular-nums">
                      {formatEur(hwLandlordRow.totalCents)}
                    </td>
                  </tr>
                ) : null}
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
