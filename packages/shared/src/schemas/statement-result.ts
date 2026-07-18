import { z } from "zod";
import type { StatementResult } from "../types/index.js";
import { allocationKeys, isoDate } from "./common.js";

const periodSchema = z.object({
  start: isoDate(),
  end: isoDate(),
});

/**
 * Sprachneutrale Berechnungs-Warnung (Code + Parameter). Im Snapshot
 * werden die Detail-Warnungen so abgelegt
 */
const calcWarningSchema = z.object({
  code: z.string().min(1),
  params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

const costLineResultSchema = z.object({
  costTypeId: z.string().min(1),
  costTypeName: z.string().min(1),
  allocationKey: z.enum(allocationKeys),
  totalAmountCents: z.number().int(),
  totalBase: z.number(),
  tenantBase: z.number(),
  shareBps: z.number().int(),
  tenantAmountCents: z.number().int(),
  baseUnit: z.string(),
  landlordAmountCents: z.number().int(),
  landlordShareBps: z.number().int(),
  tenantBaseExplain: z.string().optional(),
  totalBaseExplain: z.string().optional(),
  bemessungTotal: z.number().nullable(),
  bemessungTenant: z.number().nullable(),
  bemessungUnit: z.string().nullable(),
  daysTotal: z.number().nullable(),
  daysTenant: z.number().nullable(),
  notes: z.string().optional(),
});

const waterDetailSchema = z.object({
  totalConsumptionM3: z.number(),
  perUnit: z.array(
    z.object({
      unitId: z.string(),
      unitName: z.string(),
      consumptionM3: z.number(),
      sharePct: z.number(),
      isDifferential: z.boolean(),
      meterContributions: z.array(
        z.object({
          label: z.string(),
          consumptionM3: z.number(),
        }),
      ),
    }),
  ),
  landlordConsumptionM3: z.number().optional(),
  warnings: z.array(calcWarningSchema).optional(),
});

const occupancyDetailSchema = z.object({
  periodDays: z.number().int().nonnegative(),
  perUnit: z.array(
    z.object({
      unitId: z.string(),
      unitName: z.string(),
      areaSqm: z.number(),
      occupantCount: z.number().int().nonnegative(),
      occupiedDays: z.number().int().nonnegative(),
      personDays: z.number().int().nonnegative(),
      residents: z.array(
        z.object({
          label: z.string(),
          from: isoDate(),
          to: isoDate(),
          days: z.number().int().nonnegative(),
        }),
      ),
    }),
  ),
  totalPersonDays: z.number().int().nonnegative(),
  totalOccupiedDays: z.number().int().nonnegative(),
  landlordOccupiedDays: z.number().int().nonnegative(),
  landlordPersonDays: z.number().int().nonnegative(),
});

export const heatingDetailSchema = z.object({
  totalHeatingCostsCents: z.number().int(),
  heatingPotCents: z.number().int().optional(),
  consumptionShareBps: z.number().int().min(0).max(10_000),
  consumptionPortionCents: z.number().int(),
  basicPortionCents: z.number().int(),
  consumptionMethod: z.enum(["heat_meter", "heat_cost_allocator"]).optional(),
  consumptionDistributionMethod: z
    .enum(["consumption", "heating_area"])
    .optional(),
  /**
   * Verwendete Aufteilungsmethode für teil-überlappende Heizkosten-
   * positionen. Wird im Snapshot festgehalten, damit die PDF-Anlage die
   * eingesetzte Berechnungsgrundlage transparent ausweist
   */
  prorationMethod: z.enum(["linear", "degree_days"]).optional(),
  warnings: z.array(calcWarningSchema).optional(),
  perMeter: z
    .array(
      z.object({
        meterId: z.string(),
        meterLabel: z.string(),
        serialNumber: z.string().nullable(),
        unitId: z.string().nullable(),
        unitName: z.string().nullable(),
        consumptionRaw: z.number(),
        kTotal: z.number().nullable().optional(),
        consumptionWeighted: z.number(),
      }),
    )
    .optional(),
  perUnit: z.array(
    z.object({
      unitId: z.string(),
      unitName: z.string(),
      consumptionKwh: z.number(),
      consumptionCostCents: z.number().int(),
      areaSqm: z.number(),
      basicCostCents: z.number().int(),
      totalCents: z.number().int(),
    }),
  ),
  /**
   * Vermieteranteil (Leerstand/Mieterwechsel) an Grund- bzw.
   * Verbrauchskosten, letzte Position der Flächen-/Verbrauchs-
   * Verteilung.
   */
  landlordBasicCostCents: z.number().int().optional(),
  landlordConsumptionCostCents: z.number().int().optional(),
  /**
   * Wird gesetzt, wenn mindestens eine Wohnung eine eigene Heizfläche hat,
   * die von der Wohnfläche abweicht -> Hinweit in Anlage
   */
  heatingAreaDiffersFromLivingArea: z.boolean().optional(),
  /**
   * Aufschlüsselung der Heizkosten-Gesamtsumme nach Kostenarten. Wird im
   * Snapshot festgehalten, damit die PDF-Anlage die Zusammensetzung des
   * Heizkostentopfes ausweist
   */
  costBreakdown: z
    .array(
      z.object({
        label: z.string(),
        amountCents: z.number().int(),
      }),
    )
    .optional(),
  /**
   * Eingesetzter Energieträger (§ 6a HeizkostenV Pflichtangabe). Optional -
   * fehlt im externen Heizkosten-Modus, in dem kein Energieträger erfasst wird.
   */
  fuelType: z
    .enum([
      "gas",
      "oil",
      "district_heat",
      "pellets",
      "wood",
      "electricity",
      "heat_pump",
      "other",
    ])
    .optional(),
  /**
   * CO2KostAufG-Aufteilung (Wohngebäude). Der `landlordDeductionCents` ist
   * bereits aus `totalHeatingCostsCents` herausgerechnet. Optional - fehlt
   * bei deaktivierter Aufteilung und ohne erfasste CO2-Werte.
   */
  co2Detail: z
    .object({
      totalCostCents: z.number().int(),
      totalAmountGrams: z.number().int(),
      emissionsKgPerSqmYear: z.number(),
      landlordSharePercent: z.number().int().min(0).max(100),
      landlordDeductionCents: z.number().int(),
    })
    .optional(),
  /**
   * Warmwasser-Abspaltung (§ 9 Abs. 2 HeizkostenV). Gesetzt, wenn der
   * Warmwasseranteil aus dem Heizkostentopf herausgerechnet wurde. Optional -
   * fehlt ohne zentrales Warmwasser.
   */
  hotWaterDetail: z
    .object({
      method: z.enum(["boiler_meter", "estimated", "flat_rate_fallback"]),
      totalHeatEnergyKwh: z.number(),
      hotWaterHeatKwh: z.number(),
      hotWaterShareBps: z.number().int().min(0).max(10_000),
      hotWaterPotCents: z.number().int(),
      supplyTemperatureCelsius: z.number().optional(),
      hotWaterVolumeM3: z.number().optional(),
      consumptionShareBps: z.number().int().min(0).max(10_000),
      consumptionPortionCents: z.number().int(),
      basicPortionCents: z.number().int(),
      consumptionDistributionMethod: z.enum(["consumption", "heating_area"]),
      perUnit: z.array(
        z.object({
          unitId: z.string(),
          unitName: z.string(),
          hotWaterM3: z.number(),
          consumptionCostCents: z.number().int(),
          areaSqm: z.number(),
          basicCostCents: z.number().int(),
          totalCents: z.number().int(),
        }),
      ),
      landlordBasicCostCents: z.number().int(),
      landlordConsumptionCostCents: z.number().int(),
    })
    .optional(),
});

const paymentSummarySchema = z.object({
  id: z.string().min(1),
  forMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/u),
  date: isoDate(),
  baseRentCents: z.number().int(),
  advanceCents: z.number().int(),
  reference: z.string().nullable(),
});

const advanceAdjustmentSchema = z.object({
  currentMonthlyAdvanceCents: z.number().int().nonnegative(),
  currentMonthlyBaseRentCents: z.number().int().nonnegative(),
  suggestedMonthlyAdvanceCents: z.number().int().nonnegative(),
  suggestedMonthlyAdvanceWithTariffsCents: z.number().int().nonnegative(),
  tenantBilledDays: z.number().int().positive(),
  adjustedMonthlyAdvanceCents: z.number().int().positive().nullable(),
  adjustedAdvanceValidFrom: isoDate().nullable(),
  tariffAdjustmentBps: z.record(z.string(), z.number().int()).nullable(),
  autoTariffAdjustmentBps: z.record(z.string(), z.number().int()).nullable(),
});

const taxableLaborCostsSchema = z.object({
  byCategory: z.array(
    z.object({
      category: z.enum(["craftsman", "household_service"]),
      tenantTotalCents: z.number().int().nonnegative(),
      lines: z.array(
        z.object({
          costTypeId: z.string().min(1),
          costTypeName: z.string().min(1),
          tenantAmountCents: z.number().int().nonnegative(),
        }),
      ),
    }),
  ),
});

/**
 * Runtime-Validation für einen `StatementResult` vor dem Persistieren
 * im Snapshot. Zweck: vor dem Finalisieren sicherstellen, dass ALLE Felder
 * gesetzt sind, die die PDF-Generierung und spätere Wiederauswertung
 * brauchen. Ein unvollständiger Snapshot wäre unumkehrbar kaputt.
 * Bewusst strikt gehalten.
 */
export const statementResultSchema: z.ZodType<StatementResult> = z.object({
  version: z.number().int().positive(),
  tenantId: z.string().min(1),
  unitId: z.string().min(1),
  period: periodSchema,
  tenantPeriod: periodSchema,
  lines: z.array(costLineResultSchema),
  totalCostsCents: z.number().int(),
  totalAdvancesCents: z.number().int(),
  balanceCents: z.number().int(),
  waterDetail: waterDetailSchema.optional(),
  heatingDetail: heatingDetailSchema.optional(),
  occupancyDetail: occupancyDetailSchema.optional(),
  warnings: z.array(z.string()).optional(),
  payments: z.array(paymentSummarySchema).optional(),
  advanceAdjustment: advanceAdjustmentSchema.optional(),
  taxableLaborCosts: taxableLaborCostsSchema.optional(),
});
