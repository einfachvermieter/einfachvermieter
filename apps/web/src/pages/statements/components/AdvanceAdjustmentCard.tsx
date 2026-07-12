import {
  type AdvanceAdjustmentDetail,
  type CostLineResult,
  centsToEurInput,
  formatDate,
  formatEur,
  nextMonthOptions,
  parseEurToCents,
  STATEMENT_HEATING_COST_TYPE_ID,
  suggestAdvanceValidFromDate,
  suggestNextMonthlyAdvanceCentsWithTariffs,
  todayIso,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiCalendarScheduleLine } from "@remixicon/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { SectionCard } from "../../../components/common/SectionCard";
import { QUIET_TABLE_HEAD_ROW } from "../../../components/common/tableStyles";
import { SelectInput } from "../../../components/form/SelectInput";
import { TextInput } from "../../../components/form/TextInput";
import { Alert, AlertDescription } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { api } from "../../../lib/api";
import { gradients } from "../../../lib/domainVisuals";
import { t } from "../../../lib/i18n";

type AdvanceAdjustmentCardProps = {
  statementId: string;
  isDraft: boolean;
  detail: AdvanceAdjustmentDetail | undefined;
  lines: CostLineResult[];
  periodEnd: string;
};

type FormValues = {
  amountInput: string;
  validFrom: string;
};

const amountRegex = /^\d+([.,]\d{1,2})?$/u;

/**
 * Formatiert einen Basispunkte-Wert als deutsches Prozent mit Vorzeichen
 * ("+5 %", "-2,5 %"). 0 oder undefined -> "-" via i18n-Schlüssel im Caller.
 */
