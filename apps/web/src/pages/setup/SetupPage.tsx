import { useQuery } from "@tanstack/react-query";
import { OuterShell } from "@/components/common/OuterShell";
import { Spinner } from "@/components/common/Spinner";
import { passwordPolicyQueryOptions } from "@/lib/auth";
import { useDocumentTitle } from "../../lib/documentTitle";
import { t } from "../../lib/i18n";
import { SetupWizard } from "./SetupWizard";

export const SetupPage = () => {
  useDocumentTitle(t("ui.setup.title"));
  const { data: policy } = useQuery(passwordPolicyQueryOptions);

  return (
    <OuterShell width="lg">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {policy ? (
          <SetupWizard policy={policy} />
        ) : (
          <div className="flex justify-center py-12">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        )}
      </div>
    </OuterShell>
  );
};
