import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { FormSkeleton } from "../../components/FormSkeleton";
import { t } from "../../lib/i18n";
import { meterQueryOptions } from "../../lib/meters";
import { MeterReadingsTab } from "./components/readings/MeterReadingsTab";
import { MeterDetailHeader } from "./MeterDetailHeader";
import { MeterHero } from "./MeterHero";

export const MeterReadingsPage = () => {
  const { meterId } = useParams({ strict: false }) as { meterId: string };
  const meterQuery = useQuery(meterQueryOptions(meterId));
  const meter = meterQuery.data;

  if (meterQuery.isError) {
    return (
      <EntityNotFound
        title={t("ui.meters.notFound.title")}
        description={t("ui.meters.notFound.description")}
        to="/zaehler"
      />
    );
  }

  if (!meter) {
    return <FormSkeleton rows={4} />;
  }

  return (
    <div className="pb-24">
      <MeterHero meterId={meterId} eyebrow={t("ui.meters.editTitle")} />

      <MeterDetailHeader meterId={meterId} active="zaehlerstaende" />

      <div className="mt-6">
        <MeterReadingsTab
          meterId={meterId}
          measurementUnit={meter.measurementUnit}
          role={meter.role}
        />
      </div>
    </div>
  );
};
