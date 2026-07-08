import { type ReactNode, useId } from "react";
import {
  type Control,
  Controller,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { t } from "@/lib/i18n";

export type SwitchGroupOption = {
  value: string;
  label: ReactNode;
  description?: ReactNode;
};

type SwitchGroupInputProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  options: SwitchGroupOption[];
  description?: ReactNode;
  emptyMessage?: ReactNode;
  optional?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Mehrfachauswahl als Switch-Zeilen-Liste (Titel + Beschreibung links,
 * iOS-Toggle rechts) statt Checkbox-Gruppe. Gleiche Feld-Anbindung wie
 * CheckboxGroupInput, nur andere Optik.
 */
export const SwitchGroupInput = <T extends FieldValues>({
  control,
  name,
  label,
  options,
  description,
  emptyMessage,
  optional = false,
  disabled = false,
  className,
}: SwitchGroupInputProps<T>) => {
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
                <span className="font-normal text-muted-foreground">
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
              <div data-slot="switch-group" className="flex flex-col gap-3">
                {options.map((option) => {
                  const id = `${groupId}-${option.value}`;
                  return (
                    <Field key={option.value} orientation="horizontal">
                      <Switch
                        id={id}
                        name={field.name}
                        checked={selected.has(option.value)}
                        onCheckedChange={(checked) =>
                          toggle(option.value, checked === true)
                        }
                        disabled={disabled}
                      />
                      <div className="min-w-0">
                        <FieldLabel htmlFor={id}>{option.label}</FieldLabel>
                        {option.description ? (
                          <p className="mt-0.5 text-xs text-slate-400">
                            {option.description}
                          </p>
                        ) : null}
                      </div>
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
