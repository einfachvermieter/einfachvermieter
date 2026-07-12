import {
  type CostLineResult,
  formatBemessung,
  formatEur,
  formatNumber,
  type StatementResult,
} from "@einfachvermieter/shared";
import { RiHomeGearLine } from "@remixicon/react";
import { SectionCard } from "../../../../components/common/SectionCard";
import { QUIET_TABLE_HEAD_ROW } from "../../../../components/common/tableStyles";
import { gradients } from "../../../../lib/domainVisuals";
import { t } from "../../../../lib/i18n";

const ALLOCATION_BY_LABEL_KEY: Record<CostLineResult["allocationKey"], string> =
  {
    // biome-ignore-start lint/style/useNamingConvention: domain bedingte keys
    per_living_area: "costs.allocationsBy.perLivingArea",
    per_heating_area: "costs.allocationsBy.perHeatingArea",
    per_person: "costs.allocationsBy.perPerson",
    per_unit: "costs.allocationsBy.perUnit",
    per_consumption_m3: "costs.allocationsBy.perConsumptionM3",
    per_consumption_kwh: "costs.allocationsBy.perConsumptionKwh",
    heating_ordinance: "costs.allocationsBy.heizkostenV",
    // biome-ignore-end lint/style/useNamingConvention: domain bedingte keys
    fixed: "costs.allocationsBy.fixed",
  };

const isWasteWaterName = (name: string): boolean =>
  /schmutzwasser|abwasser/iu.test(name);

type FootnoteDef = {
  applies: (line: CostLineResult) => boolean;
  text: string;
};

type NumberedFootnote = FootnoteDef & {
  marker: number;
};

/**
 * Fußnoten-Marker werden in der Reihenfolge des ersten Auftretens in der
 * Tabelle vergeben (1, 2, 3 ...), analog zur PDF-`CostsTable`.
 */
const numberFootnotes = (
  lines: CostLineResult[],
  defs: FootnoteDef[],
): NumberedFootnote[] => {
  const seen = new Set<FootnoteDef>();
  const ordered: FootnoteDef[] = [];
  for (const line of lines) {
    for (const def of defs) {
      if (!seen.has(def) && def.applies(line)) {
        seen.add(def);
        ordered.push(def);
      }
    }
  }
  return ordered.map((def, idx) => ({ ...def, marker: idx + 1 }));
};

/**
 * Bruch-Darstellung Mieter/Gesamt (Zähler über Nenner), Spiegel der
 * gestapelten Bruch-Zellen im PDF: fetter dunkler Zähler mit dezentem
 * Bruchstrich, gedämpfter Nenner darunter.
 */
const Fraction = ({ top, bottom }: { top: string; bottom: string }) => (
  <span className="inline-flex flex-col items-center text-[12.5px] leading-tight">
    <span className="border-b border-muted-foreground/40 px-1.5 pb-px font-semibold text-foreground">
      {top}
    </span>
    <span className="px-1.5 pt-px text-muted-foreground">{bottom}</span>
  </span>
);

