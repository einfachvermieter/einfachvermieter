import {
  type SenderSettingsUpdateDto,
  senderSettingsUpdateSchema,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiBankLine, RiContactsBook2Line, RiImageLine } from "@remixicon/react";
import type { BankData } from "bankdata-germany";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Disclose } from "@/components/common/Disclose";
import { SectionCard } from "@/components/common/SectionCard";
import { Spinner } from "@/components/common/Spinner";
import { CheckboxInput } from "@/components/form/CheckboxInput";
import { Form } from "@/components/form/Form";
import { Savebar } from "@/components/form/Savebar";
import { TextInput } from "@/components/form/TextInput";
import { Button } from "@/components/ui/Button";
import { FieldDescription } from "@/components/ui/Field";
import { gradients } from "@/lib/domainVisuals";
import { t } from "@/lib/i18n";
import type { PendingLogo, SenderSettings } from "@/lib/senderSettings";
import { SenderLogoSection } from "./SenderLogoSection";
import { SenderSettingsSidebar } from "./SenderSettingsSidebar";

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
  const [bankData, setBankData] = useState<BankData | null>(null);
  useEffect(() => {
    const cleaned = normalizeIban(ibanRaw ?? "");
    if (cleaned.length === 0) {
      setBankData(null);
      return;
    }
    let cancelled = false;
    // BLZ-Verzeichnis erst beim Tippen laden (Chunk)
    import("bankdata-germany")
      .then(({ bankDataByIBAN }) => {
        if (!cancelled) {
          setBankData(bankDataByIBAN(cleaned));
        }
      })
      .catch(() => setBankData(null));
    return () => {
      cancelled = true;
    };
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
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
          <div>
            <SectionCard
              icon={RiContactsBook2Line}
              iconBackground={gradients.buildings}
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
                    placeholder={t(
                      "ui.settings.sender.fields.phonePlaceholder",
                    )}
                    optional={true}
                    inputMode="tel"
                  />
                  <TextInput
                    control={form.control}
                    name="senderEmail"
                    label={t("ui.settings.sender.fields.email")}
                    placeholder={t(
                      "ui.settings.sender.fields.emailPlaceholder",
                    )}
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
              iconBackground={gradients.money}
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
                  placeholder={t(
                    "ui.settings.sender.fields.bankNamePlaceholder",
                  )}
                  optional={true}
                />
              </div>
            </SectionCard>

            <SectionCard
              icon={RiImageLine}
              iconBackground={gradients.statements}
              title={t("ui.settings.sender.logo.title")}
              description={t("ui.settings.sender.logo.description")}
            >
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
            </SectionCard>
          </div>

          <SenderSettingsSidebar />
        </div>
      </fieldset>
      <Savebar>
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
    </Form>
  );
};
