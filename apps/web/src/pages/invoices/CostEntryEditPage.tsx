import { todayIso } from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { FormPage } from "../../components/common/FormPage";
import { FormSkeleton } from "../../components/FormSkeleton";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/Alert";
import {
  aiConfigQueryOptions,
  extractCostEntryFromAttachment,
} from "../../lib/aiExtraction";
import { ApiError, api } from "../../lib/api";
import {
  type CostEntryDetail,
  costEntryIdentityLabel,
  costEntryQueryOptions,
  costTypesQueryOptions,
} from "../../lib/costs";
import { t } from "../../lib/i18n";
import { unitsQueryOptions } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useGoBack } from "../../lib/useGoBack";
import { applyExtractionToForm } from "./components/aiExtract/applyExtractionToForm";
import { CostEntryAttachments } from "./components/attachments/CostEntryAttachments";
import { CostEntryForm } from "./components/baseData/CostEntryForm";
import {
  type CostEntryFormValues,
  type CostEntrySubmitValues,
  costEntryFormSchema,
  costEntryToFormValues,
  emptyItem,
} from "./components/baseData/costEntryForm.schema";

const routeApi = getRouteApi("/rechnungen/$costEntryId");

export const CostEntryEditPage = () => {
  const { costEntryId } = routeApi.useParams();
  const goBack = useGoBack("/rechnungen");

  const { data: costTypes } = useQuery(costTypesQueryOptions);
  const { data: units } = useQuery(unitsQueryOptions);
  const costEntryQuery = useQuery(costEntryQueryOptions(costEntryId));
  const { data: aiConfig } = useQuery(aiConfigQueryOptions);

  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractWarnings, setExtractWarnings] = useState<string[]>([]);
  const [extractingAttachmentId, setExtractingAttachmentId] = useState<
    string | null
  >(null);

  const defaultValues: CostEntryFormValues = costEntryQuery.data
    ? costEntryToFormValues(costEntryQuery.data, costTypes ?? [])
    : {
        invoiceDate: todayIso(),
        invoiceNumber: "",
        vendor: "",
        items: [emptyItem("")],
      };

  const form = useForm<CostEntryFormValues>({
    resolver: zodResolver(costEntryFormSchema),
    reValidateMode: "onSubmit",
    values: defaultValues,
  });

  const updateCostEntry = useCrudMutation({
    mutationFn: (dto: CostEntrySubmitValues) =>
      api.patch<CostEntryDetail>(`/costs/${costEntryId}`, dto),
    invalidateKeys: [
      ["costs"],
      ["costEntry", costEntryId],

      // Draft-Statements rechnen live aus den Stammdaten. Preview-Cache
      // muss nach Rechnungs-Änderung invalidiert werden.
      ["statement-preview"],
    ],
    onSuccess: goBack,
  });

  const handleExtract = async (attachmentId: string) => {
    setExtractError(null);
    setExtractWarnings([]);
    setExtractingAttachmentId(attachmentId);
    try {
      const result = await extractCostEntryFromAttachment({
        costEntryId,
        attachmentId,
      });
      applyExtractionToForm(form, result, costTypes ?? []);
      setExtractWarnings(result.warnings);
    } catch (err) {
      setExtractError(
        err instanceof ApiError
          ? err.message
          : t("ui.invoices.aiExtract.failed"),
      );
    } finally {
      setExtractingAttachmentId(null);
    }
  };

  if (
    costEntryQuery.isError ||
    (costEntryQuery.data === undefined && !costEntryQuery.isLoading)
  ) {
    return (
      <EntityNotFound
        title={t("ui.invoices.notFound.title")}
        description={t("ui.invoices.notFound.description")}
        to="/rechnungen"
      />
    );
  }

  if (!costTypes || !costEntryQuery.data) {
    return <FormSkeleton rows={4} />;
  }

  const entry = costEntryQuery.data;

  return (
    <FormPage title={costEntryIdentityLabel(entry)}>
      <CostEntryForm
        mode="edit"
        form={form}
        costTypes={costTypes}
        units={units ?? []}
        onSubmit={async (values) => {
          await updateCostEntry.mutateAsync(values);
        }}
        onCancel={goBack}
      />
      <CostEntryAttachments
        costEntryId={entry.id}
        onExtract={aiConfig?.mistralConfigured ? handleExtract : undefined}
        extractingAttachmentId={extractingAttachmentId}
      />
      {extractError ? (
        <Alert variant="error">
          <AlertDescription>{extractError}</AlertDescription>
        </Alert>
      ) : null}
      {extractWarnings.length > 0 ? (
        <Alert variant="warning">
          <AlertTitle>{t("ui.invoices.aiExtract.warnings.title")}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {extractWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
    </FormPage>
  );
};
