import {
  type GasFactorRowValues,
  gasFactorRowSchema,
} from "@einfachvermieter/shared";

export type { GasFactorRowValues };
export { gasFactorRowSchema };

export const emptyGasFactorRow = (): GasFactorRowValues => ({
  id: "",
  validFrom: "",
  validUntil: "",
  energyFactor: "",
  notes: "",
});
