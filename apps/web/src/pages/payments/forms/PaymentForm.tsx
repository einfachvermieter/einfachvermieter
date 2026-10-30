import {
  centsToEurInput,
  distributeMonthSum,
  formatEur,
  type MonthGridRow,
  openPotCents,
  type PaymentFormValues,
  pad2,
  pad4,
  parseEurToCents,
  paymentFormSchema,
  unsignedAmountRegex,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type RemixiconComponentType,
  RiArrowDownCircleLine,
  RiArrowUpCircleLine,
  RiFlashlightLine,
  RiScissorsCutLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { ChoiceTilesInput } from "@/components/form/ChoiceTilesInput";
import { DateInput } from "@/components/form/DateInput";
import { FormSheet } from "@/components/form/FormSheet";
import { SelectInput, type SelectOption } from "@/components/form/SelectInput";
import { TextInput } from "@/components/form/TextInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { FieldGroup } from "@/components/ui/Field";
import { formatForMonth } from "@/lib/dateInput";
import {
  type MonthStatus,
  monthStatus,
  tenantMonthGridQueryOptions,
} from "../../../lib/accounts";
import { t } from "../../../lib/i18n";

const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/u;

type Props = {
  mode: "create" | "edit";
  title: string;
  icon?: RemixiconComponentType;
  tenantOptions: SelectOption[];
  tenantFieldDisabled?: boolean;
  defaultValues: PaymentFormValues;
  onSubmit: (values: PaymentFormValues) => Promise<void>;
  onClose: () => void;
};

/**
 * Zahlungs-Formular im FormSheet. Der Zweck steht beim Öffnen fest (aus
 * der Zeile, an der gezahlt wird). Mietmonate haben Monat und Aufteilung,
 * alle übrigen Zwecke Richtung und Betrag
 */
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Markup
export const PaymentForm = ({
  mode,
  title,
  icon,
  tenantOptions,
  tenantFieldDisabled = false,
  defaultValues,
  onSubmit,
  onClose,
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

  const { purposeKind } = defaultValues;
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

  const { openAdvanceCents, openBaseRentCents } = monthOpenAmounts(
    monthRow,
    mode === "edit" ? defaultValues : null,
  );
  const { openMonthCents, sumDistribution, splitAboveOpen } = useMonthSum({
    form,
    monthRow,
    openAdvanceCents,
    openBaseRentCents,
  });

  const monthOptions = useMemo<SelectOption[]>(() => {
    const rows = monthRows ?? [];

    // Neueste Monate zuerst. Vermieter erfasst typischerweise die aktuelle Miete.
    const sorted = [...rows].sort((a, b) => (a.forMonth < b.forMonth ? 1 : -1));

    const options = sorted.map((row) => ({
      value: row.forMonth,
      label: [
        formatForMonth(row.forMonth),
        t(
          `ui.account.status.${monthStatus(row.baseRent, row.advance, row.forMonth)}`,
        ),
      ].join(t("ui.common.separators.dash")),
    }));

    // Im Edit-Modus den bisher gewählten Monat ergänzen, falls er außerhalb
    // des Lade-Bereichs liegt. Sonst würde das Select-Feld nichts zeigen.
    if (
      monthRegex.test(forMonth) &&
      !options.some((option) => option.value === forMonth)
    ) {
      options.unshift({
        value: forMonth,
        label: formatForMonth(forMonth),
      });
    }
    return options;
  }, [monthRows, forMonth]);

  const handleSubmit = async (values: PaymentFormValues) => {
    if (values.purposeKind === "month" && values.inputMode === "sum") {
      if (!monthRow) {
        form.setError("forMonth", {
          message: t("ui.payments.validation.monthNotInContract"),
        });
        return;
      }

      const split = distributeMonthSum(
        parseEurToCents(values.sumInput),
        openAdvanceCents,
        openBaseRentCents,
      );

      if (!split) {
        form.setError("sumInput", {
          message: t("ui.payments.validation.sumAboveOpen", {
            amount: formatEur(openMonthCents),
          }),
        });
        return;
      }

      values.baseRentInput = centsToEurInput(split.baseRentCents);
      values.advanceInput = centsToEurInput(split.advanceCents);
    }
    await onSubmit(values);
  };

  return (
    <FormSheet
      form={form}
      icon={icon}
      title={title}
      submitLabel={
        mode === "create"
          ? t("ui.common.action.record")
          : t("ui.common.action.save")
      }
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      {/* Reihenfolge wie in jedem Zahlungs- und Gebühren-Sheet: erst wofür
          bzw. in welche Richtung, dann Datum und Betrag nebeneinander, zum
          Schluss der freie Text */}
      <FieldGroup>
        {/* Steht der Mieter durch den Ort fest (Mieterkonto), entfällt das
            Feld, statt gesperrt angezeigt zu werden */}
        {tenantFieldDisabled ? null : (
          <SelectInput
            control={form.control}
            name="tenantId"
            label={t("ui.common.columns.tenant")}
            options={tenantOptions}
          />
        )}
        {purposeKind === "month" ? (
          <>
            <SelectInput
              control={form.control}
              name="forMonth"
              label={t("ui.payments.fields.forMonth")}
              options={monthOptions}
              placeholder={t("ui.payments.fields.forMonthPlaceholder")}
            />
            {monthRow ? (
              <ContractInfo
                row={monthRow}
                mode={mode}
                openCents={openMonthCents}
              />
            ) : null}
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
          </>
        ) : (
          <ChoiceTilesInput
            control={form.control}
            name="direction"
            options={[
              {
                value: "received",
                icon: RiArrowDownCircleLine,
                title: t("ui.payments.fields.directionReceived"),
                description: t("ui.payments.fields.directionReceivedHint"),
              },
              {
                value: "paidOut",
                icon: RiArrowUpCircleLine,
                title: t("ui.payments.fields.directionPaidOut"),
                description: t("ui.payments.fields.directionPaidOutHint"),
              },
            ]}
          />
        )}

        <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
          <DateInput
            control={form.control}
            name="paymentDate"
            label={t("ui.payments.columns.date")}
            startMonth={calendarStart}
            endMonth={calendarEnd}
          />
          {purposeKind !== "month" ? (
            <TextInput
              control={form.control}
              name="amountInput"
              inputMode="decimal"
              placeholder={t("ui.common.placeholders.amount")}
              label={t("ui.payments.fields.amountEur")}
              suffix="€"
            />
          ) : null}
          {purposeKind === "month" && inputMode === "sum" ? (
            <TextInput
              control={form.control}
              name="sumInput"
              inputMode="decimal"
              placeholder={t("ui.common.placeholders.amount")}
              label={t("ui.payments.fields.sumEur")}
              description={
                sumDistribution
                  ? t("ui.payments.fields.sumDistribution", {
                      advance: formatEur(sumDistribution.advanceCents),
                      baseRent: formatEur(sumDistribution.baseRentCents),
                    })
                  : undefined
              }
              suffix="€"
            />
          ) : null}
        </div>

        {purposeKind === "month" && inputMode === "split" ? (
          <>
            <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
              <TextInput
                control={form.control}
                name="baseRentInput"
                inputMode="decimal"
                placeholder={t("ui.common.placeholders.amount")}
                label={t("ui.payments.fields.baseRentEur")}
                suffix="€"
              />
              <TextInput
                control={form.control}
                name="advanceInput"
                inputMode="decimal"
                placeholder={t("ui.common.placeholders.amount")}
                label={t("ui.payments.fields.advanceEur")}
                suffix="€"
              />
            </div>
            {splitAboveOpen ? (
              <Alert variant="info">
                <AlertDescription>
                  {t("ui.payments.fields.splitAboveOpen")}
                </AlertDescription>
              </Alert>
            ) : null}
          </>
        ) : null}

        <TextInput
          control={form.control}
          name="reference"
          optional={true}
          label={t("ui.payments.fields.reference")}
          placeholder={t("ui.payments.fields.referencePlaceholder")}
        />
      </FieldGroup>
    </FormSheet>
  );
};

/**
 * Offener Betrag des Monats je Topf. Beim Ändern zählt die bearbeitete
 * Zahlung (ihre ursprünglichen Beträge) nicht zum Ist, damit sie sich
 * unverändert speichern lässt
 */
const monthOpenAmounts = (
  row: MonthGridRow | null,
  editedPayment: PaymentFormValues | null,
) => {
  if (!row) {
    return { openAdvanceCents: 0, openBaseRentCents: 0 };
  }

  // Nur wenn die Zahlung im selben Monat bleibt, steckt sie in dessen Ist
  const own = editedPayment?.forMonth === row.forMonth ? editedPayment : null;

  return {
    openAdvanceCents: openPotCents(
      row.advance.sollCents,
      row.advance.istCents - parseEurToCents(own?.advanceInput ?? ""),
    ),
    openBaseRentCents: openPotCents(
      row.baseRent.sollCents,
      row.baseRent.istCents - parseEurToCents(own?.baseRentInput ?? ""),
    ),
  };
};

/**
 * Ein Betrag für einen Mietmonat: Verteilung auf die Töpfe und Übernahme
 * in "Getrennt erfassen". Der Monat ist nur bei Mietzahlungen gesetzt
 */
const useMonthSum = ({
  form,
  monthRow,
  openAdvanceCents,
  openBaseRentCents,
}: {
  form: UseFormReturn<PaymentFormValues>;
  monthRow: MonthGridRow | null;
  openAdvanceCents: number;
  openBaseRentCents: number;
}) => {
  const openMonthCents = openAdvanceCents + openBaseRentCents;

  const sumInput = form.watch("sumInput");
  const sumDistribution =
    monthRow && unsignedAmountRegex.test(sumInput)
      ? distributeMonthSum(
          parseEurToCents(sumInput),
          openAdvanceCents,
          openBaseRentCents,
        )
      : null;

  const splitAboveOpen =
    monthRow !== null &&
    parseEurToCents(form.watch("baseRentInput")) +
      parseEurToCents(form.watch("advanceInput")) >
      openMonthCents;

  // Wechselt der Nutzer zu "Getrennt erfassen", übernehmen die beiden Felder
  // die Verteilung der Summe. Passt die Summe nicht in den offenen Betrag,
  // steht sie ganz bei der Kaltmiete
  useEffect(() => {
    const subscription = form.watch((values, { name }) => {
      if (name !== "inputMode" || values.inputMode !== "split" || !monthRow) {
        return;
      }

      const sumInputValue = values.sumInput ?? "";
      if (!unsignedAmountRegex.test(sumInputValue)) {
        return;
      }

      const split = distributeMonthSum(
        parseEurToCents(sumInputValue),
        openAdvanceCents,
        openBaseRentCents,
      );
      form.setValue(
        "baseRentInput",
        split ? centsToEurInput(split.baseRentCents) : sumInputValue,
      );
      form.setValue(
        "advanceInput",
        split ? centsToEurInput(split.advanceCents) : "0,00",
      );
    });
    return () => subscription.unsubscribe();
  }, [monthRow, openAdvanceCents, openBaseRentCents, form]);

  return { openMonthCents, sumDistribution, splitAboveOpen };
};

const ContractInfo = ({
  row,
  mode,
  openCents,
}: {
  row: MonthGridRow;
  mode: "create" | "edit";
  openCents: number;
}) => {
  const totalSoll = row.baseRent.sollCents + row.advance.sollCents;
  const totalIst = row.baseRent.istCents + row.advance.istCents;
  const recordedCount = row.paymentIds.length;
  const status = monthStatus(row.baseRent, row.advance, row.forMonth);
  const headingKey =
    mode === "edit"
      ? "ui.payments.contract.alreadyPaidHeadingInclCurrent"
      : "ui.payments.contract.alreadyPaidHeading";
  return (
    <Alert variant={alertVariantForStatus(status)}>
      <AlertTitle>
        {t("ui.payments.contract.headingWithStatus", {
          month: formatForMonth(row.forMonth),
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
          <span className="font-semibold">{t(headingKey)}</span>{" "}
          {recordedCount === 0
            ? t("ui.payments.contract.alreadyPaidNone")
            : t("ui.payments.contract.alreadyPaidSummary", {
                count: recordedCount,
                baseRent: formatEur(row.baseRent.istCents),
                advance: formatEur(row.advance.istCents),
                total: formatEur(totalIst),
              })}
        </p>
        {openCents > 0 ? (
          <p className="tabular-nums">
            <span className="font-semibold">
              {t("ui.payments.contract.openHeading")}
            </span>{" "}
            {formatEur(openCents)}
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
};

const alertVariantForStatus = (
  status: MonthStatus,
): "success" | "warning" | "info" => {
  if (status === "balanced") {
    return "success";
  }

  if (status === "open") {
    return "warning";
  }

  return "info";
};
