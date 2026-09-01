import type { InternetSettingsUpdateDto } from "@einfachvermieter/shared";
import { RiBarChartLine, RiCloudLine, RiRefreshLine } from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { SectionCard } from "@/components/common/SectionCard";
import { UpdateLinks } from "@/components/common/UpdateLinks";
import { UpdateVersion } from "@/components/common/UpdateVersion";
import { FormSkeleton } from "@/components/FormSkeleton";
import { HelpHint } from "@/components/help/HelpHint";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { climateFactorsSettingsQueryOptions } from "@/lib/climateFactors";
import { t } from "@/lib/i18n";
import {
  internetSettingsQueryOptions,
  updateInternetSettings,
  updateStatusQueryOptions,
} from "@/lib/updates";
import { SettingsLayout } from "./SettingsLayout";

/**
 * Card Einwilligung: Hinweis, solange nicht entschieden, dann die
 * Schalterzeile und optional eine Statuszeile darunter.
 */
const ConsentCard = ({
  icon,
  title,
  value,
  disabled,
  label,
  description,
  details,
  undecidedNote,
  onChange,
  children,
}: {
  icon: typeof RiCloudLine;
  title: string;
  value: boolean | null;
  disabled: boolean;
  label: string;
  description: string;
  details: string;
  undecidedNote: string;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
}) => (
  <SectionCard icon={icon} title={title}>
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Switch
          checked={value === true}
          disabled={disabled}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {label}
            <Badge variant="ok">{t("ui.internetAccess.recommended")}</Badge>
            {value === null ? (
              <Badge variant="neutral">
                {t("ui.settings.internet.undecided")}
              </Badge>
            ) : null}
            <HelpHint>{details}</HelpHint>
          </p>
          <p className="text-xs text-muted-foreground">{description}</p>
          {value === null ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {undecidedNote}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  </SectionCard>
);

/**
 * Alle Internetzugriffe der App an einer Stelle, jeder einzeln erlaubbar:
 * Klimafaktoren vom DWD, Prüfung auf neue Versionen, anonyme
 * Nutzungsstatistik. Solange eine Entscheidung nicht getroffen ist, ruft
 * die App nichts ab.
 */
export const InternetSettingsPage = () => {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery(internetSettingsQueryOptions);
  const updateStatusQuery = useQuery(updateStatusQueryOptions);

  const save = useMutation({
    mutationFn: (patch: InternetSettingsUpdateDto) =>
      updateInternetSettings(patch),
    onSuccess: (updated, patch) => {
      queryClient.setQueryData(internetSettingsQueryOptions.queryKey, updated);
      if (patch.climateFactorsAutoFetch !== undefined) {
        queryClient.invalidateQueries({
          queryKey: climateFactorsSettingsQueryOptions.queryKey,
        });
        queryClient.invalidateQueries({ queryKey: ["climateFactors"] });
        queryClient.invalidateQueries({ queryKey: ["statement-preview"] });
      }
      if (patch.updateCheckEnabled !== undefined) {
        queryClient.invalidateQueries({
          queryKey: updateStatusQueryOptions.queryKey,
        });
      }
      toast.success(t("ui.settings.internet.saveSuccess"));
    },
    onError: (error) => toast.error(error.message),
  });

  const settings = settingsQuery.data;
  const updateStatus = updateStatusQuery.data;

  return (
    <SettingsLayout
      active="internet"
      title={t("ui.settings.internet.title")}
      description={t("ui.settings.internet.description")}
    >
      {settings === undefined ? (
        <FormSkeleton rows={3} />
      ) : (
        <div className="space-y-6">
          <ConsentCard
            icon={RiCloudLine}
            title={t("ui.settings.internet.climateFactors.cardTitle")}
            value={settings.climateFactorsAutoFetch}
            disabled={save.isPending}
            label={t("ui.internetAccess.climateFactors.label")}
            description={t("ui.internetAccess.climateFactors.description")}
            details={t("ui.internetAccess.climateFactors.details")}
            undecidedNote={t(
              "ui.settings.internet.climateFactors.undecidedNote",
            )}
            onChange={(checked) =>
              save.mutate({ climateFactorsAutoFetch: checked })
            }
          />

          <ConsentCard
            icon={RiRefreshLine}
            title={t("ui.settings.internet.updateCheck.cardTitle")}
            value={settings.updateCheckEnabled}
            disabled={save.isPending}
            label={t("ui.internetAccess.updateCheck.label")}
            description={t("ui.internetAccess.updateCheck.description")}
            details={t("ui.internetAccess.updateCheck.details")}
            undecidedNote={t("ui.settings.internet.updateCheck.undecidedNote")}
            onChange={(checked) => save.mutate({ updateCheckEnabled: checked })}
          >
            {updateStatus ? (
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <p className="inline-flex flex-wrap gap-x-1">
                  {t("ui.settings.internet.updateCheck.currentVersion")}
                  <UpdateVersion version={updateStatus.currentVersion} />
                </p>
                {updateStatus.enabled === true ? (
                  <p className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                    {updateStatus.latestVersion && updateStatus.downloadUrl ? (
                      <>
                        <span className="inline-flex gap-x-1">
                          {t("ui.navigation.updateAvailable")}
                          <UpdateVersion
                            version={updateStatus.latestVersion}
                            availableFrom={updateStatus.availableFrom}
                          />
                        </span>
                        <UpdateLinks status={updateStatus} />
                      </>
                    ) : (
                      t("ui.settings.internet.updateCheck.noneKnown")
                    )}
                  </p>
                ) : null}
              </div>
            ) : null}
          </ConsentCard>

          <ConsentCard
            icon={RiBarChartLine}
            title={t("ui.settings.internet.telemetry.cardTitle")}
            value={settings.telemetryEnabled}
            disabled={save.isPending}
            label={t("ui.internetAccess.telemetry.label")}
            description={t("ui.internetAccess.telemetry.description")}
            details={t("ui.internetAccess.telemetry.details")}
            undecidedNote={t("ui.settings.internet.telemetry.undecidedNote")}
            onChange={(checked) => save.mutate({ telemetryEnabled: checked })}
          />
        </div>
      )}
    </SettingsLayout>
  );
};
