import type {
  AccountFeeCreateDto,
  AccountFeeUpdateDto,
} from "@einfachvermieter/shared";
import {
  centsToEurInput,
  parseEurToCents,
  todayIso,
  unsignedAmountRegex,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  RiArrowDownCircleLine,
  RiArrowUpCircleLine,
  RiReceiptLine,
} from "@remixicon/react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ChoiceTilesInput } from "@/components/form/ChoiceTilesInput";
import { DateInput } from "@/components/form/DateInput";
import { FormSheet } from "@/components/form/FormSheet";
import { TextInput } from "@/components/form/TextInput";
import { type FeeRow, feeIdentityLabel } from "@/lib/accounts";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useCrudMutation } from "@/lib/useCrudMutation";

/**
 * "charge" = Forderung (positives Soll), "credit" = Gutschrift (negatives
 * Soll -> Guthaben für den Mieter)
 */
const feeFormSchema = z.object({
  kind: z.enum(["charge", "credit"]),
  date: z.string().min(1),
  amountInput: z.string().min(1).regex(unsignedAmountRegex),
  reason: z.string().min(1).max(500),
});
type FeeFormValues = z.infer<typeof feeFormSchema>;

const today = new Date();
const calendarStart = new Date(today.getFullYear() - 10, 0, 1);
const calendarEnd = new Date(today.getFullYear() + 1, 11, 1);

/**
 * Gebühr (Forderung) oder Gutschrift erfassen bzw. bearbeiten im
 * FormSheet. `fee` gesetzt = Bearbeiten.
 */
export const FeeSheet = ({
  tenantId,
  fee,
  onClose,
}: {
  tenantId: string;
  fee?: FeeRow | null;
  onClose: () => void;
}) => {
  const form = useForm<FeeFormValues>({
    resolver: zodResolver(feeFormSchema),
    reValidateMode: "onSubmit",
    defaultValues: fee
      ? {
          kind: fee.pot.sollCents < 0 ? "credit" : "charge",
          date: fee.date,
          amountInput: centsToEurInput(Math.abs(fee.pot.sollCents)),
          reason: fee.reason,
        }
      : {
          kind: "charge",
          date: todayIso(),
          amountInput: "",
          reason: "",
        },
  });

  const saveFee = useCrudMutation({
    mutationFn: (dto: AccountFeeCreateDto | AccountFeeUpdateDto) =>
      fee
        ? api.patch(`/accounts/fees/${fee.feeId}`, dto)
        : api.post("/accounts/fees", dto),
    invalidateKeys: [["accounts"]],
    onSuccess: onClose,
  });

  const handleSubmit = async (values: FeeFormValues) => {
    const magnitude = parseEurToCents(values.amountInput);
    const amountCents = values.kind === "credit" ? -magnitude : magnitude;
    const reason = values.reason.trim();

    await saveFee.mutateAsync(
      fee
        ? { date: values.date, amountCents, reason }
        : { tenantId, date: values.date, amountCents, reason },
    );
  };

  return (
    <FormSheet
      form={form}
      icon={RiReceiptLine}
      title={fee ? feeIdentityLabel(fee) : t("ui.account.fee.title")}
      submitLabel={
        fee ? t("ui.common.action.save") : t("ui.common.action.record")
      }
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <ChoiceTilesInput
        control={form.control}
        name="kind"
        options={[
          {
            value: "charge",
            icon: RiArrowUpCircleLine,
            title: t("ui.account.fee.kindCharge"),
            description: t("ui.account.fee.kindChargeHint"),
          },
          {
            value: "credit",
            icon: RiArrowDownCircleLine,
            title: t("ui.account.fee.kindCredit"),
            description: t("ui.account.fee.kindCreditHint"),
          },
        ]}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DateInput
          control={form.control}
          name="date"
          label={t("ui.account.columns.date")}
          startMonth={calendarStart}
          endMonth={calendarEnd}
        />
        <TextInput
          control={form.control}
          name="amountInput"
          label={t("ui.account.fee.amountLabel")}
          inputMode="decimal"
          placeholder={t("ui.common.placeholders.amount")}
          suffix="€"
        />
      </div>
      <TextInput
        control={form.control}
        name="reason"
        label={t("ui.account.fee.reason")}
        placeholder={t("ui.account.fee.reasonPlaceholder")}
      />
    </FormSheet>
  );
};
