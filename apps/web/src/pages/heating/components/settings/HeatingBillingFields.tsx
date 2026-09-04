import type { HeatingFormValues } from "@einfachvermieter/shared";
import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { SplitBar } from "@/components/common/SplitBar";
import { ChoiceTiles } from "@/components/form/ChoiceTiles";
import { MonthInput } from "@/components/form/MonthInput";
import { SwitchInput } from "@/components/form/SwitchInput";
import { TextInput } from "@/components/form/TextInput";
import { HelpHint } from "@/components/help/HelpHint";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/Field";
import { t } from "../../../../lib/i18n";
import {
  type BillingType,
  billingTypeIcon,
  billingTypes,
  toBillingType,
} from "../../billingType";
import { ExternalBillingInfoToggle } from "./ExternalBillingInfoToggle";

/**
 * Setzt das ergänzende Anteilsfeld (Grund-/Verbrauchsanteil, Summe = 100 %)
 * auf `100 − Wert`, sofern der eingegebene Wert eine valide Prozentzahl ist
 * und sich der Zielwert tatsächlich ändert.
 */
const syncComplementaryShare = (
  form: UseFormReturn<HeatingFormValues>,
  targetField: "baseSharePercent" | "consumptionSharePercent",
  rawValue: string | undefined,
): void => {
  const parsed = Number.parseInt(rawValue ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return;
  }

  const next = String(100 - parsed);
  if (form.getValues(targetField) !== next) {
    form.setValue(targetField, next);
  }
};

const applyBillingType = (
  form: UseFormReturn<HeatingFormValues>,
  next: BillingType,
) => {
  if (next === "external") {
    form.setValue("mode", "external");
    return;
  }

  form.setValue("mode", "internal");
  form.setValue(
    "consumptionMethod",
    next === "internal_heat_cost_allocator"
      ? "heat_cost_allocator"
      : "heat_meter",
  );
};

/**
 * Felder der Abrechnung: Gültigkeit, Art der Heizkostenabrechnung, Anteile
 * und die Aufteilung bei Mieter- oder Leerstandswechsel
 */
export const HeatingBillingFields = ({
  form,
}: {
  form: UseFormReturn<HeatingFormValues>;
}) => {
  const mode = form.watch("mode");
  const consumptionMethod = form.watch("consumptionMethod");
  const currentBillingType = toBillingType({ mode, consumptionMethod });

  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (type !== "change") {
        return;
      }
      if (name === "consumptionSharePercent") {
        syncComplementaryShare(
          form,
          "baseSharePercent",
          value.consumptionSharePercent,
        );
      } else if (name === "baseSharePercent") {
        syncComplementaryShare(
          form,
          "consumptionSharePercent",
          value.baseSharePercent,
        );
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);

  const basePercent = Number.parseInt(form.watch("baseSharePercent"), 10);

  return (
    <FieldGroup className="gap-4">
      <div className="grid grid-cols-2 gap-4">
        <MonthInput
          control={form.control}
          name="validFrom"
          label={t("ui.heating.fields.validFrom")}
          description={t("ui.heating.fields.validFromDescription")}
          boundary="start"
        />
        <MonthInput
          control={form.control}
          name="validTo"
          label={t("ui.heating.fields.validTo")}
          description={t("ui.heating.fields.validToDescription")}
          boundary="end"
          optional={true}
        />
      </div>

      <Field>
        <FieldLabel>
          {t("ui.heating.fields.billingType")}
          <HelpHint>{t("ui.heating.fields.billingTypeDescription")}</HelpHint>
        </FieldLabel>
        <ChoiceTiles
          columns={1}
          value={currentBillingType}
          onValueChange={(value) =>
            applyBillingType(form, value as BillingType)
          }
          options={billingTypes.map((value) => ({
            value,
            icon: billingTypeIcon(value),
            title: t(`ui.heating.billingTypeTiles.${value}.title`),
            description: t(`ui.heating.billingTypeTiles.${value}.description`),
          }))}
        />
      </Field>

      {mode === "external" ? null : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <TextInput
              control={form.control}
              name="baseSharePercent"
              label={t("ui.heating.fields.baseSharePercent")}
              labelHelp={t("ui.heating.fields.baseShareDescription")}
              type="number"
              inputMode="numeric"
              min="0"
              max="100"
              step="1"
              suffix="%"
            />
            <TextInput
              control={form.control}
              name="consumptionSharePercent"
              label={t("ui.heating.fields.consumptionSharePercent")}
              labelHelp={t("ui.heating.fields.splitDescription")}
              type="number"
              inputMode="numeric"
              min="0"
              max="100"
              step="1"
              suffix="%"
            />
          </div>
          {Number.isFinite(basePercent) ? (
            <SplitBar
              aPercent={basePercent}
              aLabel={t("ui.heating.detail.splitBaseLegend", {
                percent: basePercent,
              })}
              bLabel={t("ui.heating.detail.splitConsumptionLegend", {
                percent: 100 - basePercent,
              })}
            />
          ) : null}
          <SwitchInput
            control={form.control}
            name="mandatorySeventyPercent"
            label={t("ui.heating.fields.mandatorySeventyPercent")}
            description={t(
              "ui.heating.fields.mandatorySeventyPercentDescription",
            )}
          />
        </>
      )}

      <ExternalBillingInfoToggle form={form} mode={mode} />
    </FieldGroup>
  );
};
