import type { StatementResult } from "@einfachvermieter/shared";
import {
  formatDate,
  formatEur,
  formatName,
  hasHeatingBreakdown,
  isoDatePlusOneYear,
  todayIso,
} from "@einfachvermieter/shared";
import {
  RiArrowDownSLine,
  RiCloseCircleLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiFileCopy2Line,
  RiFilePdf2Line,
  RiLockLine,
} from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { Fragment, type ReactNode, useState } from "react";
import { Description } from "../../components/common/Description";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { MiniKpiRow } from "../../components/common/MiniKpiRow";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { DestructiveConfirmDialog } from "../../components/DestructiveConfirmDialog";
import { FormSkeleton } from "../../components/FormSkeleton";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/Alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/AlertDialog";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ButtonGroup } from "../../components/ui/ButtonGroup";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/DropdownMenu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/Tabs";
import { Textarea } from "../../components/ui/Textarea";
import { useAdoptBuilding } from "../../lib/activeBuilding";
import { api } from "../../lib/api";
import { climateFactorsQueryOptions } from "../../lib/climateFactors";
import { domainVisuals } from "../../lib/domainVisuals";
import { formatPeriod } from "../../lib/format";
import { t } from "../../lib/i18n";
import {
  type StatementDetail,
  type StatementTab,
  statementIdentityLabel,
  statementTabs,
} from "../../lib/statements";
import { tenantQueryOptions } from "../../lib/tenants";
import { unitsQueryOptions } from "../../lib/units";
import { AdvanceAdjustmentCard } from "./components/AdvanceAdjustmentCard";
import { BillingInfoCard } from "./components/detail/BillingInfoCard";
import { ClimateFactorsCard } from "./components/detail/ClimateFactorsCard";
import { HeatingCard } from "./components/detail/HeatingCard";
import { OccupancyCard } from "./components/detail/OccupancyCard";
import { OperatingCostsCard } from "./components/detail/OperatingCostsCard";
import { OverviewCard } from "./components/detail/OverviewCard";
import { PaymentsCard } from "./components/detail/PaymentsCard";
import { StatementFinalizeDialog } from "./components/detail/StatementFinalizeDialog";
import { TaxableLaborCard } from "./components/detail/TaxableLaborCard";

const routeApi = getRouteApi("/abrechnungen/$statementId");

/**
 * Anzuzeigendes Ergebnis: bei finalisiert/storniert der Snapshot, bei Draft der
 * Live-Preview, mit den am Draft gespeicherten Anpassungs-Werten gemerged, damit
 * Card und PDF-Vorschau den aktuellen Stand spiegeln. undefined, solange Draft
 * ohne Preview.
 */
const resolveDisplayResult = (
  statement: StatementDetail,
  preview: StatementResult | undefined,
): StatementResult | undefined => {
  if (statement.status !== "draft" && statement.snapshotData) {
    return statement.snapshotData;
  }
  if (!preview) {
    return;
  }
  if (!preview.advanceAdjustment) {
    return preview;
  }
  return {
    ...preview,
    advanceAdjustment: {
      ...preview.advanceAdjustment,
      adjustedMonthlyAdvanceCents: statement.adjustedMonthlyAdvanceCents,
      adjustedAdvanceValidFrom: statement.adjustedAdvanceValidFrom,
      tariffAdjustmentBps: statement.tariffAdjustmentBps,
    },
  };
};

/**
 * Status-Punkt-Pill der Abrechnung (Entwurf/finalisiert/storniert/ersetzt)
 * für die Unterzeile im Seitenkopf.
 */
const renderStatusBadge = (statement: StatementDetail) => {
  switch (statement.status) {
    case "draft":
      return (
        <Badge variant="neutral">
          {statement.supersedesStatementId
            ? t("ui.statements.detail.correctionDraft")
            : t("ui.statements.detail.draftLive")}
        </Badge>
      );
    case "finalized":
      return (
        <Badge variant="ok">
          {t("ui.statements.detail.finalizedAt", {
            date: formatDate(statement.finalizedAt?.slice(0, 10) ?? ""),
          })}
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="bad">{t("ui.statements.detail.cancelledBadge")}</Badge>
      );
    default:
      return (
        <Badge variant="neutral">
          {t("ui.statements.detail.supersededBadge")}
        </Badge>
      );
  }
};

/**
 * Kennzahl-Kacheln des Übersicht-Tabs
 */
