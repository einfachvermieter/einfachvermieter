import {
  type BuildingCreateDto,
  buildingCreateSchema,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormSheet } from "@/components/form/FormSheet";
import { domainVisuals } from "../../../lib/domainVisuals";
import { t } from "../../../lib/i18n";
import { BuildingDataFields } from "../components/baseData/BuildingDataFields";

/**
 * Gebäude im FormSheet anlegen bzw. bearbeiten
 */
export const BuildingSheet = ({
  mode,
  defaultValues,
  onSubmit,
  onClose,
}: {
  mode: "create" | "edit";
  defaultValues: BuildingCreateDto;
  onSubmit: (values: BuildingCreateDto) => Promise<void>;
  onClose: () => void;
}) => {
  const form = useForm<BuildingCreateDto>({
    resolver: zodResolver(buildingCreateSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  return (
    <FormSheet
      form={form}
      icon={domainVisuals.buildings.icon}
      title={
        mode === "create"
          ? t("ui.buildings.createTitle")
          : t("ui.buildings.sections.baseData.title")
      }
      submitLabel={
        mode === "create"
          ? t("ui.common.action.create")
          : t("ui.common.action.save")
      }
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <BuildingDataFields form={form} />
    </FormSheet>
  );
};
