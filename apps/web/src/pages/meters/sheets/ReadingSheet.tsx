import {
  formatDate,
  hasResetBetween,
  meterReadBySources,
  todayIso,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiListOrdered2 } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { DateInput } from "@/components/form/DateInput";
import { FormSheet } from "@/components/form/FormSheet";
import { SelectInput } from "@/components/form/SelectInput";
import { SwitchInput } from "@/components/form/SwitchInput";
import { TextareaInput } from "@/components/form/TextareaInput";
import { TextInput } from "@/components/form/TextInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { FieldGroup } from "@/components/ui/Field";
import { api } from "../../../lib/api";
import { t } from "../../../lib/i18n";
import { type Reading, readingsQueryOptions } from "../../../lib/meters";
import { useCrudMutation } from "../../../lib/useCrudMutation";
import {
  type ReadingFormValues,
  type ReadingSubmitValues,
  readingFormSchema,
  readingFormToSubmit,
} from "../components/readings/readingForm.schema";
import {
  isInSettledPeriod,
  useSettledPeriods,
} from "../components/readings/useSettledPeriods";

const today = new Date();
const calendarStart = new Date(today.getFullYear() - 20, 0, 1);

/**
 * Zählerstand im FormSheet erfassen bzw. bearbeiten
 */
export const ReadingSheet = ({
  meterId,
  buildingId,
  resetDay,
  reading,
  onClose,
}: {
  meterId: string;
  buildingId: string;

  /**
   * Stichtag des Zählers; Hier ist ein niedriger neuer Wert kein Problem.
   */
  resetDay: string | null;
  reading: Reading | null;
  onClose: () => void;
}) => {
  const { data: readings } = useQuery(readingsQueryOptions(meterId));
  const settledPeriods = useSettledPeriods(buildingId);

  const sorted = useMemo(
    () =>
      [...(readings ?? [])].sort((a, b) =>
        b.readingDate.localeCompare(a.readingDate),
      ),
    [readings],
  );
  const latestReadingDate = sorted[0]?.readingDate ?? null;
  const otherReadings = sorted.filter((entry) => entry.id !== reading?.id);

  const form = useForm<ReadingFormValues>({
    resolver: zodResolver(readingFormSchema),
    reValidateMode: "onSubmit",
    defaultValues: reading
      ? {
          readingDate: reading.readingDate,
          value: String(reading.value).replace(".", ","),
          isEstimated: reading.isEstimated,
          readBy: reading.readBy,
          notes: reading.notes ?? "",
        }
      : {
          readingDate: todayIso(),
          value: "",
          isEstimated: false,
          readBy: "landlord",
          notes: "",
        },
  });

  const watchedDate = form.watch("readingDate");
  const watchedValue = form.watch("value");

  const showOlderWarning =
    !reading &&
    latestReadingDate !== null &&
    watchedDate !== "" &&
    watchedDate < latestReadingDate;
  const showSettledWarning = isInSettledPeriod(settledPeriods, watchedDate);

  const parsedValue = Number.parseFloat(watchedValue.replace(",", "."));
  const ascending = [...otherReadings].reverse();
  const before = ascending
    .filter((entry) => entry.readingDate < watchedDate)
    .at(-1);
  const after = ascending.find((entry) => entry.readingDate > watchedDate);
  const droppedSincePrevious =
    before !== undefined &&
    parsedValue < before.value &&
    !hasResetBetween(resetDay, before.readingDate, watchedDate);
  const exceedsFollowing =
    after !== undefined &&
    parsedValue > after.value &&
    !hasResetBetween(resetDay, watchedDate, after.readingDate);
  const showNonMonotonicWarning =
    watchedDate !== "" &&
    !Number.isNaN(parsedValue) &&
    (droppedSincePrevious || exceedsFollowing);

  const saveReading = useCrudMutation({
    mutationFn: (dto: ReadingSubmitValues) =>
      reading
        ? api.patch<Reading>(`/meters/readings/${reading.id}`, dto)
        : api.post<Reading>("/meters/readings", { ...dto, meterId }),
    invalidateKeys: [["readings", meterId]],
    onSuccess: onClose,
  });

  return (
    <FormSheet
      form={form}
      icon={RiListOrdered2}
      title={reading ? t("ui.reading.editTitle") : t("ui.reading.createTitle")}
      submitLabel={t("ui.common.action.save")}
      onSubmit={async (values) => {
        await saveReading.mutateAsync(readingFormToSubmit(values));
      }}
      onClose={onClose}
    >
      {showOlderWarning && latestReadingDate ? (
        <Alert variant="warning">
          <AlertTitle>{t("ui.reading.olderDateWarningTitle")}</AlertTitle>
          <AlertDescription>
            {t("ui.reading.olderDateWarningDescription", {
              date: formatDate(latestReadingDate),
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
          fieldClassName="sm:col-span-2"
        />
        <SwitchInput
          control={form.control}
          name="isEstimated"
          label={t("ui.reading.fields.estimatedHint")}
          fieldClassName="sm:col-span-2"
        />
      </FieldGroup>
    </FormSheet>
  );
};
