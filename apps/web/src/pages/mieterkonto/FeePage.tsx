import {
  type AccountFeeCreateDto,
  type AccountFeeUpdateDto,
  centsToEurInput,
  parseEurToCents,
  todayIso,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiMoneyEuroCircleLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { EntityNotFound } from "@/components/common/EntityNotFound";
import { FormPage } from "@/components/common/FormPage";
import { IconTile } from "@/components/common/IconTile";
import { PageHeader } from "@/components/common/PageHeader";
import { TenantContextCard } from "@/components/common/TenantContextCard";
import { FormSkeleton } from "@/components/FormSkeleton";
import { DateInput } from "@/components/form/DateInput";
import { Form } from "@/components/form/Form";
import { Savebar } from "@/components/form/Savebar";
import { SelectInput } from "@/components/form/SelectInput";
import { TextareaInput } from "@/components/form/TextareaInput";
import { TextInput } from "@/components/form/TextInput";
import { Card, CardContent } from "@/components/ui/Card";
import { FieldGroup } from "@/components/ui/Field";
import { feeIdentityLabel, tenantFeesQueryOptions } from "@/lib/accounts";
import { api } from "@/lib/api";
import { gradients } from "@/lib/domainVisuals";
import { t } from "@/lib/i18n";
import { tenantsOverviewQueryOptions } from "@/lib/tenants";
import { useCrudMutation } from "@/lib/useCrudMutation";
import { useGoBack } from "@/lib/useGoBack";

/**
 * "charge" = Forderung (positives Soll), "credit" = Gutschrift (negatives
 * Soll -> Guthaben für den Mieter, z. B. rückwirkende Korrektur).
 */
const formSchema = z.object({
  kind: z.enum(["charge", "credit"]),
  date: z.string().min(1),
  amountInput: z
    .string()
    .min(1)
    .regex(/^\d+([.,]\d{1,2})?$/u),
  reason: z.string().min(1).max(500),
});
type FormValues = z.infer<typeof formSchema>;

const today = new Date();
const calendarStart = new Date(today.getFullYear() - 10, 0, 1);
const calendarEnd = new Date(today.getFullYear() + 1, 11, 1);

export const FeePage = () => {
  const { tenantId, feeId } = useParams({ strict: false }) as {
    tenantId: string;
    feeId?: string;
  };
  const isEdit = feeId !== undefined;

  const feesQuery = useQuery({
    ...tenantFeesQueryOptions(tenantId),
    enabled: isEdit,
  });
  const fees = feesQuery.data;
  const { data: tenantsResult } = useQuery(
    tenantsOverviewQueryOptions({ page: 0, pageSize: 1000 }),
  );
  const contextTenant = tenantsResult?.items.find(({ id }) => id === tenantId);
  const existing = isEdit
    ? fees?.find((fee) => fee.feeId === feeId)
    : undefined;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      kind: "charge",
      date: todayIso(),
      amountInput: "0,00",
      reason: "",
    },
  });

  useEffect(() => {
    if (existing) {
      form.reset({
        kind: existing.pot.sollCents < 0 ? "credit" : "charge",
        date: existing.date,
        amountInput: centsToEurInput(Math.abs(existing.pot.sollCents)),
        reason: existing.reason,
      });
    }
  }, [existing, form]);

  const goBack = useGoBack("/mieter/$tenantId/konto", {
    params: { tenantId },
    search: { tab: "gebuehren" },
  });

  const createMutation = useCrudMutation({
    mutationFn: (dto: AccountFeeCreateDto) => api.post("/accounts/fees", dto),
    invalidateKeys: [["accounts"]],
    onSuccess: goBack,
  });

  const updateMutation = useCrudMutation({
    mutationFn: (dto: AccountFeeUpdateDto) =>
      api.patch(`/accounts/fees/${feeId}`, dto),
    invalidateKeys: [["accounts"]],
    onSuccess: goBack,
  });

  if (isEdit && (feesQuery.isError || (fees && !existing))) {
    return (
      <EntityNotFound
        title={t("ui.account.fee.notFound.title")}
        description={t("ui.account.fee.notFound.description")}
        to="/mieter/$tenantId/konto"
        params={{ tenantId }}
        search={{ tab: "gebuehren" }}
      />
    );
  }

  const onSubmit = async (values: FormValues) => {
    const magnitude = parseEurToCents(values.amountInput);
    const amountCents = values.kind === "credit" ? -magnitude : magnitude;
    const reason = values.reason.trim();
    if (isEdit) {
      await updateMutation.mutateAsync({
        date: values.date,
        amountCents,
        reason,
      });
    } else {
      await createMutation.mutateAsync({
        tenantId,
        date: values.date,
        amountCents,
        reason,
      });
    }
  };

  return (
    <FormPage
      head={
        <PageHeader
          tile={
            <IconTile
              icon={RiMoneyEuroCircleLine}
              size={44}
              background={gradients.money}
            />
          }
          title={
            existing ? feeIdentityLabel(existing) : t("ui.account.fee.title")
          }
          loading={isEdit && !fees}
        />
      }
      aside={<TenantContextCard tenant={contextTenant} />}
    >
      {isEdit && !fees ? (
        <FormSkeleton rows={4} />
      ) : (
        <Form form={form} onSubmit={onSubmit}>
          <Card>
            <CardContent>
              <FieldGroup className="gap-4">
                <DateInput
                  control={form.control}
                  name="date"
                  label={t("ui.payments.columns.date")}
                  startMonth={calendarStart}
                  endMonth={calendarEnd}
                />
                <SelectInput
                  control={form.control}
                  name="kind"
                  label={t("ui.account.fee.kindLabel")}
                  options={[
                    { value: "charge", label: t("ui.account.fee.kindCharge") },
                    { value: "credit", label: t("ui.account.fee.kindCredit") },
                  ]}
                />
                <TextInput
                  control={form.control}
                  name="amountInput"
                  inputMode="decimal"
                  placeholder="0,00"
                  label={t("ui.account.fee.amountLabel")}
                  suffix="€"
                />
                <TextareaInput
                  control={form.control}
                  name="reason"
                  label={t("ui.account.fee.reason")}
                  rows={3}
                />
              </FieldGroup>
            </CardContent>
          </Card>
          <Savebar
            submitting={form.formState.isSubmitting}
            onCancel={goBack}
            submitLabel={
              isEdit ? t("ui.common.action.save") : t("ui.common.action.record")
            }
          />
        </Form>
      )}
    </FormPage>
  );
};
