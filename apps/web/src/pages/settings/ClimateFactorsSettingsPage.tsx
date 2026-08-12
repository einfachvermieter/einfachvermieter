import { RiCloudLine } from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SectionCard } from "@/components/common/SectionCard";
import { FormSkeleton } from "@/components/FormSkeleton";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { Switch } from "@/components/ui/Switch";
import {
  climateFactorsSettingsQueryOptions,
  updateClimateFactorsAutoFetch,
} from "@/lib/climateFactors";
import { gradients } from "@/lib/domainVisuals";
import { t } from "@/lib/i18n";
import { SettingsLayout } from "./SettingsLayout";

/**
 * Entscheidung, ob Klimafaktoren für die Witterungsbereinigung automatisch
 * von opendata.dwd.de geladen werden dürfen. Solange sie nicht getroffen
 * ist, ruft die App keine Daten ab; die Frage erscheint zusätzlich an der
 * Klimafaktoren-Karte der Abrechnung.
 */
export const ClimateFactorsSettingsPage = () => {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery(climateFactorsSettingsQueryOptions);

  const update = useMutation({
    mutationFn: (autoFetch: boolean) =>
      updateClimateFactorsAutoFetch(autoFetch),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        climateFactorsSettingsQueryOptions.queryKey,
        updated,
      );
      queryClient.invalidateQueries({ queryKey: ["climateFactors"] });
      queryClient.invalidateQueries({ queryKey: ["statement-preview"] });
      toast.success(t("ui.settings.climateFactors.saveSuccess"));
    },
    onError: (error) => toast.error(error.message),
  });

  const settings = settingsQuery.data;

  return (
    <SettingsLayout
      active="climate"
      title={t("ui.settings.climateFactors.title")}
      description={t("ui.settings.climateFactors.description")}
    >
      {settings === undefined ? (
        <FormSkeleton rows={2} />
      ) : (
        <SectionCard
          icon={RiCloudLine}
          iconBackground={gradients.slate}
          title={t("ui.settings.climateFactors.cardTitle")}
        >
          <div className="space-y-4">
            {settings.autoFetch === null ? (
              <Alert variant="info">
                <AlertDescription>
                  {t("ui.settings.climateFactors.undecidedNote")}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex items-center gap-3">
              <Switch
                checked={settings.autoFetch === true}
                disabled={update.isPending}
                onCheckedChange={(checked) => update.mutate(checked === true)}
              />
              <div>
                <p className="text-sm font-medium">
                  {t("ui.settings.climateFactors.switchLabel")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("ui.settings.climateFactors.switchDescription")}
                </p>
              </div>
            </div>
          </div>
        </SectionCard>
      )}
    </SettingsLayout>
  );
};
