import { useQuery } from "@tanstack/react-query";
import { UpdateLinks } from "@/components/common/UpdateLinks";
import { UpdateVersion } from "@/components/common/UpdateVersion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { useCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { updateStatusQueryOptions } from "@/lib/updates";

/**
 * Dezenter Hinweis in der Sidebar, wenn eine neuere Version bekannt ist.
 */
export const UpdateHint = () => {
  const { data: user } = useCurrentUser();
  const { data } = useQuery({
    ...updateStatusQueryOptions,
    enabled: user?.role === "admin",
  });

  if (!data?.latestVersion || !data.downloadUrl) {
    return null;
  }

  return (
    <div className="mx-2 mb-1">
      <Alert variant="warning" size="sm">
        <AlertTitle>{t("ui.navigation.updateAvailable")}</AlertTitle>
        <AlertDescription>
          <div className="flex flex-col gap-1">
            <UpdateVersion
              version={data.latestVersion}
              availableFrom={data.availableFrom}
            />
            <UpdateLinks status={data} />
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
};
