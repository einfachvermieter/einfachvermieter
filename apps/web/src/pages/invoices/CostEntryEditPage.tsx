import { formatDate, formatEur, formatName } from "@einfachvermieter/shared";
import { RiDeleteBinLine, RiMoreLine, RiReceiptLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useRef, useState } from "react";
import { DomainLink } from "../../components/common/DomainLink";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { MiniKpiRow } from "../../components/common/MiniKpiRow";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { DestructiveConfirmDialog } from "../../components/DestructiveConfirmDialog";
import { FormSkeleton } from "../../components/FormSkeleton";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/DropdownMenu";
import { useAdoptBuilding } from "../../lib/activeBuilding";
import {
  aiConfigQueryOptions,
  extractCostEntryFromAttachment,
  isMistralSupported,
} from "../../lib/aiExtraction";
import { ApiError } from "../../lib/api";
import { costEntryAttachmentsQueryOptions } from "../../lib/attachments";
import {
  type CostEntryDetail,
  type CostType,
  costEntryIdentityLabel,
  costEntryQueryOptions,
  costTypesQueryOptions,
} from "../../lib/costs";
import { t } from "../../lib/i18n";
import { statementsQueryOptions } from "../../lib/statements";
import { unitsQueryOptions } from "../../lib/units";
import { useDeleteResource } from "../../lib/useDeleteResource";
import { useGoBack } from "../../lib/useGoBack";
import { CostEntryBaseCard } from "./cards/CostEntryBaseCard";
import { CostEntryItemsCard } from "./cards/CostEntryItemsCard";
import { applyExtraction } from "./components/aiExtract/applyExtraction";
import { CostEntryAttachments } from "./components/attachments/CostEntryAttachments";
import {
  type CostEntryFormValues,
  costEntryToFormValues,
  emptyItem,
} from "./components/baseData/costEntryForm.schema";
import { CostEntryBaseSheet } from "./sheets/CostEntryBaseSheet";
import { CostEntryItemSheet } from "./sheets/CostEntryItemSheet";
import { useCostEntrySave } from "./useCostEntrySave";

const routeApi = getRouteApi("/rechnungen/$costEntryId");

type SheetState = { kind: "base" } | { kind: "item"; index: number | null };

/**
 * Kostenarten des Gebäudes, zu dem die Rechnung gehört
 */
const costTypesOfEntryBuilding = (
  allCostTypes: CostType[] | undefined,
  entry: CostEntryDetail | undefined,
): CostType[] =>
  (allCostTypes ?? []).filter(
    (costType) => costType.buildingId === entry?.buildingId,
  );

/**
 * Zeitraum der Rechnung als Jahr bzw. Jahresspanne über alle Positionen
 */
const periodLabelOf = (entry: CostEntryDetail): string => {
  const years = entry.items.flatMap((item) => [
    item.periodStart.slice(0, 4),
    item.periodEnd.slice(0, 4),
  ]);
  if (years.length === 0) {
    return t("ui.common.emptyValue");
  }

  const minYear = years.reduce((a, b) => (a < b ? a : b));
  const maxYear = years.reduce((a, b) => (a > b ? a : b));
  return minYear === maxYear
    ? minYear
    : t("ui.common.yearRangeLabel", { start: minYear, end: maxYear });
};

