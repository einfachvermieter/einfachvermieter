import { zodResolver } from "@hookform/resolvers/zod";
import { RiBankCardLine } from "@remixicon/react";
import { bankDataByIBAN } from "bankdata-germany";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { DateInput } from "@/components/form/DateInput";
import { FormSheet } from "@/components/form/FormSheet";
import { SwitchInput } from "@/components/form/SwitchInput";
import { TextInput } from "@/components/form/TextInput";
import { FieldGroup } from "@/components/ui/Field";
import { t } from "../../../lib/i18n";
import {
  type BankAccountRowValues,
  bankAccountRowSchema,
} from "../components/bankAccounts/bankAccountRow";

const normalizeIban = (raw: string): string =>
  raw.replace(/\s+/gu, "").toUpperCase();

const today = new Date();
const validityCalendarStart = new Date(today.getFullYear() - 20, 0, 1);
const validityCalendarEnd = new Date(today.getFullYear() + 5, 11, 1);
const mandateCalendarStart = new Date(today.getFullYear() - 20, 0, 1);

/**
 * Eine Bankverbindung im FormSheet erfassen bzw. bearbeiten
 */
export const TenantBankAccountSheet = ({
  title,
  defaultValues,
  onSubmit,
  onClose,
}: {
  title: string;
  defaultValues: BankAccountRowValues;
  onSubmit: (values: BankAccountRowValues) => Promise<void>;
  onClose: () => void;
}) => {
  const form = useForm<BankAccountRowValues>({
    resolver: zodResolver(bankAccountRowSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  // Beim Deaktivieren der SEPA-Checkbox die Mandatsfelder leeren, damit
  // versteckte Werte nicht versehentlich erhalten bleiben.
  const sepaEnabled = form.watch("sepaEnabled");
  useEffect(() => {
    if (!sepaEnabled) {
      form.setValue("mandateReference", "", { shouldValidate: false });
      form.setValue("mandateSignedAt", "", { shouldValidate: false });
    }
  }, [sepaEnabled, form]);

  // BIC wird automatisch befüllt, wenn das Feld leer ist
  const ibanRaw = form.watch("iban");
  const bankData = useMemo(() => {
    const cleaned = normalizeIban(ibanRaw ?? "");
    return cleaned.length === 0 ? null : bankDataByIBAN(cleaned);
  }, [ibanRaw]);
  useEffect(() => {
    if (bankData?.bic && !form.getValues("bic")) {
      form.setValue("bic", bankData.bic, {
        shouldValidate: false,
        shouldDirty: true,
      });
    }
  }, [bankData, form]);

  return (
    <FormSheet
      form={form}
      icon={RiBankCardLine}
      title={title}
      submitLabel={t("ui.common.action.save")}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DateInput
          control={form.control}
          name="startDate"
          label={t("ui.tenant.fields.validFrom")}
          optional={true}
          startMonth={validityCalendarStart}
          endMonth={validityCalendarEnd}
        />
        <DateInput
          control={form.control}
          name="endDate"
          label={t("ui.tenant.fields.validTo")}
          optional={true}
          startMonth={validityCalendarStart}
          endMonth={validityCalendarEnd}
        />
        <TextInput
          control={form.control}
          name="iban"
          label={t("ui.tenant.fields.iban")}
          placeholder={t("ui.tenant.fields.ibanPlaceholder")}
          inputClassName="sm:col-span-2 tabular-nums"
          description={
            bankData
              ? t("ui.tenant.bankNameHint", { name: bankData.bankName })
              : undefined
          }
        />
        <TextInput
          control={form.control}
          name="bic"
          label={t("ui.tenant.fields.bic")}
          optional={true}
        />
        <TextInput
          control={form.control}
          name="accountHolder"
          label={t("ui.tenant.fields.accountHolder")}
        />
      </FieldGroup>
      <SwitchInput
        control={form.control}
        name="sepaEnabled"
        label={t("ui.tenant.fields.sepaEnabled")}
      />
      {sepaEnabled ? (
        <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput
            control={form.control}
            name="mandateReference"
            label={t("ui.tenant.fields.mandateReference")}
            inputClassName="tabular-nums"
          />
          <DateInput
            control={form.control}
            name="mandateSignedAt"
            label={t("ui.tenant.fields.mandateSignedAt")}
            startMonth={mandateCalendarStart}
            endMonth={today}
          />
        </FieldGroup>
      ) : null}
    </FormSheet>
  );
};
