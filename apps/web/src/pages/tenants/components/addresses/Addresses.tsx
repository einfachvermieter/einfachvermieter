import type { TenantFormValues } from "@einfachvermieter/shared";
import { formatDate } from "@einfachvermieter/shared";
import { type UseFormReturn, useFieldArray } from "react-hook-form";
import {
  EditableListSection,
  type EditableListSectionRowFormProps,
} from "@/components/form/EditableListSection";
import { HelpHint } from "@/components/help/HelpHint";
import { Badge } from "@/components/ui/Badge";
import { getPeriodStatusToday } from "../../../../lib/format";
import { t, translateKey } from "../../../../lib/i18n";
import { AddressRowForm } from "./AddressRowForm";
import { type AddressRowValues, emptyAddressRow } from "./addressRow";

export const Addresses = ({
  form,
  tenantStartDate,
  tenantEndDate,
}: {
  form: UseFormReturn<TenantFormValues>;
  tenantStartDate: string;
  tenantEndDate: string;
}) => {
  const addressesArray = useFieldArray({
    control: form.control,
    name: "addresses",
  });
  const watchedAddresses = form.watch("addresses");
  const error = translateKey(form.formState.errors.addresses?.message);

  const renderRowForm = ({
    defaultValues,
    editIndex,
    onSubmit,
    onCancel,
  }: EditableListSectionRowFormProps<AddressRowValues>) => (
    <AddressRowForm
      key={editIndex !== null ? `edit-${editIndex}` : "new"}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );

  return (
    <EditableListSection<AddressRowValues>
      title={t("ui.tenant.fields.address")}
      titleHelp={<HelpHint>{t("ui.tenant.addressesHelp")}</HelpHint>}
      emptyHint={t("ui.tenant.addressesEmptyHint")}
      addLabel={t("ui.tenant.addAddress")}
      fieldKeys={addressesArray.fields}
      rows={watchedAddresses}
      renderRow={(row, index) => {
        const effectiveStart = row.startDate || tenantStartDate;
        const effectiveEnd = row.endDate || tenantEndDate;
        const periodStatus = getPeriodStatusToday(
          effectiveStart,
          effectiveEnd,
          tenantEndDate,
        );
        const title =
          [row.street, [row.postalCode, row.city].filter(Boolean).join(" ")]
            .filter(Boolean)
            .join(", ") || t("ui.tenant.addressIndex", { index: index + 1 });
        return (
          <>
            <div className="flex items-center gap-2">
              <p className="truncate font-semibold">{title}</p>
              {periodStatus === "active" ? (
                <Badge variant="lightGreen">
                  {t("ui.tenant.addressCurrent")}
                </Badge>
              ) : null}
              {periodStatus === "last" ? (
                <Badge variant="lightYellow">
                  {t("ui.tenant.lastAddress")}
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">
              {t("ui.common.periodLabel", {
                start: effectiveStart ? formatDate(effectiveStart) : "?",
                end: effectiveEnd
                  ? formatDate(effectiveEnd)
                  : t("ui.tenant.openEnded"),
              })}
            </p>
          </>
        );
      }}
      onAppend={(values) => addressesArray.append(values)}
      onUpdate={(index, values) => addressesArray.update(index, values)}
      onRemove={(index) => addressesArray.remove(index)}
      resolveDefaultValues={(_editIndex, current) =>
        current ?? emptyAddressRow()
      }
      renderRowForm={renderRowForm}
      addDialogTitle={t("ui.tenant.addAddress")}
      editDialogTitle={t("ui.tenant.editAddress")}
      confirmDeleteTitle={t("ui.tenant.confirmRemoveAddress")}
      error={error}
      rowError={(index) =>
        translateKey(form.formState.errors.addresses?.[index]?.message)
      }
    />
  );
};
