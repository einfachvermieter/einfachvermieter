import type { RemixiconComponentType } from "@remixicon/react";
import { type ReactNode, useId } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";

export type ChoiceTileOption = {
  value: string;
  icon?: RemixiconComponentType;
  title: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
};

type ChoiceTilesInputProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  /** Feld-Label über den Kacheln (optional) */
  label?: string;
  description?: ReactNode;
  options: ChoiceTileOption[];
  columns?: 1 | 2;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
};

/**
 * Auswahl als getönte Radio-Kacheln (Icon, Titel, Beschreibung) statt
 * Select oder blanker RadioGroup
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
  const baseId = useId();
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
          <RadioGroup
            columns={columns}
            value={field.value}
            onValueChange={(value) => {
              field.onChange(value);
              onValueChange?.(value);
            }}
            disabled={disabled}
          >
            {options.map((option) => {
              const Icon = option.icon;
              const optionId = `${baseId}-${option.value}`;
              return (
                <label
                  key={option.value}
                  htmlFor={optionId}
                  className="block cursor-pointer rounded-[13px] border-[1.5px] border-input bg-card px-4 py-3.5 transition hover:border-slate-400 has-data-checked:border-sky-700 has-data-checked:bg-sky-50 has-data-disabled:cursor-not-allowed has-data-disabled:opacity-60 has-data-disabled:hover:border-input has-data-checked:**:data-[slot=tile-icon]:text-sky-700"
                >
                  <RadioGroupItem
                    id={optionId}
                    value={option.value}
                    disabled={option.disabled}
                    className="sr-only"
                  />
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {Icon ? (
                      <Icon
                        data-slot="tile-icon"
                        className="size-4.25 shrink-0 text-slate-400"
                      />
                    ) : null}
                    {option.title}
                  </span>
                  {option.description ? (
                    <span className="mt-1 block text-[12.5px] leading-normal text-slate-400">
                      {option.description}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </RadioGroup>
          {fieldState.invalid ? (
            <FieldError errors={[fieldState.error]} />
          ) : null}
        </Field>
      )}
    />
  );
};
