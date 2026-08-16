import {
  formatDate,
  formatEur,
  formatName,
  todayIso,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiBillLine, RiDeleteBinLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ActionLink } from "../../components/common/ActionLink";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { IconTile } from "../../components/common/IconTile";
import { InfoCard } from "../../components/common/InfoCard";
import { PageHeader } from "../../components/common/PageHeader";
import { FormSkeleton } from "../../components/FormSkeleton";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/Alert";
import {
  aiConfigQueryOptions,
  extractCostEntryFromAttachment,
} from "../../lib/aiExtraction";
import { ApiError, api } from "../../lib/api";
import {
  type CostEntryDetail,
  type CostType,
  costEntryIdentityLabel,
  costEntryQueryOptions,
  costTypesQueryOptions,
} from "../../lib/costs";
import { domainVisuals, gradients } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { statementsQueryOptions } from "../../lib/statements";
import { unitsQueryOptions } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useDeleteResource } from "../../lib/useDeleteResource";
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

/**
 * Zeigt nur die des Gebäudes dieser Rechnung (abgeleitet über die Kostenart
 * der ersten Position; das Formular erzwingt mindestens eine Position).
 */
const costTypesOfEntryBuilding = (
  allCostTypes: CostType[] | undefined,
  entry: CostEntryDetail | undefined,
): CostType[] => {
  const entryBuildingId = allCostTypes?.find(
    (costType) => costType.id === entry?.items[0]?.costTypeId,
  )?.buildingId;
  return (allCostTypes ?? []).filter(
    (costType) => costType.buildingId === entryBuildingId,
  );
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Länge liegt am Markup
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Länge liegt am Markup
export const CostEntryEditPage = () => {
  const { costEntryId } = routeApi.useParams();
  const goBack = useGoBack("/rechnungen");
  const navigate = useNavigate();

  const { data: allCostTypes } = useQuery(costTypesQueryOptions);
  const { data: units } = useQuery(unitsQueryOptions);
  const costEntryQuery = useQuery(costEntryQueryOptions(costEntryId));
  const { data: aiConfig } = useQuery(aiConfigQueryOptions);
  const { data: allStatements } = useQuery(statementsQueryOptions);

  const costTypes = costTypesOfEntryBuilding(allCostTypes, costEntryQuery.data);

  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractWarnings, setExtractWarnings] = useState<string[]>([]);
  const [extractingAttachmentId, setExtractingAttachmentId] = useState<
    string | null
  >(null);

  const defaultValues: CostEntryFormValues = costEntryQuery.data
    ? costEntryToFormValues(costEntryQuery.data, allCostTypes ?? [])
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

  const deletion = useDeleteResource<CostEntryDetail>({
    endpoint: (target) => `/costs/${target.id}`,
    invalidateKeys: [["costs"], ["statement-preview"]],
    title: t("ui.invoices.detail.deleteTitle"),
    describe: () => t("ui.invoices.detail.deleteMessage"),
    onDeleted: goBack,
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
      applyExtractionToForm(form, result, costTypes);
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

  const entry = costEntryQuery.data;

  const totalCents =
    entry?.items.reduce((sum, item) => sum + item.amountCents, 0) ?? 0;
  const years =
    entry?.items.flatMap((item) => [
      item.periodStart.slice(0, 4),
      item.periodEnd.slice(0, 4),
    ]) ?? [];

  const hasYears = years.length > 0;
  const minYear = hasYears ? years.reduce((a, b) => (a < b ? a : b)) : "";
  const maxYear = hasYears ? years.reduce((a, b) => (a > b ? a : b)) : "";
  const periodRange =
    minYear === maxYear
      ? minYear
      : t("ui.common.yearRangeLabel", { start: minYear, end: maxYear });
  const periodText = hasYears ? periodRange : t("ui.common.emptyValue");
  // Kostenarten der Rechnung als Verknüpfungen (je Kostenart einmal)
  const linkedCostTypes = [
    ...new Map(
      (entry?.items ?? [])
        .filter((item) => item.costTypeId)
        .map((item) => [
          item.costTypeId,
          { id: item.costTypeId, name: item.costTypeName },
        ]),
    ).values(),
  ];

  // Abrechnungen, deren Zeitraum sich mit dieser Rechnung überschneidet
  // (gleiches Gebäude, aktive Abrechnungen).
  const entryBuildingId = allCostTypes?.find(
    (costType) => costType.id === entry?.items[0]?.costTypeId,
  )?.buildingId;
  const itemDates =
    entry?.items.flatMap((item) => [item.periodStart, item.periodEnd]) ?? [];
  const invoicePeriodStart = itemDates.reduce(
    (a, b) => (a < b ? a : b),
    "9999",
  );
  const invoicePeriodEnd = itemDates.reduce((a, b) => (a > b ? a : b), "0000");
  const periodStatements = (allStatements ?? []).filter(
    (statement) =>
      statement.buildingId === entryBuildingId &&
      (statement.status === "draft" || statement.status === "finalized") &&
      statement.periodStart <= invoicePeriodEnd &&
      statement.periodEnd >= invoicePeriodStart,
  );

  return (
    <div className="pb-24">
      <PageHeader
        loading={!entry}
        statsSkeleton={3}
        tile={
          <IconTile
            icon={RiBillLine}
            size={44}
            background={gradients.invoices}
          />
        }
        title={entry ? costEntryIdentityLabel(entry) : ""}
        sub={
          entry
            ? [
                entry.vendor ?? t("ui.invoices.detail.vendorFallback"),
                entry.invoiceNumber,
              ]
                .filter(Boolean)
                .join(t("ui.common.separators.bullet"))
            : undefined
        }
        stats={
          entry
            ? [
                {
                  label: t("ui.invoices.detail.statAmount"),
                  value: formatEur(totalCents),
                },
                {
                  label: t("ui.invoices.detail.statPositions"),
                  value: String(entry.items.length),
                },
                {
                  label: t("ui.invoices.detail.statPeriod"),
                  value: periodText,
                },
              ]
            : undefined
        }
      />

      {entry && allCostTypes ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px] *:min-w-0">
          <div className="space-y-5">
            <CostEntryForm
              mode="edit"
              form={form}
              costTypes={costTypes}
              units={units ?? []}
              savedAt={formatDate(entry.updatedAt.slice(0, 10))}
              onSubmit={async (values) => {
                await updateCostEntry.mutateAsync(values);
              }}
              onCancel={goBack}
            />
            <CostEntryAttachments
              costEntryId={entry.id}
              onExtract={aiConfig?.configured ? handleExtract : undefined}
              extractingAttachmentId={extractingAttachmentId}
            />
            {extractError ? (
              <Alert variant="error">
                <AlertDescription>{extractError}</AlertDescription>
              </Alert>
            ) : null}
            {extractWarnings.length > 0 ? (
              <Alert variant="warning">
                <AlertTitle>
                  {t("ui.invoices.aiExtract.warnings.title")}
                </AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5">
                    {extractWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}
          </div>

          <div className="flex flex-col gap-4 xl:sticky xl:top-24">
            <InfoCard title={t("ui.common.infoCards.links")}>
              {linkedCostTypes.map((costType) => (
                <ActionLink
                  key={costType.id}
                  icon={domainVisuals.costTypes.icon}
                  iconBackground={domainVisuals.costTypes.accent}
                  onClick={() =>
                    navigate({
                      to: "/kostenarten/$costTypeId",
                      params: { costTypeId: costType.id },
                    })
                  }
                >
                  {costType.name}
                </ActionLink>
              ))}
              {periodStatements.map((statement) => (
                <ActionLink
                  key={statement.id}
                  icon={domainVisuals.statements.icon}
                  iconBackground={domainVisuals.statements.accent}
                  subtitle={t("ui.common.periodLabel", {
                    start: formatDate(statement.periodStart),
                    end: formatDate(statement.periodEnd),
                  })}
                  onClick={() =>
                    navigate({
                      to: "/abrechnungen/$statementId",
                      params: { statementId: statement.id },
                    })
                  }
                >
                  {statement.contractResidents
                    .map((resident) =>
                      formatName(resident.firstName, resident.lastName),
                    )
                    .join(t("ui.common.separators.comma"))}
                </ActionLink>
              ))}
            </InfoCard>

            <InfoCard title={t("ui.common.infoCards.actions")}>
              <ActionLink
                icon={RiDeleteBinLine}
                iconBackground="var(--color-rose-400)"
                danger={true}
                onClick={() => deletion.request(entry)}
              >
                {t("ui.invoices.detail.deleteAction")}
              </ActionLink>
            </InfoCard>
          </div>
        </div>
      ) : (
        <FormSkeleton rows={4} aside={true} />
      )}

      {deletion.dialog}
    </div>
  );
};
