import { useId } from "react";
import {
  type Control,
  Controller,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { HelpHint } from "@/components/help/HelpHint";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/Field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { allocationKeyGroups, allocationLabel } from "../../../../lib/costs";
import { t } from "../../../../lib/i18n";

export const AllocationKeySelectField = <T extends FieldValues>({
  control,
  name,
}: {
  control: Control<T>;
  name: Path<T>;
}) => {
  const fieldId = useId();
  const descriptionId = useId();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={fieldId}>
            {t("ui.common.columns.allocation")}
            <HelpHint>{t("ui.costs.typeFields.allocationKeyHelp")}</HelpHint>
          </FieldLabel>
          <Select
            name={field.name}
            value={field.value}
            onValueChange={field.onChange}
          >
            <SelectTrigger
              id={fieldId}
              aria-invalid={fieldState.invalid}
              aria-describedby={descriptionId}
              className="w-full"
            >
              <SelectValue
                placeholder={t("ui.costs.typeFields.allocationKeyPlaceholder")}
              />
            </SelectTrigger>
            <SelectContent position="popper">
              {allocationKeyGroups.map((group, idx) => (
                <SelectGroup key={group.labelKey}>
                  {idx > 0 ? <SelectSeparator /> : null}
                  <SelectLabel>{t(group.labelKey)}</SelectLabel>
                  {group.keys.map((value) => (
                    <SelectItem key={value} value={value}>
                      {allocationLabel(value)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription id={descriptionId}>
            {t("ui.costs.typeFields.allocationKeyDescription")}
          </FieldDescription>
          {fieldState.invalid ? (
            <FieldError errors={[fieldState.error]} />
          ) : null}
        </Field>
      )}
    />
  );
};
