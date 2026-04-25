import type { StatementResult } from "@einfachvermieter/shared";
import { formatDate } from "@einfachvermieter/shared";
import { RiDownloadLine, RiFileList3Line } from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { Description } from "../../components/common/Description";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { Heading1 } from "../../components/common/Heading1";
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
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/Tabs";
import { Textarea } from "../../components/ui/Textarea";
import { api } from "../../lib/api";
import { t } from "../../lib/i18n";
import { statementIdentityLabel } from "../../lib/statements";
import { tenantQueryOptions } from "../../lib/tenants";
import { unitsQueryOptions } from "../../lib/units";
import { AdvanceAdjustmentCard } from "./components/AdvanceAdjustmentCard";
import { HeatingCard } from "./components/detail/HeatingCard";
import { OccupancyCard } from "./components/detail/OccupancyCard";
import { OperatingCostsCard } from "./components/detail/OperatingCostsCard";
import { OverviewCard } from "./components/detail/OverviewCard";
import { PaymentsCard } from "./components/detail/PaymentsCard";
import { TaxableLaborCard } from "./components/detail/TaxableLaborCard";

type Statement = {
  id: string;
  buildingId: string;
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "finalized" | "cancelled" | "superseded";
  totalCostsCents: number | null;
  totalAdvancesCents: number | null;
  balanceCents: number | null;
  adjustedMonthlyAdvanceCents: number | null;
  adjustedAdvanceValidFrom: string | null;
  tariffAdjustmentBps: Record<string, number> | null;
  sequenceNumber: number | null;
  revisionNumber: number | null;
  finalizedAt: string | null;
  supersedesStatementId: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  snapshotData: StatementResult | null;
};

/**
 * Anzuzeigendes Ergebnis: bei finalisiert/storniert der Snapshot, bei Draft der
 * Live-Preview, mit den am Draft gespeicherten Anpassungs-Werten gemerged, damit
 * Card und PDF-Vorschau den aktuellen Stand spiegeln. undefined, solange Draft
 * ohne Preview.
 */
