import { zodResolver } from "@hookform/resolvers/zod";
import { RiMapPinLine } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { DateInput } from "@/components/form/DateInput";
import { FormSheet } from "@/components/form/FormSheet";
import { TextInput } from "@/components/form/TextInput";
import { FieldGroup } from "@/components/ui/Field";
import { t } from "../../../lib/i18n";
import {
  type AddressRowValues,
  addressRowSchema,
} from "../components/addresses/addressRow";

const today = new Date();
const validityCalendarStart = new Date(today.getFullYear() - 20, 0, 1);
const validityCalendarEnd = new Date(today.getFullYear() + 5, 11, 1);

/**
 * Eine abweichende Anschrift im FormSheet erfassen bzw. bearbeiten
 */
export const TenantAddressSheet = ({
  title,
  defaultValues,
  onSubmit,
  onClose,
}: {
  title: string;
  defaultValues: AddressRowValues;
  onSubmit: (values: AddressRowValues) => Promise<void>;
  onClose: () => void;
}) => {
  const form = useForm<AddressRowValues>({
    resolver: zodResolver(addressRowSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  return (
    <FormSheet
      form={form}
      icon={RiMapPinLine}
      title={title}
      submitLabel={t("ui.common.action.save")}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DateInput
          control={form.control}
          name="startDate"
          label={t("ui.tenant.fields.validFrom")}
          optional={true}
          startMonth={validityCalendarStart}
          endMonth={validityCalendarEnd}
        />
        <DateInput
          control={form.control}
          name="endDate"
          label={t("ui.tenant.fields.validTo")}
          optional={true}
          startMonth={validityCalendarStart}
          endMonth={validityCalendarEnd}
        />
        <TextInput
          control={form.control}
          name="street"
          label={t("ui.tenant.fields.addressStreet")}
          placeholder={t("ui.tenant.fields.addressStreetPlaceholder")}
          inputClassName="sm:col-span-2"
        />
        <TextInput
          control={form.control}
          name="postalCode"
          label={t("ui.tenant.fields.addressPostalCode")}
          inputClassName="tabular-nums"
        />
        <TextInput
          control={form.control}
          name="city"
          label={t("ui.tenant.fields.addressCity")}
        />
      </FieldGroup>
    </FormSheet>
  );
};
