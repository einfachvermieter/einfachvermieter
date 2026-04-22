import {
  type TenantFormValues,
  tenantFormSchema,
} from "@einfachvermieter/shared";

export type BankAccountRowValues = TenantFormValues["bankAccounts"][number];

export const bankAccountRowSchema = tenantFormSchema.shape.bankAccounts.element;

export const emptyBankAccountRow = (): BankAccountRowValues => ({
  startDate: "",
  endDate: "",
  iban: "",
  bic: "",
  accountHolder: "",
  sepaEnabled: false,
  mandateReference: "",
  mandateSignedAt: "",
});
