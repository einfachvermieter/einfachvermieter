import { messageKey } from "@einfachvermieter/i18n";
import { z } from "zod";

export const unitCreateSchema = z.object({
  buildingId: z.guid(),
  name: z
    .string()
    .min(1, messageKey("validation.required"))
    .max(100, messageKey("validation.tooLong", { max: 100 })),
  unitNumber: z
    .string()
    .max(50, messageKey("validation.tooLong", { max: 50 }))
    .nullable()
    .optional(),
  areaSqm: z.number().positive().max(10_000),
  heatingAreaSqm: z.number().positive().max(10_000).nullable().optional(),
});
export type UnitCreateDto = z.infer<typeof unitCreateSchema>;

export const unitUpdateSchema = unitCreateSchema
  .partial()
  .omit({ buildingId: true });
export type UnitUpdateDto = z.infer<typeof unitUpdateSchema>;

const decimalRegex = /^-?\d+([.,]\d+)?$/u;

const parseDecimal = (value: string): number =>
  Number.parseFloat(value.replace(",", "."));

export type UnitFormValues = {
  buildingId: string;
  name: string;
  unitNumber: string;
  areaSqm: string;
  heatingAreaSqm: string;
};

export const unitFormSchema = z.object({
  buildingId: z
    .string()
    .min(1, messageKey("ui.units.validation.buildingRequired"))
    .pipe(unitCreateSchema.shape.buildingId),
  name: z
    .string()
    .min(1, messageKey("ui.units.validation.nameRequired"))
    .pipe(unitCreateSchema.shape.name),
  unitNumber: z.string().max(50, messageKey("validation.tooLong", { max: 50 })),
  areaSqm: z
    .string()
    .min(1, messageKey("ui.units.validation.areaRequired"))
    .regex(decimalRegex, messageKey("ui.units.validation.areaInvalid"))
    .refine(
      (value) => parseDecimal(value) > 0,
      messageKey("ui.units.validation.areaPositive"),
    )
    .refine(
      (value) => parseDecimal(value) <= 10_000,
      messageKey("ui.units.validation.areaTooLarge"),
    ),
  heatingAreaSqm: z
    .string()
    .refine(
      (value) => value === "" || decimalRegex.test(value),
      messageKey("ui.units.validation.areaInvalid"),
    )
    .refine(
      (value) => value === "" || parseDecimal(value) > 0,
      messageKey("ui.units.validation.areaPositive"),
    )
    .refine(
      (value) => value === "" || parseDecimal(value) <= 10_000,
      messageKey("ui.units.validation.areaTooLarge"),
    ),
});

export const unitFormToDto = (values: UnitFormValues): UnitCreateDto => ({
  buildingId: values.buildingId,
  name: values.name,
  unitNumber: values.unitNumber.trim() === "" ? null : values.unitNumber.trim(),
  areaSqm: parseDecimal(values.areaSqm),
  heatingAreaSqm:
    values.heatingAreaSqm === "" ? null : parseDecimal(values.heatingAreaSqm),
});
