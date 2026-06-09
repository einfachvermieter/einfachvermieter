import {
  type TenantFormValues,
  type TenantSaveDto,
  tenantFormSchemaRefined,
  tenantFormToDto,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Spinner } from "@/components/common/Spinner";
import { Form } from "@/components/form/Form";
import { FormActions } from "@/components/form/FormActions";
import { FormSyncPrompt } from "@/components/form/FormSyncPrompt";
import { Savebar } from "@/components/form/Savebar";
import { useFormSync } from "@/components/form/useFormSync";
import { Button } from "@/components/ui/Button";
import { t } from "../../lib/i18n";
import type { Unit } from "../../lib/units";
import { Addresses } from "./components/addresses/Addresses";
import { BankAccounts } from "./components/bankAccounts/BankAccounts";
import { BaseDataFields } from "./components/baseData/BaseDataFields";
import { NotesSection } from "./components/baseData/NotesSection";
import { Rents } from "./components/rents/Rents";
import { Residents } from "./components/residents/Residents";

export const TenantForm = ({
  mode,
  units,
  defaultValues,
  serverVersion,
  onSubmit,
  onCancel,
  savedAt,
}: {
  mode: "create" | "edit";
  units: Unit[];
  defaultValues: TenantFormValues;
  serverVersion?: string;
  onSubmit: (values: TenantSaveDto) => Promise<void>;
  onCancel: () => void;

  /** Formatierter Speicherzeitpunkt für die Savebar (nur mode="edit") */
  savedAt?: string;
}) => {
  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantFormSchemaRefined),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  const submitting = form.formState.isSubmitting;
  const sync = useFormSync({ form, defaultValues, serverVersion });

  const tenantStartDate = form.watch("startDate");
  const tenantEndDate = form.watch("endDate");
  const kindValue = form.watch("kind");
  const showRentsAndBankAccounts = kindValue !== "owner";

  return (
    <Form form={form} onSubmit={(values) => onSubmit(tenantFormToDto(values))}>
      <FormSyncPrompt {...sync} />
      <fieldset disabled={submitting} className="contents">
        <BaseDataFields
          form={form}
          units={units}
          unitFieldDisabled={mode === "edit"}
        />
        <Residents
          form={form}
          tenantStartDate={tenantStartDate}
          tenantEndDate={tenantEndDate}
        />
        {showRentsAndBankAccounts ? (
          <>
            <Rents
              form={form}
              tenantStartDate={tenantStartDate}
              tenantEndDate={tenantEndDate}
            />
            <BankAccounts
              form={form}
              tenantStartDate={tenantStartDate}
              tenantEndDate={tenantEndDate}
            />
          </>
        ) : null}
        <Addresses
          form={form}
          tenantStartDate={tenantStartDate}
          tenantEndDate={tenantEndDate}
        />
        <NotesSection form={form} />
      </fieldset>
      {mode === "create" ? (
        <FormActions
          submitting={submitting}
          onCancel={onCancel}
          submitLabel={t("ui.common.action.create")}
        />
      ) : (
        <Savebar savedAt={savedAt}>
          <Button
            variant="secondary"
            type="button"
            onClick={onCancel}
            disabled={submitting}
          >
            {t("ui.common.action.cancel")}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Spinner data-icon="inline-start" /> : null}
            {t("ui.common.action.save")}
          </Button>
        </Savebar>
      )}
    </Form>
  );
};
