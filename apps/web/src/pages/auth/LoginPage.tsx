import { OuterShell } from "@/components/common/OuterShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { useDocumentTitle } from "../../lib/documentTitle";
import { t } from "../../lib/i18n";
import { LoginForm } from "./LoginForm";

export const LoginPage = () => {
  useDocumentTitle(t("ui.auth.login"));
  return (
    <OuterShell>
      <Card>
        <CardHeader>
          <h1 className="font-heading text-2xl font-semibold tracking-heading">
            {t("ui.auth.login")}
          </h1>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </OuterShell>
  );
};
