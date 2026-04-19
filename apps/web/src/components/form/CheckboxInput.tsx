import { useId } from "react";
import {
  type Control,
  Controller,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field, FieldLabel } from "@/components/ui/Field";

type CheckboxInputProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  disabled?: boolean;
  fieldClassName?: string;
};

export const CheckboxInput = <T extends FieldValues>({
  control,
  name,
  label,
  disabled = false,
  fieldClassName,
}: CheckboxInputProps<T>) => {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field orientation="horizontal" className={fieldClassName}>
          <Checkbox
            id={id}
            checked={field.value === true}
            onCheckedChange={(checked) => field.onChange(checked === true)}
            disabled={disabled}
          />
          <FieldLabel htmlFor={id} className="font-normal">
            {label}
          </FieldLabel>
        </Field>
      )}
    />
  );
};