const resolveDisplayResult = (
  statement: Statement,
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
 * Aktiver Tab aus dem Pfad-Suffix der Detail-Route (Default: Übersicht).
 */
const tabFromPathname = (pathname: string): string => {
  const suffixToTab: [string, string][] = [
    ["/pdf", "pdf"],
    ["/kosten", "operating"],
    ["/heizkosten", "heating"],
    ["/belegung", "occupancy"],
    ["/steuer", "taxableLabor"],
    ["/zahlungen", "payments"],
    ["/vorauszahlung", "advance"],
  ];
  return (
    suffixToTab.find(([suffix]) => pathname.endsWith(suffix))?.[1] ?? "overview"
  );
};

/**
 * Tab-Leiste + Inhalte der Abrechnungs-Detailseite. Tabs ohne Datenlage
 * (Zahlungen, Belegung, § 35a, Heizung) werden ausgeblendet, damit der Nutzer
 * nicht in leeren Ansichten landet.
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
}: {
  result: StatementResult;
  activeTab: string;
  onTabChange: (value: string) => Promise<void>;
  statementId: string;
  isDraft: boolean;
  periodEnd: string;
  pdfSrc: string;
  pdfFilename: string;
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
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList variant="line">
        <TabsTrigger value="overview">
          {t("ui.statements.detail.tabs.overview")}
        </TabsTrigger>
        <TabsTrigger value="operating">
          {t("ui.statements.detail.tabs.operatingCosts")}
        </TabsTrigger>
        {hasPayments ? (
          <TabsTrigger value="payments">
            {t("ui.statements.detail.tabs.payments")}
          </TabsTrigger>
        ) : null}
        {occupancyDetail ? (
          <TabsTrigger value="occupancy">
            {t("ui.statements.detail.tabs.occupancy")}
          </TabsTrigger>
        ) : null}
        {hasTaxableLabor ? (
          <TabsTrigger value="taxableLabor">
            {t("ui.statements.detail.tabs.taxableLabor")}
          </TabsTrigger>
        ) : null}
        {heatingDetail ? (
          <TabsTrigger value="heating">
            {t("ui.statements.detail.tabs.heating")}
          </TabsTrigger>
        ) : null}
        <TabsTrigger value="advance">
          {t("ui.statements.detail.tabs.advance")}
        </TabsTrigger>
        <TabsTrigger value="pdf">
          {t("ui.statements.detail.tabs.pdf")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <OverviewCard result={result} />
      </TabsContent>
      <TabsContent value="operating">
        <OperatingCostsCard result={result} />
      </TabsContent>
      {hasPayments ? (
        <TabsContent value="payments">
          <PaymentsCard
            payments={payments}
            period={result.period}
            tenantPeriod={result.tenantPeriod}
          />
        </TabsContent>
      ) : null}
      {occupancyDetail ? (
        <TabsContent value="occupancy">
          <OccupancyCard detail={occupancyDetail} />
        </TabsContent>
      ) : null}
      {hasTaxableLabor && taxableLabor ? (
        <TabsContent value="taxableLabor">
          <TaxableLaborCard detail={taxableLabor} />
        </TabsContent>
      ) : null}
      {heatingDetail ? (
        <TabsContent value="heating">
          <HeatingCard
            detail={heatingDetail}
            tenantPeriod={result.tenantPeriod}
            statementPeriod={result.period}
          />
        </TabsContent>
      ) : null}
      <TabsContent value="advance">
        <AdvanceAdjustmentCard
          statementId={statementId}
          isDraft={isDraft}
          detail={result.advanceAdjustment}
          lines={result.lines}
          periodEnd={periodEnd}
        />
      </TabsContent>
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
            <object
              data={pdfSrc}
              type="application/pdf"
              width="100%"
              height="100%"
              aria-label={t("ui.statements.detail.tabs.pdf")}
            />
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
  // strict:false weil dieselbe Component zwei Routen bedient
  // (/abrechnungen/$statementId und /abrechnungen/$statementId/pdf).
  const { statementId } = useParams({ strict: false }) as {
    statementId: string;
  };

  const location = useLocation();
  const navigate = useNavigate();

  // Pathname-Suffix -> Tab-Wert. Default ("/abrechnungen/$statementId" ohne
  // Suffix) ist die Übersicht. Pfadsegment immer in Sync mit den Routen
  // halten, sonst stimmt der aktive Tab nicht.
  const activeTab = tabFromPathname(location.pathname);
  const handleTabChange = async (value: string) => {
    const to = (() => {
      switch (value) {
        case "operating":
          return "/abrechnungen/$statementId/kosten";

        case "heating":
          return "/abrechnungen/$statementId/heizkosten";

        case "occupancy":
          return "/abrechnungen/$statementId/belegung";

        case "taxableLabor":
          return "/abrechnungen/$statementId/steuer";

        case "payments":
          return "/abrechnungen/$statementId/zahlungen";

        case "advance":
          return "/abrechnungen/$statementId/vorauszahlung";

        case "pdf":
          return "/abrechnungen/$statementId/pdf";

        default:
          return "/abrechnungen/$statementId";
      }
    })();
    await navigate({ to, params: { statementId } });
  };

  const statementQuery = useQuery({
    queryKey: ["statement", statementId],
    queryFn: () => api.get<Statement>(`/statements/${statementId}`),
    enabled: Boolean(statementId),
  });
  const statement = statementQuery.data;

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

  const invalidateStatementQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ["statement"] });
    await queryClient.invalidateQueries({ queryKey: ["statements"] });
  };

  const finalize = useMutation({
    mutationFn: () =>
      api.post<Statement>(`/statements/${statementId}/finalize`),
    onSuccess: invalidateStatementQueries,
  });
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);

  const cancel = useMutation({
    mutationFn: (reason: string) =>
      api.post<Statement>(`/statements/${statementId}/cancel`, { reason }),
    onSuccess: async () => {
      setCancelOpen(false);
      setCancelReason("");
      await invalidateStatementQueries();
    },
  });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const correct = useMutation({
    mutationFn: () => api.post<Statement>(`/statements/${statementId}/correct`),
    onSuccess: async (created) => {
      await invalidateStatementQueries();
      await navigate({
        to: "/abrechnungen/$statementId",
        params: { statementId: created.id },
      });
    },
  });

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
    return <FormSkeleton rows={8} />;
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Heading1 icon={<RiFileList3Line />}>
            {tenantAggregate && units
              ? statementIdentityLabel({
                  statement,
                  aggregate: tenantAggregate,
                  units,
                })
              : t("ui.statements.detail.title", {
                  start: formatDate(statement.periodStart),
                  end: formatDate(statement.periodEnd),
                })}
          </Heading1>
          <div className="mt-2 flex items-center gap-2">
            {statement.status === "draft" ? (
              <Badge variant="lightYellow">
                {statement.supersedesStatementId
                  ? t("ui.statements.detail.correctionDraft")
                  : t("ui.statements.detail.draftLive")}
              </Badge>
            ) : null}
            {statement.status === "finalized" ? (
              <Badge variant="lightGreen">
                {t("ui.statements.detail.finalizedAt", {
                  date: formatDate(statement.finalizedAt?.slice(0, 10) ?? ""),
                })}
              </Badge>
            ) : null}
            {statement.status === "cancelled" ? (
              <Badge variant="lightRed">
                {t("ui.statements.detail.cancelledBadge")}
              </Badge>
            ) : null}
            {statement.status === "superseded" ? (
              <Badge variant="secondary">
                {t("ui.statements.detail.supersededBadge")}
              </Badge>
            ) : null}
            {isCalculating ? (
              <span className="text-xs text-muted-foreground">
                {t("ui.statements.detail.calculating")}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDraft ? (
            <Button
              onClick={() => setConfirmFinalizeOpen(true)}
              disabled={finalize.isPending}
            >
              {finalize.isPending
                ? t("ui.statements.detail.finalizing")
                : t("ui.statements.detail.finalizeStatement")}
            </Button>
          ) : null}
          {statement.status === "finalized" ? (
            <>
              <Button
                variant="outline"
                onClick={() => setCancelOpen(true)}
                disabled={cancel.isPending}
              >
                {t("ui.statements.detail.cancelStatement")}
              </Button>
              <Button
                onClick={() => correct.mutate()}
                disabled={correct.isPending}
              >
                {t("ui.statements.detail.createCorrection")}
              </Button>
            </>
          ) : null}
          {statement.status === "cancelled" ? (
            <Button
              onClick={() => correct.mutate()}
              disabled={correct.isPending}
            >
              {t("ui.statements.detail.createCorrection")}
            </Button>
          ) : null}
        </div>
      </div>

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

      <DestructiveConfirmDialog
        open={confirmFinalizeOpen}
        onOpenChange={setConfirmFinalizeOpen}
        title={t("ui.statements.detail.finalizeStatement")}
        description={t("ui.statements.detail.confirmFinalize")}
        confirmLabel={t("ui.statements.detail.finalizeStatement")}
        onConfirm={() => {
          setConfirmFinalizeOpen(false);
          finalize.mutate();
        }}
      />

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

      {result && (result.warnings ?? []).length > 0 ? (
        <Alert variant="warning">
          <AlertTitle>{t("ui.statements.detail.warningsTitle")}</AlertTitle>
          <AlertDescription>
            <p>{t("ui.statements.detail.warningsDescription")}</p>
            <ul className="mt-2 list-disc pl-5">
              {result.warnings?.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
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
        />
      ) : (
        renderPreviewFallback()
      )}
    </div>
  );
};
