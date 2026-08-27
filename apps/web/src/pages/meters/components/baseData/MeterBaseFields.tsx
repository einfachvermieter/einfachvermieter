import {
  buildMeterLabel,
  isDifferenceCapableType,
  isRemoteReadableRelevantType,
  isUnitScopedRole,
  type MeterFormValues,
  type MeterRole,
  measurementUnitFor,
  meterRoles,
  meterTypes,
  roleRequiresUnit,
  UNIT_NONE,
} from "@einfachvermieter/shared";
import { RiDashboard2Line } from "@remixicon/react";
import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Disclose } from "@/components/common/Disclose";
import { SectionCard } from "@/components/common/SectionCard";
import { DateInput } from "@/components/form/DateInput";
import { SelectInput } from "@/components/form/SelectInput";
import { SwitchInput } from "@/components/form/SwitchInput";
import { TextInput } from "@/components/form/TextInput";
import { FieldGroup } from "@/components/ui/Field";
import { t } from "../../../../lib/i18n";
import { measurementUnitLabel } from "../../../../lib/meters";
import type { Unit } from "../../../../lib/units";

const today = new Date();
const calendarStart = new Date(today.getFullYear() - 20, 0, 1);
const calendarEnd = new Date(today.getFullYear() + 5, 11, 1);

export const MeterBaseFields = ({
  form,
  units,
  variant = "card",
}: {
  form: UseFormReturn<MeterFormValues>;
  units: Unit[];

  /**
   * "sheet" = ohne Card-Wrapper, für das Formular-Sheet
   */
  variant?: "card" | "sheet";
}) => {
  const selectedBuildingId = form.watch("buildingId");
  const selectedRole = form.watch("role");
  const selectedType = form.watch("type");
  const selectedRoom = form.watch("room");
  const selectedRadiator = form.watch("radiator");
  const isVirtual = selectedRole === "virtual_difference";

  /**
   * Vorschlag im Platzhalter: der Name, der ohne eigene Eingabe entsteht
   */
  const suggestedLabel = buildMeterLabel(
    {
      type: selectedType,
      role: selectedRole,
      room: selectedRoom === "" ? null : selectedRoom,
      radiator:
        selectedType === "heat_cost_allocator" && selectedRadiator !== ""
          ? selectedRadiator
          : null,
    },
    t,
  );
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

  /**
   * Typwechsel verwirft die typgebundenen Angaben (Brennwerte, HKV-Felder)
   * und die Quellen des Differenzzählers.
   */
  const onTypeChange = (newType: string) => {
    if (newType !== "gas") {
      form.setValue("gasFactors", []);
    }

    if (newType !== "heat_cost_allocator") {
      form.setValue("radiator", "");
      form.setValue("kTotal", "");
      form.setValue("radiatorManufacturer", "");
      form.setValue("radiatorModel", "");
      form.setValue("radiatorType", "");
      form.setValue("radiatorDimensions", "");
    }

    form.setValue("baseMeterId", "");
    form.setValue("subtractedMeterIds", []);
  };

  const fields = (
    <FieldGroup className="gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput
          control={form.control}
          name="label"
          label={t("ui.meters.fields.label")}
          optional={true}
          placeholder={suggestedLabel}
          description={t("ui.meters.fields.labelDescription")}
        />
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
        {isRemoteReadableRelevantType(selectedType) && !isVirtual ? (
          <SwitchInput
            control={form.control}
            name="isRemoteReadable"
            label={t("ui.meters.fields.isRemoteReadable")}
            description={t("ui.meters.fields.isRemoteReadableDescription")}
          />
        ) : null}
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
  );

  if (variant === "sheet") {
    return fields;
  }

  return (
    <SectionCard
      icon={RiDashboard2Line}
      title={t("ui.meters.detail.baseSection")}
    >
      {fields}
    </SectionCard>
  );
};
