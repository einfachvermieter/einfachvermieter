import { tenantFormSchema } from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiKey2Line } from "@remixicon/react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FormSheet } from "@/components/form/FormSheet";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { FieldGroup } from "@/components/ui/Field";
import { t } from "../../../lib/i18n";
import type { Unit } from "../../../lib/units";
import { ContractFields } from "../fields/ContractFields";

const contractSchema = tenantFormSchema.pick({
  unitId: true,
  kind: true,
  startDate: true,
  endDate: true,
  depositEuros: true,
});

export type TenantContractValues = z.infer<typeof contractSchema>;

/**
 * Mietbeginn oder Mietende mitten im Abrechnungsjahr verlangt nach
 * HeizkostenV eine Zwischenablesung der Verbrauchszähler. Als Näherung
 * für "mitten im Jahr" dient das Kalenderjahr.
 */
const isMidYear = (startDate: string, endDate: string): boolean =>
  (startDate.length === 10 && !startDate.endsWith("-01-01")) ||
  (endDate.length === 10 && !endDate.endsWith("-12-31"));

/**
 * Vertragsdaten (Wohnung, Art, Zeitraum, Kaution) im FormSheet bearbeiten
 */
export const TenantContractSheet = ({
  units,
  defaultValues,
  shiftedSections,
  dependentPeriods,
  onSubmit,
  onClose,
}: {
  units: Unit[];
  defaultValues: TenantContractValues;
  shiftedSections: string[];
  /**
   * Zeiträume der abhängigen Einträge samt Bezeichnung, um zu erkennen,
   * ob einer davon ganz aus dem neuen Vertragszeitraum fällt und um im
   * Hinweis zu sagen, um welche Art Eintrag es geht.
   */
  dependentPeriods: { startDate: string; endDate: string; label: string }[];
  onSubmit: (values: TenantContractValues) => Promise<void>;
  onClose: () => void;
}) => {
  const form = useForm<TenantContractValues>({
    resolver: zodResolver(contractSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  // Ein verschobener Zeitraum zieht Mietsätze, Bewohner und
  // Bankverbindungen mit -> warnen
  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");
  const periodChanged =
    startDate !== defaultValues.startDate || endDate !== defaultValues.endDate;

  // Einträge, die vollständig außerhalb des neuen Zeitraums liegen,
  // werden beim Speichern entfernt -> warnen
  const dropped = startDate
    ? dependentPeriods.filter(
        (entry) =>
          (entry.endDate && entry.endDate < startDate) ||
          (endDate && entry.startDate && entry.startDate > endDate),
      )
    : [];
  const droppedLabels = [...new Set(dropped.map((entry) => entry.label))];

  return (
    <FormSheet
      form={form}
      icon={RiKey2Line}
      title={t("ui.tenant.sections.contract.title")}
      submitLabel={t("ui.common.action.save")}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <FieldGroup className="gap-4">
        <ContractFields
          control={form.control}
          units={units}
          unitDisabled={true}
        />
      </FieldGroup>
      {periodChanged && shiftedSections.length > 0 ? (
        <Alert variant="warning">
          <AlertDescription>
            {t("ui.tenant.fields.periodShiftHint")}
          </AlertDescription>
        </Alert>
      ) : null}
      {dropped.length > 0 ? (
        <Alert variant="error">
          <AlertDescription>
            {t("ui.tenant.fields.periodDropHint", {
              count: dropped.length,
              types: droppedLabels.join(t("ui.common.separators.comma")),
            })}
          </AlertDescription>
        </Alert>
      ) : null}
      {isMidYear(startDate, endDate) ? (
        <Alert variant="info">
          <AlertDescription>
            {t("ui.tenant.fields.interimReadingHint")}
          </AlertDescription>
        </Alert>
      ) : null}
    </FormSheet>
  );
};
