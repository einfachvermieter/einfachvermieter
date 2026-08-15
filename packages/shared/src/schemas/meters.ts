import { messageKey, type TranslateFn } from "@einfachvermieter/i18n";
import { z } from "zod";
import type { MeasurementUnit } from "./common.js";
import { ISO_DATE_REGEX, isoDate, measurementUnits } from "./common.js";

export type { MeasurementUnit } from "./common.js";
export { measurementUnits } from "./common.js";

/**
 * Medium / "Art" des Zählers.
 */
export const meterTypes = [
  "water_cold",
  "water_hot",
  "electricity",
  "gas",
  "heat_meter",
  "heat_cost_allocator",
] as const;
export type MeterType = (typeof meterTypes)[number];

export const meterRoles = [
  "main",
  "unit",
  "sub",
  "common",
  "virtual_difference",
] as const;
export type MeterRole = (typeof meterRoles)[number];

/**
 * Medien-Typen, die als Differenzzähler konfiguriert werden dürfen.
 * Heizkostenverteiler (`heat_cost_allocator`) sind ausgeschlossen - sie
 * arbeiten geräte-/heizkörperbezogen und können fachlich nicht "minus
 * andere HKV" sein.
 */
export const isDifferenceCapableType = (type: MeterType): boolean =>
  type !== "heat_cost_allocator";

/**
 * Steuert, wie der Verbrauch eines Zählers in die Abrechnung einfließt.
 * - "heating_cost_bill": Heizkostenabrechnung (HeizkostenV) - keine Kostenarten-Zuordnung.
 * - "cost_types":        Verteilung über zugeordnete Kostenarten.
 */
export const costAllocationModes = ["heating_cost_bill", "cost_types"] as const;
export type CostAllocationMode = (typeof costAllocationModes)[number];

/**
 * Rollen, bei denen die Wohnungsauswahl angeboten wird. Differenzzähler
 * können einer Wohnung zugeordnet werden (z. B. "Wohnung B = Haupt − A"),
 * sind aber wie `sub`/`common` nicht zwingend an eine Wohnung gebunden.
 */
export const unitScopedRoles: readonly MeterRole[] = [
  "unit",
  "sub",
  "common",
  "virtual_difference",
];

export const isUnitScopedRole = (role: MeterRole): boolean =>
  unitScopedRoles.includes(role);

/**
 * Rollen, bei denen die Wohnungszuordnung Pflicht ist.
 * - `unit` (Wohnungszähler): zwingend einer Wohnung zugeordnet.
 * - `sub` (Unterzähler), `common` (Allgemeinzähler): Zuordnung optional -
 *   beide können auch gebäudeweit ohne Wohnungsbezug existieren.
 */
export const roleRequiresUnit = (role: MeterRole): boolean => role === "unit";

export const measurementUnitFor = (type: MeterType): MeasurementUnit => {
  if (type === "water_cold" || type === "water_hot" || type === "gas") {
    return "m3";
  }
  if (type === "heat_cost_allocator") {
    return "units";
  }
  return "kwh";
};

/**
 * Heizkostenverteiler erfassen Verbrauch je Heizkörper. Sie tragen
 * gerätespezifische Felder (Heizkörperdaten, KGesamt), die andere
 * Zählertypen nicht haben.
 */
export const isHeatCostAllocator = (type: MeterType): boolean =>
  type === "heat_cost_allocator";

/**
 * Zählertypen, für die Fernablesbarkeit (§ 5 Abs. 2 HeizkostenV) fachlich
 * relevant ist: die Ausstattung zur Verbrauchserfassung von Heizung und
 * Warmwasser. Nur diese Typen zeigen das Formularfeld.
 */
export const isRemoteReadableRelevantType = (type: MeterType): boolean =>
  type === "heat_cost_allocator" ||
  type === "heat_meter" ||
  type === "water_hot";

