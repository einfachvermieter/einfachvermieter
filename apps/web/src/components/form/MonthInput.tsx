import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCalendar2Line,
} from "@remixicon/react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { type ReactNode, useEffect, useId, useState } from "react";
import {
  type Control,
  type FieldPath,
  type FieldValues,
  useController,
} from "react-hook-form";
import { HelpHint } from "@/components/help/HelpHint";
import { Button } from "@/components/ui/Button";
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
  formatIsoMonthForDisplay,
  isoForMonthBoundary,
  isoToDate,
  parseDisplayMonthToIso,
} from "@/lib/dateInput";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type MonthBoundary = "start" | "end";

type MonthInputProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: ReactNode;
  labelHelp?: ReactNode;
  optional?: boolean;
  inputClassName?: string;
  disabled?: boolean;
  /**
   * Bildet den gewählten Monat im ISO-Wert auf seinen
   * ersten ("start") oder letzten Tag ("end") ab.
   */
  boundary?: MonthBoundary;
};

export const MonthInput = <T extends FieldValues>({
  control,
  name,
  label,
  description,
  labelHelp,
  optional = false,
  inputClassName,
  disabled = false,
  boundary = "start",
}: MonthInputProps<T>) => {
  const id = useId();
  const descriptionId = useId();
  const { field, fieldState } = useController({ control, name });
  const value = typeof field.value === "string" ? field.value : "";

  const [text, setText] = useState(() => formatIsoMonthForDisplay(value));
  const [open, setOpen] = useState(false);
  const today = new Date();
  const selected = isoToDate(value);
  const [pickerYear, setPickerYear] = useState(
    () => selected?.getFullYear() ?? today.getFullYear(),
  );

  useEffect(() => {
    setText(formatIsoMonthForDisplay(value));
  }, [value]);

  useEffect(() => {
    if (open) {
      setPickerYear(selected?.getFullYear() ?? today.getFullYear());
    }
  }, [open, selected, today.getFullYear]);

  const handleTextChange = (next: string) => {
    setText(next);
    const parsed = parseDisplayMonthToIso(next, boundary);
    if (parsed === null) {
      return;
    }

    if (parsed !== value) {
      field.onChange(parsed);
    }
  };

  const handleBlur = () => {
    setText(formatIsoMonthForDisplay(value));
    field.onBlur();
  };

  const handleMonthPick = (monthIndex: number) => {
    const iso = isoForMonthBoundary(pickerYear, monthIndex, boundary);
    field.onChange(iso);
    setText(formatIsoMonthForDisplay(iso));
    setOpen(false);
  };

  const monthLabels = Array.from({ length: 12 }, (_, monthIndex) =>
    format(new Date(2000, monthIndex, 1), "LLL", { locale: de }),
  );

  return (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional ? (
          <span className="font-normal text-muted-foreground">
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
          placeholder={t("ui.common.forms.monthPlaceholder")}
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
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild={true}>
              <InputGroupButton
                size="icon-xs"
                aria-label={t("ui.common.forms.monthOpenPicker")}
                disabled={disabled}
              >
                <RiCalendar2Line />
              </InputGroupButton>
            </PopoverTrigger>
            <PopoverContent
              className="w-64 p-3"
              align="end"
              alignOffset={-8}
              sideOffset={8}
            >
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("ui.common.forms.monthPreviousYear")}
                  onClick={() => setPickerYear((year) => year - 1)}
                >
                  <RiArrowLeftSLine />
                </Button>
                <span className="text-sm font-medium tabular-nums">
                  {pickerYear}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("ui.common.forms.monthNextYear")}
                  onClick={() => setPickerYear((year) => year + 1)}
                >
                  <RiArrowRightSLine />
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {monthLabels.map((monthLabel, monthIndex) => {
                  const isSelected =
                    selected !== undefined &&
                    selected.getFullYear() === pickerYear &&
                    selected.getMonth() === monthIndex;
                  return (
                    <Button
                      key={monthLabel}
                      type="button"
                      variant={isSelected ? "default" : "ghost"}
                      size="sm"
                      className={cn("h-9", !isSelected && "text-foreground")}
                      onClick={() => handleMonthPick(monthIndex)}
                    >
                      {monthLabel}
                    </Button>
                  );
                })}
              </div>
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