const formatBpsAsPercent = (bps: number): string => {
  const percent = bps / 100;
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} %`;
};

const buildFormSchema = (periodEnd: string) =>
  z.object({
    amountInput: z
      .string()
      .min(1, t("ui.statements.advanceAdjustment.validation.amountRequired"))
      .regex(
        amountRegex,
        t("ui.statements.advanceAdjustment.validation.amountFormat"),
      )
      .refine((value) => parseEurToCents(value) > 0, {
        message: t("ui.statements.advanceAdjustment.validation.amountPositive"),
      }),
    validFrom: z
      .string()
      .min(1, t("ui.statements.advanceAdjustment.validation.validFromRequired"))
      .refine((value) => value > periodEnd, {
        message: t(
          "ui.statements.advanceAdjustment.validation.validFromAfterPeriodEnd",
        ),
      }),
  });

type TariffEntry = {
  costTypeId: string;
  costTypeName: string;
  tenantAmountCents: number;
};

const buildTariffEntries = (lines: CostLineResult[]): TariffEntry[] => {
  const byId = new Map<string, TariffEntry>();
  for (const line of lines) {
    if (line.tenantAmountCents <= 0) {
      continue;
    }
    const existing = byId.get(line.costTypeId);
    if (existing) {
      existing.tenantAmountCents += line.tenantAmountCents;
    } else {
      byId.set(line.costTypeId, {
        costTypeId: line.costTypeId,
        costTypeName: line.costTypeName,
        tenantAmountCents: line.tenantAmountCents,
      });
    }
  }
  return [...byId.values()].sort((a, b) => {
    const aHeating = a.costTypeId === STATEMENT_HEATING_COST_TYPE_ID ? 1 : 0;
    const bHeating = b.costTypeId === STATEMENT_HEATING_COST_TYPE_ID ? 1 : 0;
    if (aHeating !== bHeating) {
      return aHeating - bHeating;
    }
    return a.costTypeName.localeCompare(b.costTypeName, "de");
  });
};

/**
 * Default-Stichtag der Anpassung: bereits gesetzter Wert, sonst der
 * vorgeschlagene Stichtag (falls in den Optionen), ersatzweise die erste Option.
 */
const resolveDefaultValidFrom = (
  adjustedValidFrom: string | null,
  monthOptions: { iso: string }[],
): string => {
  if (adjustedValidFrom) {
    return adjustedValidFrom;
  }
  const suggested = suggestAdvanceValidFromDate(todayIso());
  if (monthOptions.some((option) => option.iso === suggested)) {
    return suggested;
  }
  return monthOptions[0]?.iso ?? suggested;
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Länge liegt am Markup
export const AdvanceAdjustmentCard = ({
  statementId,
  isDraft,
  detail,
  lines,
  periodEnd,
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Formular-/Tarif-Anzeige-Verzweigung (Vorschau vs. gespeichert, Auto-Tarife), Rest bereits ausgelagert.
}: AdvanceAdjustmentCardProps) => {
  const queryClient = useQueryClient();
  const formId = useId();

  const currentCents = detail?.currentMonthlyAdvanceCents ?? 0;
  const suggestedCents = detail?.suggestedMonthlyAdvanceCents ?? 0;
  const suggestedWithTariffsCents =
    detail?.suggestedMonthlyAdvanceWithTariffsCents ?? suggestedCents;
  const adjustedCents = detail?.adjustedMonthlyAdvanceCents ?? null;
  const adjustedValidFrom = detail?.adjustedAdvanceValidFrom ?? null;
  const autoTariffs = detail?.autoTariffAdjustmentBps ?? null;

  const hasAdjustment = adjustedCents !== null && adjustedValidFrom !== null;
  const hasAutoTariffs =
    autoTariffs !== null && Object.keys(autoTariffs).length > 0;

  const tariffEntries = useMemo(() => buildTariffEntries(lines), [lines]);
  const linesByCostTypeId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const entry of tariffEntries) {
      map[entry.costTypeId] = entry.tenantAmountCents;
    }
    return map;
  }, [tariffEntries]);

  const monthOptions = useMemo(() => {
    const today = todayIso();
    return nextMonthOptions(today).filter((option) => option.iso > periodEnd);
  }, [periodEnd]);

  const defaultValidFrom = useMemo(
    () => resolveDefaultValidFrom(adjustedValidFrom, monthOptions),
    [adjustedValidFrom, monthOptions],
  );

  const defaultAmountCents = adjustedCents ?? currentCents;

  const formSchema = buildFormSchema(periodEnd);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amountInput: centsToEurInput(defaultAmountCents),
      validFrom: defaultValidFrom,
    },
  });

  useEffect(() => {
    form.reset({
      amountInput: centsToEurInput(defaultAmountCents),
      validFrom: defaultValidFrom,
    });
  }, [defaultAmountCents, defaultValidFrom, form]);

  const watchedAmountInput = useWatch({
    control: form.control,
    name: "amountInput",
  });
  const watchedAmountCents = useMemo(
    () => parseEurToCents(watchedAmountInput ?? ""),
    [watchedAmountInput],
  );
  const isBelowSuggested =
    watchedAmountCents > 0 &&
    suggestedCents > 0 &&
    watchedAmountCents < suggestedCents;

  // Tarif-Anpassungen stammen ausschließlich aus der Auto-Ableitung. Manuelle
  // Override-Werte würden in den Bereich pauschaler Sicherheitszuschläge
  // rutschen (BGH-unzulässig). Belege gehören als Kosteneintrag in die App.
  const liveSuggestedCents = useMemo(
    () =>
      suggestNextMonthlyAdvanceCentsWithTariffs(
        linesByCostTypeId,
        detail?.tenantBilledDays ?? 0,
        autoTariffs,
      ),
    [linesByCostTypeId, detail?.tenantBilledDays, autoTariffs],
  );

  // Tarif-Vorschlag wird nur gezeigt, wenn er sich vom reinen
  // Vorjahres-Ist unterscheidet; zwei gleichen Vorschläge wirken wie Bug
  const withTariffsCents = isDraft
    ? liveSuggestedCents
    : suggestedWithTariffsCents;
  const showWithTariffs = withTariffsCents !== suggestedCents;

  // Info-Hinweis, wenn der eingegebene Betrag von allen Standard-Werten
  // abweicht (alt / Vorjahres-Ist auf 12 Monate / mit Tarif-Erwartungen). In dem Fall
  // muss der Vermieter den Wert konkret belegen können. Die Warnung
  // unterbleibt, wenn die separate Below-Suggested-Warnung greift, sonst
  // würden beide übereinander gerendert.
  const isCustomAmount =
    watchedAmountCents > 0 &&
    watchedAmountCents !== currentCents &&
    watchedAmountCents !== suggestedCents &&
    watchedAmountCents !== liveSuggestedCents &&
    !isBelowSuggested;

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const tariffAdjustmentBps: Record<string, number> = {};
      if (autoTariffs) {
        for (const [costTypeId, bps] of Object.entries(autoTariffs)) {
          if (bps !== 0) {
            tariffAdjustmentBps[costTypeId] = bps;
          }
        }
      }

      return api.put(`/statements/${statementId}/advance-adjustment`, {
        adjustedMonthlyAdvanceCents: parseEurToCents(values.amountInput),
        adjustedAdvanceValidFrom: values.validFrom,
        tariffAdjustmentBps:
          Object.keys(tariffAdjustmentBps).length > 0
            ? tariffAdjustmentBps
            : null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["statement"] });
    },
  });

  const clear = useMutation({
    mutationFn: () =>
      api.put(`/statements/${statementId}/advance-adjustment`, {
        adjustedMonthlyAdvanceCents: null,
        adjustedAdvanceValidFrom: null,
        tariffAdjustmentBps: null,
      }),

    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["statement"] });
    },
  });

  const applyAmount = (cents: number) => {
    form.setValue("amountInput", centsToEurInput(cents), {
      shouldDirty: true,
    });
  };

  const labelForCostType = (entry: TariffEntry) =>
    entry.costTypeId === STATEMENT_HEATING_COST_TYPE_ID
      ? t("ui.statements.advanceAdjustment.tariffs.heatingLabel")
      : entry.costTypeName;

  return (
    <SectionCard
      icon={RiCalendarScheduleLine}
      iconBackground={gradients.money}
      title={t("ui.statements.advanceAdjustment.title")}
      description={t("ui.statements.advanceAdjustment.description")}
    >
      <div className="space-y-4">
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 text-muted-foreground">
                {t("ui.statements.advanceAdjustment.currentLabel")}
              </td>
              <td className="py-1 text-right tabular-nums">
                {formatEur(currentCents)}
              </td>
            </tr>
            <tr>
              <td className="py-1 text-muted-foreground">
                {t("ui.statements.advanceAdjustment.suggestedLabel")}
              </td>
              <td className="py-1 text-right tabular-nums">
                {formatEur(suggestedCents)}
              </td>
            </tr>
            {showWithTariffs ? (
              <tr>
                <td className="py-1 text-muted-foreground">
                  {t(
                    "ui.statements.advanceAdjustment.suggestedWithTariffsLabel",
                  )}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {formatEur(withTariffsCents)}
                </td>
              </tr>
            ) : null}
            {hasAdjustment ? (
              <tr className="border-t border-border font-semibold">
                <td className="py-1.5">
                  {t("ui.statements.advanceAdjustment.adjustedLabel", {
                    date: formatDate(adjustedValidFrom),
                  })}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatEur(adjustedCents)}
                </td>
              </tr>
            ) : (
              <tr className="border-t border-border text-muted-foreground">
                <td className="py-1.5" colSpan={2}>
                  {t("ui.statements.advanceAdjustment.noAdjustment")}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {isDraft ? (
          <form
            id={formId}
            onSubmit={form.handleSubmit((values) => save.mutate(values))}
            className="space-y-4 border-t border-border pt-4"
          >
            <TextInput
              control={form.control}
              name="amountInput"
              label={t("ui.statements.advanceAdjustment.amountLabel")}
              suffix="€"
              inputMode="decimal"
            />
            {isBelowSuggested ? (
              <Alert variant="warning">
                <AlertDescription>
                  {t(
                    "ui.statements.advanceAdjustment.amountBelowSuggestedWarning",
                    { suggested: formatEur(suggestedCents) },
                  )}
                </AlertDescription>
              </Alert>
            ) : null}
            {isCustomAmount ? (
              <Alert variant="info">
                <AlertDescription>
                  {t("ui.statements.advanceAdjustment.amountCustomInfo")}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => applyAmount(currentCents)}
              >
                {t("ui.statements.advanceAdjustment.applyCurrent", {
                  amount: formatEur(currentCents),
                })}
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => applyAmount(suggestedCents)}
              >
                {t("ui.statements.advanceAdjustment.applySuggested", {
                  amount: formatEur(suggestedCents),
                })}
              </Button>
              {showWithTariffs ? (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => applyAmount(liveSuggestedCents)}
                >
                  {t(
                    "ui.statements.advanceAdjustment.applySuggestedWithTariffs",
                    {
                      amount: formatEur(liveSuggestedCents),
                    },
                  )}
                </Button>
              ) : null}
            </div>
            <SelectInput
              control={form.control}
              name="validFrom"
              label={t("ui.statements.advanceAdjustment.validFromLabel")}
              description={t(
                "ui.statements.advanceAdjustment.validFromDescription",
              )}
              options={monthOptions.map((option) => ({
                value: option.iso,
                label: option.label,
              }))}
            />

            {tariffEntries.length > 0 ? (
              <details
                className="rounded-md border border-border p-3"
                open={hasAutoTariffs}
              >
                <summary className="cursor-pointer text-sm font-semibold">
                  {t("ui.statements.advanceAdjustment.tariffs.sectionTitle")}
                </summary>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t(
                    "ui.statements.advanceAdjustment.tariffs.sectionDescription",
                  )}
                </p>
                {hasAutoTariffs ? (
                  <table className="mt-3 w-full text-sm">
                    <thead>
                      <tr className={QUIET_TABLE_HEAD_ROW}>
                        <th className="py-1.5">
                          {t(
                            "ui.statements.advanceAdjustment.tariffs.columnCostType",
                          )}
                        </th>
                        <th className="py-1.5 text-right">
                          {t(
                            "ui.statements.advanceAdjustment.tariffs.columnPeriodCost",
                          )}
                        </th>
                        <th className="py-1.5 text-right">
                          {t(
                            "ui.statements.advanceAdjustment.tariffs.columnAdjustment",
                          )}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tariffEntries.map((entry) => {
                        const autoBps = autoTariffs?.[entry.costTypeId];
                        const hasValue =
                          autoBps !== undefined &&
                          autoBps !== null &&
                          autoBps !== 0;
                        return (
                          <tr
                            key={entry.costTypeId}
                            className="border-t border-border"
                          >
                            <td className="py-1.5">
                              {labelForCostType(entry)}
                            </td>
                            <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                              {formatEur(entry.tenantAmountCents)}
                            </td>
                            <td className="py-1.5 text-right tabular-nums">
                              {hasValue
                                ? formatBpsAsPercent(autoBps)
                                : t(
                                    "ui.statements.advanceAdjustment.tariffs.noChange",
                                  )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {t("ui.statements.advanceAdjustment.tariffs.emptyHint")}
                  </p>
                )}
              </details>
            ) : null}

            <div className="flex justify-end gap-2">
              {hasAdjustment ? (
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => clear.mutate()}
                  disabled={clear.isPending || save.isPending}
                >
                  {t("ui.statements.advanceAdjustment.removeButton")}
                </Button>
              ) : null}
              <Button type="submit" disabled={save.isPending}>
                {save.isPending
                  ? t("ui.common.action.saving")
                  : t("ui.statements.advanceAdjustment.saveButton")}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </SectionCard>
  );
};
