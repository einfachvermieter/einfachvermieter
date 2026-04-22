import {
  type MeterCreateDto,
  type MeterFormValues,
  meterFormSchema,
  meterFormToDto,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form } from "@/components/form/Form";
import { FormActions } from "@/components/form/FormActions";
import { Card, CardContent } from "@/components/ui/Card";
import type { Building } from "../../lib/buildings";
import type { CostType } from "../../lib/costs";
import { t } from "../../lib/i18n";
import type { Unit } from "../../lib/units";
import { MeterBaseFields } from "./components/baseData/MeterBaseFields";
import { CostAllocationModeField } from "./components/costAssignment/CostAllocationModeField";
import { CostTypeAssignment } from "./components/costAssignment/CostTypeAssignment";
import { DifferenceConfigCard } from "./components/differenceConfig/DifferenceConfigCard";
import { GasFactorsCard } from "./components/gasFactors/GasFactorsCard";
import { HkvFields } from "./components/hkv/HkvFields";

export const MeterForm = ({
  mode,
  buildings,
  units,
  costTypes,
  defaultValues,
  costAllocationModeLocked = false,
  currentMeterId,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  buildings: Building[];
  units: Unit[];
  costTypes: CostType[];
  defaultValues: MeterFormValues;
  costAllocationModeLocked?: boolean;
  currentMeterId?: string;
  onSubmit: (values: MeterCreateDto) => Promise<void>;
  onCancel: () => void;
}) => {
  const form = useForm<MeterFormValues>({
    resolver: zodResolver(meterFormSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  const submitting = form.formState.isSubmitting;
  const selectedType = form.watch("type");
  const selectedRole = form.watch("role");
  const costAllocationMode = form.watch("costAllocationMode");
  const isGas = selectedType === "gas";
  const isHkv = selectedType === "heat_cost_allocator";
  const isVirtual = selectedRole === "virtual_difference";

  const onTypeChange = (newType: string) => {
    if (newType !== "gas") {
      form.setValue("gasFactors", []);
    }

    if (newType !== "heat_cost_allocator") {
      form.setValue("radiator", "");
      form.setValue("kTotal", "");
      form.setValue("radiatorManufacturer", "");
      form.setValue("radiatorModel", "");
      form.setValue("radiatorType", "");
      form.setValue("radiatorDimensions", "");
    }

    // Quellen sind typgebunden, bei Type-Wechsel verwerfen.
    form.setValue("baseMeterId", "");
    form.setValue("subtractedMeterIds", []);
  };

  return (
    <Form form={form} onSubmit={(values) => onSubmit(meterFormToDto(values))}>
      <fieldset disabled={submitting} className="contents">
        <MeterBaseFields
          form={form}
          buildings={buildings}
          units={units}
          buildingFieldDisabled={mode === "edit"}
          onTypeChange={onTypeChange}
        />
        {isGas ? <GasFactorsCard form={form} /> : null}
        {isHkv ? <HkvFields form={form} /> : null}
        {isVirtual ? (
          <DifferenceConfigCard form={form} currentMeterId={currentMeterId} />
        ) : null}
        {isHkv ? null : (
          <Card>
            <CardContent className="flex flex-col gap-6">
              <CostAllocationModeField
                form={form}
                locked={costAllocationModeLocked}
              />
              {costAllocationMode === "cost_types" ? (
                <CostTypeAssignment form={form} costTypes={costTypes} />
              ) : null}
            </CardContent>
          </Card>
        )}
      </fieldset>
      <FormActions
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
