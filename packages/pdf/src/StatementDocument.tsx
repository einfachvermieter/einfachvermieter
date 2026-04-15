import {
  formatDate,
  formatEur,
  formatIban,
  formatNumber,
  type StatementResult,
} from "@einfachvermieter/shared";
import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { calcWarningKey, formatCalcWarning } from "./calcWarnings.js";
import { CostsTable } from "./components/CostsTable.js";
import { HeatingAppendix } from "./components/HeatingAppendix.js";
import { LetterMarks } from "./components/LetterMarks.js";
import { OccupancyAppendix } from "./components/OccupancyAppendix.js";
import { PaymentsAppendix } from "./components/PaymentsAppendix.js";
import { StatementMetaTable } from "./components/StatementMetaTable.js";
import { SummaryBlock } from "./components/SummaryBlock.js";
import { TaxableLaborAppendix } from "./components/TaxableLaborAppendix.js";
import { t } from "./i18n.js";
import { styles } from "./styles.js";

export type StatementDocumentProps = {
  result: StatementResult;
  meta: {
    buildingName: string;
    buildingAddress: string;
    tenantName: string;
    tenantAddressStreet: string;
    tenantAddressCity: string;
    unitName: string;
    /**
     * Optionale Bezeichnung der Mieteinheit in Wohnanlagen (z. B. "3.07").
     */
    unitNumber: string | null;
    unitAreaSqm: number;
    buildingTotalAreaSqm: number;
    /**
     * Externe Abrechnungs-Nr. im Format `NK-{Jahr}-{Seq}-{Rev}`. Im
     * Draft-Status sind die noch nicht vergebenen Stellen mit `X`
     * aufgefüllt (z. B. `NK-2025-XXXX-XX`).
     */
    statementReference: string;
    /**
     * Falls Entwurf, dann u.a. ENTWURF-Wasserzeichen in PDF
     */
    isDraft: boolean;
    /**
     * Abrechnungs-Nr. der ersetzten Abrechnung, wenn dies eine
     * Korrekturabrechnung ist.
     */
    correctionOfReference?: string | null;
    /**
     * Absender-Daten aus den App-Einstellungen
     */
    senderName: string;
    senderAddressStreet: string;
    senderAddressPostalCode: string;
    senderAddressCity: string;
    senderPhone?: string | null;
    senderFax?: string | null;
    senderEmail?: string | null;
    /**
     * Bankverbindung des Absenders. Ohne IBAN bleibt der Block aus.
     */
    senderBankName?: string | null;
    senderBankIban?: string | null;
    senderBankBic?: string | null;
    /**
     * Absolute oder app-relative URL zum Logo im Briefkopf
     */
    senderLogoUrl?: string | null;
    documentDate: string; // YYYY-MM-DD
    /**
     * True, wenn zum Periodenende ein aktives SEPA-Lastschriftmandat
     * vorliegt. Beeinflusst den Zahlungsabwicklungs-Text: bei SEPA wird
     * darauf hingewiesen, dass per Lastschrift eingezogen wird; ohne
     * SEPA wird zur Überweisung aufgefordert.
     */
    hasSepaMandate: boolean;
    /**
     * True, wenn zum Periodenende mindestens ein gültiger
     * Bankverbindungs-Eintrag (mit IBAN) für den Mieter vorliegt, auch
     * ohne Mandat. Bei Rückzahlung ohne hinterlegte Bankverbindung wird
     * der Mieter im PDF gebeten, seine aktuelle Bankverbindung zu nennen.
     */
    hasBankAccount: boolean;
  };
};

// Zeile fürs Adressfenster über dem Empfänger
const senderAddressLine = (meta: StatementDocumentProps["meta"]): string =>
  `${meta.senderName} – ${meta.senderAddressStreet} – ${meta.senderAddressPostalCode} ${meta.senderAddressCity}`;

/**
 * Verarbeitet `**bold**`-Markierungen in einem i18n-Text und rendert die
 * markierten Abschnitte als fettes inline-`<Text>`.
 */
const renderWithBold = (text: string) =>
  text.split(/\*\*(.+?)\*\*/u).map((chunk, idx) =>
    idx % 2 === 0 ? (
      chunk
    ) : (
      <Text key={chunk} style={styles.bold}>
        {chunk}
      </Text>
    ),
  );

const DraftWatermark = () => (
  <Text style={styles.draftWatermark} fixed={true}>
    {t("statements.pdf.draftWatermark")}
  </Text>
);

type PageFooterProps = {
  statementReference: string;
};

