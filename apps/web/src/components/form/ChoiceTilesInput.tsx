import { type ReactNode, useId } from "react";
import {
  type Control,
  Controller,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import {
  type ChoiceTileOption,
  ChoiceTiles,
} from "@/components/form/ChoiceTiles";
import { HelpHint } from "@/components/help/HelpHint";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/Field";

type ChoiceTilesInputProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  description?: ReactNode;
  labelHelp?: ReactNode;
  options: ChoiceTileOption[];
  columns?: 1 | 2 | 3;
  disabled?: boolean;
  showIcons?: boolean;
  onValueChange?: (value: string) => void;
};

/**
 * Radio-Cards als Formularfeld
 */
export const ChoiceTilesInput = <T extends FieldValues>({
  control,
  name,
  label,
  description,
  labelHelp,
  options,
  columns = 2,
  disabled = false,
  showIcons = false,
  onValueChange,
}: ChoiceTilesInputProps<T>) => {
  const descriptionId = useId();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          {label ? (
            <FieldLabel>
              {label}
              {labelHelp ? <HelpHint>{labelHelp}</HelpHint> : null}
            </FieldLabel>
          ) : null}
          {description ? (
            <FieldDescription id={descriptionId}>
              {description}
            </FieldDescription>
          ) : null}
          <ChoiceTiles
            value={field.value}
            onValueChange={(value) => {
              field.onChange(value);
              onValueChange?.(value);
            }}
            options={options}
            columns={columns}
            disabled={disabled}
            showIcons={showIcons}
          />
          {fieldState.invalid ? (
            <FieldError errors={[fieldState.error]} />
          ) : null}
        </Field>
      )}
    />
  );
};
