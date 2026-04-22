import {
  type TenantFormValues,
  tenantFormSchema,
} from "@einfachvermieter/shared";

export type ResidentRowValues = TenantFormValues["residents"][number];

export const residentRowSchema = tenantFormSchema.shape.residents.element;

export const emptyResidentRow = (): ResidentRowValues => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  moveInDate: "",
  moveOutDate: "",
  isContractParty: true,
});
