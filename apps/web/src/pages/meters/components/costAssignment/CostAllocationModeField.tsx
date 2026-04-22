import type { MeterFormValues } from "@einfachvermieter/shared";
import { useId } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/Field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import { t } from "../../../../lib/i18n";

export const CostAllocationModeField = ({
  form,
  locked = false,
}: {
  form: UseFormReturn<MeterFormValues>;
  locked?: boolean;
}) => {
  const heatingId = useId();
  const costTypesId = useId();
  return (
    <Controller
      control={form.control}
      name="costAllocationMode"
      render={({ field }) => (
        <div className="flex flex-col gap-3">
          <RadioGroup
            value={field.value}
            onValueChange={field.onChange}
            columns={2}
          >
            <FieldLabel htmlFor={costTypesId}>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>
                    {t("ui.meters.costAllocationMode.costTypes.title")}
                  </FieldTitle>
                  <FieldDescription>
                    {t("ui.meters.costAllocationMode.costTypes.description")}
                  </FieldDescription>
                </FieldContent>
                <RadioGroupItem
                  value="cost_types"
                  id={costTypesId}
                  disabled={locked && field.value !== "cost_types"}
                />
              </Field>
            </FieldLabel>
            <FieldLabel htmlFor={heatingId}>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>
                    {t("ui.meters.costAllocationMode.heatingCostBill.title")}
                  </FieldTitle>
                  <FieldDescription>
                    {t(
                      "ui.meters.costAllocationMode.heatingCostBill.description",
                    )}
                  </FieldDescription>
                </FieldContent>
                <RadioGroupItem
                  value="heating_cost_bill"
                  id={heatingId}
                  disabled={locked && field.value !== "heating_cost_bill"}
                />
              </Field>
            </FieldLabel>
          </RadioGroup>
          {locked ? (
            <p className="text-sm text-muted-foreground">
              {t("ui.meters.costAllocationMode.lockedHint")}
            </p>
          ) : null}
        </div>
      )}
    />
  );
};
