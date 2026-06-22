import {
  centsToEurInput,
  formatDate,
  formatEur,
  type MonthGridRow,
  type PaymentFormValues,
  type PaymentPurposeKind,
  type PotState,
  pad2,
  pad4,
  paymentFormSchema,
  paymentPurposeKinds,
  splitSumByContract,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiFlashlightLine, RiScissorsCutLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { ChoiceTilesInput } from "@/components/form/ChoiceTilesInput";
import { DateInput } from "@/components/form/DateInput";
import { Form } from "@/components/form/Form";
import { FormActions } from "@/components/form/FormActions";
import { SelectInput, type SelectOption } from "@/components/form/SelectInput";
import { SubformShell } from "@/components/form/SubformShell";
import { TextInput } from "@/components/form/TextInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Card, CardContent } from "@/components/ui/Card";
import { FieldGroup } from "@/components/ui/Field";
import {
  tenantMonthGridQueryOptions,
  tenantSettlementsQueryOptions,
} from "../../../lib/accounts";
import { t } from "../../../lib/i18n";

const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/u;

type Props = {
  mode: "create" | "edit";
  tenantOptions: SelectOption[];
  tenantFieldDisabled?: boolean;
  lockedPurposeKind?: PaymentPurposeKind;
  allowedPurposeKinds?: PaymentPurposeKind[];
  defaultValues: PaymentFormValues;
  onSubmit: (values: PaymentFormValues) => Promise<void>;
  onCancel: () => void;
  /**
   * "page" (Standard): eigenes Formular mit Karte und FormActions.
   * "inline": getöntes Aufklapp-Subform (SubformShell) ohne eigene Karte,
   * z. B. eingebettet im Mieterkonto.
   */
  variant?: "page" | "inline";
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Markup
export const PaymentForm = ({
  mode,
  tenantOptions,
  tenantFieldDisabled = false,
  lockedPurposeKind,
  allowedPurposeKinds = [...paymentPurposeKinds],
  defaultValues,
  onSubmit,
  onCancel,
  variant = "page",
}: Props) => {
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });
  // Bei jedem Mount neu berechnen, damit längere Sessions nicht auf
  // einem veralteten "heute" hängen.
  const { calendarStart, calendarEnd, monthRangeEndIso } = useMemo(() => {
    const now = new Date();
    // Letzter Tag des übernächsten Monats: erlaubt Eingabe von Zahlungen für
    // Mietmonate bis +2 Monate in der Zukunft
    const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 3, 0);
    return {
      calendarStart: new Date(now.getFullYear() - 20, 0, 1),
      calendarEnd: now,
      monthRangeEndIso: `${pad4(rangeEnd.getFullYear())}-${pad2(rangeEnd.getMonth() + 1)}-${pad2(rangeEnd.getDate())}`,
    };
  }, []);

  const submitting = form.formState.isSubmitting;
  const purposeKind = form.watch("purposeKind");
  const tenantId = form.watch("tenantId");
  const forMonth = form.watch("forMonth");
  const inputMode = form.watch("inputMode");

  const monthQueryEnabled = purposeKind === "month" && tenantId.length > 0;
  const { data: monthRows } = useQuery({
    ...tenantMonthGridQueryOptions(tenantId, {
      from: "2000-01-01",
      to: monthRangeEndIso,
    }),
    enabled: monthQueryEnabled,
  });
  const monthRow =
    monthQueryEnabled && monthRegex.test(forMonth)
      ? (monthRows?.find((row) => row.forMonth === forMonth) ?? null)
      : null;

  const monthOptions = useMemo<SelectOption[]>(() => {
    const rows = monthRows ?? [];

    // Neueste Monate zuerst. Vermieter erfasst typischerweise die aktuelle Miete.
    const sorted = [...rows].sort((a, b) => (a.forMonth < b.forMonth ? 1 : -1));

    const options = sorted.map((row) => ({
      value: row.forMonth,
      label: `${formatMonthLabel(row.forMonth)} – ${t(
        `ui.account.status.${monthOverallStatus(row)}`,
      )}`,
    }));

    // Im Edit-Modus den bisher gewählten Monat ergänzen, falls er außerhalb
    // des Lade-Bereichs liegt. Sonst würde das Select-Feld nichts zeigen.
    if (
      monthRegex.test(forMonth) &&
      !options.some((option) => option.value === forMonth)
    ) {
      options.unshift({
        value: forMonth,
        label: formatMonthLabel(forMonth),
      });
    }
    return options;
  }, [monthRows, forMonth]);

  const statementQueryEnabled =
    purposeKind === "statement" && tenantId.length > 0;
  const { data: settlementRows } = useQuery({
    ...tenantSettlementsQueryOptions(tenantId),
    enabled: statementQueryEnabled,
  });
  const forStatementId = form.watch("forStatementId");

  const statementOptions = useMemo<SelectOption[]>(() => {
    const rows = settlementRows ?? [];
    const options = rows.map((row) => ({
      value: row.statementId,
      label: `${formatDate(row.date)} – ${formatEur(row.pot.sollCents)}`,
    }));

    // Im Edit-Modus die bisher gewählte Abrechnung ergänzen, falls sie nicht
    // (mehr) in der Liste auftaucht. Sonst zeigt das Select-Feld nichts.
    if (
      forStatementId &&
      !options.some((option) => option.value === forStatementId)
    ) {
      options.unshift({ value: forStatementId, label: forStatementId });
    }

    return options;
  }, [settlementRows, forStatementId]);

  // Wechselt der User von "Summe" zu "Getrennt" und die Eingabe-Felder
  // sind noch leer, übernehmen wir das, was bisher in "sumInput" steht,
  // sinnvoll: bei passender Vertragssumme aus dem Vertrag, sonst ganzer
  // Betrag in die Kaltmiete-Spalte als Startpunkt.
  useEffect(() => {
    if (purposeKind !== "month" || inputMode !== "split") {
      return;
    }
    if (form.getValues("baseRentInput") || form.getValues("advanceInput")) {
      return;
    }

    const sumInputValue = form.getValues("sumInput");
    if (!sumInputValue || !monthRow) {
      return;
    }

    const split = splitSumByContract(
      sumInputValue,
      monthRow.baseRent.sollCents,
      monthRow.advance.sollCents,
    );

    if (split) {
      form.setValue("baseRentInput", centsToEurInput(split.baseRentCents));
      form.setValue("advanceInput", centsToEurInput(split.advanceCents));
    } else {
      form.setValue("baseRentInput", sumInputValue);
      form.setValue("advanceInput", "0,00");
    }
  }, [purposeKind, inputMode, monthRow, form]);

  const handleSubmit = async (values: PaymentFormValues) => {
    if (values.purposeKind === "month" && values.inputMode === "sum") {
      if (!monthRow) {
        form.setError("forMonth", {
          message: t("ui.payments.validation.monthNotInContract"),
        });
        return;
      }

      const split = splitSumByContract(
        values.sumInput,
        monthRow.baseRent.sollCents,
        monthRow.advance.sollCents,
      );

      if (!split) {
        form.setError("sumInput", {
          message: t("ui.payments.validation.sumMismatch"),
        });
        return;
      }

      values.baseRentInput = centsToEurInput(split.baseRentCents);
      values.advanceInput = centsToEurInput(split.advanceCents);
    }
    await onSubmit(values);
  };

  const inputModeTiles = (
    <ChoiceTilesInput
      control={form.control}
      name="inputMode"
      options={[
        {
          value: "sum",
          icon: RiFlashlightLine,
          title: t("ui.payments.fields.inputModeSum"),
          description: t("ui.payments.fields.inputModeSumHint"),
        },
        {
          value: "split",
          icon: RiScissorsCutLine,
          title: t("ui.payments.fields.inputModeSplit"),
          description: t("ui.payments.fields.inputModeSplitHint"),
        },
      ]}
    />
  );

  const referenceField = (
    <TextInput
      control={form.control}
      name="reference"
      optional={true}
      label={t("ui.payments.fields.reference")}
      placeholder={t("ui.payments.fields.referencePlaceholder")}
    />
  );

  const fields = (
    <FieldGroup className="gap-4">
      <SelectInput
        control={form.control}
        name="tenantId"
        label={t("ui.common.columns.tenant")}
        disabled={tenantFieldDisabled}
        options={tenantOptions}
      />
      <DateInput
        control={form.control}
        name="paymentDate"
        label={t("ui.payments.columns.date")}
        startMonth={calendarStart}
        endMonth={calendarEnd}
      />
      <SelectInput
        control={form.control}
        name="purposeKind"
        label={t("ui.payments.fields.purposeKind")}
        disabled={mode === "edit" || lockedPurposeKind !== undefined}
        options={allowedPurposeKinds.map((value) => ({
          value,
          label: t(`ui.payments.purposeKinds.${value}`),
        }))}
      />

      {purposeKind === "month" ? (
        <>
          <SelectInput
            control={form.control}
            name="forMonth"
            label={t("ui.payments.fields.forMonth")}
            options={monthOptions}
            placeholder={t("ui.payments.fields.forMonthPlaceholder")}
          />
          {monthRow ? <ContractInfo row={monthRow} mode={mode} /> : null}
          {inputModeTiles}
          {inputMode === "sum" ? (
            <TextInput
              control={form.control}
              name="sumInput"
              inputMode="decimal"
              placeholder="0,00"
              label={t("ui.payments.fields.sumEur")}
              description={t("ui.payments.fields.sumHint")}
              suffix="€"
              inputClassName="max-w-xs"
            />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <TextInput
                control={form.control}
                name="baseRentInput"
                inputMode="decimal"
                placeholder="0,00"
                label={t("ui.payments.fields.baseRentEur")}
                suffix="€"
              />
              <TextInput
                control={form.control}
                name="advanceInput"
                inputMode="decimal"
                placeholder="0,00"
                label={t("ui.payments.fields.advanceEur")}
                suffix="€"
              />
            </div>
          )}
        </>
      ) : null}

      {purposeKind === "statement" ? (
        <SelectInput
          control={form.control}
          name="forStatementId"
          label={t("ui.payments.fields.forStatement")}
          options={statementOptions}
          disabled={lockedPurposeKind === "statement"}
        />
      ) : null}

      {purposeKind !== "month" ? (
        <TextInput
          control={form.control}
          name="amountInput"
          inputMode="decimal"
          placeholder="0,00"
          label={t("ui.payments.fields.amountEur")}
          description={t("ui.payments.fields.amountSignHint")}
          suffix="€"
        />
      ) : null}

      {referenceField}
    </FieldGroup>
  );

  /**
   * Inline-Variante (Mieterkonto): fester Mieter + Monatszweck
   */
  const inlineFields = (
    <FieldGroup className="gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DateInput
          control={form.control}
          name="paymentDate"
          label={t("ui.payments.columns.date")}
          startMonth={calendarStart}
          endMonth={calendarEnd}
        />
        <SelectInput
          control={form.control}
          name="forMonth"
          label={t("ui.payments.fields.forMonth")}
          options={monthOptions}
          placeholder={t("ui.payments.fields.forMonthPlaceholder")}
        />
      </div>
      {monthRow ? <ContractInfo row={monthRow} mode={mode} /> : null}
      {inputModeTiles}
      {inputMode === "sum" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput
            control={form.control}
            name="sumInput"
            inputMode="decimal"
            placeholder="0,00"
            label={t("ui.payments.fields.sumEur")}
            description={t("ui.payments.fields.sumHint")}
            suffix="€"
          />
          {referenceField}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextInput
            control={form.control}
            name="baseRentInput"
            inputMode="decimal"
            placeholder="0,00"
            label={t("ui.payments.fields.baseRentEur")}
            suffix="€"
          />
          <TextInput
            control={form.control}
            name="advanceInput"
            inputMode="decimal"
            placeholder="0,00"
            label={t("ui.payments.fields.advanceEur")}
            suffix="€"
          />
          {referenceField}
        </div>
      )}
    </FieldGroup>
  );

  if (variant === "inline") {
    return (
      <div className="rounded-[13px] border border-sky-100 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/30">
        <SubformShell
          onSubmit={() => {
            form
              .handleSubmit(handleSubmit)()
              .catch(() => undefined);
          }}
          onCancel={onCancel}
          submitLabel={t("ui.payments.add")}
        >
          {inlineFields}
        </SubformShell>
      </div>
    );
  }

  return (
    <Form form={form} onSubmit={handleSubmit}>
      <fieldset disabled={submitting} className="contents">
        <Card>
          <CardContent>{fields}</CardContent>
        </Card>
      </fieldset>
      <FormActions
        submitting={submitting}
        onCancel={onCancel}
        submitLabel={
          mode === "create"
            ? t("ui.common.action.record")
            : t("ui.common.action.save")
        }
      />
    </Form>
  );
};

