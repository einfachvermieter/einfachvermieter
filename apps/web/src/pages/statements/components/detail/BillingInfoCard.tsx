import {
  averageUserComparison,
  billingInfoCostRows,
  billingInfoRows,
  energyComparisonDisplay,
  type HeatingDetail,
  type Period,
} from "@einfachvermieter/shared";
import { RiInformationLine } from "@remixicon/react";
import { SectionCard } from "../../../../components/common/SectionCard";
import { t } from "../../../../lib/i18n";

const FOOTNOTE_MARKER = 1;

/**
 * Web-Version des PDF-Anhangs „Abrechnungsinformationen nach § 6a HeizkostenV"
 */
export const BillingInfoCard = ({
  detail,
  targetUnitId,
  tenantPeriod,
  statementPeriod,
}: {
  detail: HeatingDetail;
  targetUnitId: string;
  tenantPeriod: Period;
  statementPeriod: Period;
}) => {
  const rows = billingInfoRows(detail);
  const costRows = billingInfoCostRows(detail, t);
  const comparison = averageUserComparison(
    detail,
    targetUnitId,
    tenantPeriod,
    statementPeriod,
  );
  const prevComparison = detail.energyComparison
    ? energyComparisonDisplay(detail.energyComparison)
    : null;

  return (
    <SectionCard
      icon={RiInformationLine}
      title={t("statements.pdf.appendixBillingInfo")}
    >
      <div className="space-y-5 text-sm">
        {rows.length > 0 ? (
          <section>
            <h3 className="mb-2.5 font-semibold text-foreground">
              {t("statements.pdf.billingInfo.energyTitle")}
            </h3>
            <div className="scroll-shadow-x overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className="border-b border-border">
                      <td className="py-2.5 font-semibold text-foreground">
                        {t(row.label.key, row.label.params)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {t(row.value.key, row.value.params)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
        {rows.length === 0 ? (
          <p className="text-muted-foreground">
            {t("statements.pdf.billingInfo.externalReference")}
          </p>
        ) : null}
        {costRows.length > 0 ? (
          <section>
            <h3 className="mb-2.5 font-semibold text-foreground">
              {t("statements.pdf.billingInfo.costsTitle")}
            </h3>
            <div className="scroll-shadow-x overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {costRows.map((row) => (
                    <tr key={row.key} className="border-b border-border">
                      <td className="py-2.5 font-semibold text-foreground">
                        {t(row.label.key, row.label.params)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {t(row.value.key, row.value.params)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
        {comparison?.rows ? (
          <section>
            <h3 className="mb-2.5 font-semibold text-foreground">
              {t("statements.pdf.billingInfo.comparisonTitle")}
              <sup>{FOOTNOTE_MARKER}</sup>
            </h3>
            <div className="scroll-shadow-x overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {comparison.rows.map((row) => (
                    <tr key={row.key} className="border-b border-border">
                      <td className="py-2.5 font-semibold text-foreground">
                        {t(row.label.key, row.label.params)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {t(row.value.key, row.value.params)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              <sup>{FOOTNOTE_MARKER}</sup>{" "}
              {t("statements.pdf.billingInfo.comparisonNote")}
            </p>
            {comparison.isExtrapolated ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("statements.pdf.billingInfo.comparisonExtrapolatedNote")}
              </p>
            ) : null}
          </section>
        ) : null}
        {prevComparison ? (
          <section>
            <h3 className="mb-2.5 font-semibold text-foreground">
              {t("statements.pdf.billingInfo.comparisonPrevTitle")}
            </h3>
            {prevComparison.previousMissing ? (
              <p className="text-muted-foreground">
                {t("statements.pdf.billingInfo.comparisonPrevMissing")}
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {prevComparison.bars.map((bar) => (
                    <div key={bar.key} className="flex items-center gap-3">
                      <div className="w-72 shrink-0">
                        {t(bar.label.key, bar.label.params)}
                      </div>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-sm bg-muted">
                        <div
                          className="h-full rounded-sm bg-limette-500"
                          style={{ width: `${bar.widthPct}%` }}
                        />
                      </div>
                      <div className="w-44 shrink-0 text-right tabular-nums">
                        {t(bar.value.key, bar.value.params)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 space-y-1 text-muted-foreground">
                  {prevComparison.notes.map((note) => (
                    <p key={note.key}>{t(note.key, note.params)}</p>
                  ))}
                </div>
              </>
            )}
          </section>
        ) : null}
        <section>
          <h3 className="mb-2.5 font-semibold text-foreground">
            {t("statements.pdf.billingInfo.contactsTitle")}
          </h3>
          <p className="mb-2 text-xs text-muted-foreground">
            {t("statements.pdf.billingInfo.contactsIntro")}
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>{t("statements.pdf.billingInfo.contact1")}</li>
            <li>{t("statements.pdf.billingInfo.contact2")}</li>
            <li>{t("statements.pdf.billingInfo.contact3")}</li>
          </ul>
        </section>
        <section>
          <h3 className="mb-2.5 font-semibold text-foreground">
            {t("statements.pdf.billingInfo.disputeTitle")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("statements.pdf.billingInfo.disputeText")}
          </p>
        </section>
      </div>
    </SectionCard>
  );
};
