import { type ReactNode, useId } from "react";
import {
  type Control,
  Controller,
  type FieldPath,
  type FieldValues,
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { t } from "@/lib/i18n";

export type SelectOption = {
  value: string;
  label: ReactNode;
};

type SelectInputProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  options: SelectOption[];
  description?: ReactNode;
  description2?: ReactNode;
  labelHelp?: ReactNode;
  optional?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  onValueChange?: (value: string) => void;
};

export const SelectInput = <T extends FieldValues>({
  control,
  name,
  label,
  options,
  description,
  description2,
  labelHelp,
  optional = false,
  disabled = false,
  placeholder,
  className,
  triggerClassName,
  onValueChange,
}: SelectInputProps<T>) => {
  const id = useId();
  const descriptionId = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field className={className} data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>
            {label}

            {optional ? (
              <span className="font-normal text-muted-foreground">
                {t("ui.common.forms.optionalSuffix")}
              </span>
            ) : null}

            {labelHelp ? <HelpHint>{labelHelp}</HelpHint> : null}
          </FieldLabel>

          {description ? (
            <FieldDescription id={descriptionId}>
              {description}
            </FieldDescription>
          ) : null}

          <Select
            name={field.name}
            value={field.value}
            onValueChange={(value) => {
              field.onChange(value);
              onValueChange?.(value);
            }}
            disabled={disabled}
          >
            <SelectTrigger
              id={id}
              aria-invalid={fieldState.invalid}
              aria-describedby={description ? descriptionId : undefined}
              className={triggerClassName ?? "w-full"}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent position="popper">
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {description2 ? (
            <FieldDescription id={descriptionId}>
              {description2}
            </FieldDescription>
          ) : null}

          {fieldState.invalid ? (
            <FieldError errors={[fieldState.error]} />
          ) : null}
        </Field>
      )}
    />
  );
};
