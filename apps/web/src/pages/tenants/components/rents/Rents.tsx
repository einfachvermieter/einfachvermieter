import type { TenantFormValues } from "@einfachvermieter/shared";
import {
  addDaysIso,
  formatEur,
  parseEurToCents,
} from "@einfachvermieter/shared";
import {
  RiAddLine,
  RiInformationLine,
  RiMoneyEuroCircleLine,
} from "@remixicon/react";
import { useState } from "react";
import { type UseFormReturn, useFieldArray } from "react-hook-form";
import { SectionCard } from "@/components/common/SectionCard";
import { ComputedValueRow } from "@/components/form/ComputedValueRow";
import { DateInput } from "@/components/form/DateInput";
import {
  EditableListSection,
  type EditableListSectionRowFormProps,
} from "@/components/form/EditableListSection";
import { TextInput } from "@/components/form/TextInput";
import { HelpHint } from "@/components/help/HelpHint";
import { Button } from "@/components/ui/Button";
import { FieldGroup } from "@/components/ui/Field";
import { t, translateKey } from "../../../../lib/i18n";
import { RentRowForm } from "./RentRowForm";
import { RentRowSummary } from "./RentRowSummary";
import { emptyRentRow, type RentRowValues } from "./rentRow";

/**
 * Warmmiete live aus Kaltmiete + Nebenkosten-Vorauszahlung
 */
const warmRentLabel = (baseEuros: string, advanceEuros: string): string => {
  const cents =
    parseEurToCents(baseEuros || "0") + parseEurToCents(advanceEuros || "0");
  return Number.isFinite(cents) ? formatEur(cents) : t("ui.common.emptyValue");
};

const collectRentRowErrors = (
  rowErrors:
    | {
        message?: string;
        startDate?: { message?: string };
        endDate?: { message?: string };
        monthlyBaseRentEuros?: { message?: string };
        monthlyAdvanceEuros?: { message?: string };
      }
    | undefined,
): string | undefined => {
  if (!rowErrors) {
    return;
  }
  const messages = [
    rowErrors.message,
    rowErrors.startDate?.message,
    rowErrors.endDate?.message,
    rowErrors.monthlyBaseRentEuros?.message,
    rowErrors.monthlyAdvanceEuros?.message,
  ]
    .map((msg) => translateKey(msg))
    .filter((msg): msg is string => Boolean(msg));

  return messages.length > 0 ? messages.join(" · ") : undefined;
};

/**
 * Eine Mieterhöhung endet den bisherigen Satz automatisch am Vortag.
 * Liefert je offenem Vorgänger dessen Index und neues Enddatum.
 */
const predecessorEnds = (
  rows: RentRowValues[],
  startDate: string,
  tenantStartDate: string,
): [number, string][] => {
  if (startDate === "") {
    return [];
  }

  return rows.flatMap((row, index) => {
    const rowStart = row.startDate || tenantStartDate;
    const isOpenPredecessor =
      row.endDate === "" && rowStart !== "" && rowStart < startDate;
    return isOpenPredecessor
      ? [[index, addDaysIso(startDate, -1)] as [number, string]]
      : [];
  });
};

