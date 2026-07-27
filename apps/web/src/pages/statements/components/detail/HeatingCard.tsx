import {
  co2TenantShareCents,
  co2TierLabel,
  degreeDaysMonthlyBreakdown,
  formatEur,
  formatNumber,
  HKVO_DEGREE_DAYS_PROMILLE_PER_MONTH,
  heatingColumnFootnotes,
  hotWaterColumnFootnotes,
  hotWaterFactRows,
  landlordShareRow,
  type Period,
  perMeterDisplayDigits,
  prepareHeatingDisplay,
  type StatementResult,
} from "@einfachvermieter/shared";
import { RiDropLine, RiFireLine, RiPieChart2Line } from "@remixicon/react";
import { Disclose } from "../../../../components/common/Disclose";
import { ResultRows } from "../../../../components/common/ResultRows";
import { SectionCard } from "../../../../components/common/SectionCard";
import { SplitBar } from "../../../../components/common/SplitBar";
import {
  QUIET_TABLE_GROUP_HEAD,
  QUIET_TABLE_HEAD_ROW,
} from "../../../../components/common/tableStyles";
import { gradients } from "../../../../lib/domainVisuals";
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
 * Wert-Zellen der Verteilungstabellen. Im Flächen-Fallback  (keine Zähler) eine
 * zusammengefasste "100 % nach Fläche"-Zelle (= Gesamtbetrag), sonst die
 * getrennten Spalten Verbrauch / Fläche / Summe.
 */
const distributionValueCells = (
  consumptionCents: number,
  basicCents: number,
  totalCents: number,
  merged: boolean,
  emphasizeTotal: boolean,
) => {
  const totalClass = emphasizeTotal
    ? "py-2.5 text-right font-semibold tabular-nums"
    : "py-2.5 text-right tabular-nums";
  if (merged) {
    return <td className={totalClass}>{formatEur(totalCents)}</td>;
  }
  return (
    <>
      <td className="py-2.5 text-right tabular-nums">
        {formatEur(consumptionCents)}
      </td>
      <td className="py-2.5 text-right tabular-nums">
        {formatEur(basicCents)}
      </td>
      <td className={totalClass}>{formatEur(totalCents)}</td>
    </>
  );
};

/**
 * Hochgestellte Fußnoten-Marker am Referenzort (Spaltenkopf)
 */
const columnMarkers = (indices: number[]) =>
  indices.length > 0 ? <sup>{indices.join(", ")}</sup> : null;

