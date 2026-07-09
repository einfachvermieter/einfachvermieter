import { RiCalendar2Line } from "@remixicon/react";
import { de } from "date-fns/locale";
import { type ReactNode, useEffect, useId, useState } from "react";
import {
  type Control,
  type FieldPath,
  type FieldValues,
  useController,
} from "react-hook-form";
import { HelpHint } from "@/components/help/HelpHint";
import { Calendar } from "@/components/ui/Calendar";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/Field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/InputGroup";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import {
  dateToIso,
  formatIsoDateForDisplay,
  isoToDate,
  parseDisplayDateToIso,
} from "@/lib/dateInput";
import { t } from "@/lib/i18n";

type DateInputProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: ReactNode;
  labelHelp?: ReactNode;
  optional?: boolean;
  inputClassName?: string;
  disabled?: boolean;

  // Bereich nur für das Kalender-Popup
  // schränkt die manuelle Texteingabe nicht ein
  startMonth?: Date;
  endMonth?: Date;
};

export const DateInput = <T extends FieldValues>({
  control,
  name,
  label,
  description,
  labelHelp,
  optional = false,
  inputClassName,
  disabled = false,
  startMonth,
  endMonth,
}: DateInputProps<T>) => {
  const id = useId();
  const descriptionId = useId();
  const { field, fieldState } = useController({ control, name });
  const value = typeof field.value === "string" ? field.value : "";

  const [text, setText] = useState(() => formatIsoDateForDisplay(value));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setText(formatIsoDateForDisplay(value));
  }, [value]);

  const handleTextChange = (next: string) => {
    setText(next);
    const parsed = parseDisplayDateToIso(next);
    if (parsed === null) {
      return;
    }

    if (parsed !== value) {
      field.onChange(parsed);
    }

    if (parsed) {
      const display = formatIsoDateForDisplay(parsed);
      if (display && display !== next) {
        setText(display);
      }
    }
  };

  const handleBlur = () => {
    setText(formatIsoDateForDisplay(value));
    field.onBlur();
  };

  const selected = isoToDate(value);

  return (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional ? (
          <span className="font-normal text-slate-400 dark:text-slate-500">
            {t("ui.common.forms.optionalSuffix")}
          </span>
        ) : null}
        {labelHelp ? <HelpHint>{labelHelp}</HelpHint> : null}
      </FieldLabel>

      <InputGroup className={inputClassName}>
        <InputGroupInput
          id={id}
          name={field.name}
          value={text}
          placeholder={t("ui.common.forms.datePlaceholder")}
          onChange={(event) => handleTextChange(event.target.value)}
          onBlur={handleBlur}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && !open) {
              event.preventDefault();
              setOpen(true);
            }
          }}
          disabled={disabled}
          aria-invalid={fieldState.invalid}
          aria-describedby={description ? descriptionId : undefined}
          inputMode="numeric"
          autoComplete="off"
        />

        <InputGroupAddon align="inline-end">
          <Popover open={open} onOpenChange={setOpen} modal={true}>
            <PopoverTrigger asChild={true}>
              <InputGroupButton
                size="icon-xs"
                aria-label={t("ui.common.forms.dateOpenPicker")}
                disabled={disabled}
              >
                <RiCalendar2Line />
              </InputGroupButton>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto overflow-hidden p-0"
              align="end"
              alignOffset={-8}
              sideOffset={8}
            >
              <Calendar
                mode="single"
                locale={de}
                selected={selected}
                defaultMonth={selected}
                startMonth={startMonth}
                endMonth={endMonth}
                captionLayout="dropdown"
                onSelect={(picked) => {
                  if (picked) {
                    const iso = dateToIso(picked);
                    field.onChange(iso);
                    setText(formatIsoDateForDisplay(iso));
                  }
                  setOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </InputGroupAddon>
      </InputGroup>

      {description ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
    </Field>
  );
};
