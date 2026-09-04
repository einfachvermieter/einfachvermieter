import {
  type HeatingFormValues,
  heatingFormSchema,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiFireLine } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { FormSheet } from "@/components/form/FormSheet";
import { t } from "../../../lib/i18n";
import type { Meter } from "../../../lib/meters";
import { HeatingInstallationFields } from "../components/settings/HeatingInstallationFields";

/**
 * Heizungsanlage der Konfiguration bearbeiten. Das Formular hält den
 * kompletten Wertesatz, zeigt aber nur die Anlagen-Felder.
 */
export const HeatingInstallationSheet = ({
  defaultValues,
  hotWaterMeterCandidates,
  onSubmit,
  onClose,
}: {
  defaultValues: HeatingFormValues;
  hotWaterMeterCandidates: Meter[];
  onSubmit: (values: HeatingFormValues) => Promise<void>;
  onClose: () => void;
}) => {
  const form = useForm<HeatingFormValues>({
    resolver: zodResolver(heatingFormSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  return (
    <FormSheet
      form={form}
      icon={RiFireLine}
      title={t("ui.heating.installation.title")}
      submitLabel={t("ui.common.action.save")}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <HeatingInstallationFields
        form={form}
        hotWaterMeterCandidates={hotWaterMeterCandidates}
      />
    </FormSheet>
  );
};