/**
 * Eine Periode des Gas-Umrechnungsfaktors. Gehört zu einem Gaszähler.
 * Mehrere Perioden je Zähler sind erlaubt. Der Umrechnungsfaktor selbst
 * ist optional - fehlt er, kann der Zähler weiterhin als reine m3-Quelle
 * verteilt werden.
 */
/**
 * Konfiguration eines Differenzzählers. `baseMeterId` ist der Ausgangs-
 * zähler (z. B. Hauptwasserzähler), `subtractedMeterIds` sind die davon
 * abzuziehenden Zähler (z. B. Wohnung A, Waschmaschine A).
 */
export const meterDifferenceConfigSchema = z.object({
  baseMeterId: z.guid(),
  subtractedMeterIds: z
    .array(z.guid())
    .min(1, messageKey("ui.meters.validation.differenceSubtractRequired")),
});
export type MeterDifferenceConfigDto = z.infer<
  typeof meterDifferenceConfigSchema
>;

export const gasFactorCreateSchema = z.object({
  id: z.guid().optional(),
  validFrom: isoDate(),
  validUntil: isoDate().nullable().optional(),
  energyFactorKwhPerM3: z.number().positive().nullable().optional(),
  notes: z
    .string()
    .max(200, messageKey("validation.tooLong", { max: 200 }))
    .nullable()
    .optional(),
});
export type GasFactorCreateDto = z.infer<typeof gasFactorCreateSchema>;

const meterBaseShape = {
  buildingId: z.guid(),
  unitId: z.guid().nullable().optional(),
  type: z.enum(meterTypes),
  role: z.enum(meterRoles),
  label: z
    .string()
    .min(1, messageKey("validation.required"))
    .max(200, messageKey("validation.tooLong", { max: 200 })),
  serialNumber: z
    .string()
    .max(100, messageKey("validation.tooLong", { max: 100 }))
    .nullable()
    .optional(),
  measurementUnit: z.enum(measurementUnits),
  room: z
    .string()
    .max(100, messageKey("validation.tooLong", { max: 100 }))
    .nullable()
    .optional(),
  /**
   * HKV-spezifische Felder (nur für `type = "heat_cost_allocator"`).
   * `kTotal` ist Pflicht bei HKV (Bewertungsfaktor des Heizkörpers),
   * die übrigen Heizkörperangaben sind beschreibend und optional.
   */
  radiator: z
    .string()
    .max(200, messageKey("validation.tooLong", { max: 200 }))
    .nullable()
    .optional(),
  kTotal: z.number().positive().nullable().optional(),
  radiatorManufacturer: z
    .string()
    .max(100, messageKey("validation.tooLong", { max: 100 }))
    .nullable()
    .optional(),
  radiatorModel: z
    .string()
    .max(100, messageKey("validation.tooLong", { max: 100 }))
    .nullable()
    .optional(),
  radiatorType: z
    .string()
    .max(100, messageKey("validation.tooLong", { max: 100 }))
    .nullable()
    .optional(),
  radiatorDimensions: z
    .string()
    .max(100, messageKey("validation.tooLong", { max: 100 }))
    .nullable()
    .optional(),
  /**
   * Gerät ist fernablesbar (§ 5 Abs. 2 HeizkostenV). Nur für die
   * Verbrauchserfassung Heizung/Warmwasser relevant; steuert den Hinweis
   * auf die unterjährigen Verbrauchsinformationen nach § 6a Abs. 1/2.
   */
  isRemoteReadable: z.boolean().optional(),
  /**
   * Gültigkeitszeitraum für die Abrechnung. Nur Abrechnungen, deren Zeitraum
   * mit [validFrom, validUntil] überlappt, berücksichtigen diesen Zähler.
   * `validUntil = null` -> Zähler ist ab `validFrom` unbefristet gültig.
   */
  validFrom: isoDate(),
  validUntil: isoDate().nullable().optional(),
  /**
   * Gas-Umrechnungsfaktor-Perioden. Nur für `type = "gas"` befüllt; für
   * andere Typen leer/undefined.
   */
  gasFactors: z.array(gasFactorCreateSchema).optional(),
  costAllocationMode: z.enum(costAllocationModes).default("cost_types"),
  costTypeIds: z.array(z.guid()).optional(),
  /**
   * Nur bei `role = "virtual_difference"` befüllt. Sonst `null`/undefined.
   */
  differenceConfig: meterDifferenceConfigSchema.nullable().optional(),
} as const;

