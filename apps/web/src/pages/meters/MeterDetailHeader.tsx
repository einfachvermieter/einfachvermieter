import { useNavigate } from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/Tabs";
import { t } from "../../lib/i18n";

export const MeterDetailHeader = ({
  meterId,
  active,
}: {
  meterId: string;
  active: "stammdaten" | "zaehlerstaende";
}) => {
  const navigate = useNavigate();

  return (
    <Tabs
      value={active}
      onValueChange={(value) => {
        navigate({
          to:
            value === "zaehlerstaende"
              ? "/zaehler/$meterId/zaehlerstaende"
              : "/zaehler/$meterId",
          params: { meterId },
        }).catch(() => undefined);
      }}
    >
      <TabsList variant="pills">
        <TabsTrigger value="stammdaten">
          {t("ui.meters.tabs.master")}
        </TabsTrigger>
        <TabsTrigger value="zaehlerstaende">
          {t("ui.meters.tabs.readings")}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};
