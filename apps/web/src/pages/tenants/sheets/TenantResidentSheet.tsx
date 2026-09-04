import { zodResolver } from "@hookform/resolvers/zod";
import { RiGroupLine } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { FormSheet } from "@/components/form/FormSheet";
import { t } from "../../../lib/i18n";
import {
  type ResidentRowValues,
  residentRowSchema,
} from "../components/residents/residentRow";
import { ResidentFields } from "../fields/ResidentFields";

/**
 * Einen Bewohner im FormSheet erfassen bzw. bearbeiten
 */
export const TenantResidentSheet = ({
  title,
  defaultValues,
  lockContractParty,
  onSubmit,
  onClose,
}: {
  title: string;
  defaultValues: ResidentRowValues;

  /**
   * Beim einzigen Bewohner bleibt "Vertragspartner" erzwungen an
   */
  lockContractParty: boolean;
  onSubmit: (values: ResidentRowValues) => Promise<void>;
  onClose: () => void;
}) => {
  const form = useForm<ResidentRowValues>({
    resolver: zodResolver(residentRowSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  return (
    <FormSheet
      form={form}
      icon={RiGroupLine}
      title={title}
      submitLabel={t("ui.common.action.save")}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <ResidentFields
        control={form.control}
        lockContractParty={lockContractParty}
      />
    </FormSheet>
  );
};
