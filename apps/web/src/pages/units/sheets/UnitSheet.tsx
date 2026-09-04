import {
  type UnitCreateDto,
  type UnitFormValues,
  unitFormSchema,
  unitFormToDto,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormSheet } from "@/components/form/FormSheet";
import { domainVisuals } from "../../../lib/domainVisuals";
import { t } from "../../../lib/i18n";
import { UnitDataFields } from "../components/baseData/UnitDataFields";

/**
 * Wohnung im FormSheet anlegen bzw. bearbeiten
 */
export const UnitSheet = ({
  mode,
  defaultValues,
  onSubmit,
  onClose,
}: {
  mode: "create" | "edit";
  defaultValues: UnitFormValues;
  onSubmit: (values: UnitCreateDto) => Promise<void>;
  onClose: () => void;
}) => {
  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitFormSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  return (
    <FormSheet
      form={form}
      icon={domainVisuals.units.icon}
      title={
        mode === "create"
          ? t("ui.units.createTitle")
          : t("ui.units.sections.baseData.title")
      }
      submitLabel={
        mode === "create"
          ? t("ui.common.action.create")
          : t("ui.common.action.save")
      }
      onSubmit={(values) => onSubmit(unitFormToDto(values))}
      onClose={onClose}
    >
      <UnitDataFields form={form} />
    </FormSheet>
  );
};
