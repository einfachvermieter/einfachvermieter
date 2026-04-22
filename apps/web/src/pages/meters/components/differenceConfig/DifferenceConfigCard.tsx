import type { MeterFormValues } from "@einfachvermieter/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { CheckboxGroupInput } from "@/components/form/CheckboxGroupInput";
import { SelectInput } from "@/components/form/SelectInput";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldGroup } from "@/components/ui/Field";
import { t } from "../../../../lib/i18n";
import {
  type Meter,
  metersOverviewQueryOptions,
  meterTypeLabel,
} from "../../../../lib/meters";

const PAGE_SIZE = 500;

export const DifferenceConfigCard = ({
  form,
  currentMeterId,
}: {
  form: UseFormReturn<MeterFormValues>;
  currentMeterId?: string;
}) => {
  const buildingId = form.watch("buildingId");
  const type = form.watch("type");
  const baseMeterId = form.watch("baseMeterId");

  const { data: metersResult } = useQuery({
    ...metersOverviewQueryOptions({
      page: 0,
      pageSize: PAGE_SIZE,
      buildingId,
    }),
    enabled: Boolean(buildingId),
  });

  const eligibleMeters = useMemo<Meter[]>(() => {
    const items = metersResult?.items ?? [];
    return items.filter(
      (item) => item.type === type && item.id !== currentMeterId,
    );
  }, [metersResult, type, currentMeterId]);

  useEffect(() => {
    // Solange die Zähler-Query noch nicht geladen ist, dürfen wir nichts
    // prunen. Sonst löscht der Edit-Mount die gerade aus dem Server geladenen
    // baseMeterId/subtractedMeterIds, weil eligibleIds noch leer ist.
    if (!metersResult) {
      return;
    }

    const eligibleIds = new Set(eligibleMeters.map((meter) => meter.id));

    if (
      form.getValues("baseMeterId") !== "" &&
      !eligibleIds.has(form.getValues("baseMeterId"))
    ) {
      form.setValue("baseMeterId", "");
    }

    const currentSubtractions = form.getValues("subtractedMeterIds");
    const pruned = currentSubtractions.filter((id) => eligibleIds.has(id));

    if (pruned.length !== currentSubtractions.length) {
      form.setValue("subtractedMeterIds", pruned);
    }
  }, [eligibleMeters, metersResult, form]);

  const baseOptions = eligibleMeters.map((meter) => ({
    value: meter.id,
    label: meter.label,
  }));

  const subtractOptions = eligibleMeters
    .filter((meter) => meter.id !== baseMeterId)
    .map((meter) => ({
      value: meter.id,
      label: meter.label,
      description: meter.serialNumber ?? undefined,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("ui.meters.differenceConfig.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <SelectInput
            control={form.control}
            name="baseMeterId"
            label={t("ui.meters.fields.baseMeter")}
            description={t("ui.meters.hints.differenceConfig")}
            placeholder={t("ui.meters.fields.baseMeterPlaceholder")}
            options={baseOptions}
          />
          <CheckboxGroupInput
            control={form.control}
            name="subtractedMeterIds"
            label={t("ui.meters.fields.subtractedMeters")}
            options={subtractOptions}
            emptyMessage={t("ui.meters.fields.subtractedMetersEmpty", {
              type: meterTypeLabel(type),
            })}
          />
        </FieldGroup>
      </CardContent>
    </Card>
  );
};