/**
 * Spiegel der PDF-Anlage `HeatingAppendix` im Browser. Im Gegensatz zur
 * PDF-Variante (für den Mieter, mit § 12 HeizkostenV-Anonymisierung
 * fremder Wohnungen) zeigt diese Card alle Wohnungen und alle Zähler.
 * Die Übersicht ist nur für den Vermieter sichtbar.
 */
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Spiegel der PDF-Anlage, drei Karten.
export const HeatingCard = ({
  detail,
  tenantPeriod,
  statementPeriod,
  targetUnitId,
}: {
  detail: NonNullable<StatementResult["heatingDetail"]>;
  tenantPeriod: Period;
  statementPeriod: Period;
  /**
   * Wohnung dieser Abrechnung, wird in den Tabellen hervorgehoben.
   */
  targetUnitId: string;
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
    hotWaterSharePct,
    heatingSharePct,
    formatAggregatedConsumption,
  } = prepareHeatingDisplay(detail, tenantPeriod, statementPeriod);

  // CO2KostAufG-Aufteilung (nur bei aktiver Aufteilung mit erfassten CO2-
  // Werten gesetzt). Steuert die Abzugszeile im Breakdown und die separate
  // CO2-Tabelle darunter.
  const co2 = detail.co2Detail;
  const hw = detail.hotWaterDetail;

  // Summenzeile Heizung + Warmwasser der abgerechneten Wohnung
  const ownHeatingUnit = detail.perUnit.find((u) => u.unitId === targetUnitId);
  const ownHotWaterUnit = hw?.perUnit.find((u) => u.unitId === targetUnitId);
  // Auf den Mieter entfallender CO2-Kostenanteil (§ 7 Abs. 3 CO2KostAufG)
  const tenantCo2Cents = co2TenantShareCents(
    detail,
    (ownHeatingUnit?.totalCents ?? 0) + (ownHotWaterUnit?.totalCents ?? 0),
  );
  const heatingIntro =
    hw && ownHeatingUnit && ownHotWaterUnit
      ? t("statements.pdf.heating.heatingIntroOverview", {
          total: formatEur(
            ownHeatingUnit.totalCents + ownHotWaterUnit.totalCents,
          ),
          heating: formatEur(ownHeatingUnit.totalCents),
          hotWater: formatEur(ownHotWaterUnit.totalCents),
        })
      : null;

  // Vermieteranteil (Leerstand/Mieterwechsel) als eigene Tabellenzeile,
  // damit die Wohnungszeilen sichtbar auf "Haus gesamt" aufsummieren.
  const landlordRow = landlordShareRow(detail);
  const hwLandlordRow = hw ? landlordShareRow(hw) : null;

  // Ohne Warmwasserzähler (Verteilung nach Fläche) sind alle m3-Werte 0,00,
  // die Spalte entfällt, die Fußnote erklärt es.
  const showHotWaterM3 = hw
    ? hw.consumptionDistributionMethod !== "heating_area"
    : false;

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
  const hasDerivedMeter = perMeter.some(
    (row) => row.consumptionIsDerived === true,
  );

  const hasBreakdown = detail.costBreakdown && detail.costBreakdown.length > 0;

  // Nummerierte Spalten-Fußnoten (Heizfläche -> Bewertungspunkte -> Summe),
  // gemeinsame Quelle mit der PDF-Anlage. Marker am jeweiligen Spaltenkopf.
  const columnFootnotes = heatingColumnFootnotes(
    detail,
    useValuationPoints,
    heatingSharePct,
  );
  const wwFootnotes = hw ? hotWaterColumnFootnotes(hw, hotWaterSharePct) : [];
  const heatingIndices = (column: (typeof columnFootnotes)[number]["column"]) =>
    columnFootnotes
      .filter((note) => note.column === column)
      .map((n) => n.index);
  const wwIndices = () => wwFootnotes.map((note) => note.index);

  // Flächen-Fallback: Verbrauchs- und Grundkostenspalte zu einer
  // "100 % nach Fläche"-Spalte zusammenfassen (mangels Verbrauchsmessern).
  const heatingMerged = distributionMethod === "heating_area";
  const wwMerged = hw?.consumptionDistributionMethod === "heating_area";

  return (
    <>
      {heatingIntro ? (
        <p className="mb-5 rounded-xl border border-border bg-card px-6.5 py-4 text-sm text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          {heatingIntro}
        </p>
      ) : null}
      {hasBreakdown ? (
        <SectionCard
          icon={RiFireLine}
          iconBackground={gradients.heating}
          title={t("statements.pdf.heating.breakdown.title")}
        >
          <ResultRows
            rows={[
              ...(detail.costBreakdown ?? []).map((row) => ({
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
          {co2 || detail.fuelType ? (
            <div className="mt-6">
              <h3 className={`mb-2.5 ${QUIET_TABLE_GROUP_HEAD}`}>
                {co2
                  ? t("statements.pdf.heating.co2.title")
                  : t("statements.pdf.heating.energySource")}
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  {detail.fuelType ? (
                    <tr className={co2 ? "border-b border-border" : undefined}>
                      <th
                        scope="row"
                        className="py-2.5 text-left font-medium text-muted-foreground"
                      >
                        {t("statements.pdf.heating.energySource")}
                      </th>
                      <td className="py-2.5 text-right">
                        {t(`ui.heating.fuelTypes.${detail.fuelType}`)}
                      </td>
                    </tr>
                  ) : null}
                  {co2 ? (
                    <>
                      <tr className="border-b border-border">
                        <th
                          scope="row"
                          className="py-2.5 text-left font-medium text-muted-foreground"
                        >
                          {t("statements.pdf.heating.co2.totalCost")}
                        </th>
                        <td className="py-2.5 text-right tabular-nums">
                          {formatEur(co2.totalCostCents)}
                        </td>
                      </tr>
                      <tr className="border-b border-border">
                        <th
                          scope="row"
                          className="py-2.5 text-left font-medium text-muted-foreground"
                        >
                          {t("statements.pdf.heating.co2.emissions")}
                        </th>
                        <td className="py-2.5 text-right tabular-nums">
                          {`${formatNumber(co2.emissionsKgPerSqmYear, 1)} kg/m²a`}
                        </td>
                      </tr>
                      <tr className="border-b border-border">
                        <th
                          scope="row"
                          className="py-2.5 text-left font-medium text-muted-foreground"
                        >
                          {t("statements.pdf.heating.co2.amount")}
                        </th>
                        <td className="py-2.5 text-right tabular-nums">
                          {t("statements.pdf.heating.co2.amountValue", {
                            value: formatNumber(co2.totalAmountGrams / 1000, 0),
                          })}
                        </td>
                      </tr>
                      {co2.livingAreaSqm === undefined ? null : (
                        <tr className="border-b border-border">
                          <th
                            scope="row"
                            className="py-2.5 text-left font-medium text-muted-foreground"
                          >
                            {t("statements.pdf.heating.co2.areaBasis")}
                          </th>
                          <td className="py-2.5 text-right tabular-nums">
                            {t("statements.pdf.heating.co2.areaBasisValue", {
                              value: formatNumber(co2.livingAreaSqm, 0),
                            })}
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-border">
                        <th
                          scope="row"
                          className="py-2.5 text-left font-medium text-muted-foreground"
                        >
                          {t("statements.pdf.heating.co2.tier")}
                        </th>
                        <td className="py-2.5 text-right tabular-nums">
                          {co2TierText}
                        </td>
                      </tr>
                      <tr className="border-b border-border">
                        <th
                          scope="row"
                          className="py-2.5 text-left font-medium text-muted-foreground"
                        >
                          {t("statements.pdf.heating.co2.sharePair")}
                        </th>
                        <td className="py-2.5 text-right tabular-nums">
                          {`${formatNumber(100 - co2.landlordSharePercent, 0)} % / ${formatNumber(co2.landlordSharePercent, 0)} %`}
                        </td>
                      </tr>
                      <tr className="border-b border-border">
                        <th
                          scope="row"
                          className="py-2.5 text-left font-medium text-muted-foreground"
                        >
                          {t("statements.pdf.heating.co2.landlordDeduction")}
                        </th>
                        <td className="py-2.5 text-right tabular-nums">
                          {formatEur(co2.landlordDeductionCents)}
                        </td>
                      </tr>
                      {tenantCo2Cents === null ? null : (
                        <tr className="border-b border-border">
                          <th
                            scope="row"
                            className="py-2.5 text-left font-medium text-muted-foreground"
                          >
                            {t("statements.pdf.heating.co2.tenantShare")}
                          </th>
                          <td className="py-2.5 text-right tabular-nums">
                            {formatEur(tenantCo2Cents)}
                          </td>
                        </tr>
                      )}
                    </>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      <SectionCard
        icon={RiPieChart2Line}
        iconBackground={gradients.heating}
        title={t("statements.pdf.heating.distributionPerUnit")}
      >
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={QUIET_TABLE_HEAD_ROW}>
                <th className="py-2.5">{t("statements.pdf.heating.unit")}</th>
                <th className="py-2.5 text-right">
                  {t("statements.pdf.heating.heatingArea")}
                  {columnMarkers(heatingIndices("heatingArea"))}
                </th>
                <th className="whitespace-pre-line py-1.5 text-right">
                  {consumptionUnitHeader(
                    detail.consumptionMethod,
                    useValuationPoints,
                  )}
                  {columnMarkers(heatingIndices("consumption"))}
                </th>
                {heatingMerged ? (
                  <th className="whitespace-pre-line py-1.5 text-right">
                    {t("statements.pdf.heating.mergedAreaHeader")}
                    {columnMarkers(heatingIndices("total"))}
                  </th>
                ) : (
                  <>
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
                    <th className="py-2.5 text-right">
                      {t("statements.pdf.heating.total")}
                      {columnMarkers(heatingIndices("total"))}
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {detail.perUnit.map((unit) => {
                const isTarget = unit.unitId === targetUnitId;
                return (
                  <tr key={unit.unitId} className="border-b border-border">
                    <td
                      className={
                        isTarget
                          ? "py-2.5 font-semibold text-foreground"
                          : "py-2.5 text-foreground"
                      }
                    >
                      {unit.unitName}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {`${formatNumber(unit.areaSqm, 2)} m²`}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {formatAggregatedConsumption(unit.consumptionKwh)}
                    </td>
                    {distributionValueCells(
                      unit.consumptionCostCents,
                      unit.basicCostCents,
                      unit.totalCents,
                      heatingMerged,
                      isTarget,
                    )}
                  </tr>
                );
              })}
              {landlordRow ? (
                <tr className="border-b border-border">
                  <td className="py-2.5">
                    {t("statements.pdf.heating.landlordShare")}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {t("ui.common.emptyValue")}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {t("ui.common.emptyValue")}
                  </td>
                  {distributionValueCells(
                    landlordRow.consumptionCostCents,
                    landlordRow.basicCostCents,
                    landlordRow.totalCents,
                    heatingMerged,
                    true,
                  )}
                </tr>
              ) : null}
              {/* "Haus gesamt": Summenzeile (vormals die separate
                  Übersichtstabelle). EUR-Werte aus den maßgeblichen
                  Gesamtsummen, nicht aus den gerundeten Zeilenwerten. */}
              <tr className="border-t-2 border-foreground font-semibold">
                <td className="py-2.5">
                  {t("statements.pdf.heating.totalHouse")}
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  {`${formatNumber(totalArea, 2)} m²`}
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  {formatAggregatedConsumption(totalConsumption)}
                </td>
                {distributionValueCells(
                  detail.consumptionPortionCents,
                  detail.basicPortionCents,
                  heatingPotForDisplay,
                  heatingMerged,
                  false,
                )}
              </tr>
            </tbody>
          </table>
        </div>
        {columnFootnotes.map((footnote) => (
          <p key={footnote.key} className="mt-2 text-xs text-muted-foreground">
            <sup>{footnote.index}</sup>{" "}
            {t(footnote.label.key, footnote.label.params)}
          </p>
        ))}
        {/* Hinweis zur zeitanteiligen Verteilung, nur bei unterjähriger
            Nutzung und nur bei interner Berechnung (im external-Modus ist
            `prorationMethod` undefiniert). Bei voller Nutzung findet keine
            Abgrenzung statt, der Hinweis entfällt. */}
        {detail.prorationMethod !== undefined && isPartialPeriod ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {prorationNote(detail, tenantPeriod)}
          </p>
        ) : null}

        {perMeter.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("statements.pdf.heating.perMeterEmpty")}
          </p>
        ) : (
          <div className="mt-4">
            <Disclose label={t("ui.statements.detail.showMeters")}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={QUIET_TABLE_HEAD_ROW}>
                      <th className="py-2.5">
                        {t("statements.pdf.heating.perMeterMeter")}
                      </th>
                      <th className="py-2.5">
                        {t("ui.statements.detail.occupancyMeterUnitColumn")}
                      </th>
                      <th className="py-2.5">
                        {t("statements.pdf.heating.perMeterSerial")}
                      </th>
                      <th className="py-2.5 text-right">
                        {t("statements.pdf.heating.perMeterDelta")}
                      </th>
                      {isHkv ? (
                        <th className="py-2.5 text-right">
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
                        <td className="py-2.5 font-semibold text-foreground">
                          {isHkv
                            ? row.meterLabel
                                .replace(/^Heizkostenverteiler\s*/u, "")
                                .trim() || row.meterLabel
                            : row.meterLabel}
                        </td>
                        <td className="py-2.5 text-muted-foreground">
                          {row.unitName ?? t("ui.common.emptyValue")}
                        </td>
                        <td className="py-2.5 text-muted-foreground">
                          {row.serialNumber ?? t("ui.common.emptyValue")}
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          {formatNumber(
                            row.consumptionRaw,
                            consumptionRawDigits,
                          )}
                          {row.consumptionIsDerived === true
                            ? columnMarkers([1])
                            : null}
                          {isHkv ? (
                            <span className="ml-1 text-muted-foreground">
                              {t("statements.pdf.costTable.operatorMultiply")}
                            </span>
                          ) : null}
                        </td>
                        {isHkv ? (
                          <td className="py-2.5 text-right tabular-nums">
                            {row.kTotal === null || row.kTotal === undefined
                              ? t("ui.common.emptyValue")
                              : formatNumber(row.kTotal, kTotalDigits)}
                            <span className="ml-1 text-muted-foreground">
                              {t("statements.pdf.costTable.operatorEquals")}
                            </span>
                          </td>
                        ) : null}
                        <td className="py-2.5 text-right tabular-nums">
                          {formatNumber(
                            row.consumptionWeighted,
                            consumptionWeightedDigits,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hasDerivedMeter ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {columnMarkers([1])}{" "}
                  {t("statements.pdf.heating.perMeterDerivedNote")}
                </p>
              ) : null}
            </Disclose>
          </div>
        )}
      </SectionCard>

      {hw ? (
        <SectionCard
          icon={RiDropLine}
          iconBackground={gradients.water}
          title={t("statements.pdf.heating.hotWater.title")}
        >
          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {hotWaterFactRows(hw).map((factRow) => (
                  <tr key={factRow.key} className="border-b border-border">
                    <th
                      scope="row"
                      className="py-2.5 text-left font-medium text-muted-foreground"
                    >
                      {t(factRow.label.key, factRow.label.params)}
                    </th>
                    <td className="py-2.5 text-right tabular-nums">
                      {t(factRow.value.key, factRow.value.params)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={QUIET_TABLE_HEAD_ROW}>
                  <th className="py-2.5">{t("statements.pdf.heating.unit")}</th>
                  {showHotWaterM3 ? (
                    <th className="py-2.5 text-right">
                      {t("statements.pdf.heating.hotWater.consumptionM3")}
                    </th>
                  ) : null}
                  {wwMerged ? (
                    <th className="whitespace-pre-line py-1.5 text-right">
                      {t("statements.pdf.heating.mergedAreaHeader")}
                      {columnMarkers(wwIndices())}
                    </th>
                  ) : (
                    <>
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
                      <th className="py-2.5 text-right">
                        {t("statements.pdf.heating.total")}
                        {columnMarkers(wwIndices())}
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {hw.perUnit.map((unit) => {
                  const isTarget = unit.unitId === targetUnitId;
                  return (
                    <tr key={unit.unitId} className="border-b border-border">
                      <td
                        className={
                          isTarget
                            ? "py-2.5 font-semibold text-foreground"
                            : "py-2.5 text-foreground"
                        }
                      >
                        {unit.unitName}
                      </td>
                      {showHotWaterM3 ? (
                        <td className="py-2.5 text-right tabular-nums">
                          {`${formatNumber(unit.hotWaterM3, 2)} m³`}
                        </td>
                      ) : null}
                      {distributionValueCells(
                        unit.consumptionCostCents,
                        unit.basicCostCents,
                        unit.totalCents,
                        wwMerged,
                        isTarget,
                      )}
                    </tr>
                  );
                })}
                {hwLandlordRow ? (
                  <tr className="border-b border-border">
                    <td className="py-2.5">
                      {t("statements.pdf.heating.landlordShare")}
                    </td>
                    {showHotWaterM3 ? (
                      <td className="py-2.5 text-right tabular-nums">
                        {t("ui.common.emptyValue")}
                      </td>
                    ) : null}
                    {distributionValueCells(
                      hwLandlordRow.consumptionCostCents,
                      hwLandlordRow.basicCostCents,
                      hwLandlordRow.totalCents,
                      wwMerged,
                      true,
                    )}
                  </tr>
                ) : null}
                <tr className="border-t-2 border-foreground font-semibold">
                  <td className="py-2.5">
                    {t("statements.pdf.heating.totalHouse")}
                  </td>
                  {showHotWaterM3 ? (
                    <td className="py-2.5 text-right tabular-nums">
                      {`${formatNumber(
                        hw.perUnit.reduce((acc, u) => acc + u.hotWaterM3, 0),
                        2,
                      )} m³`}
                    </td>
                  ) : null}
                  {distributionValueCells(
                    hw.consumptionPortionCents,
                    hw.basicPortionCents,
                    hw.hotWaterPotCents,
                    wwMerged,
                    false,
                  )}
                </tr>
              </tbody>
            </table>
          </div>
          {wwFootnotes.map((footnote) => (
            <p
              key={footnote.key}
              className="mt-2 text-xs text-muted-foreground"
            >
              <sup>{footnote.index}</sup>{" "}
              {t(footnote.label.key, footnote.label.params)}
            </p>
          ))}
        </SectionCard>
      ) : null}
    </>
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
