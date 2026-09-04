import {
  type AdvanceAdjustmentDetail,
  type CostLineResult,
  centsToEurInput,
  formatEur,
  nextMonthOptions,
  parseEurToCents,
  STATEMENT_HEATING_COST_TYPE_ID,
  todayIso,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiCalendarScheduleLine } from "@remixicon/react";
import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { QUIET_TABLE_HEAD_ROW } from "@/components/common/tableStyles";
import { ChoiceTilesInput } from "@/components/form/ChoiceTilesInput";
import { FormSheet } from "@/components/form/FormSheet";
import { SelectInput } from "@/components/form/SelectInput";
import { TextInput } from "@/components/form/TextInput";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { api } from "../../../lib/api";
import { t } from "../../../lib/i18n";
import { useCrudMutation } from "../../../lib/useCrudMutation";
import {
  type AdvanceFormValues,
  type AdvanceMode,
  buildAdvanceFormSchema,
  buildTariffEntries,
  formatBpsAsPercent,
  resolveDefaultValidFrom,
  resolveSuggestedApplyCents,
  type TariffEntry,
} from "./advanceAdjustment";

/**
 * Künftige Vorauszahlung im FormSheet festlegen: beibehalten, Vorschlag
 * übernehmen oder eigener Betrag, dazu der Stichtag. "Beibehalten" löscht
 * eine bestehende Anpassung.
 */
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Formular-Verzweigung plus Tarif-Tabelle
export const AdvanceAdjustmentSheet = ({
  statementId,
  detail,
  lines,
  periodEnd,
  onClose,
}: {
  statementId: string;
  detail: AdvanceAdjustmentDetail | undefined;
  lines: CostLineResult[];
  periodEnd: string;
  onClose: () => void;
}) => {
  const currentCents = detail?.currentMonthlyAdvanceCents ?? 0;
  const suggestedCents = detail?.suggestedMonthlyAdvanceCents ?? 0;
  const adjustedCents = detail?.adjustedMonthlyAdvanceCents ?? null;
  const adjustedValidFrom = detail?.adjustedAdvanceValidFrom ?? null;
  const autoTariffs = detail?.autoTariffAdjustmentBps ?? null;
  const hasAutoTariffs =
    autoTariffs !== null && Object.keys(autoTariffs).length > 0;

  const tariffEntries = useMemo(() => buildTariffEntries(lines), [lines]);
  const suggestedApplyCents = useMemo(
    () => resolveSuggestedApplyCents(detail, lines, true),
    [detail, lines],
  );

  const monthOptions = useMemo(() => {
    const today = todayIso();
    return nextMonthOptions(today).filter((option) => option.iso > periodEnd);
  }, [periodEnd]);

  let defaultMode: AdvanceMode = "keep";
  if (adjustedCents !== null && adjustedValidFrom !== null) {
    defaultMode =
      adjustedCents === suggestedApplyCents ? "suggested" : "custom";
  }

  const form = useForm<AdvanceFormValues>({
    resolver: zodResolver(buildAdvanceFormSchema(periodEnd)),
    reValidateMode: "onSubmit",
    defaultValues: {
      mode: defaultMode,
      amountInput: centsToEurInput(adjustedCents ?? currentCents),
      validFrom: resolveDefaultValidFrom(adjustedValidFrom, monthOptions),
    },
  });

  const watchedMode = useWatch({ control: form.control, name: "mode" });
  const watchedAmountInput = useWatch({
    control: form.control,
    name: "amountInput",
  });
  const watchedAmountCents = parseEurToCents(watchedAmountInput ?? "");

  const isBelowSuggested =
    watchedMode === "custom" &&
    watchedAmountCents > 0 &&
    suggestedCents > 0 &&
    watchedAmountCents < suggestedCents;

  // Hinweis, wenn der eingegebene Betrag von allen Standard-Werten abweicht
  // (alt / Vorjahres-Ist auf 12 Monate / mit Tarif-Erwartungen). Dann muss
  // der Vermieter den Wert konkret belegen können. Der Hinweis unterbleibt,
  // wenn schon die Below-Suggested-Warnung greift.
  const isCustomAmount =
    watchedMode === "custom" &&
    watchedAmountCents > 0 &&
    watchedAmountCents !== currentCents &&
    watchedAmountCents !== suggestedCents &&
    watchedAmountCents !== suggestedApplyCents &&
    !isBelowSuggested;

  const saveAdjustment = useCrudMutation({
    mutationFn: (values: AdvanceFormValues) => {
      if (values.mode === "keep") {
        return api.put(`/statements/${statementId}/advance-adjustment`, {
          adjustedMonthlyAdvanceCents: null,
          adjustedAdvanceValidFrom: null,
          tariffAdjustmentBps: null,
        });
      }

      const tariffAdjustmentBps: Record<string, number> = {};
      if (autoTariffs) {
        for (const [costTypeId, bps] of Object.entries(autoTariffs)) {
          if (bps !== 0) {
            tariffAdjustmentBps[costTypeId] = bps;
          }
        }
      }

      return api.put(`/statements/${statementId}/advance-adjustment`, {
        adjustedMonthlyAdvanceCents:
          values.mode === "suggested"
            ? suggestedApplyCents
            : parseEurToCents(values.amountInput),
        adjustedAdvanceValidFrom: values.validFrom,
        tariffAdjustmentBps:
          Object.keys(tariffAdjustmentBps).length > 0
            ? tariffAdjustmentBps
            : null,
      });
    },
    invalidateKeys: [["statement"]],
    onSuccess: onClose,
  });

  const labelForCostType = (entry: TariffEntry) =>
    entry.costTypeId === STATEMENT_HEATING_COST_TYPE_ID
      ? t("ui.statements.advanceAdjustment.tariffs.heatingLabel")
      : entry.costTypeName;

  return (
    <FormSheet
      form={form}
      icon={RiCalendarScheduleLine}
      title={t("ui.statements.advanceAdjustment.title")}
      description={t("ui.statements.advanceAdjustment.description")}
      submitLabel={t("ui.common.action.save")}
      onSubmit={async (values) => {
        await saveAdjustment.mutateAsync(values);
      }}
      onClose={onClose}
    >
      <ChoiceTilesInput
        control={form.control}
        name="mode"
        columns={1}
        options={[
          {
            value: "keep",
            title: t("ui.statements.advanceAdjustment.choice.keepTitle"),
            description: t(
              "ui.statements.advanceAdjustment.choice.keepDescription",
              { amount: formatEur(currentCents) },
            ),
          },
          {
            value: "suggested",
            title: t("ui.statements.advanceAdjustment.choice.suggestedTitle"),
            description: t(
              "ui.statements.advanceAdjustment.choice.suggestedDescription",
              { amount: formatEur(suggestedApplyCents) },
            ),
          },
          {
            value: "custom",
            title: t("ui.statements.advanceAdjustment.choice.customTitle"),
            description: t(
              "ui.statements.advanceAdjustment.choice.customDescription",
            ),
          },
        ]}
      />

      {watchedMode !== "keep" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectInput
              control={form.control}
              name="validFrom"
              label={t("ui.statements.advanceAdjustment.validFromLabel")}
              labelHelp={t(
                "ui.statements.advanceAdjustment.validFromDescription",
              )}
              options={monthOptions.map((option) => ({
                value: option.iso,
                label: option.label,
              }))}
            />
            {watchedMode === "custom" ? (
              <TextInput
                control={form.control}
                name="amountInput"
                label={t("ui.statements.advanceAdjustment.amountLabel")}
                labelHelp={t("ui.statements.advanceAdjustment.amountHelp")}
                suffix="€"
                inputMode="decimal"
              />
            ) : null}
          </div>
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
        </>
      ) : null}

      {tariffEntries.length > 0 ? (
        <details
          className="rounded-md border border-border p-3"
          open={hasAutoTariffs}
        >
          <summary className="cursor-pointer text-sm font-semibold">
            {t("ui.statements.advanceAdjustment.tariffs.sectionTitle")}
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("ui.statements.advanceAdjustment.tariffs.sectionDescription")}
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
                    autoBps !== undefined && autoBps !== null && autoBps !== 0;
                  return (
                    <tr
                      key={entry.costTypeId}
                      className="border-t border-border"
                    >
                      <td className="py-1.5">{labelForCostType(entry)}</td>
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
    </FormSheet>
  );
};
