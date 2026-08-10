import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { SectionCard } from "@/components/common/SectionCard";
import { Form } from "@/components/form/Form";
import { Savebar } from "@/components/form/Savebar";
import type { Building } from "../../../../lib/buildings";
import { costTypeVisual } from "../../../../lib/domainVisuals";
import { t } from "../../../../lib/i18n";
import { CostTypeBaseFields } from "./CostTypeBaseFields";
import {
  type CostTypeFormValues,
  type CostTypeSubmitValues,
  costTypeFormSchema,
  costTypeFormToDto,
} from "./costTypeForm.schema";

export const CostTypeForm = ({
  mode,
  buildings,
  defaultValues,
  onSubmit,
  onCancel,
  savedAt,
  onBuildingChange,
}: {
  mode: "create" | "edit";
  buildings: Building[];
  defaultValues: CostTypeFormValues;
  onSubmit: (values: CostTypeSubmitValues) => Promise<void>;
  onCancel: () => void;
  /** Formatierter Speicherzeitpunkt für die Savebar (nur mode="edit") */
  savedAt?: string;

  /**
   * Meldet die aktuelle Gebäude-Auswahl nach außen, damit die
   * Kontext-Karte der Anlege-Seite dem Wechsel folgt
   */
  onBuildingChange?: (buildingId: string) => void;
}) => {
  const form = useForm<CostTypeFormValues>({
    resolver: zodResolver(costTypeFormSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  const submitting = form.formState.isSubmitting;

  const selectedBuildingId = form.watch("buildingId");
  useEffect(() => {
    onBuildingChange?.(selectedBuildingId);
  }, [onBuildingChange, selectedBuildingId]);

  const fields = (
    <fieldset disabled={submitting} className="contents">
      <CostTypeBaseFields
        form={form}
        buildings={buildings}
        buildingFieldDisabled={mode === "edit"}
      />
    </fieldset>
  );

  const visual = costTypeVisual(defaultValues);

  return (
    <Form
      form={form}
      onSubmit={(values) => onSubmit(costTypeFormToDto(values))}
    >
      <SectionCard
        icon={visual.icon}
        iconBackground={visual.gradient}
        title={t("ui.costs.detail.sectionTitle")}
        description={t("ui.costs.detail.sectionDescription")}
      >
        {fields}
      </SectionCard>
      <Savebar
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
