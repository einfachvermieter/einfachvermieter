import {
  type TenantFormValues,
  type TenantSaveDto,
  tenantFormSchemaRefined,
  tenantFormToDto,
  todayIso,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/form/Form";
import { FormSyncPrompt } from "@/components/form/FormSyncPrompt";
import { Savebar } from "@/components/form/Savebar";
import { useFormSync } from "@/components/form/useFormSync";
import { t } from "../../lib/i18n";
import { currentResidentCount } from "../../lib/tenants";
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
  onResidentsChange,
}: {
  mode: "create" | "edit";
  units: Unit[];
  defaultValues: TenantFormValues;
  serverVersion?: string;
  onSubmit: (values: TenantSaveDto) => Promise<void>;
  onCancel: () => void;

  /** Formatierter Speicherzeitpunkt für die Savebar (nur mode="edit") */
  savedAt?: string;

  /**
   * Meldet den Bewohner-Stand des Formulars nach außen, damit die Infospalte
   * nicht den älteren Serverstand neben der bearbeiteten Liste zeigt
   */
  onResidentsChange?: (count: number) => void;
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
  const residents = form.watch("residents");

  // Leere Datumsfelder sind im Formular "", außerhalb aber null
  const residentCount = currentResidentCount(
    residents.map((resident) => ({
      moveInDate: resident.moveInDate === "" ? null : resident.moveInDate,
      moveOutDate: resident.moveOutDate === "" ? null : resident.moveOutDate,
    })),
    {
      startDate: tenantStartDate,
      endDate: tenantEndDate === "" ? null : tenantEndDate,
    },
    todayIso(),
  );

  // Nur echte Änderungen melden: `residents` ist bei jedem Render ein neues
  // Array, ein ungefiltertes Melden würde die Elternseite endlos neu rendern.
  const reportedCount = useRef<number | null>(null);
  useEffect(() => {
    if (reportedCount.current === residentCount) {
      return;
    }

    reportedCount.current = residentCount;
    onResidentsChange?.(residentCount);
  }, [onResidentsChange, residentCount]);

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
      <Savebar
        dirty={form.formState.isDirty}
        savedAt={savedAt}
        submitting={submitting}
        onCancel={onCancel}
        submitLabel={
          mode === "create"
            ? t("ui.common.action.create")
            : t("ui.common.action.save")
        }
      />
    </Form>
  );
};
