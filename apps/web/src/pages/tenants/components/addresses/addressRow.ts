import {
  type TenantFormValues,
  tenantFormSchema,
} from "@einfachvermieter/shared";

export type AddressRowValues = TenantFormValues["addresses"][number];

export const addressRowSchema = tenantFormSchema.shape.addresses.element;

export const emptyAddressRow = (): AddressRowValues => ({
  startDate: "",
  endDate: "",
  street: "",
  postalCode: "",
  city: "",
});
