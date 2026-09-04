import { useNavigate } from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/Tabs";
import { t } from "../../lib/i18n";

export const TenantDetailHeader = ({
  tenantId,
  active,
}: {
  tenantId: string;
  active: "stammdaten" | "konto";
}) => {
  const navigate = useNavigate();

  return (
    <Tabs
      value={active}
      onValueChange={(value) => {
        navigate({
          to:
            value === "konto" ? "/mieter/$tenantId/konto" : "/mieter/$tenantId",
          params: { tenantId },
        }).catch(() => undefined);
      }}
    >
      <TabsList variant="pills">
        <TabsTrigger value="stammdaten">
          {t("ui.tenants.tabs.master")}
        </TabsTrigger>
        <TabsTrigger value="konto">{t("ui.tenants.tabs.account")}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
};
