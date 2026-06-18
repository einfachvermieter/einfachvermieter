import {
  isDifferenceCapableType,
  isUnitScopedRole,
  type MeterFormValues,
  type MeterRole,
  measurementUnitFor,
  meterRoles,
  meterTypes,
  roleRequiresUnit,
  UNIT_NONE,
} from "@einfachvermieter/shared";
import { RiSpeedUpLine } from "@remixicon/react";
import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Disclose } from "@/components/common/Disclose";
import { SectionCard } from "@/components/common/SectionCard";
import { DateInput } from "@/components/form/DateInput";
import { SelectInput } from "@/components/form/SelectInput";
import { TextInput } from "@/components/form/TextInput";
import { FieldGroup } from "@/components/ui/Field";
import type { Building } from "../../../../lib/buildings";
import { gradients } from "../../../../lib/domainVisuals";
import { t } from "../../../../lib/i18n";
import { measurementUnitLabel } from "../../../../lib/meters";
import type { Unit } from "../../../../lib/units";

const today = new Date();
const calendarStart = new Date(today.getFullYear() - 20, 0, 1);
const calendarEnd = new Date(today.getFullYear() + 5, 11, 1);

export const MeterBaseFields = ({
  form,
  buildings,
  units,
  buildingFieldDisabled,
  onTypeChange,
}: {
  form: UseFormReturn<MeterFormValues>;
  buildings: Building[];
  units: Unit[];
  buildingFieldDisabled: boolean;
  onTypeChange: (newType: string) => void;
}) => {
  const selectedBuildingId = form.watch("buildingId");
  const selectedRole = form.watch("role");
  const selectedType = form.watch("type");
  const isVirtual = selectedRole === "virtual_difference";
  const showUnitField = isUnitScopedRole(selectedRole);

  const scopedUnits = units.filter(
    (unit) => unit.buildingId === selectedBuildingId,
  );

  const visibleRoles: readonly MeterRole[] =
    isVirtual || isDifferenceCapableType(selectedType)
      ? meterRoles
      : meterRoles.filter((role) => role !== "virtual_difference");

  useEffect(() => {
    if (
      !isUnitScopedRole(selectedRole) &&
      form.getValues("unitId") !== UNIT_NONE
    ) {
      form.setValue("unitId", UNIT_NONE);
    }

    if (isVirtual && form.getValues("serialNumber") !== "") {
      form.setValue("serialNumber", "");
    }

    if (!isVirtual) {
      if (form.getValues("baseMeterId") !== "") {
        form.setValue("baseMeterId", "");
      }

      if (form.getValues("subtractedMeterIds").length > 0) {
        form.setValue("subtractedMeterIds", []);
      }
    }
  }, [selectedRole, isVirtual, form]);

  return (
    <SectionCard
      icon={RiSpeedUpLine}
      iconBackground={gradients.water}
      title={t("ui.meters.detail.baseSection")}
      description={t("ui.meters.detail.baseDescription")}
    >
      <FieldGroup className="gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectInput
            control={form.control}
            name="type"
            label={t("ui.meters.fields.type")}
            onValueChange={onTypeChange}
            options={meterTypes.map((type) => ({
              value: type,
              label: `${t(`meters.types.${type}`)} (${measurementUnitLabel(measurementUnitFor(type))})`,
            }))}
          />
          <SelectInput
            control={form.control}
            name="role"
            label={t("ui.meters.fields.role")}
            description2={t(`ui.meters.roleDescriptions.${selectedRole}`)}
            options={visibleRoles.map((role) => ({
              value: role,
              label: t(`meters.roles.${role}`),
            }))}
          />
          <SelectInput
            control={form.control}
            name="buildingId"
            label={t("ui.buildings.title")}
            disabled={buildingFieldDisabled}
            onValueChange={() => form.setValue("unitId", UNIT_NONE)}
            options={buildings.map((building) => ({
              value: building.id,
              label: building.name,
            }))}
          />
          {showUnitField ? (
            <SelectInput
              control={form.control}
              name="unitId"
              label={t("ui.meters.fields.unit")}
              optional={!roleRequiresUnit(selectedRole)}
              options={[
                { value: UNIT_NONE, label: "-" },
                ...scopedUnits.map((unit) => ({
                  value: unit.id,
                  label: unit.name,
                })),
              ]}
            />
          ) : null}
          <TextInput
            control={form.control}
            name="serialNumber"
            label={t("ui.meters.fields.serialNumber")}
            optional={true}
            disabled={isVirtual}
            description={
              isVirtual ? t("ui.meters.hints.virtualNoReadings") : undefined
            }
          />
        </div>
        <Disclose label={t("ui.meters.detail.moreFields")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextInput
              control={form.control}
              name="room"
              label={
                showUnitField
                  ? t("ui.meters.fields.room")
                  : t("ui.meters.fields.area")
              }
              placeholder={
                showUnitField
                  ? t("ui.meters.fields.roomPlaceholder")
                  : t("ui.meters.fields.areaPlaceholder")
              }
              optional={true}
            />
            <DateInput
              control={form.control}
              name="validFrom"
              label={t("ui.meters.fields.validFrom")}
              startMonth={calendarStart}
              endMonth={calendarEnd}
            />
            <DateInput
              control={form.control}
              name="validUntil"
              label={t("ui.meters.fields.validUntil")}
              optional={true}
              startMonth={calendarStart}
              endMonth={calendarEnd}
            />
          </div>
        </Disclose>
      </FieldGroup>
    </SectionCard>
  );
};
