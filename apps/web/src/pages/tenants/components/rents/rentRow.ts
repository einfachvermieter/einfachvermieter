import {
  type TenantFormValues,
  tenantFormSchema,
} from "@einfachvermieter/shared";

export type RentRowValues = TenantFormValues["rents"][number];

export const rentRowSchema = tenantFormSchema.shape.rents.element;

export const emptyRentRow = (startDate: string): RentRowValues => ({
  startDate,
  endDate: "",
  monthlyBaseRentEuros: "0,00",
  monthlyAdvanceEuros: "0,00",
  reductionReason: "",
});
