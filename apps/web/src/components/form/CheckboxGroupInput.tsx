import { type ReactNode, useId } from "react";
import {
  type Control,
  Controller,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/Field";
import { t } from "@/lib/i18n";

export type CheckboxGroupOption = {
  value: string;
  label: ReactNode;
  description?: ReactNode;
};

type CheckboxGroupInputProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  options: CheckboxGroupOption[];
  description?: ReactNode;
  emptyMessage?: ReactNode;
  optional?: boolean;
  disabled?: boolean;
  className?: string;
};

export const CheckboxGroupInput = <T extends FieldValues>({
  control,
  name,
  label,
  options,
  description,
  emptyMessage,
  optional = false,
  disabled = false,
  className,
}: CheckboxGroupInputProps<T>) => {
  const groupId = useId();
  const descriptionId = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selected = new Set<string>(
          Array.isArray(field.value) ? (field.value as string[]) : [],
        );

        const toggle = (value: string, checked: boolean) => {
          const next = new Set(selected);
          if (checked) {
            next.add(value);
          } else {
            next.delete(value);
          }
          field.onChange(Array.from(next));
        };

        return (
          <FieldSet
            className={className}
            data-invalid={fieldState.invalid}
            aria-describedby={description ? descriptionId : undefined}
          >
            <FieldLegend variant="label">
              {label}
              {optional ? (
                <span className="font-normal text-slate-400 dark:text-slate-500">
                  {t("ui.common.forms.optionalSuffix")}
                </span>
              ) : null}
            </FieldLegend>
            {description ? (
              <FieldDescription id={descriptionId}>
                {description}
              </FieldDescription>
            ) : null}
            {options.length === 0 ? (
              <Alert variant="info">
                <AlertDescription>{emptyMessage ?? null}</AlertDescription>
              </Alert>
            ) : (
              <div data-slot="checkbox-group" className="flex flex-col gap-2">
                {options.map((option) => {
                  const id = `${groupId}-${option.value}`;
                  return (
                    <Field key={option.value} orientation="horizontal">
                      <Checkbox
                        id={id}
                        name={field.name}
                        checked={selected.has(option.value)}
                        onCheckedChange={(checked) =>
                          toggle(option.value, checked === true)
                        }
                        disabled={disabled}
                      />
                      <FieldLabel htmlFor={id} className="font-normal">
                        {option.label}
                        {option.description ? (
                          <span className="block text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        ) : null}
                      </FieldLabel>
                    </Field>
                  );
                })}
              </div>
            )}

            {fieldState.invalid ? (
              <FieldError errors={[fieldState.error]} />
            ) : null}
          </FieldSet>
        );
      }}
    />
  );
};