export const Rents = ({
  form,
  tenantStartDate,
  tenantEndDate,
}: {
  form: UseFormReturn<TenantFormValues>;
  tenantStartDate: string;
  tenantEndDate: string;
}) => {
  const rentsArray = useFieldArray({ control: form.control, name: "rents" });
  const watchedRents = form.watch("rents");
  const error = translateKey(form.formState.errors.rents?.message);

  // Wachsende Ansicht.
  // Ein Datensatz einfach, mehrere als Verlauf
  const [historyOpen, setHistoryOpen] = useState(watchedRents.length > 1);
  const [openAdd, setOpenAdd] = useState(false);

  const resolveDefaultValues = (
    _editIndex: number | null,
    current: RentRowValues | undefined,
  ): RentRowValues => {
    if (current) {
      return current;
    }
    // Beim Anlegen: erster Mietsatz startet am Vertragsbeginn, weitere
    // brauchen ein leeres Startdatum (Validation erzwingt Folgedatum +1).
    return emptyRentRow(watchedRents.length === 0 ? tenantStartDate || "" : "");
  };

  const appendRent = (values: RentRowValues) => {
    for (const [index, endDate] of predecessorEnds(
      watchedRents,
      values.startDate,
      tenantStartDate,
    )) {
      const row = watchedRents[index];
      if (row) {
        rentsArray.update(index, { ...row, endDate });
      }
    }

    rentsArray.append(values);
  };

  const renderRowForm = ({
    defaultValues,
    editIndex,
    onSubmit,
    onCancel,
  }: EditableListSectionRowFormProps<RentRowValues>) => (
    <RentRowForm
      key={editIndex !== null ? `edit-${editIndex}` : "new"}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );

  if (!historyOpen && watchedRents.length === 1) {
    const [current] = watchedRents;
    // Fehler versteckter Felder (z. B. Ende-Datum) hier sichtbar machen
    const rowErrors = form.formState.errors.rents?.[0];
    const hiddenError = [rowErrors?.message, rowErrors?.endDate?.message]
      .map((message) => translateKey(message))
      .filter(Boolean)
      .join(t("ui.common.separators.bullet"));

    return (
      <SectionCard
        icon={RiMoneyEuroCircleLine}
        title={t("ui.tenant.rentsTitle")}
        titleExtra={<HelpHint>{t("ui.tenant.rentsHelp")}</HelpHint>}
        description={t("ui.tenant.rentSimpleDescription")}
        action={
          <Button
            type="button"
            variant="addLink"
            size="text"
            onClick={() => {
              setOpenAdd(true);
              setHistoryOpen(true);
            }}
          >
            <RiAddLine />
            {t("ui.tenant.addRentChange")}
          </Button>
        }
      >
        <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextInput
            control={form.control}
            name="rents.0.monthlyBaseRentEuros"
            label={t("ui.tenant.fields.coldRentEuros")}
            inputMode="decimal"
            suffix="€"
          />
          <TextInput
            control={form.control}
            name="rents.0.monthlyAdvanceEuros"
            label={t("ui.tenant.fields.advanceEuros")}
            inputMode="decimal"
            suffix="€"
          />
          <DateInput
            control={form.control}
            name="rents.0.startDate"
            label={t("ui.tenant.fields.validFrom")}
          />
        </FieldGroup>
        <div className="mt-4">
          <ComputedValueRow
            icon={RiMoneyEuroCircleLine}
            label={t("ui.tenant.hero.warmRent")}
            value={
              current
                ? warmRentLabel(
                    current.monthlyBaseRentEuros,
                    current.monthlyAdvanceEuros,
                  )
                : t("ui.common.emptyValue")
            }
          />
        </div>
        {hiddenError || error ? (
          <p className="mt-2 text-sm text-destructive">
            {hiddenError || error}
          </p>
        ) : null}
      </SectionCard>
    );
  }

  return (
    <EditableListSection<RentRowValues>
      title={t("ui.tenant.rentsTitle")}
      titleHelp={<HelpHint>{t("ui.tenant.rentsHelp")}</HelpHint>}
      emptyHint={t("ui.tenant.rentsEmptyHint")}
      addLabel={t("ui.tenant.addRent")}
      icon={RiMoneyEuroCircleLine}
      defaultOpenAdd={openAdd}
      onFormCancel={() => {
        // Zurück zur einfachen Ansicht, solange es beim einen Mietsatz bleibt
        if (watchedRents.length === 1) {
          setHistoryOpen(false);
          setOpenAdd(false);
        }
      }}
      footer={
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <RiInformationLine
            aria-hidden={true}
            className="size-3.75 shrink-0"
          />
          {t("ui.tenant.rentHistoryHint")}
        </p>
      }
      fieldKeys={rentsArray.fields}
      rows={watchedRents}
      renderRow={(row, index) => (
        <RentRowSummary
          row={row}
          index={index}
          tenantStartDate={tenantStartDate}
          tenantEndDate={tenantEndDate}
        />
      )}
      onAppend={appendRent}
      onUpdate={(index, values) => rentsArray.update(index, values)}
      onRemove={(index) => rentsArray.remove(index)}
      resolveDefaultValues={resolveDefaultValues}
      renderRowForm={renderRowForm}
      confirmDeleteTitle={t("ui.tenant.confirmRemoveRent")}
      error={error}
      rowError={(index) =>
        collectRentRowErrors(form.formState.errors.rents?.[index])
      }
      sortIndex={(rows) => rows.map((_, i) => rows.length - 1 - i)}
    />
  );
};
