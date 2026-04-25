import {
  type SenderSettingsUpdateDto,
  senderSettingsUpdateSchema,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { bankDataByIBAN } from "bankdata-germany";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { CheckboxInput } from "@/components/form/CheckboxInput";
import { Form } from "@/components/form/Form";
import { FormActions } from "@/components/form/FormActions";
import { TextInput } from "@/components/form/TextInput";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldDescription } from "@/components/ui/Field";
import { t } from "@/lib/i18n";
import type { PendingLogo, SenderSettings } from "@/lib/senderSettings";
import { SenderLogoSection } from "./SenderLogoSection";

const normalizeIban = (raw: string): string =>
  raw.replace(/\s+/gu, "").toUpperCase();

type SenderSettingsFormProps = {
  settings: SenderSettings;
  defaultValues: SenderSettingsUpdateDto;
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

  // IBAN-getriebene Bankerkennung: BIC und Bankname werden automatisch
  // befüllt, solange das jeweilige Feld leer ist. Funktioniert nur für
  // deutsche IBANs.
  const ibanRaw = form.watch("senderBankIban");
  const bankData = useMemo(() => {
    const cleaned = normalizeIban(ibanRaw ?? "");

    if (cleaned.length === 0) {
      return null;
    }

    return bankDataByIBAN(cleaned);
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

  return (
    <Form form={form} onSubmit={onSubmit}>
      <fieldset disabled={submitting} className="contents">
        <Card>
          <CardHeader>
            <CardTitle>{t("ui.settings.sender.sections.contact")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                name="senderFax"
                label={t("ui.settings.sender.fields.fax")}
                placeholder={t("ui.settings.sender.fields.faxPlaceholder")}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("ui.settings.sender.sections.bank")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextInput
                control={form.control}
                name="senderBankIban"
                label={t("ui.settings.sender.fields.bankIban")}
                placeholder={t("ui.settings.sender.fields.bankIbanPlaceholder")}
                inputClassName="tabular-nums"
                optional={true}
              />
              <TextInput
                control={form.control}
                name="senderBankBic"
                label={t("ui.settings.sender.fields.bankBic")}
                placeholder={t("ui.settings.sender.fields.bankBicPlaceholder")}
                inputClassName="tabular-nums"
                optional={true}
              />
              <TextInput
                control={form.control}
                name="senderBankName"
                label={t("ui.settings.sender.fields.bankName")}
                placeholder={t("ui.settings.sender.fields.bankNamePlaceholder")}
                optional={true}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("ui.settings.sender.logo.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <CheckboxInput
                  control={form.control}
                  name="useLogo"
                  label={t("ui.settings.sender.fields.useLogo")}
                />
                <FieldDescription>
                  {t("ui.settings.sender.fields.useLogoDescription")}
                </FieldDescription>
              </div>
              <SenderLogoSection
                settings={settings}
                pendingLogo={pendingLogo}
                onPendingLogoChange={onPendingLogoChange}
                logoVersion={logoVersion}
              />
            </div>
          </CardContent>
        </Card>
      </fieldset>
      <FormActions
        submitting={submitting}
        onCancel={onCancel}
        submitLabel={t("ui.common.action.save")}
      />
    </Form>
  );
};
