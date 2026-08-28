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
  options: ChoiceTileOption[];
  columns?: 1 | 2 | 3;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
};

/**
 * Auswahl-Kacheln als Formularfeld
 */
export const ChoiceTilesInput = <T extends FieldValues>({
  control,
  name,
  label,
  description,
  options,
  columns = 2,
  disabled = false,
  onValueChange,
}: ChoiceTilesInputProps<T>) => {
  const descriptionId = useId();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          {label ? <FieldLabel>{label}</FieldLabel> : null}
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
          />
          {fieldState.invalid ? (
            <FieldError errors={[fieldState.error]} />
          ) : null}
        </Field>
      )}
    />
  );
};
