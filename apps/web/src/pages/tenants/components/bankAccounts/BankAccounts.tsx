import type { TenantFormValues } from "@einfachvermieter/shared";
import { formatDate, formatIban } from "@einfachvermieter/shared";
import { type UseFormReturn, useFieldArray } from "react-hook-form";
import {
  EditableListSection,
  type EditableListSectionRowFormProps,
} from "@/components/form/EditableListSection";
import { HelpHint } from "@/components/help/HelpHint";
import { Badge } from "@/components/ui/Badge";
import { getPeriodStatusToday } from "../../../../lib/format";
import { t, translateKey } from "../../../../lib/i18n";
import { BankAccountRowForm } from "./BankAccountRowForm";
import {
  type BankAccountRowValues,
  emptyBankAccountRow,
} from "./bankAccountRow";

export const BankAccounts = ({
  form,
  tenantStartDate,
  tenantEndDate,
}: {
  form: UseFormReturn<TenantFormValues>;
  tenantStartDate: string;
  tenantEndDate: string;
}) => {
  const bankAccountsArray = useFieldArray({
    control: form.control,
    name: "bankAccounts",
  });
  const watchedBankAccounts = form.watch("bankAccounts");
  const error = translateKey(form.formState.errors.bankAccounts?.message);

  const renderRowForm = ({
    defaultValues,
    editIndex,
    onSubmit,
    onCancel,
  }: EditableListSectionRowFormProps<BankAccountRowValues>) => (
    <BankAccountRowForm
      key={editIndex !== null ? `edit-${editIndex}` : "new"}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );

  return (
    <EditableListSection<BankAccountRowValues>
      title={t("ui.tenant.fields.bankAccount")}
      titleHelp={<HelpHint>{t("ui.tenant.bankAccountsHelp")}</HelpHint>}
      emptyHint={t("ui.tenant.bankAccountsEmptyHint")}
      addLabel={t("ui.tenant.addBankAccount")}
      fieldKeys={bankAccountsArray.fields}
      rows={watchedBankAccounts}
      renderRow={(row, index) => {
        const effectiveStart = row.startDate || tenantStartDate;
        const effectiveEnd = row.endDate || tenantEndDate;
        const periodStatus = getPeriodStatusToday(
          effectiveStart,
          effectiveEnd,
          tenantEndDate,
        );

        const title = row.iban
          ? formatIban(row.iban)
          : t("ui.tenant.bankAccountIndex", { index: index + 1 });

        return (
          <>
            <div className="flex items-center gap-2">
              <p className="truncate font-semibold tabular-nums">{title}</p>
              {periodStatus === "active" ? (
                <Badge variant="lightGreen">
                  {t("ui.tenant.bankAccountCurrent")}
                </Badge>
              ) : null}
              {periodStatus === "last" ? (
                <Badge variant="lightYellow">
                  {t("ui.tenant.lastBankAccount")}
                </Badge>
              ) : null}
              {row.mandateReference ? (
                <Badge variant="lightBlue">{t("ui.tenant.mandateBadge")}</Badge>
              ) : null}
            </div>
            {row.accountHolder ? (
              <p className="truncate text-sm">{row.accountHolder}</p>
            ) : null}
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
      onAppend={(values) => bankAccountsArray.append(values)}
      onUpdate={(index, values) => bankAccountsArray.update(index, values)}
      onRemove={(index) => bankAccountsArray.remove(index)}
      resolveDefaultValues={(_editIndex, current) =>
        current ?? emptyBankAccountRow()
      }
      renderRowForm={renderRowForm}
      addDialogTitle={t("ui.tenant.addBankAccount")}
      editDialogTitle={t("ui.tenant.editBankAccount")}
      confirmDeleteTitle={t("ui.tenant.confirmRemoveBankAccount")}
      error={error}
      rowError={(index) =>
        translateKey(form.formState.errors.bankAccounts?.[index]?.message)
      }
    />
  );
};