const meterBaseObject = z.object(meterBaseShape).strict();

const unitRequiredRolesNeedUnit = (data: {
  role: MeterRole;
  unitId?: string | null;
}) =>
  !roleRequiresUnit(data.role) ||
  (data.unitId !== null && data.unitId !== undefined);

const virtualMustNotHaveSerial = (data: {
  role: MeterRole;
  serialNumber?: string | null;
}) => data.role !== "virtual_difference" || !data.serialNumber;

const virtualNeedsConfig = (data: {
  role: MeterRole;
  differenceConfig?: MeterDifferenceConfigDto | null;
}) =>
  data.role !== "virtual_difference" ||
  (data.differenceConfig !== null && data.differenceConfig !== undefined);

const nonVirtualHasNoConfig = (data: {
  role: MeterRole;
  differenceConfig?: MeterDifferenceConfigDto | null;
}) =>
  data.role === "virtual_difference" ||
  data.differenceConfig === null ||
  data.differenceConfig === undefined;

const virtualTypeAllowed = (data: { role: MeterRole; type: MeterType }) =>
  data.role !== "virtual_difference" || isDifferenceCapableType(data.type);

const baseNotInSubtractions = (data: {
  differenceConfig?: MeterDifferenceConfigDto | null;
}) => {
  const cfg = data.differenceConfig;
  if (!cfg) {
    return true;
  }
  return !cfg.subtractedMeterIds.includes(cfg.baseMeterId);
};

export const meterCreateSchema = meterBaseObject
  .refine(unitRequiredRolesNeedUnit, {
    message: messageKey("ui.meters.validation.unitRequired"),
    path: ["unitId"],
  })
  .refine(virtualMustNotHaveSerial, {
    message: messageKey("ui.meters.validation.virtualNoSerial"),
    path: ["serialNumber"],
  })
  .refine(virtualTypeAllowed, {
    message: messageKey("ui.meters.validation.differenceUnsupportedType"),
    path: ["type"],
  })
  .refine(virtualNeedsConfig, {
    message: messageKey("ui.meters.validation.differenceBaseRequired"),
    path: ["differenceConfig"],
  })
  .refine(nonVirtualHasNoConfig, {
    message: messageKey("ui.meters.validation.differenceConfigOnlyVirtual"),
    path: ["differenceConfig"],
  })
  .refine(baseNotInSubtractions, {
    message: messageKey("ui.meters.validation.differenceBaseInSubtract"),
    path: ["differenceConfig", "baseMeterId"],
  });
export type MeterCreateDto = z.infer<typeof meterCreateSchema>;

export const meterUpdateSchema = meterBaseObject
  .partial()
  .omit({ buildingId: true });
export type MeterUpdateDto = z.infer<typeof meterUpdateSchema>;

/**
 * Quelle der Ablesung. Orthogonal zu `isEstimated`: jede Quelle kann
 * gemessen oder geschätzt liefern.
 */
export const meterReadBySources = [
  "landlord",
  "tenant",
  "utility",
  "metering_service",
  "property_management",
] as const;
export type MeterReadBy = (typeof meterReadBySources)[number];

export const meterReadingCreateSchema = z
  .object({
    meterId: z.guid(),
    readingDate: isoDate(),
    value: z.number().nonnegative(),
    isCumulative: z.boolean().default(true),
    isEstimated: z.boolean().default(false),
    readBy: z.enum(meterReadBySources).default("landlord"),
    notes: z.string().max(500).optional().nullable(),
  })
  .strict();
