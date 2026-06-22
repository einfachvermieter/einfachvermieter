import {
  type AccountFeeCreateDto,
  parseEurToCents,
  todayIso,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiArrowDownCircleLine, RiArrowUpCircleLine } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ChoiceTilesInput } from "@/components/form/ChoiceTilesInput";
import { DateInput } from "@/components/form/DateInput";
import { SubformShell } from "@/components/form/SubformShell";
import { TextInput } from "@/components/form/TextInput";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useCrudMutation } from "@/lib/useCrudMutation";

// "charge" = Forderung (positives Soll), "credit" = Gutschrift (negatives
// Soll -> Guthaben für den Mieter).
const feeFormSchema = z.object({
  kind: z.enum(["charge", "credit"]),
  date: z.string().min(1),
  amountInput: z
    .string()
    .min(1)
    .regex(/^\d+([.,]\d{1,2})?$/u),
  reason: z.string().min(1).max(500),
});
type FeeFormValues = z.infer<typeof feeFormSchema>;

const today = new Date();
const calendarStart = new Date(today.getFullYear() - 10, 0, 1);
const calendarEnd = new Date(today.getFullYear() + 1, 11, 1);

/**
 * Inline-Subform zum Erfassen einer Gebühr (Forderung) oder
 * Gutschrift, direkt im Gebühren-Register.
 */
export const FeeInlineForm = ({
  tenantId,
  onDone,
}: {
  tenantId: string;
  onDone: () => void;
}) => {
  const form = useForm<FeeFormValues>({
    resolver: zodResolver(feeFormSchema),
    reValidateMode: "onSubmit",
    defaultValues: {
      kind: "charge",
      date: todayIso(),
      amountInput: "",
      reason: "",
    },
  });

  const createFee = useCrudMutation({
    mutationFn: (dto: AccountFeeCreateDto) => api.post("/accounts/fees", dto),
    invalidateKeys: [["accounts"]],
    onSuccess: onDone,
  });

  const handleSubmit = async (values: FeeFormValues) => {
    const magnitude = parseEurToCents(values.amountInput);
    await createFee.mutateAsync({
      tenantId,
      date: values.date,
      amountCents: values.kind === "credit" ? -magnitude : magnitude,
      reason: values.reason.trim(),
    });
  };

  return (
    <div className="rounded-[13px] border border-sky-100 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/30">
      <SubformShell
        onSubmit={() => {
          form
            .handleSubmit(handleSubmit)()
            .catch(() => undefined);
        }}
        onCancel={onDone}
        submitLabel={t("ui.account.fee.add")}
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            placeholder="0,00"
            suffix="€"
          />
          <TextInput
            control={form.control}
            name="reason"
            label={t("ui.account.fee.reason")}
            placeholder={t("ui.account.fee.reasonPlaceholder")}
          />
        </div>
      </SubformShell>
    </div>
  );
};
