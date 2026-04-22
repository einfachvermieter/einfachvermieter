import { RiTeamLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Heading1 } from "../../components/common/Heading1";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/Tabs";
import { t } from "../../lib/i18n";
import { tenantIdentityLabel, tenantQueryOptions } from "../../lib/tenants";
import { unitsQueryOptions } from "../../lib/units";

export const TenantDetailHeader = ({
  tenantId,
  active,
}: {
  tenantId: string;
  active: "stammdaten" | "konto";
}) => {
  const navigate = useNavigate();
  const { data: aggregate } = useQuery(tenantQueryOptions(tenantId));
  const { data: units } = useQuery(unitsQueryOptions);

  const title =
    aggregate && units ? tenantIdentityLabel({ aggregate, units }) : "";

  return (
    <div className="space-y-6">
      <Heading1 icon={<RiTeamLine />}>{title}</Heading1>
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
        <TabsList variant="line">
          <TabsTrigger value="stammdaten">
            {t("ui.tenants.tabs.master")}
          </TabsTrigger>
          <TabsTrigger value="konto">
            {t("ui.tenants.tabs.account")}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
};
