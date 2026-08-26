import { type ReactNode, useId } from "react";
import {
  type Control,
  Controller,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { HelpHint } from "@/components/help/HelpHint";
import { Field, FieldLabel } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";

type SwitchInputProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  /**
   * Erklärtext unter dem Label
   */
  description?: string;
  /**
   * Ausführlichere Hilfe hinter einem Fragezeichen neben dem Label
   */
  labelHelp?: ReactNode;
  labelBadge?: ReactNode;
  disabled?: boolean;
  fieldClassName?: string;
};

/**
 * react-hook-form-Anbindung für den shadcn-Switch (Toggle-Zeile)
 */
export const SwitchInput = <T extends FieldValues>({
  control,
  name,
  label,
  description,
  labelHelp,
  labelBadge,
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
            <FieldLabel htmlFor={id}>
              {label}
              {labelBadge}
              {labelHelp ? <HelpHint>{labelHelp}</HelpHint> : null}
            </FieldLabel>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </Field>
      )}
    />
  );
};
