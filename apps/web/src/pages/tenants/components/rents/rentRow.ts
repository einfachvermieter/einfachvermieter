import {
  RENT_CHANGE_REASON_NONE,
  type TenantFormValues,
  tenantFormSchema,
} from "@einfachvermieter/shared";

export type RentRowValues = TenantFormValues["rents"][number];

export const rentRowSchema = tenantFormSchema.shape.rents.element;

export const emptyRentRow = (startDate = ""): RentRowValues => ({
  startDate,
  endDate: "",
  monthlyBaseRentEuros: "0,00",
  monthlyAdvanceEuros: "0,00",
  changeReason: RENT_CHANGE_REASON_NONE,
  changeNote: "",
});
