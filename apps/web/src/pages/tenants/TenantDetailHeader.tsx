import { RiUser3Line, RiWallet3Line } from "@remixicon/react";
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
    <div className="space-y-6">
      <Tabs
        value={active}
        onValueChange={(value) => {
          navigate({
            to:
              value === "konto"
                ? "/mieter/$tenantId/konto"
                : "/mieter/$tenantId",
            params: { tenantId },
          }).catch(() => undefined);
        }}
      >
        <TabsList variant="default">
          <TabsTrigger value="stammdaten">
            <RiUser3Line />
            {t("ui.tenants.tabs.master")}
          </TabsTrigger>
          <TabsTrigger value="konto">
            <RiWallet3Line />
            {t("ui.tenants.tabs.account")}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
};