/**
 * Rechnungs-Ansicht: Kopf, Kennzahlen, Basisdaten und Positionen als
 * Werte-Cards sowie die Belege
 */
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Länge liegt am Markup
export const CostEntryEditPage = () => {
  const { costEntryId } = routeApi.useParams();
  const { costTypeId: presetCostTypeId, extract: extractOnArrival } =
    routeApi.useSearch();
  const goBack = useGoBack("/rechnungen");
  const navigate = useNavigate();
  const { data: allCostTypes } = useQuery(costTypesQueryOptions);
  const { data: units } = useQuery(unitsQueryOptions);
  const costEntryQuery = useQuery(costEntryQueryOptions(costEntryId));
  const { data: aiConfig } = useQuery(aiConfigQueryOptions);
  const { data: allStatements } = useQuery(statementsQueryOptions);

  const entry = costEntryQuery.data;

  // Beim Direkteinstieg das Gebäude des Objekts übernehmen
  useAdoptBuilding(entry?.buildingId);
  const costTypes = costTypesOfEntryBuilding(allCostTypes, entry);
  const save = useCostEntrySave(entry, costTypes);

  // Aus einer Kostenart heraus angelegt: das Sheet für die erste Position
  // steht gleich offen, mit dieser Kostenart vorbelegt.
  const [sheet, setSheet] = useState<SheetState | null>(
    presetCostTypeId ? { kind: "item", index: null } : null,
  );

  const closeSheet = () => {
    setSheet(null);
    if (presetCostTypeId) {
      navigate({
        to: "/rechnungen/$costEntryId",
        params: { costEntryId },
        search: { costTypeId: undefined, extract: undefined },
        replace: true,
      }).catch(() => undefined);
    }
  };
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractWarnings, setExtractWarnings] = useState<string[]>([]);
  const [extractingAttachmentId, setExtractingAttachmentId] = useState<
    string | null
  >(null);

  // Auswertung, die erst nach Rückfrage laufen darf, weil sie vorhandene
  // Positionen ersetzen würde
  const [confirmExtractId, setConfirmExtractId] = useState<string | null>(null);

  const deletion = useDeleteResource<CostEntryDetail>({
    endpoint: (target) => `/costs/${target.id}`,
    invalidateKeys: [["costs"], ["stats"], ["statement-preview"]],
    title: t("ui.invoices.detail.deleteTitle"),
    describe: (target) =>
      target.vendor
        ? t("ui.invoices.detail.deleteMessageWithVendor", {
            vendor: target.vendor,
            date: formatDate(target.invoiceDate),
          })
        : t("ui.invoices.detail.deleteMessage", {
            date: formatDate(target.invoiceDate),
          }),
    onDeleted: goBack,
  });

  const runExtraction = async (attachmentId: string) => {
    setExtractError(null);
    setExtractWarnings([]);
    setExtractingAttachmentId(attachmentId);
    try {
      const result = await extractCostEntryFromAttachment({
        costEntryId,
        attachmentId,
      });
      await save(
        (current) => applyExtraction(current, result, costTypes),
        t("ui.invoices.aiExtract.appliedToast"),
      );
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

  /**
   * Auswertung anstoßen. Sind schon Positionen erfasst, erst nachfragen:
   * die erkannten Positionen ersetzen die vorhandenen.
   */
  const requestExtraction = (attachmentId: string) => {
    if ((entry?.items.length ?? 0) > 0) {
      setConfirmExtractId(attachmentId);
      return;
    }

    runExtraction(attachmentId).catch(() => undefined);
  };

  const attachmentsQuery = useQuery({
    ...costEntryAttachmentsQueryOptions(costEntryId),
    enabled: extractOnArrival === true,
  });
  const arrivalHandled = useRef(false);
  useEffect(() => {
    if (!extractOnArrival || arrivalHandled.current) {
      return;
    }

    const attachment = attachmentsQuery.data?.find((candidate) =>
      isMistralSupported(candidate.mimeType),
    );
    if (!attachment) {
      return;
    }

    arrivalHandled.current = true;
    navigate({
      to: "/rechnungen/$costEntryId",
      params: { costEntryId },
      search: { costTypeId: undefined, extract: undefined },
      replace: true,
    }).catch(() => undefined);
    runExtraction(attachment.id).catch(() => undefined);
  });

  if (
    costEntryQuery.isError ||
    (entry === undefined && !costEntryQuery.isLoading)
  ) {
    return (
      <EntityNotFound
        title={t("ui.invoices.notFound.title")}
        description={t("ui.invoices.notFound.description")}
        to="/rechnungen"
      />
    );
  }

  if (!(entry && allCostTypes && units)) {
    return (
      <div className="max-w-225 pb-6">
        <PageHeader
          tile={<PageHeaderIcon icon={RiReceiptLine} />}
          title=""
          loading={true}
        />
        <FormSkeleton rows={4} />
      </div>
    );
  }

  const values: CostEntryFormValues = costEntryToFormValues(entry, costTypes);
  const totalCents = entry.items.reduce(
    (sum, item) => sum + item.amountCents,
    0,
  );

  // Abrechnungen, deren Zeitraum sich mit dieser Rechnung überschneidet
  // (gleiches Gebäude, aktive Abrechnungen).
  const itemDates = entry.items.flatMap((item) => [
    item.periodStart,
    item.periodEnd,
  ]);
  const invoicePeriodStart = itemDates.reduce(
    (a, b) => (a < b ? a : b),
    "9999",
  );
  const invoicePeriodEnd = itemDates.reduce((a, b) => (a > b ? a : b), "0000");
  const periodStatements = (allStatements ?? []).filter(
    (statement) =>
      statement.buildingId === entry.buildingId &&
      (statement.status === "draft" || statement.status === "finalized") &&
      statement.periodStart <= invoicePeriodEnd &&
      statement.periodEnd >= invoicePeriodStart,
  );

  return (
    <>
      <div className="max-w-225 pb-6">
        <PageHeader
          tile={<PageHeaderIcon icon={RiReceiptLine} />}
          title={entry.vendor ?? costEntryIdentityLabel(entry)}
          sub={
            <span>
              {[
                costEntryIdentityLabel(entry),
                entry.invoiceNumber
                  ? t("ui.invoices.detail.invoiceNumberMeta", {
                      number: entry.invoiceNumber,
                    })
                  : undefined,
              ]
                .filter(Boolean)
                .join(t("ui.common.separators.bullet"))}
            </span>
          }
          action={
            <DropdownMenu>
              <DropdownMenuTrigger asChild={true}>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("ui.common.a11y.more")}
                >
                  <RiMoreLine />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => deletion.request(entry)}
                >
                  <RiDeleteBinLine />
                  {t("ui.invoices.detail.deleteAction")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />

        <div className="space-y-5">
          {extractingAttachmentId ? (
            <Alert variant="info">
              <AlertTitle>{t("ui.invoices.aiExtract.running")}</AlertTitle>
              <AlertDescription>
                {t("ui.invoices.aiExtract.runningHint")}
              </AlertDescription>
            </Alert>
          ) : null}
          {extractError ? (
            <Alert variant="error">
              <AlertTitle>{t("ui.invoices.aiExtract.failedTitle")}</AlertTitle>
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

          <MiniKpiRow
            columns={2}
            items={[
              {
                label: t("ui.invoices.detail.statAmount"),
                value: formatEur(totalCents),
                hint: t("ui.invoices.itemCount", { count: entry.items.length }),
              },
              {
                label: t("ui.invoices.detail.statPeriod"),
                value: periodLabelOf(entry),
                hint:
                  periodStatements.length > 0 ? (
                    <span className="flex flex-wrap items-center gap-x-2">
                      {periodStatements.map((statement, index) => (
                        <Fragment key={statement.id}>
                          {index > 0
                            ? t("ui.common.separators.bullet")
                            : t("ui.invoices.detail.statementsHint")}
                          <DomainLink
                            to="/abrechnungen/$statementId"
                            params={{ statementId: statement.id }}
                          >
                            {statement.contractResidents
                              .map((resident) =>
                                formatName(
                                  resident.firstName,
                                  resident.lastName,
                                ),
                              )
                              .join(t("ui.common.separators.comma"))}
                          </DomainLink>
                        </Fragment>
                      ))}
                    </span>
                  ) : (
                    t("ui.invoices.detail.noStatementsHint")
                  ),
              },
            ]}
          />

          <div>
            <CostEntryBaseCard
              entry={entry}
              onEdit={() => setSheet({ kind: "base" })}
            />

            <CostEntryItemsCard
              items={entry.items}
              costTypes={costTypes}
              units={units}
              onAdd={() => setSheet({ kind: "item", index: null })}
              onEdit={(index) => setSheet({ kind: "item", index })}
              onDelete={async (index) => {
                await save((current) => ({
                  ...current,
                  items: current.items.filter(
                    (_, position) => position !== index,
                  ),
                }));
              }}
            />

            <CostEntryAttachments
              costEntryId={entry.id}
              onExtract={aiConfig?.configured ? requestExtraction : undefined}
              onUploaded={(attachment) => {
                // Frisch hochgeladener Beleg einer noch leeren Rechnung wird
                // direkt ausgewertet; sonst entscheidet der Knopf am Beleg.
                if (
                  aiConfig?.configured &&
                  entry.items.length === 0 &&
                  isMistralSupported(attachment.mimeType)
                ) {
                  runExtraction(attachment.id).catch(() => undefined);
                }
              }}
              extractingAttachmentId={extractingAttachmentId}
            />
          </div>
        </div>
      </div>

      {sheet?.kind === "base" ? (
        <CostEntryBaseSheet
          defaultValues={values}
          onSubmit={async (next) => {
            await save(() => next);
            closeSheet();
          }}
          onClose={closeSheet}
        />
      ) : null}

      {sheet?.kind === "item" ? (
        <CostEntryItemSheet
          title={
            sheet.index === null
              ? t("ui.invoices.items.add")
              : t("ui.invoices.items.editTitle")
          }
          defaultValues={{
            ...values,
            items: [
              (sheet.index === null
                ? undefined
                : values.items[sheet.index]) ?? {
                ...emptyItem(presetCostTypeId ?? costTypes[0]?.id ?? ""),
                periodStart: values.items[0]?.periodStart ?? "",
                periodEnd: values.items[0]?.periodEnd ?? "",
              },
            ],
          }}
          costTypes={costTypes}
          units={units}
          onSubmit={async (item) => {
            const { index } = sheet;
            await save((current) => ({
              ...current,
              items:
                index === null
                  ? [...current.items, item]
                  : current.items.map((entryItem, position) =>
                      position === index ? item : entryItem,
                    ),
            }));
            closeSheet();
          }}
          onClose={closeSheet}
        />
      ) : null}

      <DestructiveConfirmDialog
        open={confirmExtractId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmExtractId(null);
          }
        }}
        title={t("ui.invoices.aiExtract.confirmReplaceTitle")}
        description={t("ui.invoices.aiExtract.confirmReplaceMessage", {
          count: entry.items.length,
        })}
        confirmLabel={t("ui.invoices.aiExtract.button")}
        onConfirm={() => {
          const attachmentId = confirmExtractId;
          setConfirmExtractId(null);
          if (attachmentId) {
            runExtraction(attachmentId).catch(() => undefined);
          }
        }}
      />

      {deletion.dialog}
    </>
  );
};
