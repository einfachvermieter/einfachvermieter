import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import logoUrl from "../../img/logo/logo.svg";
import { useDocumentTitle } from "../../lib/documentTitle";
import { t } from "../../lib/i18n";
import { LoginForm } from "./LoginForm";

export const LoginPage = () => {
  useDocumentTitle(t("ui.auth.login"));
  return (
    <div className="auth-wash flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <div className="flex flex-col items-center gap-3 text-center">
              <img src={logoUrl} alt="" className="size-12" />
              <span className="font-heading font-bold text-2xl">
                <span className="text-sky-700">
                  {t("common.appName.Einfach")}
                </span>
                <span className="text-teal-600">
                  {t("common.appName.Vermieter")}
                </span>
              </span>
              <CardTitle>{t("ui.auth.welcome")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
