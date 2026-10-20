import {
  type CostLineResult,
  formatBemessung,
  formatEur,
  formatNumber,
  isWasteWaterName,
  type StatementResult,
  waterFootnoteMeters,
} from "@einfachvermieter/shared";
import { RiHomeGearLine } from "@remixicon/react";
import { TableFrame } from "@/components/common/TableFrame";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { SectionCard } from "../../../../components/common/SectionCard";
import { t } from "../../../../lib/i18n";
import { ALLOCATION_BY_LABEL_KEY } from "../../../../lib/statements";

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
  <span className="inline-flex flex-col items-center text-xs leading-tight">
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
  const footnoteMeters = waterFootnoteMeters(result);
  const meterList = (meters: Array<{ label: string; consumptionM3: number }>) =>
    meters
      .map((c) => `${c.label} (${formatNumber(c.consumptionM3, 2)}\u00A0m³)`)
      .join(", ");
  const consumptionNote =
    footnoteMeters.fresh.length > 0
      ? `${t("statements.pdf.water.calculationNote")} ${meterList(footnoteMeters.fresh)}`
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
      // Rechnet das Schmutzwasser mit anderen Zählern als das Frischwasser,
      // stehen dort die eigenen Zähler statt des Verweises.
      text: footnoteMeters.waste
        ? `${t("statements.pdf.water.wasteWaterCalculationNote")} ${meterList(footnoteMeters.waste)}`
        : t("statements.pdf.water.wasteWaterNote"),
    });
  }

  footnoteDefs.push({
    applies: (line) => line.bemessungUnit === "Personentage",
    text: t("statements.pdf.costTable.personDaysNote"),
  });
  const footnotes = numberFootnotes(operatingLines, footnoteDefs);

  // Die Bemessungsspalte zeigt gerundete Werte, gerechnet wird mit den
  // ungerundeten. Ohne Bemessungswerte gibt es nichts zu erklären.
  const hasAnyBemessung = operatingLines.some(
    (line) => line.bemessungTotal !== null && line.bemessungTotal !== undefined,
  );

  return (
    <SectionCard
      icon={RiHomeGearLine}
      title={t("ui.statements.detail.operatingCostsTitle")}
      description={t("ui.statements.detail.operatingCostsDescription")}
    >
      <div className="space-y-4">
        <TableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-normal">
                  {t("statements.pdf.costTable.costTypeAllocation")}
                </TableHead>
                <TableHead className="text-right whitespace-normal">
                  {t("statements.pdf.costTable.totalCosts")}
                </TableHead>
                <TableHead className="text-center whitespace-normal">
                  {t("ui.statements.detail.columnBemessungFraction")}
                </TableHead>
                <TableHead className="text-center whitespace-normal">
                  {t("statements.pdf.costTable.tage")}
                </TableHead>
                <TableHead className="text-right whitespace-normal">
                  {t("ui.statements.detail.columnYourCosts")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
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
                  <TableRow key={line.costTypeName}>
                    <TableCell className="whitespace-normal">
                      <span className="font-semibold text-foreground">
                        {line.costTypeName}
                        {markers.length > 0 ? (
                          <sup>{markers.join(",")}</sup>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-muted-foreground">
                        {t(ALLOCATION_BY_LABEL_KEY[line.allocationKey])}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatEur(line.totalAmountCents)}{" "}
                      <span className="font-semibold text-muted-foreground">
                        {isFixed
                          ? t("statements.pdf.costTable.operatorEquals")
                          : t("statements.pdf.costTable.operatorMultiply")}
                      </span>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
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
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
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
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatEur(line.tenantAmountCents)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold" colSpan={4}>
                  {t("statements.pdf.costTable.total")}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatEur(operatingTotalCents)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </TableFrame>
        {footnotes.length > 0 || hasAnyBemessung ? (
          <div className="space-y-0.5">
            {footnotes.map((fn) => (
              <p key={fn.marker} className="text-xs text-muted-foreground">
                <sup>{fn.marker}</sup> {fn.text}
              </p>
            ))}
            {hasAnyBemessung ? (
              <p className="text-xs text-muted-foreground">
                {t("statements.pdf.costTable.roundingNote")}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
};
