import {
  averageUserComparison,
  billingInfoCostRows,
  billingInfoRows,
  type HeatingDetail,
  type Period,
} from "@einfachvermieter/shared";
import { RiInformationLine } from "@remixicon/react";
import { SectionCard } from "../../../../components/common/SectionCard";
import { gradients } from "../../../../lib/domainVisuals";
import { t } from "../../../../lib/i18n";

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
  const costRows = billingInfoCostRows(detail);
  const comparison = averageUserComparison(
    detail,
    targetUnitId,
    tenantPeriod,
    statementPeriod,
  );

  return (
    <SectionCard
      icon={RiInformationLine}
      iconBackground={gradients.slate}
      title={t("statements.pdf.appendixBillingInfo")}
    >
      <div className="space-y-5 text-sm">
        {rows.length > 0 ? (
          <section>
            <h3 className="mb-2.5 font-semibold text-foreground">
              {t("statements.pdf.billingInfo.energyTitle")}
            </h3>
            <div className="overflow-x-auto">
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
            <div className="overflow-x-auto">
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
            </h3>
            <div className="overflow-x-auto">
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
            <p className="mt-2 text-muted-foreground">
              {t("statements.pdf.billingInfo.comparisonNote")}
            </p>
          </section>
        ) : null}
        {comparison?.note ? (
          <p className="text-muted-foreground">
            {t(comparison.note.key, comparison.note.params)}
          </p>
        ) : null}
        <section>
          <h3 className="mb-2.5 font-semibold text-foreground">
            {t("statements.pdf.billingInfo.contactsTitle")}
          </h3>
          <p className="mb-2 text-muted-foreground">
            {t("statements.pdf.billingInfo.contactsIntro")}
          </p>
          <ul className="space-y-1 text-muted-foreground">
            <li>{t("statements.pdf.billingInfo.contact1")}</li>
            <li>{t("statements.pdf.billingInfo.contact2")}</li>
            <li>{t("statements.pdf.billingInfo.contact3")}</li>
          </ul>
        </section>
        <section>
          <h3 className="mb-2.5 font-semibold text-foreground">
            {t("statements.pdf.billingInfo.disputeTitle")}
          </h3>
          <p className="text-muted-foreground">
            {t("statements.pdf.billingInfo.disputeText")}
          </p>
        </section>
      </div>
    </SectionCard>
  );
};
