import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@/components/common/Spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { passwordPolicyQueryOptions } from "@/lib/auth";
import logoUrl from "../../img/logo/logo.svg";
import { t } from "../../lib/i18n";
import { useAuthMode } from "../../lib/setup";
import { SetupWizard } from "./SetupWizard";

export const SetupPage = () => {
  const { data: policy } = useQuery(passwordPolicyQueryOptions);
  const authMode = useAuthMode();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted p-6">
      <div className="flex w-full max-w-md flex-col gap-8">
        <div className="flex items-center justify-center gap-3 font-medium">
          <img src={logoUrl} alt="" className="size-12" />
          <span className="font-heading font-bold text-3xl">
            <span className="text-sky-700">{t("common.appName.Einfach")}</span>
            <span className="text-teal-600">
              {t("common.appName.Vermieter")}
            </span>
          </span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t("ui.setup.title")}</CardTitle>
            <CardDescription>
              {authMode === "local"
                ? t("ui.setup.descriptionLocal")
                : t("ui.setup.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {policy ? (
              <SetupWizard policy={policy} />
            ) : (
              <div className="flex justify-center py-6">
                <Spinner className="size-6 text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