const PageFooter = ({ statementReference }: PageFooterProps) => (
  <View style={styles.footer} fixed={true}>
    <Text style={styles.footerLeft}>{t("statements.pdf.documentType")}</Text>
    <Text style={styles.footerCenter}>{statementReference}</Text>
    <Text
      style={styles.footerRight}
      render={({ pageNumber, totalPages }) =>
        t("statements.pdf.pagination", { page: pageNumber, total: totalPages })
      }
    />
  </View>
);

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Länge liegt am Markup
export const StatementDocument = ({ result, meta }: StatementDocumentProps) => {
  const {
    period,
    tenantPeriod,
    lines,
    totalAdvancesCents,
    balanceCents,
    payments,
  } = result;
  const isPartialTenantPeriod =
    tenantPeriod.start !== period.start || tenantPeriod.end !== period.end;
  const { statementReference } = meta;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <LetterMarks />

        {/* Logo eigenständig mittig im Briefkopf, unabhängig vom
            rechts platzierten Sender-Block. */}
        {meta.senderLogoUrl ? (
          <Image src={meta.senderLogoUrl} style={styles.senderLogo} />
        ) : null}

        {/* Sender-Block oben rechts, nur Kontaktdaten, ohne Logo. */}
        <View style={styles.senderHeader}>
          <Text style={styles.bold}>{meta.senderName}</Text>
          <Text>{meta.senderAddressStreet}</Text>
          <Text>
            {meta.senderAddressPostalCode} {meta.senderAddressCity}
          </Text>
          {meta.senderPhone ? (
            <Text>
              {t("statements.pdf.senderContact.phone", {
                value: meta.senderPhone,
              })}
            </Text>
          ) : null}
          {meta.senderFax ? (
            <Text>
              {t("statements.pdf.senderContact.fax", { value: meta.senderFax })}
            </Text>
          ) : null}
          {meta.senderEmail ? <Text>{meta.senderEmail}</Text> : null}
        </View>

        {/* Empfänger-Adressfeld nach DIN 5008 Form B. */}
        <View style={styles.addressFieldB}>
          <Text style={styles.envelopeSender}>{senderAddressLine(meta)}</Text>
          <Text>{meta.tenantName}</Text>
          <Text>{meta.tenantAddressStreet}</Text>
          <Text>{meta.tenantAddressCity}</Text>
        </View>

        <View style={styles.letterContent}>
          <View style={styles.documentMeta}>
            <Text>
              {meta.senderAddressCity}
              {t("ui.common.separators.comma")} {formatDate(meta.documentDate)}
            </Text>
          </View>

          <View style={styles.subject}>
            <Text>{t("statements.pdf.subject")}</Text>
            <Text>
              {t("statements.pdf.subjectPeriod", {
                start: formatDate(period.start),
                end: formatDate(period.end),
              })}
            </Text>
            <Text>
              {t("statements.pdf.subjectUnit", {
                unit: meta.unitNumber
                  ? `${meta.unitName} (${meta.unitNumber})`
                  : meta.unitName,
                address: meta.buildingAddress,
              })}
            </Text>
          </View>

          {/* Korrekturhinweis: weist die ersetzte Abrechnung aus, damit für
              den Mieter klar ist, dass diese Abrechnung an deren Stelle tritt. */}
          {meta.correctionOfReference ? (
            <Text style={styles.paragraph}>
              {t("statements.pdf.correctionNote", {
                reference: meta.correctionOfReference,
              })}
            </Text>
          ) : null}

          {/* Einleitungstext nur, wenn der Mietzeitraum von der
              Abrechnungs-Periode abweicht. Sonst wäre der Hinweis
              redundant zum Betreff. */}
          {isPartialTenantPeriod ? (
            <Text style={styles.paragraph}>
              {t("statements.pdf.introPartial")}
            </Text>
          ) : null}

          {/* Zweispaltiger Block: links die Eckdaten zur Abrechnung,
              rechts die kompakte Kosten-/Saldo-Übersicht */}
          <View style={styles.twoColumnRow} wrap={false}>
            <View style={styles.twoColumnLeft}>
              <StatementMetaTable
                statementReference={statementReference}
                unitName={meta.unitName}
                unitNumber={meta.unitNumber}
                unitAreaSqm={meta.unitAreaSqm}
                buildingTotalAreaSqm={meta.buildingTotalAreaSqm}
                period={period}
                tenantPeriod={tenantPeriod}
              />
            </View>
            <View style={styles.twoColumnRight}>
              <SummaryBlock
                lines={lines}
                totalAdvancesCents={totalAdvancesCents}
                balanceCents={balanceCents}
              />
            </View>
          </View>

          {/* Hinweis zur Zahlungsabwicklung, variiert nach SEPA-Status,
              hinterlegter Bankverbindung und Saldo-Richtung. Bei Nach-
              zahlung ohne SEPA wird die Absender-Bankverbindung (falls
              hinterlegt) inline in den Satz eingebaut; ist keine IBAN
              hinterlegt, bleibt es bei "auf unser Konto" (der Mieter
              kennt sie aus dem Mietvertrag). */}
          <Text style={styles.paragraph}>
            {(() => {
              if (balanceCents === 0) {
                return t("statements.pdf.paymentInfo.balanced");
              }
              if (balanceCents > 0) {
                if (meta.hasSepaMandate) {
                  return t("statements.pdf.paymentInfo.sepaDebit");
                }
                if (!meta.senderBankIban) {
                  return t("statements.pdf.paymentInfo.transferDebit", {
                    variant: "plain",
                  });
                }
                const variantKey = `${meta.senderBankName ? "1" : "0"}${meta.senderBankBic ? "1" : "0"}`;
                const variant = {
                  "00": "iban",
                  "10": "ibanBank",
                  "01": "ibanBic",
                  "11": "ibanBankBic",
                }[variantKey];
                return t("statements.pdf.paymentInfo.transferDebit", {
                  variant,
                  iban: formatIban(meta.senderBankIban),
                  bankName: meta.senderBankName ?? "",
                  bic: meta.senderBankBic ?? "",
                });
              }
              if (meta.hasSepaMandate) {
                return t("statements.pdf.paymentInfo.sepaRefund");
              }
              return meta.hasBankAccount
                ? t("statements.pdf.paymentInfo.transferRefund")
                : t("statements.pdf.paymentInfo.transferRefundNoAccount");
            })()}
          </Text>

          {/* Hinweis zur neuen monatlichen Vorauszahlung. Wird nur
              gerendert, wenn der Vermieter eine Anpassung festgelegt hat
              UND sich der Betrag tatsächlich vom bisherigen unterscheidet.
              Wenn zusätzlich Tarif-Erwartungen gesetzt sind, wird die
              erweiterte Text-Variante verwendet. */}
          {(() => {
            const adj = result.advanceAdjustment;
            if (
              !adj ||
              adj.adjustedMonthlyAdvanceCents === null ||
              adj.adjustedAdvanceValidFrom === null ||
              adj.adjustedMonthlyAdvanceCents === adj.currentMonthlyAdvanceCents
            ) {
              return null;
            }
            const affectedCostTypeIds = new Set(
              Object.entries(adj.tariffAdjustmentBps ?? {})
                .filter(([, bps]) => bps !== 0)
                .map(([costTypeId]) => costTypeId),
            );
            const affectedNames = result.lines
              .filter((line) => affectedCostTypeIds.has(line.costTypeId))
              .map((line) => line.costTypeName);

            // Die with-tariffs-Variante (mit Auflistung der betroffenen
            // Positionen) nur dann verwenden, wenn der gewählte Betrag
            // tatsächlich über dem Vorjahres-Vorschlag (Ist/12) liegt. Bei
            // <= Vorjahres-Vorschlag ist die Begründung "Preisänderungen
            // berücksichtigt" inhaltlich nicht tragfähig.
            const hasTariffAdjustments =
              affectedNames.length > 0 &&
              adj.adjustedMonthlyAdvanceCents >
                adj.suggestedMonthlyAdvanceCents;

            // Ausgewiesen wird die monatliche Gesamtzahlung (Kaltmiete + neue
            // Vorauszahlung), fett, mit Aufschlüsselung in Klammern, auch bei
            // Kaltmiete 0 € (dann "0,00 € Kaltmiete" in der Klammer).
            const baseRentCents = adj.currentMonthlyBaseRentCents;
            const textParams = {
              validFrom: formatDate(adj.adjustedAdvanceValidFrom),
              total: formatEur(baseRentCents + adj.adjustedMonthlyAdvanceCents),
              baseRent: formatEur(baseRentCents),
              advance: formatEur(adj.adjustedMonthlyAdvanceCents),
            };

            if (hasTariffAdjustments) {
              const positions = new Intl.ListFormat("de", {
                style: "long",
                type: "conjunction",
              }).format(affectedNames);

              const closingKey = meta.hasSepaMandate
                ? "statements.pdf.advanceAdjustmentWithTariffsClosingSepa"
                : "statements.pdf.advanceAdjustmentWithTariffsClosing";

              return (
                <>
                  <Text style={styles.paragraph}>
                    {renderWithBold(
                      t("statements.pdf.advanceAdjustmentWithTariffsIntro", {
                        positions,
                        count: affectedNames.length,
                      }),
                    )}
                  </Text>
                  <Text style={styles.paragraph}>
                    {renderWithBold(t(closingKey, textParams))}
                  </Text>
                </>
              );
            }

            const adjustmentKey = meta.hasSepaMandate
              ? "statements.pdf.advanceAdjustmentSepa"
              : "statements.pdf.advanceAdjustment";

            return (
              <Text style={styles.paragraph}>
                {renderWithBold(t(adjustmentKey, textParams))}
              </Text>
            );
          })()}

          <Text style={styles.paragraph}>
            {t("statements.pdf.appendixHint")}
          </Text>
        </View>

        <PageFooter statementReference={statementReference} />
        {meta.isDraft ? <DraftWatermark /> : null}
      </Page>

      {/* Anhänge: Betriebskosten-Detailaufstellung, Zahlungs-
          Eingänge, Belegung und Lohnkosten laufen untereinander.
          react-pdf bricht automatisch um, sobald der Platz nicht reicht.
          Kleinere Folgeblöcke rutschen so noch auf die vorherige Seite,
          wenn dort Platz ist. Heizkosten bleiben bewusst als eigener
          Anhang am Ende */}
      <Page size="A4" style={styles.page}>
        <LetterMarks />
        <Text style={styles.appendixHeading}>
          {t("statements.pdf.appendixDetail")}
        </Text>
        {(() => {
          // Heizkosten haben einen eigenen Anhang (HeatingAppendix) und
          // erscheinen daher nicht in der Betriebskosten-Detailtabelle.
          const operatingLines = lines.filter(
            (l) => l.allocationKey !== "heating_ordinance",
          );

          const operatingTotalCents = operatingLines.reduce(
            (sum, l) => sum + l.tenantAmountCents,
            0,
          );

          // Frischwasser-Fußnote: listet die Zähler dieser Wohnung mit ihrem
          // Einzelverbrauch. Fußnote nur bei ≥ 2 beitragenden Zählern; bei
          // einem einzelnen Zähler ist die Information redundant zur
          // Bemessungs-Spalte.
          const ownUnit = result.waterDetail?.perUnit.find(
            (u) => u.unitId === result.unitId,
          );

          const contributions = ownUnit?.meterContributions ?? [];
          const consumptionNote =
            contributions.length >= 2
              ? `${t("statements.pdf.water.calculationNote")} ${contributions
                  .map(
                    (c) =>
                      `${c.label} (${formatNumber(c.consumptionM3, 2)} m³)`,
                  )
                  .join(", ")}`
              : undefined;

          const hasWasteWater = operatingLines.some(
            (l) =>
              l.allocationKey === "per_consumption_m3" &&
              /schmutzwasser|abwasser/iu.test(l.costTypeName),
          );

          const wasteWaterNote = hasWasteWater
            ? t("statements.pdf.water.wasteWaterNote")
            : undefined;

          return (
            <>
              <CostsTable
                lines={operatingLines}
                totalCostsCents={operatingTotalCents}
                consumptionNote={consumptionNote}
                wasteWaterNote={wasteWaterNote}
              />
              {/* Berechnungs-Hinweise der Wasser-Verteilung, v. a. die
                  Kennzeichnung geschätzter bzw. fehlender Ablesewerte. */}
              {(result.waterDetail?.warnings ?? []).map((warning) => (
                <Text key={calcWarningKey(warning)} style={styles.footnote}>
                  {formatCalcWarning(warning)}
                </Text>
              ))}
            </>
          );
        })()}

        {payments && payments.length > 0 ? (
          <View wrap={false}>
            <Text style={styles.appendixSubheading}>
              {t("statements.pdf.appendixPayments")}
            </Text>
            <PaymentsAppendix
              payments={payments}
              period={period}
              tenantPeriod={tenantPeriod}
            />
          </View>
        ) : null}

        {result.occupancyDetail &&
        lines.some((l) => l.allocationKey === "per_person") ? (
          <View wrap={false}>
            <Text style={styles.appendixSubheading}>
              {t("statements.pdf.appendixOccupancy")}
            </Text>
            <OccupancyAppendix
              detail={result.occupancyDetail}
              targetUnitId={result.unitId}
            />
          </View>
        ) : null}

        {result.taxableLaborCosts &&
        result.taxableLaborCosts.byCategory.length > 0 ? (
          <View wrap={false}>
            <Text style={styles.appendixSubheading}>
              {t("statements.pdf.appendixTaxableLabor")}
            </Text>
            <TaxableLaborAppendix detail={result.taxableLaborCosts} />
          </View>
        ) : null}

        <PageFooter statementReference={statementReference} />
        {meta.isDraft ? <DraftWatermark /> : null}
      </Page>

      {/* Heizkostenabrechnung als eigenständiger Anhang am Ende */}
      {result.heatingDetail ? (
        <Page size="A4" style={styles.page}>
          <LetterMarks />
          <Text style={styles.appendixHeading}>
            {t("statements.pdf.appendixHeating")}
          </Text>
          <HeatingAppendix
            detail={result.heatingDetail}
            tenantPeriod={result.tenantPeriod}
            statementPeriod={result.period}
            targetUnitId={result.unitId}
          />
          <PageFooter statementReference={statementReference} />
          {meta.isDraft ? <DraftWatermark /> : null}
        </Page>
      ) : null}
    </Document>
  );
};
