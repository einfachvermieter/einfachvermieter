import { zodResolver } from "@hookform/resolvers/zod";
import { RiMoneyEuroCircleLine } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { FormSheet } from "@/components/form/FormSheet";
import { t } from "../../../lib/i18n";
import { type RentRowValues, rentRowSchema } from "../components/rents/rentRow";
import { RentFields } from "../fields/RentFields";

/**
 * Einen Mietsatz im FormSheet erfassen bzw. bearbeiten
 */
export const TenantRentSheet = ({
  title,
  defaultValues,
  onSubmit,
  onClose,
}: {
  title: string;
  defaultValues: RentRowValues;
  onSubmit: (values: RentRowValues) => Promise<void>;
  onClose: () => void;
}) => {
  const form = useForm<RentRowValues>({
    resolver: zodResolver(rentRowSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  return (
    <FormSheet
      form={form}
      icon={RiMoneyEuroCircleLine}
      title={title}
      submitLabel={t("ui.common.action.save")}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <RentFields control={form.control} />
    </FormSheet>
  );
};
