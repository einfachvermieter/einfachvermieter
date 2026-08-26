import { formatNumber } from "@einfachvermieter/shared";
import { RiCloudLine } from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { SectionCard } from "@/components/common/SectionCard";
import { Spinner } from "@/components/common/Spinner";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { api } from "../../../../lib/api";
import {
  type ClimateFactorRow,
  climateFactorsQueryOptions,
  climateFactorsSettingsQueryOptions,
  updateClimateFactorsAutoFetch,
} from "../../../../lib/climateFactors";
import { formatPeriod } from "../../../../lib/format";
import { t } from "../../../../lib/i18n";

const decimalRegex = /^\d+([.,]\d+)?$/u;

const parseFactorInput = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (!decimalRegex.test(trimmed)) {
    return null;
  }
  const parsed = Number.parseFloat(trimmed.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 5 ? parsed : null;
};

const rowKey = (row: ClimateFactorRow): string =>
  `${row.periodStart}|${row.periodEnd}`;

const sourceBadge = (row: ClimateFactorRow) => {
  if (row.factor === null) {
    return t("ui.common.emptyValue");
  }
  if (row.isManual) {
    return (
      <Badge variant="warn">
        {t("ui.heating.climateFactors.sourceManual")}
      </Badge>
    );
  }
  return (
    <Badge variant="neutral">{t("ui.heating.climateFactors.sourceDwd")}</Badge>
  );
};

/**
 * Klimafaktoren der Entwurfs-Abrechnung für die Witterungsbereinigung
 * des Vorperiodenvergleichs (§ 6a Abs. 3 Nr. 5 HeizkostenV): der eigene
 * Abrechnungszeitraum und - falls vorhanden - der der Vorperiode, mit dem
 * gecachten DWD-Wert der Gebäude-PLZ. Bearbeiten nur hinter dem Schalter
 * (Notausgang ohne Internet); „Neu laden" holt den DWD-Wert zurück und
 * überschreibt manuelle Eingaben. Werte gelten je PLZ + Zeitraum, also
 * automatisch für alle Abrechnungen und Gebäude derselben PLZ.
 */
export const ClimateFactorsCard = ({
  statementId,
}: {
  statementId: string;
}) => {
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data } = useQuery(climateFactorsQueryOptions(statementId));
  const buildingId = data?.buildingId;

  // Nach Änderungen auch die Live-Berechnung neu anstoßen - der Vergleich
  // im § 6a-Anhang rechnet mit den Faktoren.
  /**
   * Lokalen Eingabe-Entwurf einer Zeile verwerfen, damit das Feld nach
   * Speichern/Neu-laden wieder den Server-Wert zeigt.
   */
  const clearDraft = (row: ClimateFactorRow) =>
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[rowKey(row)];
      return next;
    });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["climateFactors"] });
    queryClient.invalidateQueries({ queryKey: ["statement-preview"] });
  };

  const decideAutoFetch = useMutation({
    mutationFn: (autoFetch: boolean) =>
      updateClimateFactorsAutoFetch(autoFetch),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: climateFactorsSettingsQueryOptions.queryKey,
      });
      // Bei "Automatisch laden" holt die nächste Berechnung die Faktoren.
      invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const reload = useMutation({
    mutationFn: (row: ClimateFactorRow) =>
      api.post("/climate-factors/reload", {
        buildingId,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
      }),
    onSuccess: (_data, row) => {
      toast.success(t("ui.heating.climateFactors.reloadSuccess"));
      clearDraft(row);
      invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const save = useMutation({
    mutationFn: ({ row, factor }: { row: ClimateFactorRow; factor: number }) =>
      api.put("/climate-factors", {
        buildingId,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        factor,
      }),
    onSuccess: (_data, variables) => {
      toast.success(t("ui.heating.climateFactors.saveSuccess"));
      clearDraft(variables.row);
      invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  if (!data || data.rows.length === 0) {
    return null;
  }

  const submitDraft = (row: ClimateFactorRow) => {
    const raw = drafts[rowKey(row)];
    if (raw === undefined || raw.trim() === "") {
      return;
    }
    const factor = parseFactorInput(raw);
    if (factor === null) {
      toast.error(t("ui.heating.climateFactors.factorInvalid"));
      return;
    }
    save.mutate({ row, factor });
  };

  return (
    <SectionCard
      icon={RiCloudLine}
      title={t("ui.heating.climateFactors.title")}
      description={
        data.postalCode
          ? t("ui.heating.climateFactors.description", {
              postalCode: data.postalCode,
            })
          : t("ui.heating.climateFactors.descriptionNoPostalCode")
      }
    >
      <div className="space-y-4">
        {data.autoFetch === null && data.postalCode ? (
          <Alert variant="info">
            <AlertDescription>
              <p>{t("ui.heating.climateFactors.consentQuestion")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={decideAutoFetch.isPending}
                  onClick={() => decideAutoFetch.mutate(true)}
                >
                  {t("ui.heating.climateFactors.consentEnable")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={decideAutoFetch.isPending}
                  onClick={() => decideAutoFetch.mutate(false)}
                >
                  {t("ui.heating.climateFactors.consentDecline")}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}
        {data.autoFetch === false ? (
          <Alert variant="default">
            <AlertDescription>
              {t("ui.heating.climateFactors.consentDeclinedHint")}
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="scroll-shadow-x overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 font-medium">
                  {t("ui.heating.climateFactors.columns.period")}
                </th>
                <th className="py-2 text-right font-medium">
                  {t("ui.heating.climateFactors.columns.factor")}
                </th>
                <th className="py-2 text-right font-medium">
                  {t("ui.heating.climateFactors.columns.source")}
                </th>
                <th className="py-2 text-right font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={rowKey(row)} className="border-b border-border">
                  <td className="py-2.5">
                    {formatPeriod(row.periodStart, row.periodEnd)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {editMode ? (
                      <div className="ml-auto w-24">
                        <Input
                          inputMode="decimal"
                          placeholder={t(
                            "ui.heating.climateFactors.factorPlaceholder",
                          )}
                          value={
                            drafts[rowKey(row)] ??
                            (row.factor === null
                              ? ""
                              : formatNumber(row.factor, 2))
                          }
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [rowKey(row)]: event.target.value,
                            }))
                          }
                        />
                      </div>
                    ) : (
                      (row.factor !== null && formatNumber(row.factor, 2)) || (
                        <span className="text-muted-foreground">
                          {t("ui.heating.climateFactors.missing")}
                        </span>
                      )
                    )}
                  </td>
                  <td className="py-2.5 text-right">{sourceBadge(row)}</td>
                  <td className="py-2.5 text-right">
                    <div className="flex justify-end gap-2">
                      {editMode ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={save.isPending}
                          onClick={() => submitDraft(row)}
                        >
                          {save.isPending ? (
                            <Spinner data-icon="inline-start" />
                          ) : null}
                          {t("ui.heating.climateFactors.save")}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={reload.isPending}
                        onClick={() => reload.mutate(row)}
                      >
                        {reload.isPending ? (
                          <Spinner data-icon="inline-start" />
                        ) : null}
                        {t("ui.heating.climateFactors.reload")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={editMode}
            onCheckedChange={(checked) => {
              setEditMode(checked === true);
              setDrafts({});
            }}
          />
          <div>
            <p className="text-sm font-medium">
              {t("ui.heating.climateFactors.editSwitch")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("ui.heating.climateFactors.editSwitchDescription")}
            </p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
};
