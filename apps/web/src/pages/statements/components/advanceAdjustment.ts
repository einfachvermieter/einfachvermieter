import {
  type AdvanceAdjustmentDetail,
  type CostLineResult,
  parseEurToCents,
  STATEMENT_HEATING_COST_TYPE_ID,
  suggestAdvanceValidFromDate,
  suggestNextMonthlyAdvanceCentsWithTariffs,
  todayIso,
  unsignedAmountRegex,
} from "@einfachvermieter/shared";
import { z } from "zod";
import { t } from "../../../lib/i18n";

/**
 * Beibehalten = keine Anpassung speichern, Vorschlag = hochgerechnetes
 * Vorjahres-Ist (inkl. Tarif-Erwartungen) übernehmen, Eigener Betrag =
 * frei eingeben.
 */
export type AdvanceMode = "keep" | "suggested" | "custom";

export type AdvanceFormValues = {
  mode: AdvanceMode;
  amountInput: string;
  validFrom: string;
};

export type TariffEntry = {
  costTypeId: string;
  costTypeName: string;
  tenantAmountCents: number;
};

/**
 * Betrag und Stichtag sind nur relevant, wenn überhaupt eine Anpassung
 * gespeichert wird; der Betrag nur bei freier Eingabe.
 */
export const buildAdvanceFormSchema = (periodEnd: string) =>
  z
    .object({
      mode: z.enum(["keep", "suggested", "custom"]),
      amountInput: z.string(),
      validFrom: z.string(),
    })
    .superRefine((values, ctx) => {
      if (values.mode === "keep") {
        return;
      }
      if (values.mode === "custom") {
        if (values.amountInput.length === 0) {
          ctx.addIssue({
            code: "custom",
            path: ["amountInput"],
            message: t(
              "ui.statements.advanceAdjustment.validation.amountRequired",
            ),
          });
        } else if (!unsignedAmountRegex.test(values.amountInput)) {
          ctx.addIssue({
            code: "custom",
            path: ["amountInput"],
            message: t(
              "ui.statements.advanceAdjustment.validation.amountFormat",
            ),
          });
        } else if (parseEurToCents(values.amountInput) <= 0) {
          ctx.addIssue({
            code: "custom",
            path: ["amountInput"],
            message: t(
              "ui.statements.advanceAdjustment.validation.amountPositive",
            ),
          });
        }
      }
      if (values.validFrom.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["validFrom"],
          message: t(
            "ui.statements.advanceAdjustment.validation.validFromRequired",
          ),
        });
      } else if (values.validFrom <= periodEnd) {
        ctx.addIssue({
          code: "custom",
          path: ["validFrom"],
          message: t(
            "ui.statements.advanceAdjustment.validation.validFromAfterPeriodEnd",
          ),
        });
      }
    });

/**
 * Formatiert einen Basispunkte-Wert als deutsches Prozent mit Vorzeichen
 * ("+5 %", "-2,5 %").
 */
export const formatBpsAsPercent = (bps: number): string => {
  const percent = bps / 100;
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} %`;
};

/**
 * Kostenarten-Summen des Mieters, Heizkosten ans Ende
 */
export const buildTariffEntries = (lines: CostLineResult[]): TariffEntry[] => {
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
 * vorgeschlagene Stichtag (falls in den Optionen), ersatzweise die erste
 * Option.
 */
export const resolveDefaultValidFrom = (
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

/**
 * Betrag hinter der Kachel "Vorschlag übernehmen": im Entwurf der live
 * berechnete Wert inkl. Tarif-Erwartungen, sonst der eingefrorene.
 */
export const resolveSuggestedApplyCents = (
  detail: AdvanceAdjustmentDetail | undefined,
  lines: CostLineResult[],
  isDraft: boolean,
): number => {
  if (!isDraft) {
    return (
      detail?.suggestedMonthlyAdvanceWithTariffsCents ??
      detail?.suggestedMonthlyAdvanceCents ??
      0
    );
  }

  const linesByCostTypeId: Record<string, number> = {};
  for (const entry of buildTariffEntries(lines)) {
    linesByCostTypeId[entry.costTypeId] = entry.tenantAmountCents;
  }

  return suggestNextMonthlyAdvanceCentsWithTariffs(
    linesByCostTypeId,
    detail?.tenantBilledDays ?? 0,
    detail?.autoTariffAdjustmentBps ?? null,
    detail?.daysInBaseYear,
  );
};
