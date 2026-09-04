import {
  type MeterCreateDto,
  type MeterFormValues,
  meterFormSchema,
  meterFormToDto,
  todayIso,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  RiDashboard2Line,
  RiFireLine,
  RiPriceTag3Line,
  RiSubtractLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { FormSheet } from "@/components/form/FormSheet";
import { SheetSection } from "@/components/form/SheetSection";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { api } from "../../lib/api";
import { costTypesQueryOptions } from "../../lib/costs";
import { domainVisuals } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import type { Meter, MeterType } from "../../lib/meters";
import { unitsQueryOptions } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { MeterBaseFields } from "./components/baseData/MeterBaseFields";
import { CostAllocationModeField } from "./components/costAssignment/CostAllocationModeField";
import { CostTypeAssignment } from "./components/costAssignment/CostTypeAssignment";
import { DifferenceConfigFields } from "./components/differenceConfig/DifferenceConfigFields";
import { HkvFields } from "./components/hkv/HkvFields";
import { emptyMeterFormValues } from "./components/meterFormHelpers";

export const MeterCreateSheet = ({
  initialType,
  onClose,
}: {
  initialType?: MeterType;
  onClose: () => void;
}) => {
  const { buildingId } = useActiveBuilding();
  const { data: units } = useQuery(unitsQueryOptions);
  const { data: costTypes } = useQuery(costTypesQueryOptions);
  const navigate = useNavigate();

  const form = useForm<MeterFormValues>({
    resolver: zodResolver(meterFormSchema),
    reValidateMode: "onSubmit",
    defaultValues: emptyMeterFormValues(
      buildingId ?? "",
      todayIso(),
      initialType,
    ),
  });

  const type = form.watch("type");
  const role = form.watch("role");
  const costAllocationMode = form.watch("costAllocationMode");
  const isHkv = type === "heat_cost_allocator";
  const isVirtual = role === "virtual_difference";

  const createMeter = useCrudMutation({
    mutationFn: (dto: MeterCreateDto) => api.post<Meter>("/meters", dto),
    invalidateKeys: [["meters"], ["stats"]],
  });

  return (
    <FormSheet
      form={form}
      icon={domainVisuals.meters.icon}
      title={t("ui.meters.createTitle")}
      submitLabel={t("ui.common.action.create")}
      onSubmit={async (values) => {
        const created = await createMeter.mutateAsync(
          meterFormToDto(values, t),
        );
        // Direkt zum Zähler; der Routenwechsel schließt das Sheet
        await navigate({
          to: "/zaehler/$meterId",
          params: { meterId: created.id },
        });
      }}
      onClose={onClose}
    >
      <SheetSection
        icon={RiDashboard2Line}
        title={t("ui.meters.detail.baseSection")}
        divider={false}
      >
        <MeterBaseFields form={form} units={units ?? []} variant="sheet" />
      </SheetSection>

      {isHkv ? (
        <SheetSection
          icon={RiFireLine}
          title={t("ui.meters.detail.hkvSection")}
        >
          <HkvFields form={form} variant="sheet" />
        </SheetSection>
      ) : null}

      {isVirtual ? (
        <SheetSection
          icon={RiSubtractLine}
          title={t("ui.meters.differenceConfig.title")}
        >
          <DifferenceConfigFields form={form} />
        </SheetSection>
      ) : null}

      {isHkv ? null : (
        <SheetSection
          icon={RiPriceTag3Line}
          title={t("ui.meters.detail.assignmentSection")}
          description={t("ui.meters.detail.assignmentDescription")}
        >
          <CostAllocationModeField form={form} />
          {costAllocationMode === "cost_types" ? (
            <CostTypeAssignment form={form} costTypes={costTypes ?? []} />
          ) : null}
        </SheetSection>
      )}
    </FormSheet>
  );
};
