import { useQuery } from "@tanstack/react-query";
import { AppBrand } from "@/components/common/AppBrand";
import { Spinner } from "@/components/common/Spinner";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { passwordPolicyQueryOptions } from "@/lib/auth";
import { useDocumentTitle } from "../../lib/documentTitle";
import { t } from "../../lib/i18n";
import { SetupWizard } from "./SetupWizard";

export const SetupPage = () => {
  useDocumentTitle(t("ui.setup.title"));
  const { data: policy } = useQuery(passwordPolicyQueryOptions);

  return (
    <div className="auth-wash flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader>
            <AppBrand />
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
