import {
  type SenderSettingsUpdateDto,
  senderSettingsUpdateSchema,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiBankLine, RiContactsBook2Line } from "@remixicon/react";
import { bankDataByIBAN } from "bankdata-germany";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Disclose } from "@/components/common/Disclose";
import { SectionCard } from "@/components/common/SectionCard";
import { Form } from "@/components/form/Form";
import { Savebar } from "@/components/form/Savebar";
import { TextInput } from "@/components/form/TextInput";
import { t } from "@/lib/i18n";
import type { PendingLogo, SenderSettings } from "@/lib/senderSettings";
import { SenderLogoCard } from "./SenderLogoCard";

const normalizeIban = (raw: string): string =>
  raw.replace(/\s+/gu, "").toUpperCase();

type SenderSettingsFormProps = {
  settings: SenderSettings;
  defaultValues: z.input<typeof senderSettingsUpdateSchema>;
  onSubmit: (values: SenderSettingsUpdateDto) => Promise<void>;
  onCancel: () => void;
  pendingLogo: PendingLogo;
  onPendingLogoChange: (pending: PendingLogo) => void;
  logoVersion: string;
};

export const SenderSettingsForm = ({
  settings,
  defaultValues,
  onSubmit,
  onCancel,
  pendingLogo,
  onPendingLogoChange,
  logoVersion,
}: SenderSettingsFormProps) => {
  const form = useForm<
    z.input<typeof senderSettingsUpdateSchema>,
    unknown,
    SenderSettingsUpdateDto
  >({
    resolver: zodResolver(senderSettingsUpdateSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  const submitting = form.formState.isSubmitting;

  // BIC und Bankname werden automatisch befüllt,
  // solange das jeweilige Feld leer ist.
  const ibanRaw = form.watch("senderBankIban");
  const bankData = useMemo(() => {
    const cleaned = normalizeIban(ibanRaw ?? "");
    return cleaned.length === 0 ? null : bankDataByIBAN(cleaned);
  }, [ibanRaw]);
  useEffect(() => {
    if (bankData?.bic && !form.getValues("senderBankBic")) {
      form.setValue("senderBankBic", bankData.bic, {
        shouldValidate: false,
        shouldDirty: true,
      });
    }

    if (bankData?.bankName && !form.getValues("senderBankName")) {
      form.setValue("senderBankName", bankData.bankName, {
        shouldValidate: false,
        shouldDirty: true,
      });
    }
  }, [bankData, form]);

  const letterValues = {
    name: form.watch("senderName") ?? "",
    street: form.watch("senderAddressStreet") ?? "",
    postalCode: form.watch("senderAddressPostalCode") ?? "",
    city: form.watch("senderAddressCity") ?? "",
    phone: form.watch("senderPhone") ?? "",
    fax: form.watch("senderFax") ?? "",
    email: form.watch("senderEmail") ?? "",
  };

  return (
    <Form form={form} onSubmit={onSubmit}>
      <fieldset disabled={submitting} className="contents">
        <div>
          <SectionCard
            icon={RiContactsBook2Line}
            title={t("ui.settings.sender.sections.contact")}
            description={t("ui.settings.sender.sections.contactDescription")}
          >
            <div className="flex flex-col gap-4">
              <TextInput
                control={form.control}
                name="senderName"
                label={t("ui.settings.sender.fields.name")}
                placeholder={t("ui.settings.sender.fields.namePlaceholder")}
              />
              <TextInput
                control={form.control}
                name="senderAddressStreet"
                label={t("ui.settings.sender.fields.addressStreet")}
                placeholder={t(
                  "ui.settings.sender.fields.addressStreetPlaceholder",
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextInput
                  control={form.control}
                  name="senderAddressPostalCode"
                  label={t("ui.settings.sender.fields.addressPostalCode")}
                  inputMode="numeric"
                />
                <TextInput
                  control={form.control}
                  name="senderAddressCity"
                  label={t("ui.settings.sender.fields.addressCity")}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextInput
                  control={form.control}
                  name="senderPhone"
                  label={t("ui.settings.sender.fields.phone")}
                  placeholder={t("ui.settings.sender.fields.phonePlaceholder")}
                  optional={true}
                  inputMode="tel"
                />
                <TextInput
                  control={form.control}
                  name="senderEmail"
                  label={t("ui.settings.sender.fields.email")}
                  placeholder={t("ui.settings.sender.fields.emailPlaceholder")}
                  optional={true}
                  inputMode="email"
                  type="email"
                />
              </div>
              <Disclose label={t("ui.settings.sender.moreFields")}>
                <TextInput
                  control={form.control}
                  name="senderFax"
                  label={t("ui.settings.sender.fields.fax")}
                  placeholder={t("ui.settings.sender.fields.faxPlaceholder")}
                  optional={true}
                  inputMode="tel"
                />
              </Disclose>
            </div>
          </SectionCard>

          <SectionCard
            icon={RiBankLine}
            title={t("ui.settings.sender.sections.bank")}
            description={t("ui.settings.sender.sections.bankDescription")}
          >
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextInput
                  control={form.control}
                  name="senderBankIban"
                  label={t("ui.settings.sender.fields.bankIban")}
                  placeholder={t(
                    "ui.settings.sender.fields.bankIbanPlaceholder",
                  )}
                  inputClassName="tabular-nums"
                  optional={true}
                />
                <TextInput
                  control={form.control}
                  name="senderBankBic"
                  label={t("ui.settings.sender.fields.bankBic")}
                  placeholder={t(
                    "ui.settings.sender.fields.bankBicPlaceholder",
                  )}
                  inputClassName="tabular-nums"
                  optional={true}
                />
              </div>
              <TextInput
                control={form.control}
                name="senderBankName"
                label={t("ui.settings.sender.fields.bankName")}
                placeholder={t("ui.settings.sender.fields.bankNamePlaceholder")}
                optional={true}
              />
            </div>
          </SectionCard>

          <SenderLogoCard
            form={form}
            settings={settings}
            letterValues={letterValues}
            pendingLogo={pendingLogo}
            onPendingLogoChange={onPendingLogoChange}
            logoVersion={logoVersion}
          />
        </div>
      </fieldset>
      <Savebar
        dirty={form.formState.isDirty}
        submitting={submitting}
        onCancel={onCancel}
      />
    </Form>
  );
};
