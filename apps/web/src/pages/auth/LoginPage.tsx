import { AppBrand } from "@/components/common/AppBrand";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
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
            <AppBrand />
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
