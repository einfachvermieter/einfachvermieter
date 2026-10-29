import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormSheet } from "@/components/form/FormSheet";
import { IconUsers } from "@/lib/icons";
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
  contractPartyLock,
  onSubmit,
  onClose,
}: {
  title: string;
  defaultValues: ResidentRowValues;

  /**
   * Grund, warum "Vertragspartner" nicht abgewählt werden kann, sonst null
   */
  contractPartyLock: string | null;
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
      icon={IconUsers}
      title={title}
      submitLabel={t("ui.common.action.save")}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <ResidentFields
        control={form.control}
        contractPartyLock={contractPartyLock}
      />
    </FormSheet>
  );
};
