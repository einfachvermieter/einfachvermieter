import { messageKey } from "@einfachvermieter/i18n";
import { z } from "zod";

export const buildingCreateSchema = z
  .object({
    name: z
      .string()
      .min(1, messageKey("validation.required"))
      .max(200, messageKey("validation.tooLong", { max: 200 })),
    addressStreet: z
      .string()
      .min(1, messageKey("validation.required"))
      .max(200, messageKey("validation.tooLong", { max: 200 })),
    addressPostalCode: z
      .string()
      .regex(
        /^\d{5}$/u,
        messageKey("ui.buildings.validation.postalCodeFormat"),
      ),
    addressCity: z
      .string()
      .min(1, messageKey("validation.required"))
      .max(100, messageKey("validation.tooLong", { max: 100 })),
  })
  .strict();
export type BuildingCreateDto = z.infer<typeof buildingCreateSchema>;

export const buildingUpdateSchema = buildingCreateSchema.partial();
export type BuildingUpdateDto = z.infer<typeof buildingUpdateSchema>;
