import { z } from "zod";

export const statsResultSchema = z.object({
  buildings: z.number().int().nonnegative(),
  units: z.number().int().nonnegative(),
  meters: z.number().int().nonnegative(),
  tenants: z.number().int().nonnegative(),
  residents: z.number().int().nonnegative(),
  costTypes: z.number().int().nonnegative(),
  costs: z.number().int().nonnegative(),
  payments: z.number().int().nonnegative(),
  statements: z.number().int().nonnegative(),
});

export type StatsResult = z.infer<typeof statsResultSchema>;
