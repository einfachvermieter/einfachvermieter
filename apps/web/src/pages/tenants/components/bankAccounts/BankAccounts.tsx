import type { TenantFormValues } from "@einfachvermieter/shared";
import { formatDate, formatIban } from "@einfachvermieter/shared";
import { RiAddLine, RiBankCardLine } from "@remixicon/react";
import { useState } from "react";
import { type UseFormReturn, useFieldArray } from "react-hook-form";
import { SectionCard } from "@/components/common/SectionCard";
import { DateInput } from "@/components/form/DateInput";
import {
  EditableListSection,
  type EditableListSectionRowFormProps,
} from "@/components/form/EditableListSection";
import { SwitchInput } from "@/components/form/SwitchInput";
import { TextInput } from "@/components/form/TextInput";
import { HelpHint } from "@/components/help/HelpHint";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldGroup } from "@/components/ui/Field";
import { gradients } from "../../../../lib/domainVisuals";
import { getPeriodStatusToday } from "../../../../lib/format";
import { t, translateKey } from "../../../../lib/i18n";
import { BankAccountRowForm } from "./BankAccountRowForm";
import {
  type BankAccountRowValues,
  emptyBankAccountRow,
} from "./bankAccountRow";

const today = new Date();
const mandateCalendarStart = new Date(today.getFullYear() - 20, 0, 1);

/**
 * Nur der explizit erfasste Zeitraum wird ausgewiesen: fehlt eine Grenze,
 * "ab"/"bis", fehlen beide, leere Angabe (gilt implizit für die gesamte
 * Mietdauer).
 */
const bankPeriodText = (start: string, end: string): string => {
  if (start && end) {
    return t("ui.common.periodLabel", {
      start: formatDate(start),
      end: formatDate(end),
    });
  }
  if (start) {
    return t("ui.common.periodSince", { date: formatDate(start) });
  }
  if (end) {
    return t("ui.common.periodUntil", { date: formatDate(end) });
  }
  return "";
};

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
  const simpleSepaEnabled = form.watch("bankAccounts.0.sepaEnabled");
  const error = translateKey(form.formState.errors.bankAccounts?.message);

  // Wachsende Ansicht.
  // Ein Datensatz einfach, mehrere als Verlauf
  const [historyOpen, setHistoryOpen] = useState(
    watchedBankAccounts.length > 1,
  );
  const [openAdd, setOpenAdd] = useState(false);

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

  if (!historyOpen && watchedBankAccounts.length === 1) {
    // Fehler versteckter Detailfelder (Mandat, Zeitraum) sichtbar machen
    const rowErrors = form.formState.errors.bankAccounts?.[0];
    const hiddenError = [
      rowErrors?.message,
      rowErrors?.mandateReference?.message,
      rowErrors?.mandateSignedAt?.message,
      rowErrors?.startDate?.message,
      rowErrors?.endDate?.message,
    ]
      .map((message) => translateKey(message))
      .filter(Boolean)
      .join(t("ui.common.separators.bullet"));

    return (
      <SectionCard
        icon={RiBankCardLine}
        iconBackground={gradients.bank}
        title={t("ui.tenant.fields.bankAccount")}
        titleExtra={<HelpHint>{t("ui.tenant.bankAccountsHelp")}</HelpHint>}
        description={t("ui.tenant.bankSimpleDescription")}
        action={
          <Button
            type="button"
            variant="addLink"
            size="text"
            onClick={() => {
              setOpenAdd(true);
              setHistoryOpen(true);
            }}
          >
            <RiAddLine />
            {t("ui.tenant.addBankAccount")}
          </Button>
        }
      >
        <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput
            control={form.control}
            name="bankAccounts.0.iban"
            label={t("ui.tenant.fields.iban")}
          />
          <TextInput
            control={form.control}
            name="bankAccounts.0.accountHolder"
            label={t("ui.tenant.fields.accountHolder")}
          />
        </FieldGroup>
        <div className="mt-4">
          <SwitchInput
            control={form.control}
            name="bankAccounts.0.sepaEnabled"
            label={t("ui.tenant.fields.sepaEnabled")}
          />
        </div>
        {simpleSepaEnabled ? (
          <FieldGroup className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput
              control={form.control}
              name="bankAccounts.0.mandateReference"
              label={t("ui.tenant.fields.mandateReference")}
              inputClassName="tabular-nums"
            />
            <DateInput
              control={form.control}
              name="bankAccounts.0.mandateSignedAt"
              label={t("ui.tenant.fields.mandateSignedAt")}
              startMonth={mandateCalendarStart}
              endMonth={today}
            />
          </FieldGroup>
        ) : null}
        {hiddenError || error ? (
          <p className="mt-2 text-sm text-destructive">
            {hiddenError || error}
          </p>
        ) : null}
      </SectionCard>
    );
  }

  return (
    <EditableListSection<BankAccountRowValues>
      title={t("ui.tenant.fields.bankAccount")}
      titleHelp={<HelpHint>{t("ui.tenant.bankAccountsHelp")}</HelpHint>}
      description={t("ui.tenant.bankAccountsDescription")}
      emptyHint={t("ui.tenant.bankAccountsEmptyHint")}
      addLabel={t("ui.tenant.addBankAccount")}
      icon={RiBankCardLine}
      iconBackground={gradients.bank}
      defaultOpenAdd={openAdd}
      onFormCancel={() => {
        // Zurück zur einfachen Ansicht, solange es bei der einen Bankverbindung bleibt
        if (watchedBankAccounts.length === 1) {
          setHistoryOpen(false);
          setOpenAdd(false);
        }
      }}
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

        const periodText = bankPeriodText(row.startDate, row.endDate);

        return (
          <>
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold tabular-nums">
                {title}
              </p>
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
            {row.accountHolder || periodText ? (
              <p className="truncate text-sm">
                {row.accountHolder}
                {row.accountHolder && periodText
                  ? t("ui.common.separators.bullet")
                  : null}
                {periodText ? (
                  <span className="text-muted-foreground tabular-nums">
                    {periodText}
                  </span>
                ) : null}
              </p>
            ) : null}
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
      confirmDeleteTitle={t("ui.tenant.confirmRemoveBankAccount")}
      error={error}
      rowError={(index) =>
        translateKey(form.formState.errors.bankAccounts?.[index]?.message)
      }
    />
  );
};