export type MeterReadingCreateDto = z.infer<typeof meterReadingCreateSchema>;

export const meterReadingUpdateSchema = z
  .object({
    readingDate: isoDate().optional(),
    value: z.number().nonnegative().optional(),
    isEstimated: z.boolean().optional(),
    readBy: z.enum(meterReadBySources).optional(),
    notes: z.string().max(500).optional().nullable(),
  })
  .strict();
export type MeterReadingUpdateDto = z.infer<typeof meterReadingUpdateSchema>;

const decimalRegex = /^-?\d+([.,]\d+)?$/u;

const parseDecimal = (value: string): number =>
  Number.parseFloat(value.replace(",", "."));

export const UNIT_NONE = "none";

/**
 * Eine Periode des Gas-Faktors im Formular. Jede Periode steht für sich
 * (analog zu Bewohnern/Bankverbindungen): `validFrom` ist Pflicht, alle
 * weiteren Felder sind optional. Insbesondere darf `energyFactor` leer
 * bleiben - der Zähler wird dann ohne Umrechnung verteilt.
 */
export type GasFactorFormValues = {
  id: string;
  validFrom: string;
  validUntil: string;
  energyFactor: string;
  notes: string;
};

export const gasFactorRowSchema = z.object({
  id: z.string(),
  validFrom: z
    .string()
    .min(1, messageKey("ui.meters.validation.gasFactorValidFromRequired"))
    .regex(ISO_DATE_REGEX, messageKey("ui.form.dateFormat")),
  validUntil: z
    .string()
    .refine((value) => value === "" || ISO_DATE_REGEX.test(value), {
      message: messageKey("ui.form.dateFormat"),
    }),
  energyFactor: z.string(),
  notes: z.string().max(200, messageKey("validation.tooLong", { max: 200 })),
});
export type GasFactorRowValues = z.infer<typeof gasFactorRowSchema>;

export type MeterFormValues = {
  buildingId: string;
  type: MeterType;
  role: MeterRole;
  label: string;
  serialNumber: string;
  unitId: string;
  room: string;
  gasFactors: GasFactorFormValues[];
  radiator: string;
  kTotal: string;
  radiatorManufacturer: string;
  radiatorModel: string;
  radiatorType: string;
  radiatorDimensions: string;
  isRemoteReadable: boolean;
  validFrom: string;
  validUntil: string;
  costAllocationMode: CostAllocationMode;
  costTypeIds: string[];
  /**
   * Differenzzähler-Konfiguration (nur bei `role === "virtual_difference"`).
   * Form-Repräsentation: leerer String / leeres Array, wenn nichts gewählt.
   */
  baseMeterId: string;
  subtractedMeterIds: string[];
};

