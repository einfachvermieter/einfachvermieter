import { RiAddLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useState } from "react";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { FormSkeleton } from "../../components/FormSkeleton";
import { Button } from "../../components/ui/Button";
import { t } from "../../lib/i18n";
import { meterQueryOptions, type Reading } from "../../lib/meters";
import { MeterReadingsTab } from "./components/readings/MeterReadingsTab";
import { MeterDetailLayout } from "./MeterDetailLayout";
import { ReadingSheet } from "./sheets/ReadingSheet";

export const MeterReadingsPage = () => {
  const { meterId } = useParams({ strict: false }) as { meterId: string };
  const meterQuery = useQuery(meterQueryOptions(meterId));
  const meter = meterQuery.data;

  // null = geschlossen, "new" = neuer Stand, sonst der zu bearbeitende
  const [sheet, setSheet] = useState<Reading | "new" | null>(null);
  const isVirtual = meter?.role === "virtual_difference";

  if (meterQuery.isError) {
    return (
      <EntityNotFound
        title={t("ui.meters.notFound.title")}
        description={t("ui.meters.notFound.description")}
        to="/zaehler"
      />
    );
  }

  return (
    <>
      <MeterDetailLayout
        meterId={meterId}
        active="zaehlerstaende"
        className="pb-6"
        action={
          meter && !isVirtual ? (
            <Button type="button" onClick={() => setSheet("new")}>
              <RiAddLine />
              <span className="hidden sm:inline">
                {t("ui.meters.addReading")}
              </span>
            </Button>
          ) : undefined
        }
      >
        {meter ? (
          <MeterReadingsTab
            meterId={meterId}
            buildingId={meter.buildingId}
            measurementUnit={meter.measurementUnit}
            role={meter.role}
            resetDay={meter.resetDay}
            onEditReading={setSheet}
          />
        ) : (
          <FormSkeleton rows={4} />
        )}
      </MeterDetailLayout>

      {meter && sheet ? (
        <ReadingSheet
          meterId={meterId}
          buildingId={meter.buildingId}
          resetDay={meter.resetDay}
          reading={sheet === "new" ? null : sheet}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </>
  );
};
