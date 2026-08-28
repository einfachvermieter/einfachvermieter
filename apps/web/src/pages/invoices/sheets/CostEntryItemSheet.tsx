import { zodResolver } from "@hookform/resolvers/zod";
import { RiListCheck2 } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { FormSheet } from "@/components/form/FormSheet";
import type { CostType } from "../../../lib/costs";
import { t } from "../../../lib/i18n";
import type { Unit } from "../../../lib/units";
import { CostEntryItemFields } from "../components/baseData/CostEntryItemFields";
import {
  type CostEntryFormValues,
  type CostEntryItemFormValues,
  costEntryFormSchema,
} from "../components/baseData/costEntryForm.schema";

/**
 * Eine Rechnungsposition im FormSheet. Das Formular trägt die Rechnung mit
 * genau dieser Position, damit dieselbe Prüfung wie beim Anlegen greift.
 */
export const CostEntryItemSheet = ({
  title,
  defaultValues,
  costTypes,
  units,
  onSubmit,
  onClose,
}: {
  title: string;
  defaultValues: CostEntryFormValues;
  costTypes: CostType[];
  units: Unit[];
  onSubmit: (item: CostEntryItemFormValues) => Promise<void>;
  onClose: () => void;
}) => {
  const form = useForm<CostEntryFormValues>({
    resolver: zodResolver(costEntryFormSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  return (
    <FormSheet
      form={form}
      icon={RiListCheck2}
      title={title}
      submitLabel={t("ui.common.action.save")}
      onSubmit={async (values) => {
        const [item] = values.items;
        if (item) {
          await onSubmit(item);
        }
      }}
      onClose={onClose}
    >
      <CostEntryItemFields
        form={form}
        index={0}
        costTypes={costTypes}
        units={units}
      />
    </FormSheet>
  );
};