const buildKpiItems = (
  result: StatementResult,
  tenantName: string,
  unitName: string | undefined,
) => {
  const isRefund = result.balanceCents <= 0;
  const paymentCount = result.payments?.length ?? 0;
  let balanceHint: string | undefined;
  if (tenantName) {
    balanceHint = isRefund
      ? t("ui.statements.detail.kpi.refundHint", { tenant: tenantName })
      : t("ui.statements.detail.kpi.arrearsHint", { tenant: tenantName });
  }
  return [
    {
      label: t("ui.statements.detail.totalCosts"),
      value: formatEur(result.totalCostsCents),
      hint: unitName
        ? t("ui.statements.detail.kpi.costsHint", { unit: unitName })
        : undefined,
    },
    {
      label: t("ui.statements.detail.advances"),
      value: formatEur(result.totalAdvancesCents),
      hint:
        paymentCount > 0
          ? t("ui.statements.detail.kpi.advancesHint", { count: paymentCount })
          : undefined,
    },
    {
      label: isRefund
        ? t("ui.statements.detail.info.creditLabel")
        : t("ui.statements.detail.additionalPayment"),
      value: (
        <span className={isRefund ? "text-limette-700" : "text-himbeere-500"}>
          {formatEur(Math.abs(result.balanceCents))}
        </span>
      ),
      hint: balanceHint,
    },
  ];
};

/**
 * Tab-Leiste + Inhalte der Abrechnungs-Detailseite. Tabs ohne Datenlage
 * (Zahlungen, Belegung, § 35a, Heizung) werden ausgeblendet, damit der Nutzer
 * nicht in leeren Ansichten landet. Die PDF-Vorschau ist ein verstecktes
 * Tab-Ziel, erreichbar über den Button im Seitenkopf.
 */
