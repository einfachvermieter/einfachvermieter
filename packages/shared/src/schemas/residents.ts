import { z } from "zod";

export const residentCreateSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
});
export type ResidentCreateDto = z.infer<typeof residentCreateSchema>;