export const meterFormSchema = z
  .object({
    buildingId: z
      .string()
      .min(1, messageKey("ui.meters.validation.buildingRequired"))
      .pipe(z.guid()),
    type: z.enum(meterTypes),
    role: z.enum(meterRoles),
    label: z.string().max(200, messageKey("validation.tooLong", { max: 200 })),
    serialNumber: z
      .string()
      .max(100, messageKey("validation.tooLong", { max: 100 })),
    unitId: z.string().min(1),
    room: z.string().max(100, messageKey("validation.tooLong", { max: 100 })),
    gasFactors: z.array(gasFactorRowSchema),
    radiator: z
      .string()
      .max(200, messageKey("validation.tooLong", { max: 200 })),
    kTotal: z.string(),
    radiatorManufacturer: z
      .string()
      .max(100, messageKey("validation.tooLong", { max: 100 })),
    radiatorModel: z
      .string()
      .max(100, messageKey("validation.tooLong", { max: 100 })),
    radiatorType: z
      .string()
      .max(100, messageKey("validation.tooLong", { max: 100 })),
    radiatorDimensions: z
      .string()
      .max(100, messageKey("validation.tooLong", { max: 100 })),
    isRemoteReadable: z.boolean(),
    validFrom: z
      .string()
      .min(1, messageKey("ui.meters.validation.validFromRequired"))
      .pipe(isoDate()),
    validUntil: z.string(),
    costAllocationMode: z.enum(costAllocationModes),
    costTypeIds: z.array(z.guid()),
    baseMeterId: z.string(),
    subtractedMeterIds: z.array(z.guid()),
  })
  .superRefine((data, ctx) => {
    if (data.type !== "gas") {
      return;
    }
    data.gasFactors.forEach((factor, index) => {
      if (factor.energyFactor !== "") {
        if (!decimalRegex.test(factor.energyFactor)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: messageKey("ui.meters.validation.energyFactorInvalid"),
            path: ["gasFactors", index, "energyFactor"],
          });
        } else if (parseDecimal(factor.energyFactor) <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: messageKey("ui.meters.validation.energyFactorPositive"),
            path: ["gasFactors", index, "energyFactor"],
          });
        }
      }
      if (
        factor.validUntil !== "" &&
        ISO_DATE_REGEX.test(factor.validFrom) &&
        ISO_DATE_REGEX.test(factor.validUntil) &&
        factor.validUntil < factor.validFrom
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: messageKey(
            "ui.meters.validation.gasFactorValidUntilBeforeFrom",
          ),
          path: ["gasFactors", index, "validUntil"],
        });
      }
    });
  })
  .refine((data) => data.type !== "heat_cost_allocator" || data.kTotal !== "", {
    message: messageKey("ui.meters.validation.kTotalRequired"),
    path: ["kTotal"],
  })
  .refine((data) => data.kTotal === "" || decimalRegex.test(data.kTotal), {
    message: messageKey("ui.meters.validation.kTotalInvalid"),
    path: ["kTotal"],
  })
  .refine((data) => data.kTotal === "" || parseDecimal(data.kTotal) > 0, {
    message: messageKey("ui.meters.validation.kTotalPositive"),
    path: ["kTotal"],
  })
  .refine(
    (data) => data.validUntil === "" || ISO_DATE_REGEX.test(data.validUntil),
    {
      message: messageKey("ui.meters.validation.validUntilInvalid"),
      path: ["validUntil"],
    },
  )
  .refine(
    (data) => data.validUntil === "" || data.validUntil >= data.validFrom,
    {
      message: messageKey("ui.meters.validation.validUntilBeforeValidFrom"),
      path: ["validUntil"],
    },
  )
  .refine((data) => !roleRequiresUnit(data.role) || data.unitId !== UNIT_NONE, {
    message: messageKey("ui.meters.validation.unitRequired"),
    path: ["unitId"],
  })
  .refine(
    (data) => data.role !== "virtual_difference" || data.serialNumber === "",
    {
      message: messageKey("ui.meters.validation.virtualNoSerial"),
      path: ["serialNumber"],
    },
  )
  .refine(
    (data) =>
      data.role !== "virtual_difference" || isDifferenceCapableType(data.type),
    {
      message: messageKey("ui.meters.validation.differenceUnsupportedType"),
      path: ["type"],
    },
  )
  .refine(
    (data) => data.role !== "virtual_difference" || data.baseMeterId !== "",
    {
      message: messageKey("ui.meters.validation.differenceBaseRequired"),
      path: ["baseMeterId"],
    },
  )
  .refine(
    (data) =>
      data.role !== "virtual_difference" || data.subtractedMeterIds.length > 0,
    {
      message: messageKey("ui.meters.validation.differenceSubtractRequired"),
      path: ["subtractedMeterIds"],
    },
  )
  .refine(
    (data) =>
      data.role !== "virtual_difference" ||
      !data.subtractedMeterIds.includes(data.baseMeterId),
    {
      message: messageKey("ui.meters.validation.differenceBaseInSubtract"),
      path: ["baseMeterId"],
    },
  );