const formatMonthLabel = (forMonth: string): string => {
  const [year, month] = forMonth.split("-");
  return `${month}.${year}`;
};

const monthOverallStatus = (row: MonthGridRow): PotState["status"] => {
  const statuses: PotState["status"][] = [
    row.baseRent.status,
    row.advance.status,
  ];

  if (statuses.includes("open")) {
    return "open";
  }

  if (statuses.includes("credit")) {
    return "credit";
  }

  return "balanced";
};

const ContractInfo = ({
  row,
  mode,
}: {
  row: MonthGridRow;
  mode: "create" | "edit";
}) => {
  const totalSoll = row.baseRent.sollCents + row.advance.sollCents;
  const totalIst = row.baseRent.istCents + row.advance.istCents;
  const recordedCount = row.paymentIds.length;
  const status = monthOverallStatus(row);
  const headingKey =
    mode === "edit"
      ? "ui.payments.contract.alreadyPaidHeadingInclCurrent"
      : "ui.payments.contract.alreadyPaidHeading";
  return (
    <Alert variant={alertVariantForStatus(status)}>
      <AlertTitle>
        {t("ui.payments.contract.headingWithStatus", {
          month: formatMonthLabel(row.forMonth),
          status: t(`ui.account.status.${status}`),
        })}
      </AlertTitle>
      <AlertDescription>
        <p className="tabular-nums">
          {t("ui.payments.contract.summary", {
            baseRent: formatEur(row.baseRent.sollCents),
            advance: formatEur(row.advance.sollCents),
            total: formatEur(totalSoll),
          })}
        </p>
        <p className="tabular-nums">
          <span className="font-medium">{t(headingKey)}</span>{" "}
          {recordedCount === 0
            ? t("ui.payments.contract.alreadyPaidNone")
            : t("ui.payments.contract.alreadyPaidSummary", {
                count: String(recordedCount),
                baseRent: formatEur(row.baseRent.istCents),
                advance: formatEur(row.advance.istCents),
                total: formatEur(totalIst),
              })}
        </p>
      </AlertDescription>
    </Alert>
  );
};

const alertVariantForStatus = (
  status: PotState["status"],
): "success" | "warning" | "info" => {
  if (status === "balanced") {
    return "success";
  }

  if (status === "open") {
    return "warning";
  }

  return "info";
};
