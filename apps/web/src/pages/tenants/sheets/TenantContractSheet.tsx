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
  onSubmit,
  onClose,
}: {
  units: Unit[];
  defaultValues: TenantContractValues;
  onSubmit: (values: TenantContractValues) => Promise<void>;
  onClose: () => void;
}) => {
  const form = useForm<TenantContractValues>({
    resolver: zodResolver(contractSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

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
      {isMidYear(form.watch("startDate"), form.watch("endDate")) ? (
        <Alert variant="info">
          <AlertDescription>
            {t("ui.tenant.fields.interimReadingHint")}
          </AlertDescription>
        </Alert>
      ) : null}
    </FormSheet>
  );
};