/**
 * Auto-generiert ein Label aus Medium, Rolle und Raum/Bereich.
 * Wird serverseitig ebenfalls angewendet, hier aber auch in
 * Formular-Defaults nutzbar.
 */
export const buildMeterLabel = (
  input: {
    type: MeterType;
    role: MeterRole;
    room: string | null;
    radiator?: string | null;
  },
  translate: TranslateFn,
): string => {
  const parts: string[] = [];

  if (input.type === "heat_meter") {
    parts.push(translate("meters.types.heat_meter"));
  } else if (input.type === "heat_cost_allocator") {
    parts.push(translate("meters.types.heat_cost_allocator"));
    if (input.radiator) {
      parts.push(input.radiator);
    }
  } else {
    parts.push(translate(`meters.types.${input.type}`));
    parts.push(translate(`meters.roles.${input.role}`));
  }

  if (input.room) {
    parts.push(input.room);
  }

  return parts.join(" ");
};

export const meterFormToDto = (
  values: MeterFormValues,
  translate: TranslateFn,
): MeterCreateDto => {
  const isHkv = values.type === "heat_cost_allocator";
  const label =
    values.label.trim() === ""
      ? buildMeterLabel(
          {
            type: values.type,
            role: values.role,
            room: values.room === "" ? null : values.room,
            radiator: isHkv && values.radiator !== "" ? values.radiator : null,
          },
          translate,
        )
      : values.label.trim();

  const isGas = values.type === "gas";
  const blank = (s: string) => (s === "" ? null : s);
  const meterValidUntil = blank(values.validUntil);
  const buildGasFactors = (): GasFactorCreateDto[] => {
    if (!isGas) {
      return [];
    }
    return values.gasFactors.map((factor) => ({
      ...(factor.id !== "" ? { id: factor.id } : {}),
      validFrom: factor.validFrom,
      validUntil: blank(factor.validUntil),
      energyFactorKwhPerM3:
        factor.energyFactor === "" ? null : parseDecimal(factor.energyFactor),
      notes: blank(factor.notes),
    }));
  };
  const gasFactors = buildGasFactors();
  const costAllocationMode: CostAllocationMode = isHkv
    ? "heating_cost_bill"
    : values.costAllocationMode;
  const isVirtual = values.role === "virtual_difference";
  const differenceConfig: MeterDifferenceConfigDto | null = isVirtual
    ? {
        baseMeterId: values.baseMeterId,
        subtractedMeterIds: values.subtractedMeterIds,
      }
    : null;
  return {
    buildingId: values.buildingId,
    type: values.type,
    role: values.role,
    label,
    serialNumber: blank(values.serialNumber),
    measurementUnit: measurementUnitFor(values.type),
    unitId: values.unitId === UNIT_NONE ? null : values.unitId,
    room: blank(values.room),
    gasFactors,
    radiator: isHkv ? blank(values.radiator) : null,
    kTotal: isHkv && values.kTotal !== "" ? parseDecimal(values.kTotal) : null,
    radiatorManufacturer: isHkv ? blank(values.radiatorManufacturer) : null,
    radiatorModel: isHkv ? blank(values.radiatorModel) : null,
    radiatorType: isHkv ? blank(values.radiatorType) : null,
    radiatorDimensions: isHkv ? blank(values.radiatorDimensions) : null,
    isRemoteReadable: isRemoteReadableRelevantType(values.type)
      ? values.isRemoteReadable
      : false,
    validFrom: values.validFrom,
    validUntil: meterValidUntil,
    costAllocationMode,
    costTypeIds: costAllocationMode === "cost_types" ? values.costTypeIds : [],
    differenceConfig,
  };
};
