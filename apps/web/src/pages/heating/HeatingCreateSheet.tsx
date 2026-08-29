import {
  emptyHeatingFormValues,
  type HeatingFormValues,
  heatingFormSchema,
  heatingFormToDto,
  heatingSettingsToFormValues,
  todayIso,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiCalendarLine, RiFireLine, RiPercentLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { FormSheet } from "@/components/form/FormSheet";
import { SheetSection } from "@/components/form/SheetSection";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { domainVisuals } from "../../lib/domainVisuals";
import {
  createHeatingSettings,
  heatingSettingsListQueryOptions,
} from "../../lib/heating";
import { t } from "../../lib/i18n";
import { type Meter, metersOverviewQueryOptions } from "../../lib/meters";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { HeatingBillingFields } from "./components/settings/HeatingBillingFields";
import { HeatingInstallationFields } from "./components/settings/HeatingInstallationFields";
import { HeatingProrationFields } from "./components/settings/HeatingProrationFields";
import { hotWaterMeterCandidatesOf } from "./hotWaterMeters";

/**
 * Heizkosten-Konfiguration im FormSheet anlegen.
 */
export const HeatingCreateSheet = ({ onClose }: { onClose: () => void }) => {
  const { buildingId } = useActiveBuilding();

  const { data: versions } = useQuery({
    ...heatingSettingsListQueryOptions(buildingId ?? ""),
    enabled: buildingId !== undefined,
  });
  const { data: metersResult } = useQuery({
    ...metersOverviewQueryOptions({ page: 0, pageSize: 500, buildingId }),
    enabled: buildingId !== undefined,
  });

  if (!(buildingId && versions && metersResult)) {
    return null;
  }

  const [latest] = versions;
  const defaultValues = latest
    ? {
        ...heatingSettingsToFormValues(latest),
        validFrom: todayIso(),
        validTo: "",
      }
    : emptyHeatingFormValues(buildingId, todayIso());

  return (
    <HeatingCreateForm
      buildingId={buildingId}
      defaultValues={defaultValues}
      hotWaterMeterCandidates={hotWaterMeterCandidatesOf(metersResult.items)}
      onClose={onClose}
    />
  );
};

const HeatingCreateForm = ({
  buildingId,
  defaultValues,
  hotWaterMeterCandidates,
  onClose,
}: {
  buildingId: string;
  defaultValues: HeatingFormValues;
  hotWaterMeterCandidates: Meter[];
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const form = useForm<HeatingFormValues>({
    resolver: zodResolver(heatingFormSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  const create = useCrudMutation({
    mutationFn: (values: HeatingFormValues) =>
      createHeatingSettings(buildingId, heatingFormToDto(values)),
    invalidateKeys: [["heating"]],
  });

  const isExternal = form.watch("mode") === "external";

  return (
    <FormSheet
      form={form}
      icon={domainVisuals.heating.icon}
      title={t("ui.heating.versions.createTitle")}
      submitLabel={t("ui.common.action.create")}
      onSubmit={async (values) => {
        const created = await create.mutateAsync(values);
        // Direkt zur Konfiguration; der Routenwechsel schließt das Sheet
        await navigate({ to: "/heizkosten/$id", params: { id: created.id } });
      }}
      onClose={onClose}
    >
      <SheetSection
        icon={RiPercentLine}
        title={t("ui.heating.cards.billing")}
        divider={false}
      >
        <HeatingBillingFields form={form} />
      </SheetSection>
      <SheetSection
        icon={RiCalendarLine}
        title={t("ui.heating.cards.proration")}
      >
        <HeatingProrationFields form={form} />
      </SheetSection>
      {isExternal ? null : (
        <SheetSection
          icon={RiFireLine}
          title={t("ui.heating.installation.title")}
        >
          <HeatingInstallationFields
            form={form}
            hotWaterMeterCandidates={hotWaterMeterCandidates}
          />
        </SheetSection>
      )}
    </FormSheet>
  );
};
