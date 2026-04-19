import { type ComponentProps, type ReactNode, useId } from "react";
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
import { Input } from "@/components/ui/Input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/InputGroup";
import { t } from "@/lib/i18n";

type InputProps = Omit<
  ComponentProps<typeof Input>,
  | "name"
  | "id"
  | "aria-invalid"
  | "aria-describedby"
  | "value"
  | "defaultValue"
  | "onChange"
  | "onBlur"
>;

type TextInputProps<T extends FieldValues> = InputProps & {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  descriptionAbove?: ReactNode;
  description?: ReactNode;
  labelHelp?: ReactNode;
  suffix?: ReactNode;
  optional?: boolean;
  required?: boolean;
  inputClassName?: string;
};

export const TextInput = <T extends FieldValues>({
  control,
  name,
  label,
  descriptionAbove,
  description,
  labelHelp,
  suffix,
  optional = false,
  required = false,
  inputClassName,
  ...inputProps
}: TextInputProps<T>) => {
  const id = useId();
  const descriptionAboveId = useId();
  const descriptionId = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>
            {label}
            {optional ? (
              <span className="font-normal text-muted-foreground">
                {t("ui.common.forms.optionalSuffix")}
              </span>
            ) : null}
            {required ? (
              <span aria-hidden="true" className="text-destructive">
                {t("ui.common.forms.requiredMarker")}
              </span>
            ) : null}
            {labelHelp ? <HelpHint>{labelHelp}</HelpHint> : null}
          </FieldLabel>

          {descriptionAbove ? (
            <FieldDescription id={descriptionAboveId}>
              {descriptionAbove}
            </FieldDescription>
          ) : null}

          {suffix ? (
            <InputGroup className={inputClassName}>
              <InputGroupInput
                {...inputProps}
                {...field}
                id={id}
                aria-invalid={fieldState.invalid}
                aria-describedby={description ? descriptionId : undefined}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>{suffix}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          ) : (
            <Input
              {...inputProps}
              {...field}
              id={id}
              aria-invalid={fieldState.invalid}
              aria-describedby={description ? descriptionId : undefined}
              className={inputClassName}
            />
          )}

          {description ? (
            <FieldDescription id={descriptionId}>
              {description}
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
