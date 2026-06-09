import type { TenantFormValues } from "@einfachvermieter/shared";
import { formatDate } from "@einfachvermieter/shared";
import { RiMoneyEuroCircleLine } from "@remixicon/react";
import { type UseFormReturn, useFieldArray } from "react-hook-form";
import {
  EditableListSection,
  type EditableListSectionRowFormProps,
} from "@/components/form/EditableListSection";
import { HelpHint } from "@/components/help/HelpHint";
import { Badge } from "@/components/ui/Badge";
import { gradients } from "../../../../lib/domainVisuals";
import { getPeriodStatusToday } from "../../../../lib/format";
import { t, translateKey } from "../../../../lib/i18n";
import { RentRowForm } from "./RentRowForm";
import { emptyRentRow, type RentRowValues } from "./rentRow";

export const Rents = ({
  form,
  tenantStartDate,
  tenantEndDate,
}: {
  form: UseFormReturn<TenantFormValues>;
  tenantStartDate: string;
  tenantEndDate: string;
}) => {
  const rentsArray = useFieldArray({ control: form.control, name: "rents" });
  const watchedRents = form.watch("rents");
  const error = translateKey(form.formState.errors.rents?.message);

  const resolveDefaultValues = (
    _editIndex: number | null,
    current: RentRowValues | undefined,
  ): RentRowValues => {
    if (current) {
      return current;
    }
    // Beim Anlegen: erster Mietsatz startet am Vertragsbeginn, weitere
    // brauchen ein leeres Startdatum (Validation erzwingt Folgedatum +1).
    return emptyRentRow(watchedRents.length === 0 ? tenantStartDate || "" : "");
  };

  const renderRowForm = ({
    defaultValues,
    editIndex,
    onSubmit,
    onCancel,
  }: EditableListSectionRowFormProps<RentRowValues>) => (
    <RentRowForm
      key={editIndex !== null ? `edit-${editIndex}` : "new"}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );

  return (
    <EditableListSection<RentRowValues>
      title={t("ui.tenant.rentsTitle")}
      titleHelp={<HelpHint>{t("ui.tenant.rentsHelp")}</HelpHint>}
      emptyHint={t("ui.tenant.rentsEmptyHint")}
      addLabel={t("ui.tenant.addRent")}
      icon={RiMoneyEuroCircleLine}
      iconBackground={gradients.money}
      fieldKeys={rentsArray.fields}
      rows={watchedRents}
      renderRow={(row, index) => {
        const effectiveStart = row.startDate || tenantStartDate;
        const effectiveEnd = row.endDate || tenantEndDate;
        const periodStatus = getPeriodStatusToday(
          effectiveStart,
          effectiveEnd,
          tenantEndDate,
        );
        return (
          <>
            <div className="flex items-center gap-2">
              <p className="truncate font-semibold tabular-nums">
                {row.monthlyBaseRentEuros
                  ? `${row.monthlyBaseRentEuros} € + ${row.monthlyAdvanceEuros || "0,00"} €`
                  : t("ui.tenant.rentIndex", { index: index + 1 })}
              </p>
              {periodStatus === "active" ? (
                <Badge variant="lightGreen">{t("ui.tenant.rentCurrent")}</Badge>
              ) : null}
              {periodStatus === "last" ? (
                <Badge variant="lightYellow">{t("ui.tenant.lastRent")}</Badge>
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
      onAppend={(values) => rentsArray.append(values)}
      onUpdate={(index, values) => rentsArray.update(index, values)}
      onRemove={(index) => rentsArray.remove(index)}
      resolveDefaultValues={resolveDefaultValues}
      renderRowForm={renderRowForm}
      addDialogTitle={t("ui.tenant.addRent")}
      editDialogTitle={t("ui.tenant.editRent")}
      confirmDeleteTitle={t("ui.tenant.confirmRemoveRent")}
      error={error}
      rowError={(index) => {
        const rowErrors = form.formState.errors.rents?.[index];
        if (!rowErrors) {
          return;
        }
        const messages = [
          rowErrors.message,
          rowErrors.startDate?.message,
          rowErrors.endDate?.message,
          rowErrors.monthlyBaseRentEuros?.message,
          rowErrors.monthlyAdvanceEuros?.message,
        ]
          .map((msg) => translateKey(msg))
          .filter((msg): msg is string => Boolean(msg));
        return messages.length > 0 ? messages.join(" · ") : undefined;
      }}
      sortIndex={(rows) => rows.map((_, i) => rows.length - 1 - i)}
    />
  );
};
