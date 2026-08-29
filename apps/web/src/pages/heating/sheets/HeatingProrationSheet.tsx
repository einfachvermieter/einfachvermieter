import {
  type HeatingFormValues,
  heatingFormSchema,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiCalendarLine } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { FormSheet } from "@/components/form/FormSheet";
import { t } from "../../../lib/i18n";
import { HeatingProrationFields } from "../components/settings/HeatingProrationFields";

/**
 * Aufteilung bei Mieterwechsel bearbeiten. Das Formular hält den kompletten
 * Wertesatz, zeigt aber nur das Verfahren.
 */
export const HeatingProrationSheet = ({
  defaultValues,
  onSubmit,
  onClose,
}: {
  defaultValues: HeatingFormValues;
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
      icon={RiCalendarLine}
      title={t("ui.heating.cards.proration")}
      submitLabel={t("ui.common.action.save")}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <HeatingProrationFields form={form} />
    </FormSheet>
  );
};
