import { useId } from "react";
import {
  type Control,
  Controller,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Field, FieldLabel } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";

type SwitchInputProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  /** Erklärtext unter dem Label */
  description?: string;
  disabled?: boolean;
  fieldClassName?: string;
};

/**
 * react-hook-form-Anbindung für den shadcn-Switch (Toggle-Zeile) */
export const SwitchInput = <T extends FieldValues>({
  control,
  name,
  label,
  description,
  disabled = false,
  fieldClassName,
}: SwitchInputProps<T>) => {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field orientation="horizontal" className={fieldClassName}>
          <Switch
            id={id}
            checked={field.value === true}
            onCheckedChange={(checked) => field.onChange(checked === true)}
            disabled={disabled}
          />
          <div className="min-w-0">
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {description ? (
              <p className="mt-0.5 text-xs text-slate-400">{description}</p>
            ) : null}
          </div>
        </Field>
      )}
    />
  );
};
