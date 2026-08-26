import { formatDate, meterReadBySources } from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { DateInput } from "@/components/form/DateInput";
import { Form } from "@/components/form/Form";
import { FormActions } from "@/components/form/FormActions";
import { SelectInput } from "@/components/form/SelectInput";
import { SwitchInput } from "@/components/form/SwitchInput";
import { TextareaInput } from "@/components/form/TextareaInput";
import { TextInput } from "@/components/form/TextInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { FieldGroup } from "@/components/ui/Field";
import { t } from "../../../../lib/i18n";
import {
  type ReadingFormValues,
  type ReadingSubmitValues,
  readingFormSchema,
  readingFormToSubmit,
} from "./readingForm.schema";

const today = new Date();
const calendarStart = new Date(today.getFullYear() - 20, 0, 1);

export const ReadingForm = ({
  defaultValues,
  onSubmit,
  onCancel,
  submitting = false,
  warnIfBefore = null,
  otherReadings = [],
  settledPeriods = [],
}: {
  defaultValues: ReadingFormValues;
  onSubmit: (values: ReadingSubmitValues) => Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
  warnIfBefore?: string | null;
  /**
   * Übrige Ablesungen desselben Zählers (ohne den gerade bearbeiteten)
   */
  otherReadings?: { readingDate: string; value: number }[];

  /**
   * Zeiträume festgeschriebener Abrechnungen
   */
  settledPeriods?: { start: string; end: string }[];
}) => {
  const form = useForm<ReadingFormValues>({
    resolver: zodResolver(readingFormSchema),
    defaultValues,
  });

  const watchedDate = form.watch("readingDate");
  const watchedValue = form.watch("value");
  const showOlderWarning =
    warnIfBefore !== null && watchedDate !== "" && watchedDate < warnIfBefore;

  const parsedValue = Number.parseFloat(watchedValue.replace(",", "."));
  const sortedOthers = [...otherReadings].sort((a, b) =>
    a.readingDate.localeCompare(b.readingDate),
  );

  const before = sortedOthers
    .filter((reading) => reading.readingDate < watchedDate)
    .at(-1);
  const after = sortedOthers.find(
    (reading) => reading.readingDate > watchedDate,
  );

  const showSettledWarning = settledPeriods.some(
    (period) => watchedDate >= period.start && watchedDate <= period.end,
  );

  const showNonMonotonicWarning =
    watchedDate !== "" &&
    !Number.isNaN(parsedValue) &&
    ((before !== undefined && parsedValue < before.value) ||
      (after !== undefined && parsedValue > after.value));

  return (
    <Form
      form={form}
      onSubmit={(values) => onSubmit(readingFormToSubmit(values))}
    >
      {showOlderWarning ? (
        <Alert variant="warning">
          <AlertTitle>{t("ui.reading.olderDateWarningTitle")}</AlertTitle>
          <AlertDescription>
            {t("ui.reading.olderDateWarningDescription", {
              date: formatDate(warnIfBefore),
            })}
          </AlertDescription>
        </Alert>
      ) : null}
      {showSettledWarning ? (
        <Alert variant="warning">
          <AlertTitle>{t("ui.reading.settledWarningTitle")}</AlertTitle>
          <AlertDescription>
            {t("ui.reading.settledWarningDescription")}
          </AlertDescription>
        </Alert>
      ) : null}
      {showNonMonotonicWarning ? (
        <Alert variant="warning">
          <AlertTitle>{t("ui.reading.nonMonotonicWarningTitle")}</AlertTitle>
          <AlertDescription>
            {t("ui.reading.nonMonotonicWarningDescription")}
          </AlertDescription>
        </Alert>
      ) : null}
      <fieldset disabled={submitting} className="contents">
        <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DateInput
            control={form.control}
            name="readingDate"
            label={t("ui.common.columns.date")}
            startMonth={calendarStart}
            endMonth={today}
          />
          <TextInput
            control={form.control}
            name="value"
            label={t("ui.reading.fields.value")}
            inputMode="decimal"
          />
          <SelectInput
            control={form.control}
            name="readBy"
            label={t("ui.reading.fields.readBy")}
            options={meterReadBySources.map((source) => ({
              value: source,
              label: t(`ui.reading.readBy.${source}`),
            }))}
            className="sm:col-span-2"
          />
          <TextareaInput
            control={form.control}
            name="notes"
            label={t("ui.reading.fields.note")}
            rows={2}
            fieldClassName="sm:col-span-2"
            textareaClassName="field-sizing-fixed min-h-0 resize-y"
          />
          <SwitchInput
            control={form.control}
            name="isEstimated"
            label={t("ui.reading.fields.estimatedHint")}
            fieldClassName="sm:col-span-2"
          />
        </FieldGroup>
      </fieldset>
      <FormActions
        submitting={submitting}
        onCancel={onCancel}
        submitLabel={t("ui.common.action.save")}
      />
    </Form>
  );
};
