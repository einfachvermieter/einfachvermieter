import {
  type UnitCreateDto,
  type UnitFormValues,
  unitFormSchema,
  unitFormToDto,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { SectionCard } from "@/components/common/SectionCard";
import { Form } from "@/components/form/Form";
import { Savebar } from "@/components/form/Savebar";
import { domainVisuals } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { UnitDataFields } from "./components/baseData/UnitDataFields";

export const UnitForm = ({
  mode,
  defaultValues,
  onSubmit,
  onCancel,
  savedAt,
}: {
  mode: "create" | "edit";
  defaultValues: UnitFormValues;
  onSubmit: (values: UnitCreateDto) => Promise<void>;
  onCancel: () => void;

  /**
   * Formatierter Speicherzeitpunkt für die Savebar (nur mode="edit")
   */
  savedAt?: string;
}) => {
  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitFormSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  const submitting = form.formState.isSubmitting;

  const fields = (
    <fieldset disabled={submitting} className="contents">
      <UnitDataFields form={form} />
    </fieldset>
  );

  return (
    <Form form={form} onSubmit={(values) => onSubmit(unitFormToDto(values))}>
      <SectionCard
        icon={domainVisuals.units.icon}
        title={t("ui.units.sections.baseData.title")}
      >
        {fields}
      </SectionCard>
      <Savebar
        dirty={form.formState.isDirty}
        savedAt={savedAt}
        submitting={submitting}
        onCancel={onCancel}
        submitLabel={
          mode === "create"
            ? t("ui.common.action.add")
            : t("ui.common.action.save")
        }
      />
    </Form>
  );
};
