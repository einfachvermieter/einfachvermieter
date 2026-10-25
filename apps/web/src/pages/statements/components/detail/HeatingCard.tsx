import {
  co2AreaIsPartial,
  co2FuelTable,
  co2RestrictionNote,
  co2TableRows,
  consumptionUnitLabel,
  formatEur,
  formatNumber,
  heatingAreaColumnLabelKey,
  heatingBaseMethodOf,
  heatingColumnFootnotes,
  hotWaterColumnFootnotes,
  hotWaterFactRows,
  landlordShareRow,
  type Period,
  perMeterDisplayDigits,
  prepareHeatingDisplay,
  prorationNote,
  type StatementResult,
} from "@einfachvermieter/shared";
import { RiDropLine, RiLeafLine, RiPieChart2Line } from "@remixicon/react";
import { TableFrame } from "@/components/common/TableFrame";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { IconFlame } from "@/lib/icons";
import { Disclose } from "../../../../components/common/Disclose";
import { MiniKpiRow } from "../../../../components/common/MiniKpiRow";
import { ResultRows } from "../../../../components/common/ResultRows";
import { SectionCard } from "../../../../components/common/SectionCard";
import { SplitBar } from "../../../../components/common/SplitBar";
import { t } from "../../../../lib/i18n";

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
    ? "text-right font-semibold tabular-nums"
    : "text-right tabular-nums";
  if (merged) {
    return (
      <TableCell className={totalClass}>{formatEur(totalCents)}</TableCell>
    );
  }
  return (
    <>
      <TableCell className="text-right tabular-nums">
        {formatEur(consumptionCents)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatEur(basicCents)}
      </TableCell>
      <TableCell className={totalClass}>{formatEur(totalCents)}</TableCell>
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
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Spiegel der PDF-Anlage, drei Cards.
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
  // Zeilen der CO2-Tabelle samt Berechnungsgrundlagen (§ 7 Abs. 3
  // CO2KostAufG), gemeinsame Quelle mit der PDF-Anlage.
  const co2Rows = co2TableRows(
    detail,
    (ownHeatingUnit?.totalCents ?? 0) + (ownHotWaterUnit?.totalCents ?? 0),
  );
  const fuelTable = co2FuelTable(co2);
  const restrictionNote = co2RestrictionNote(co2);
  // Kopf-Kennzahl über die volle Breite: Gesamt-Heizkosten der Wohnung,
  // aufgeschlüsselt nach Heizung und Warmwasser.
  const heatingKpi =
    hw && ownHeatingUnit && ownHotWaterUnit
      ? {
          totalCents: ownHeatingUnit.totalCents + ownHotWaterUnit.totalCents,
          heatingCents: ownHeatingUnit.totalCents,
          hotWaterCents: ownHotWaterUnit.totalCents,
        }
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
      {heatingKpi ? (
        <div className="mb-5">
          <MiniKpiRow
            columns={1}
            items={[
              {
                label: t("ui.statements.detail.heatingKpiLabel"),
                value: formatEur(heatingKpi.totalCents),
                hint: t("ui.statements.detail.heatingKpiHint", {
                  heating: formatEur(heatingKpi.heatingCents),
                  hotWater: formatEur(heatingKpi.hotWaterCents),
                }),
              },
            ]}
          />
        </div>
      ) : null}
      {hasBreakdown ? (
        <SectionCard
          icon={IconFlame}
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
        </SectionCard>
      ) : null}

      {hasBreakdown && (co2 || detail.fuelType) ? (
        <SectionCard
          collapsible={true}
          icon={RiLeafLine}
          title={
            co2
              ? t("statements.pdf.heating.co2.title")
              : t("statements.pdf.heating.energySource")
          }
        >
          {fuelTable ? (
            <div className="mb-4">
              <h4 className="mb-1 text-sm font-semibold">
                {t("statements.pdf.heating.co2.fuelTableTitle")}
              </h4>
              <TableFrame>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">
                        {t("statements.pdf.heating.co2.fuelColumn")}
                      </TableHead>
                      <TableHead scope="col" className="text-right">
                        {t("statements.pdf.heating.co2.fuelEnergyColumn")}
                      </TableHead>
                      <TableHead scope="col" className="text-right">
                        {t("statements.pdf.heating.co2.emissionFactor")}
                      </TableHead>
                      <TableHead scope="col" className="text-right">
                        {t("statements.pdf.heating.co2.amount")}
                      </TableHead>
                      <TableHead scope="col" className="text-right">
                        {t("statements.pdf.heating.co2.fuelCostColumn")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fuelTable.rows.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell>{row.label}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {t(row.energy.key, row.energy.params)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {t(row.factor.key, row.factor.params)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {t(row.amount.key, row.amount.params)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {typeof row.cost === "string"
                            ? row.cost
                            : t(row.cost.key, row.cost.params)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold">
                      <TableCell colSpan={3}>
                        {t("statements.pdf.heating.co2.fuelSum")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {t(fuelTable.sumAmount.key, fuelTable.sumAmount.params)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {typeof fuelTable.sumCost === "string"
                          ? fuelTable.sumCost
                          : t(fuelTable.sumCost.key, fuelTable.sumCost.params)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableFrame>
            </div>
          ) : null}
          <ResultRows
            rows={co2Rows.map((row) => ({
              label: t(row.label.key, row.label.params),
              value:
                typeof row.value === "string"
                  ? row.value
                  : t(row.value.key, row.value.params),
            }))}
          />
          {restrictionNote ? (
            <div className="mt-4 text-sm">
              <h4 className="font-semibold">
                {t("statements.pdf.heating.co2.restrictionNoteTitle")}
              </h4>
              <p className="mt-1">{t(restrictionNote.sentence.key)}</p>
              <p className="mt-1 whitespace-pre-line">
                {restrictionNote.evidenceNote}
              </p>
            </div>
          ) : null}
          {co2AreaIsPartial(detail) ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("statements.pdf.heating.co2.areaBasisPartialNote")}
            </p>
          ) : null}
          {co2?.periodShare ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("statements.pdf.heating.co2.periodShareNote")}
            </p>
          ) : null}
          {co2 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("statements.pdf.heating.co2.basisNote")}
            </p>
          ) : null}
        </SectionCard>
      ) : null}

      <SectionCard
        icon={RiPieChart2Line}
        title={t("statements.pdf.heating.distributionPerUnit")}
        collapsible={true}
      >
        <div className="mb-4">
          <SplitBar
            aPercent={basicPct}
            aLabel={t(
              `ui.heating.detail.splitBaseLegend.${heatingBaseMethodOf(detail)}`,
              { percent: formatNumber(basicPct, 0) },
            )}
            bLabel={t("ui.heating.detail.splitConsumptionLegend", {
              percent: formatNumber(consumptionPct, 0),
            })}
          />
        </div>
        <TableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("statements.pdf.heating.unit")}</TableHead>
                <TableHead className="text-right">
                  {t(heatingAreaColumnLabelKey(detail))}
                  {columnMarkers(heatingIndices("heatingArea"))}
                </TableHead>
                <TableHead className="whitespace-pre-line text-right">
                  {t(
                    consumptionUnitLabel(
                      detail.consumptionMethod,
                      useValuationPoints,
                    ).key,
                  )}
                  {columnMarkers(heatingIndices("consumption"))}
                </TableHead>
                {heatingMerged ? (
                  <TableHead className="whitespace-pre-line text-right">
                    {t("statements.pdf.heating.mergedAreaHeader")}
                    {columnMarkers(heatingIndices("total"))}
                  </TableHead>
                ) : (
                  <>
                    <TableHead className="whitespace-pre-line text-right">
                      {t("statements.pdf.heating.consumptionShareHeader", {
                        percent: formatNumber(consumptionPct, 0),
                      })}
                    </TableHead>
                    <TableHead className="whitespace-pre-line text-right">
                      {t("statements.pdf.heating.basicShareHeader", {
                        percent: formatNumber(basicPct, 0),
                      })}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("statements.pdf.heating.total")}
                      {columnMarkers(heatingIndices("total"))}
                    </TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.perUnit.map((unit) => {
                const isTarget = unit.unitId === targetUnitId;
                return (
                  <TableRow key={unit.unitId}>
                    <TableCell
                      className={
                        isTarget
                          ? "py-2.5 font-semibold text-foreground"
                          : "py-2.5 text-foreground"
                      }
                    >
                      {unit.unitName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t("ui.common.measures.sqm", {
                        value: formatNumber(unit.areaSqm, 2),
                      })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAggregatedConsumption(unit.consumptionKwh)}
                    </TableCell>
                    {distributionValueCells(
                      unit.consumptionCostCents,
                      unit.basicCostCents,
                      unit.totalCents,
                      heatingMerged,
                      isTarget,
                    )}
                  </TableRow>
                );
              })}
              {landlordRow ? (
                <TableRow>
                  <TableCell>
                    {t("statements.pdf.heating.landlordShare")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {t("ui.common.emptyValue")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {t("ui.common.emptyValue")}
                  </TableCell>
                  {distributionValueCells(
                    landlordRow.consumptionCostCents,
                    landlordRow.basicCostCents,
                    landlordRow.totalCents,
                    heatingMerged,
                    true,
                  )}
                </TableRow>
              ) : null}
              {/* "Haus gesamt": Summenzeile (vormals die separate
                  Übersichtstabelle). EUR-Werte aus den maßgeblichen
                  Gesamtsummen, nicht aus den gerundeten Zeilenwerten. */}
              <TableRow className="font-semibold">
                <TableCell>{t("statements.pdf.heating.totalHouse")}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {t("ui.common.measures.sqm", {
                    value: formatNumber(totalArea, 2),
                  })}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatAggregatedConsumption(totalConsumption)}
                </TableCell>
                {distributionValueCells(
                  detail.consumptionPortionCents,
                  detail.basicPortionCents,
                  heatingPotForDisplay,
                  heatingMerged,
                  false,
                )}
              </TableRow>
            </TableBody>
          </Table>
        </TableFrame>
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
            {prorationNote(detail, tenantPeriod, t)}
          </p>
        ) : null}

        {perMeter.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("statements.pdf.heating.perMeterEmpty")}
          </p>
        ) : (
          <div className="mt-4">
            <Disclose label={t("ui.statements.detail.showMeters")}>
              <TableFrame>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {t("statements.pdf.heating.perMeterMeter")}
                      </TableHead>
                      <TableHead>
                        {t("ui.statements.detail.occupancyMeterUnitColumn")}
                      </TableHead>
                      <TableHead>
                        {t("statements.pdf.heating.perMeterSerial")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("statements.pdf.heating.perMeterDelta")}
                      </TableHead>
                      {isHkv ? (
                        <TableHead className="text-right">
                          {t("statements.pdf.heating.perMeterKTotal")}
                        </TableHead>
                      ) : null}
                      <TableHead className="whitespace-pre-line text-right">
                        {t("statements.pdf.heating.perMeterWeighted")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perMeter.map((row) => (
                      <TableRow key={row.meterId}>
                        <TableCell className="font-semibold text-foreground">
                          {isHkv
                            ? row.meterLabel
                                .replace(/^Heizkostenverteiler\s*/u, "")
                                .trim() || row.meterLabel
                            : row.meterLabel}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.unitName ?? t("ui.common.emptyValue")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.serialNumber ?? t("ui.common.emptyValue")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
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
                        </TableCell>
                        {isHkv ? (
                          <TableCell className="text-right tabular-nums">
                            {row.kTotal === null || row.kTotal === undefined
                              ? t("ui.common.emptyValue")
                              : formatNumber(row.kTotal, kTotalDigits)}
                            <span className="ml-1 text-muted-foreground">
                              {t("statements.pdf.costTable.operatorEquals")}
                            </span>
                          </TableCell>
                        ) : null}
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(
                            row.consumptionWeighted,
                            consumptionWeightedDigits,
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableFrame>
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
          title={t("statements.pdf.heating.hotWater.title")}
          collapsible={true}
        >
          <div className="mb-4">
            <ResultRows
              rows={hotWaterFactRows(hw).map((factRow) => ({
                label: t(factRow.label.key, factRow.label.params),
                value: t(factRow.value.key, factRow.value.params),
              }))}
            />
          </div>
          <TableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("statements.pdf.heating.unit")}</TableHead>
                  {showHotWaterM3 ? (
                    <TableHead className="text-right">
                      {t("statements.pdf.heating.hotWater.consumptionM3")}
                    </TableHead>
                  ) : null}
                  {wwMerged ? (
                    <TableHead className="whitespace-pre-line text-right">
                      {t("statements.pdf.heating.mergedAreaHeader")}
                      {columnMarkers(wwIndices())}
                    </TableHead>
                  ) : (
                    <>
                      <TableHead className="whitespace-pre-line text-right">
                        {t("statements.pdf.heating.consumptionShareHeader", {
                          percent: formatNumber(hotWaterConsumptionPct, 0),
                        })}
                      </TableHead>
                      <TableHead className="whitespace-pre-line text-right">
                        {t("statements.pdf.heating.basicShareHeader", {
                          percent: formatNumber(hotWaterBasicPct, 0),
                        })}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("statements.pdf.heating.total")}
                        {columnMarkers(wwIndices())}
                      </TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {hw.perUnit.map((unit) => {
                  const isTarget = unit.unitId === targetUnitId;
                  return (
                    <TableRow key={unit.unitId}>
                      <TableCell
                        className={
                          isTarget
                            ? "py-2.5 font-semibold text-foreground"
                            : "py-2.5 text-foreground"
                        }
                      >
                        {unit.unitName}
                      </TableCell>
                      {showHotWaterM3 ? (
                        <TableCell className="text-right tabular-nums">
                          {t("ui.common.measures.m3", {
                            value: formatNumber(unit.hotWaterM3, 2),
                          })}
                        </TableCell>
                      ) : null}
                      {distributionValueCells(
                        unit.consumptionCostCents,
                        unit.basicCostCents,
                        unit.totalCents,
                        wwMerged,
                        isTarget,
                      )}
                    </TableRow>
                  );
                })}
                {hwLandlordRow ? (
                  <TableRow>
                    <TableCell>
                      {t("statements.pdf.heating.landlordShare")}
                    </TableCell>
                    {showHotWaterM3 ? (
                      <TableCell className="text-right tabular-nums">
                        {t("ui.common.emptyValue")}
                      </TableCell>
                    ) : null}
                    {distributionValueCells(
                      hwLandlordRow.consumptionCostCents,
                      hwLandlordRow.basicCostCents,
                      hwLandlordRow.totalCents,
                      wwMerged,
                      true,
                    )}
                  </TableRow>
                ) : null}
                <TableRow className="font-semibold">
                  <TableCell>
                    {t("statements.pdf.heating.totalHouse")}
                  </TableCell>
                  {showHotWaterM3 ? (
                    <TableCell className="text-right tabular-nums">
                      {t("ui.common.measures.m3", {
                        value: formatNumber(
                          hw.perUnit.reduce((acc, u) => acc + u.hotWaterM3, 0),
                          2,
                        ),
                      })}
                    </TableCell>
                  ) : null}
                  {distributionValueCells(
                    hw.consumptionPortionCents,
                    hw.basicPortionCents,
                    hw.hotWaterPotCents,
                    wwMerged,
                    false,
                  )}
                </TableRow>
              </TableBody>
            </Table>
          </TableFrame>
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
