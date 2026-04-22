import type { MeterCreateDto } from "@einfachvermieter/shared";
import { RiDashboard3Line } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { Heading1 } from "../../components/common/Heading1";
import { FormSkeleton } from "../../components/FormSkeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/Tabs";
import { api } from "../../lib/api";
import { buildingsQueryOptions } from "../../lib/buildings";
import { costTypesQueryOptions } from "../../lib/costs";
import { t } from "../../lib/i18n";
import type { Meter } from "../../lib/meters";
import { meterQueryOptions } from "../../lib/meters";
import { unitsQueryOptions } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useGoBack } from "../../lib/useGoBack";
import { meterToFormValues } from "./components/meterFormHelpers";
import { MeterReadingsTab } from "./components/readings/MeterReadingsTab";
import { MeterForm } from "./MeterForm";

export const MeterDetailPage = () => {
  const { meterId } = useParams({ strict: false }) as { meterId: string };
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const isReadingsTab = pathname.endsWith("/zaehlerstaende");
  const activeTab = isReadingsTab ? "readings" : "config";

  const meterQuery = useQuery(meterQueryOptions(meterId));
  const meter = meterQuery.data;
  const { data: buildings } = useQuery(buildingsQueryOptions);
  const { data: units } = useQuery(unitsQueryOptions);
  const { data: costTypes } = useQuery(costTypesQueryOptions);

  const goBack = useGoBack("/zaehler", {
    search: { buildingId: undefined, type: undefined },
  });

  const updateMeter = useCrudMutation({
    mutationFn: ({ buildingId: _ignored, ...dto }: MeterCreateDto) =>
      api.patch<Meter>(`/meters/${meterId}`, dto),
    invalidateKeys: [["meters"], ["meter", meterId]],
    onSuccess: goBack,
  });

  if (meterQuery.isError) {
    return (
      <EntityNotFound
        title={t("ui.meters.notFound.title")}
        description={t("ui.meters.notFound.description")}
        to="/zaehler"
      />
    );
  }

  if (!meter || !buildings || !units || !costTypes) {
    return <FormSkeleton rows={4} />;
  }

  return (
    <div className="space-y-6">
      <Heading1 icon={<RiDashboard3Line />}>{meter.label}</Heading1>
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const target =
            value === "readings"
              ? `/zaehler/${meterId}/zaehlerstaende`
              : `/zaehler/${meterId}`;
          navigate({ to: target as string }).catch(() => undefined);
        }}
      >
        <TabsList variant="line">
          <TabsTrigger value="config">
            {t("ui.reading.tabs.configuration")}
          </TabsTrigger>
          <TabsTrigger value="readings">
            {t("ui.reading.tabs.readings")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="config">
          <MeterForm
            mode="edit"
            buildings={buildings}
            units={units}
            costTypes={costTypes}
            defaultValues={meterToFormValues(meter)}
            costAllocationModeLocked={meter.costAllocationModeLocked}
            currentMeterId={meter.id}
            onSubmit={async (values) => {
              await updateMeter.mutateAsync(values);
            }}
            onCancel={goBack}
          />
        </TabsContent>
        <TabsContent value="readings">
          <MeterReadingsTab
            meterId={meterId}
            measurementUnit={meter.measurementUnit}
            role={meter.role}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