export const OperatingCostsCard = ({ result }: { result: StatementResult }) => {
  // Heizkosten haben einen eigenen Tab (HeatingCard), daher hier wie
  // im PDF-Anhang ohne `heating_ordinance`-Zeilen.
  const operatingLines = result.lines.filter(
    (l) => l.allocationKey !== "heating_ordinance",
  );
  const operatingTotalCents = operatingLines.reduce(
    (sum, l) => sum + l.tenantAmountCents,
    0,
  );

  // Fußnoten wie im PDF: Frischwasser-Zähleraufstellung, Schmutzwasser-
  // Kopplung und Personentage-Erläuterung. Bedingungen/Texte spiegeln
  // StatementDocument + CostsTable.
  const ownUnit = result.waterDetail?.perUnit.find(
    (u) => u.unitId === result.unitId,
  );
  const contributions = ownUnit?.meterContributions ?? [];
  const consumptionNote =
    contributions.length >= 2
      ? `${t("statements.pdf.water.calculationNote")} ${contributions
          .map((c) => `${c.label} (${formatNumber(c.consumptionM3, 2)} m³)`)
          .join(", ")}`
      : undefined;
  const hasWasteWater = operatingLines.some(
    (l) =>
      l.allocationKey === "per_consumption_m3" &&
      isWasteWaterName(l.costTypeName),
  );

  const footnoteDefs: FootnoteDef[] = [];
  if (consumptionNote) {
    footnoteDefs.push({
      applies: (line) =>
        line.allocationKey === "per_consumption_m3" &&
        !isWasteWaterName(line.costTypeName),
      text: consumptionNote,
    });
  }

  if (hasWasteWater) {
    footnoteDefs.push({
      applies: (line) =>
        line.allocationKey === "per_consumption_m3" &&
        isWasteWaterName(line.costTypeName),
      text: t("statements.pdf.water.wasteWaterNote"),
    });
  }

  footnoteDefs.push({
    applies: (line) => line.bemessungUnit === "Personentage",
    text: t("statements.pdf.costTable.personDaysNote"),
  });
  const footnotes = numberFootnotes(operatingLines, footnoteDefs);

  return (
    <SectionCard
      icon={RiHomeGearLine}
      iconBackground={gradients.notes}
      title={t("ui.statements.detail.operatingCostsTitle")}
      description={t("ui.statements.detail.operatingCostsDescription")}
    >
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={QUIET_TABLE_HEAD_ROW}>
                <th className="py-2.5">
                  {t("statements.pdf.costTable.costTypeAllocation")}
                </th>
                <th className="py-2.5 text-right">
                  {t("statements.pdf.costTable.totalCosts")}
                </th>
                <th className="py-2.5 text-center">
                  {t("statements.pdf.costTable.bemessung")}
                </th>
                <th className="py-2.5 text-center">
                  {t("statements.pdf.costTable.tage")}
                </th>
                <th className="py-2.5 text-right">
                  {t("statements.pdf.costTable.yourCosts")}
                </th>
              </tr>
            </thead>
            <tbody>
              {operatingLines.map((line) => {
                const isFixed = line.allocationKey === "fixed";
                const hasBemessung =
                  line.bemessungTotal !== null &&
                  line.bemessungTotal !== undefined &&
                  line.bemessungTenant !== null &&
                  line.bemessungTenant !== undefined;
                const hasDays =
                  line.daysTotal !== null &&
                  line.daysTotal !== undefined &&
                  line.daysTenant !== null &&
                  line.daysTenant !== undefined;
                const markers = footnotes
                  .filter((fn) => fn.applies(line))
                  .map((fn) => fn.marker);
                return (
                  <tr
                    key={line.costTypeName}
                    className="border-b border-border"
                  >
                    <td className="py-2.5">
                      <span className="font-semibold text-foreground">
                        {line.costTypeName}
                        {markers.length > 0 ? (
                          <sup>{markers.join(",")}</sup>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-muted-foreground">
                        {t(ALLOCATION_BY_LABEL_KEY[line.allocationKey])}
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {formatEur(line.totalAmountCents)}{" "}
                      <span className="font-semibold text-muted-foreground">
                        {isFixed
                          ? t("statements.pdf.costTable.operatorEquals")
                          : t("statements.pdf.costTable.operatorMultiply")}
                      </span>
                    </td>
                    <td className="py-2.5 text-center tabular-nums">
                      {hasBemessung ? (
                        <span className="inline-flex items-center justify-center gap-1">
                          <Fraction
                            top={formatBemessung(
                              line.bemessungTenant as number,
                              line.bemessungUnit,
                              t,
                            )}
                            bottom={formatBemessung(
                              line.bemessungTotal as number,
                              line.bemessungUnit,
                              t,
                            )}
                          />
                          {isFixed ? null : (
                            <span className="font-semibold text-muted-foreground">
                              {hasDays
                                ? t("statements.pdf.costTable.operatorMultiply")
                                : t("statements.pdf.costTable.operatorEquals")}
                            </span>
                          )}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 text-center tabular-nums">
                      {hasDays ? (
                        <span className="inline-flex items-center justify-center gap-1">
                          <Fraction
                            top={String(line.daysTenant)}
                            bottom={String(line.daysTotal)}
                          />
                          <span className="font-semibold text-muted-foreground">
                            {t("statements.pdf.costTable.operatorEquals")}
                          </span>
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">
                      {formatEur(line.tenantAmountCents)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-foreground">
                <td className="py-2 font-semibold" colSpan={4}>
                  {t("statements.pdf.costTable.total")}
                </td>
                <td className="py-2 text-right font-semibold tabular-nums">
                  {formatEur(operatingTotalCents)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {footnotes.length > 0 ? (
          <div className="space-y-0.5">
            {footnotes.map((fn) => (
              <p key={fn.marker} className="text-xs text-muted-foreground">
                <sup>{fn.marker}</sup> {fn.text}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
};