const StatementTabs = ({
  result,
  activeTab,
  onTabChange,
  statementId,
  isDraft,
  periodEnd,
  pdfSrc,
  pdfFilename,
  tenantName,
  unitName,
}: {
  result: StatementResult;
  activeTab: string;
  onTabChange: (value: string) => Promise<void>;
  statementId: string;
  isDraft: boolean;
  periodEnd: string;
  pdfSrc: string;
  pdfFilename: string;
  tenantName: string;
  unitName: string | undefined;
}) => {
  const {
    heatingDetail,
    occupancyDetail,
    taxableLaborCosts: taxableLabor,
  } = result;
  const hasTaxableLabor =
    taxableLabor !== undefined && taxableLabor.byCategory.length > 0;
  const payments = result.payments ?? [];
  const hasPayments = payments.length > 0;
  // Analog zu PDF-Anhängen: Rechenweg-Card nur, wenn das PDF den
  // Heizkosten-Anhang druckt; § 6a-Card nur, wenn die Seite nicht in der
  // Heizkonfiguration abgewählt wurde.
  const showHeatingBreakdown = heatingDetail
    ? hasHeatingBreakdown(heatingDetail, result.tenantPeriod, result.period)
    : false;
  const showBillingInfo =
    heatingDetail !== undefined && !heatingDetail.billingInfoOmitted;
  const showHeatingTab = showHeatingBreakdown || showBillingInfo;

  const kpis = buildKpiItems(result, tenantName, unitName);

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList variant="pills">
        <TabsTrigger value="uebersicht">
          {t("ui.statements.detail.tabs.overview")}
        </TabsTrigger>
        <TabsTrigger value="kosten">
          {t("ui.statements.detail.tabs.operatingCosts")}
        </TabsTrigger>
        {showHeatingTab ? (
          <TabsTrigger value="heizkosten">
            {t("ui.statements.detail.tabs.heating")}
          </TabsTrigger>
        ) : null}
        {hasPayments ? (
          <TabsTrigger value="zahlungen">
            {t("ui.statements.detail.tabs.payments")}
          </TabsTrigger>
        ) : null}
        {occupancyDetail ? (
          <TabsTrigger value="belegung">
            {t("ui.statements.detail.tabs.occupancy")}
          </TabsTrigger>
        ) : null}
        {hasTaxableLabor ? (
          <TabsTrigger value="steuer">
            {t("ui.statements.detail.tabs.taxableLabor")}
          </TabsTrigger>
        ) : null}
      </TabsList>
      <TabsContent value="uebersicht">
        <div className="space-y-5">
          <MiniKpiRow items={kpis} />
          <AdvanceAdjustmentCard
            statementId={statementId}
            isDraft={isDraft}
            detail={result.advanceAdjustment}
            lines={result.lines}
            periodEnd={periodEnd}
          />
          <OverviewCard
            result={result}
            onShowDetails={() => onTabChange("kosten")}
          />
        </div>
      </TabsContent>
      <TabsContent value="kosten">
        <OperatingCostsCard result={result} />
      </TabsContent>
      {hasPayments ? (
        <TabsContent value="zahlungen">
          <PaymentsCard
            payments={payments}
            period={result.period}
            tenantPeriod={result.tenantPeriod}
          />
        </TabsContent>
      ) : null}
      {occupancyDetail ? (
        <TabsContent value="belegung">
          <OccupancyCard
            detail={occupancyDetail}
            targetUnitId={result.unitId}
          />
        </TabsContent>
      ) : null}
      {hasTaxableLabor && taxableLabor ? (
        <TabsContent value="steuer">
          <TaxableLaborCard detail={taxableLabor} />
        </TabsContent>
      ) : null}
      {heatingDetail && showHeatingTab ? (
        <TabsContent value="heizkosten">
          <div className="space-y-5">
            {showHeatingBreakdown ? (
              <HeatingCard
                detail={heatingDetail}
                tenantPeriod={result.tenantPeriod}
                statementPeriod={result.period}
                targetUnitId={result.unitId}
              />
            ) : null}
            {/* Nur wenn es eine Vorperiode gibt: ohne sie entfällt der
                Vergleich, und der Klimafaktor wäre wirkungslos. */}
            {isDraft && heatingDetail.energyComparison?.previous ? (
              <ClimateFactorsCard statementId={statementId} />
            ) : null}
            {showBillingInfo ? (
              <BillingInfoCard
                detail={heatingDetail}
                targetUnitId={result.unitId}
                tenantPeriod={result.tenantPeriod}
                statementPeriod={result.period}
              />
            ) : null}
          </div>
        </TabsContent>
      ) : null}
      <TabsContent value="pdf">
        <Card className="h-225 overflow-hidden">
          <CardHeader>
            <CardTitle>{t("ui.statements.detail.tabs.pdf")}</CardTitle>
            <Description>
              {t("ui.statements.detail.pdfPreviewDescription")}
            </Description>
            <CardAction>
              <Button asChild={true} variant="outline">
                {/* `download` erzwingt den Download unabhängig vom
                    Content-Disposition-Header, auch als Fallback, wenn der
                    Browser kein Inline-PDF rendert. */}
                <a href={pdfSrc} download={pdfFilename}>
                  <RiDownloadLine data-icon="inline-start" />
                  {t("ui.statements.detail.downloadPdf")}
                </a>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="h-full p-0">
            {/* Heller Rahmen hinter dem Viewer: füllt Letterbox-/Ladeflächen */}
            <div className="h-full bg-white">
              <object
                data={pdfSrc}
                type="application/pdf"
                width="100%"
                height="100%"
                aria-label={t("ui.statements.detail.tabs.pdf")}
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: große Detailseite, bereits einiges ausgelagert
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: große Detailseite, bereits einiges ausgelagert
export const StatementDetailPage = () => {
  const queryClient = useQueryClient();
  const { statementId } = routeApi.useParams();
  const { tab } = routeApi.useSearch();
  const navigate = useNavigate();

  // Fallback für ein fehlendes oder ungültiges `tab`
  const activeTab = tab && statementTabs.includes(tab) ? tab : statementTabs[0];
  const handleTabChange = async (value: string) => {
    await navigate({
      to: "/abrechnungen/$statementId",
      params: { statementId },
      search: { tab: value as StatementTab },
    });
  };

  const statementQuery = useQuery({
    queryKey: ["statement", statementId],
    queryFn: () => api.get<StatementDetail>(`/statements/${statementId}`),
    enabled: Boolean(statementId),
  });
  const statement = statementQuery.data;

  // Beim Direkteinstieg das Gebäude des Objekts übernehmen
  useAdoptBuilding(statement?.buildingId);

  // Mietvertrag + Wohnungen für die identifizierende Überschrift (Mieter,
  // Wohnung), gleicher Query-Cache wie der Route-Loader, kein Doppel-Fetch.
  const { data: tenantAggregate } = useQuery({
    ...tenantQueryOptions(statement?.tenantId ?? ""),
    enabled: Boolean(statement?.tenantId),
  });
  const { data: units } = useQuery(unitsQueryOptions);

  const {
    data: preview,
    isFetching: isCalculating,
    error: previewError,
    dataUpdatedAt: previewUpdatedAt,
  } = useQuery({
    queryKey: ["statement-preview", statementId, statement?.status],
    queryFn: () =>
      api.get<StatementResult>("/statements/preview/calculate", {
        buildingId: statement?.buildingId,
        tenantId: statement?.tenantId,
        from: statement?.periodStart,
        to: statement?.periodEnd,
      }),
    enabled: Boolean(statement) && statement?.status === "draft",
    staleTime: 0,
  });

  // Für die Finalisieren-Checkliste, solange die DWD-Abruf-Frage offen ist;
  // gleicher Query-Cache wie die Klimafaktoren-Card, kein Doppel-Fetch.
  const { data: climateFactors } = useQuery({
    ...climateFactorsQueryOptions(statementId),
    enabled: Boolean(statement) && statement?.status === "draft",
  });

  const invalidateStatementQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ["statement"] });
    await queryClient.invalidateQueries({ queryKey: ["statements"] });
  };

  const finalize = useMutation({
    mutationFn: () =>
      api.post<StatementDetail>(`/statements/${statementId}/finalize`),
    onSuccess: invalidateStatementQueries,
  });
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);

  const cancel = useMutation({
    mutationFn: (reason: string) =>
      api.post<StatementDetail>(`/statements/${statementId}/cancel`, {
        reason,
      }),
    onSuccess: async () => {
      setCancelOpen(false);
      setCancelReason("");
      await invalidateStatementQueries();
    },
  });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const correct = useMutation({
    mutationFn: () =>
      api.post<StatementDetail>(`/statements/${statementId}/correct`),
    onSuccess: async (created) => {
      await invalidateStatementQueries();
      await navigate({
        to: "/abrechnungen/$statementId",
        params: { statementId: created.id },
      });
    },
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/statements/${statementId}`),
    onSuccess: async () => {
      // Detail-Query entfernen statt invalidieren: ein Nachladen liefe in
      // einen 404 auf die gerade gelöschte Abrechnung.
      queryClient.removeQueries({ queryKey: ["statement", statementId] });
      await queryClient.invalidateQueries({ queryKey: ["statements"] });
      await navigate({ to: "/abrechnungen" });
    },
  });
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (statementQuery.isError) {
    return (
      <EntityNotFound
        title={t("ui.statements.notFound.title")}
        description={t("ui.statements.notFound.description")}
        to="/abrechnungen"
      />
    );
  }

  if (!statement) {
    return (
      <div className="max-w-225 pb-6">
        <PageHeader
          tile={<PageHeaderIcon icon={domainVisuals.statements.icon} />}
          title=""
          loading={true}
        />
        <FormSkeleton rows={8} tabs="pills" kpis={3} />
      </div>
    );
  }

  const result = resolveDisplayResult(statement, preview);

  const isDraft = statement.status === "draft";

  const renderPreviewFallback = () => {
    if (previewError) {
      return (
        <Alert variant="error">
          <AlertTitle>
            {t("ui.statements.detail.calculationErrorTitle")}
          </AlertTitle>
          <AlertDescription>{previewError.message}</AlertDescription>
        </Alert>
      );
    }
    return (
      <div className="text-muted-foreground">
        {t("ui.statements.detail.computing")}
      </div>
    );
  };

  // Cache-Bust für den iframe-PDF-Endpoint: bei finalized stabil über
  // `finalizedAt`, bei draft an die TanStack-Query-Aktualisierung des
  // Live-Preview gekoppelt, neues Render nur, wenn sich die berechneten
  // Daten geändert haben.
  const pdfCacheBust = isDraft
    ? String(previewUpdatedAt ?? 0)
    : (statement.finalizedAt ?? "");
  const pdfSrc = `/api/statements/${statement.id}/pdf?v=${encodeURIComponent(pdfCacheBust)}`;
  const pdfFilename = t("ui.statements.detail.pdfFilename", {
    start: statement.periodStart,
    end: statement.periodEnd,
  });

  const identity =
    tenantAggregate && units
      ? statementIdentityLabel({ statement, aggregate: tenantAggregate, units })
      : t("ui.statements.detail.title", {
          start: formatDate(statement.periodStart),
          end: formatDate(statement.periodEnd),
        });

  const downloadPdf = () => {
    const anchor = document.createElement("a");
    anchor.href = pdfSrc;
    anchor.download = pdfFilename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const tenantName = tenantAggregate
    ? tenantAggregate.residents
        .filter((resident) => resident.isContractParty)
        .map((resident) => formatName(resident.firstName, resident.lastName))
        .join(t("ui.common.separators.comma"))
    : "";
  const unit = units?.find(
    (entry) => entry.id === tenantAggregate?.tenant.unitId,
  );

  const statusBadge = renderStatusBadge(statement);

  // 12 Monate nach Periodenende ist Nachforderung ausgeschlossen.
  // Guthaben schuldet der Vermieter weiter, deshalb nur bei Nachzahlung warnen.
  const deadlineMissedWithArrears =
    result !== undefined &&
    result.balanceCents > 0 &&
    todayIso() > isoDatePlusOneYear(statement.periodEnd);
  // Solange die DWD-Abruf-Frage unbeantwortet ist und deshalb Klimafaktoren
  // fehlen, bliebe der Vorperiodenvergleich im Anhang unbereinigt.
  const climateFactorQuestionOpen =
    result?.heatingDetail?.energyComparison?.previous !== undefined &&
    climateFactors?.autoFetch === null &&
    climateFactors.rows.some((row) => row.factor === null);

  /**
   * Unterzeile im Seitenkopf
   */
  const subLinkClass =
    "underline-offset-3 transition-colors hover:text-azur-700 hover:underline";
  const subItems: ReactNode[] = [];
  if (tenantName) {
    subItems.push(
      <Link
        to="/mieter/$tenantId/konto"
        params={{ tenantId: statement.tenantId }}
        className={subLinkClass}
      >
        {tenantName}
      </Link>,
    );
  }
  if (unit) {
    subItems.push(
      <Link
        to="/wohnungen/$unitId"
        params={{ unitId: unit.id }}
        className={subLinkClass}
      >
        {unit.name}
      </Link>,
    );
  }
  subItems.push(
    <span>{formatPeriod(statement.periodStart, statement.periodEnd)}</span>,
  );

  /**
   * Primäraktion + Chevron-Menü für seltene Aktionen, je nach Status:
   * Entwurf finalisieren/löschen, finalisiert PDF/Korrektur/Stornieren,
   * storniert Korrektur/PDF, ersetzt nur PDF.
   */
  let primaryAction: ReactNode;
  const menuItems: ReactNode[] = [];
  if (isDraft) {
    primaryAction = (
      <Button onClick={() => setConfirmFinalizeOpen(true)}>
        <RiLockLine data-icon="inline-start" />
        {t("ui.statements.detail.finalizeStatement")}
      </Button>
    );
    menuItems.push(
      <DropdownMenuItem
        key="delete"
        variant="destructive"
        onSelect={() => setDeleteOpen(true)}
      >
        <RiDeleteBinLine />
        {t("ui.statements.detail.info.deleteDraft")}
      </DropdownMenuItem>,
    );
  } else if (statement.status === "finalized") {
    primaryAction = (
      <Button onClick={downloadPdf}>
        <RiDownloadLine data-icon="inline-start" />
        {t("ui.statements.detail.downloadPdf")}
      </Button>
    );
    menuItems.push(
      <DropdownMenuItem key="correct" onSelect={() => correct.mutate()}>
        <RiFileCopy2Line />
        {t("ui.statements.detail.createCorrection")}
      </DropdownMenuItem>,
      <DropdownMenuItem
        key="cancel"
        variant="destructive"
        onSelect={() => setCancelOpen(true)}
      >
        <RiCloseCircleLine />
        {t("ui.statements.detail.cancelStatement")}
      </DropdownMenuItem>,
    );
  } else if (statement.status === "cancelled") {
    primaryAction = (
      <Button onClick={() => correct.mutate()} disabled={correct.isPending}>
        <RiFileCopy2Line data-icon="inline-start" />
        {t("ui.statements.detail.createCorrection")}
      </Button>
    );
    menuItems.push(
      <DropdownMenuItem key="download" onSelect={downloadPdf}>
        <RiDownloadLine />
        {t("ui.statements.detail.downloadPdf")}
      </DropdownMenuItem>,
    );
  } else {
    primaryAction = (
      <Button onClick={downloadPdf}>
        <RiDownloadLine data-icon="inline-start" />
        {t("ui.statements.detail.downloadPdf")}
      </Button>
    );
  }

  const subtitle = [
    tenantName,
    unit?.name,
    formatPeriod(statement.periodStart, statement.periodEnd),
  ]
    .filter(Boolean)
    .join(t("ui.common.separators.bullet"));

  return (
    <div className="max-w-225 pb-6">
      <PageHeader
        tile={<PageHeaderIcon icon={domainVisuals.statements.icon} />}
        title={identity}
        titleExtra={statusBadge}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {subItems.map((item, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: statische Liste
                <Fragment key={index}>
                  {index > 0 ? t("ui.common.separators.bullet") : null}
                  {item}
                </Fragment>
              ))}
            </span>
            {isCalculating ? (
              <span className="text-xs text-muted-foreground">
                {t("ui.statements.detail.calculating")}
              </span>
            ) : null}
          </span>
        }
        action={
          <>
            <Button variant="outline" onClick={() => handleTabChange("pdf")}>
              <RiFilePdf2Line data-icon="inline-start" />
              {t("ui.statements.detail.tabs.pdf")}
            </Button>
            {menuItems.length > 0 ? (
              <ButtonGroup>
                {primaryAction}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild={true}>
                    <Button size="icon" aria-label={t("ui.common.a11y.more")}>
                      <RiArrowDownSLine />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-56">
                    {menuItems}
                  </DropdownMenuContent>
                </DropdownMenu>
              </ButtonGroup>
            ) : (
              primaryAction
            )}
          </>
        }
      />

      <div className="space-y-6">
        {statement.status === "cancelled" && statement.cancellationReason ? (
          <Alert variant="warning">
            <AlertTitle>{t("ui.statements.detail.cancelledTitle")}</AlertTitle>
            <AlertDescription>
              {t("ui.statements.detail.cancelledReason", {
                reason: statement.cancellationReason,
              })}
            </AlertDescription>
          </Alert>
        ) : null}

        {result ? (
          <StatementTabs
            result={result}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            statementId={statement.id}
            isDraft={isDraft}
            periodEnd={statement.periodEnd}
            pdfSrc={pdfSrc}
            pdfFilename={pdfFilename}
            tenantName={tenantName}
            unitName={unit?.name}
          />
        ) : (
          renderPreviewFallback()
        )}
      </div>

      {isDraft ? (
        <StatementFinalizeDialog
          open={confirmFinalizeOpen}
          onOpenChange={setConfirmFinalizeOpen}
          subtitle={subtitle}
          warnings={result?.warnings ?? []}
          deadlineWarning={deadlineMissedWithArrears}
          climateFactorQuestionOpen={climateFactorQuestionOpen}
          advanceDetail={result?.advanceAdjustment}
          balanceCents={result?.balanceCents ?? 0}
          tenantName={tenantName}
          isPending={finalize.isPending}
          onConfirm={() => {
            setConfirmFinalizeOpen(false);
            finalize.mutate();
          }}
          onAdjustAdvance={() => {
            setConfirmFinalizeOpen(false);
            return handleTabChange("uebersicht");
          }}
        />
      ) : null}

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("ui.statements.detail.cancelStatement")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("ui.statements.detail.cancelDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder={t("ui.statements.detail.cancelReasonPlaceholder")}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline">
              {t("ui.common.action.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cancelReason.trim().length === 0 || cancel.isPending}
              onClick={(event) => {
                // Dialog nicht automatisch schließen, erst nach erfolgreicher
                // Mutation (onSuccess schließt), damit Fehler sichtbar bleiben.
                event.preventDefault();
                cancel.mutate(cancelReason.trim());
              }}
            >
              {t("ui.statements.detail.cancelStatement")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DestructiveConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("ui.statements.detail.info.confirmDeleteTitle")}
        description={
          tenantName
            ? t("ui.statements.detail.info.confirmDeleteMessageWithTenant", {
                tenant: tenantName,
                unit: unit?.name ?? "",
                period: formatPeriod(
                  statement.periodStart,
                  statement.periodEnd,
                ),
              })
            : t("ui.statements.detail.info.confirmDeleteMessage", {
                period: formatPeriod(
                  statement.periodStart,
                  statement.periodEnd,
                ),
              })
        }
        confirmLabel={t("ui.statements.detail.info.deleteDraft")}
        onConfirm={() => {
          setDeleteOpen(false);
          remove.mutate();
        }}
      />
    </div>
  );
};
