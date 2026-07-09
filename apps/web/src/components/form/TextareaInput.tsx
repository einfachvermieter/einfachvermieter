import { type ComponentProps, type ReactNode, useId } from "react";
import {
  type Control,
  Controller,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { t } from "@/lib/i18n";

type TextareaProps = Omit<
  ComponentProps<typeof Textarea>,
  | "name"
  | "id"
  | "aria-invalid"
  | "aria-describedby"
  | "value"
  | "defaultValue"
  | "onChange"
  | "onBlur"
>;

type TextareaInputProps<T extends FieldValues> = TextareaProps & {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: ReactNode;
  optional?: boolean;
  fieldClassName?: string;
  textareaClassName?: string;
};

export const TextareaInput = <T extends FieldValues>({
  control,
  name,
  label,
  description,
  optional = false,
  fieldClassName,
  textareaClassName,
  ...textareaProps
}: TextareaInputProps<T>) => {
  const id = useId();
  const descriptionId = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={fieldClassName}>
          <FieldLabel htmlFor={id}>
            {label}
            {optional ? (
              <span className="font-normal text-slate-400 dark:text-slate-500">
                {t("ui.common.forms.optionalSuffix")}
              </span>
            ) : null}
          </FieldLabel>
          {description ? (
            <FieldDescription id={descriptionId}>
              {description}
            </FieldDescription>
          ) : null}
          <Textarea
            {...textareaProps}
            {...field}
            id={id}
            aria-invalid={fieldState.invalid}
            aria-describedby={description ? descriptionId : undefined}
            className={textareaClassName}
          />
          {fieldState.invalid ? (
            <FieldError errors={[fieldState.error]} />
          ) : null}
        </Field>
      )}
    />
  );
};
