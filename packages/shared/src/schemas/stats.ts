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
  openStatementsCount: z.number().int().nonnegative(),
});

export type StatsResult = z.infer<typeof statsResultSchema>;

export const dashboardResultSchema = z.object({
  statementYear: z.number().int(),
  statementsDone: z.number().int().nonnegative(),
  statementsTotal: z.number().int().nonnegative(),
  statementDeadline: z.string(),
  daysUntilDeadline: z.number().int(),
  buildingsWithMissingStatements: z.array(
    z.object({ id: z.string(), name: z.string(), count: z.number().int() }),
  ),
  overdueTotalCents: z.number().int().nonnegative(),
  overdueTenants: z.array(
    z.object({
      tenantId: z.string(),
      residentNames: z.array(z.string()),
      buildingName: z.string(),
      amountCents: z.number().int(),
      sinceMonth: z.string().nullable(),
    }),
  ),
  months: z.array(
    z.object({
      month: z.string(),
      targetCents: z.number().int().nonnegative(),
      receivedCents: z.number().int().nonnegative(),
    }),
  ),
  buildings: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      unitsCount: z.number().int().nonnegative(),
      rentedCount: z.number().int().nonnegative(),
      monthlyRentCents: z.number().int().nonnegative(),
      overdueCents: z.number().int().nonnegative(),
      missingStatements: z.number().int().nonnegative(),
    }),
  ),
  unitsWithoutTenant: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      buildingId: z.string(),
      buildingName: z.string(),
    }),
  ),
  meterCount: z.number().int().nonnegative(),
});

export type DashboardResult = z.infer<typeof dashboardResultSchema>;
