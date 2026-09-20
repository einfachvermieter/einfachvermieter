import { formatNumber, UNIT_NONE } from "@einfachvermieter/shared";
import {
  RiDashboard2Line,
  RiDeleteBinLine,
  RiFireLine,
  RiMoreLine,
  RiSubtractLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useState } from "react";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { RowListSection } from "../../components/common/RowListSection";
import { FormSkeleton } from "../../components/FormSkeleton";
import { HelpHint } from "../../components/help/HelpHint";
import { Button } from "../../components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/DropdownMenu";
import { allocationLabel, costTypesQueryOptions } from "../../lib/costs";
import { formatPeriod } from "../../lib/format";
import { t } from "../../lib/i18n";
import {
  type Meter,
  meterQueryOptions,
  meterRoleLabel,
  meterTypeLabel,
} from "../../lib/meters";
import { unitsQueryOptions } from "../../lib/units";
import { useDeleteResource } from "../../lib/useDeleteResource";
import { useGoBack } from "../../lib/useGoBack";
import { MeterAssignmentCard } from "./cards/MeterAssignmentCard";
import { MeterViewCard } from "./cards/MeterViewCard";
import {
  emptyGasFactorRow,
  type GasFactorRowValues,
} from "./components/gasFactors/gasFactorRow";
import { meterToFormValues } from "./components/meterFormHelpers";
import { MeterDetailLayout } from "./MeterDetailLayout";
import { MeterAssignmentSheet } from "./sheets/MeterAssignmentSheet";
import { MeterBaseSheet } from "./sheets/MeterBaseSheet";
import { MeterDifferenceSheet } from "./sheets/MeterDifferenceSheet";
import { MeterGasFactorSheet } from "./sheets/MeterGasFactorSheet";
import { MeterHkvSheet } from "./sheets/MeterHkvSheet";
import { useMeterSave } from "./useMeterSave";

type SheetState =
  | { kind: "base" }
  | { kind: "assignment" }
  | { kind: "hkv" }
  | { kind: "difference" }
  | { kind: "gasFactor"; index: number | null }
  | null;

/**
 * Stammdaten-Ansicht des Zählers
 */
export const MeterDetailPage = () => {
  const { meterId } = useParams({ strict: false }) as { meterId: string };

  const meterQuery = useQuery(meterQueryOptions(meterId));
  const meter = meterQuery.data;
  const { data: units } = useQuery(unitsQueryOptions);
  const { data: costTypes } = useQuery(costTypesQueryOptions);

  const save = useMeterSave(meter);
  const [sheet, setSheet] = useState<SheetState>(null);
  const closeSheet = () => setSheet(null);

  const goBack = useGoBack("/zaehler", {
    search: { buildingId: undefined, type: undefined },
  });

  const deletion = useDeleteResource<Meter>({
    endpoint: (target) => `/meters/${target.id}`,
    invalidateKeys: [["meters"]],
    title: t("ui.meters.confirmDelete"),
    describe: (target) =>
      t("ui.meters.confirmDeleteMessage", { label: target.label }),
    onDeleted: goBack,
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

  const values = meter ? meterToFormValues(meter) : null;

  return (
    <>
      <MeterDetailLayout
        meterId={meterId}
        active="stammdaten"
        className="pb-6"
        action={
          meter ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild={true}>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("ui.common.a11y.more")}
                >
                  <RiMoreLine />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => deletion.request(meter)}
                >
                  <RiDeleteBinLine />
                  {t("ui.meters.detail.deleteAction")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
      >
        {meter && values && units && costTypes ? (
          <MeterCards
            meter={meter}
            values={values}
            costTypes={costTypes
              .filter((costType) => meter.costTypeIds.includes(costType.id))
              .map((costType) => ({
                id: costType.id,
                name: costType.name,
                allocation: costType.defaultAllocationKey
                  ? allocationLabel(costType.defaultAllocationKey)
                  : t("ui.common.emptyValue"),
              }))}
            unitName={
              units.find((entry) => entry.id === meter.unitId)?.name ?? null
            }
            onOpenSheet={setSheet}
            onDeleteGasFactor={async (index) => {
              await save((current) => ({
                ...current,
                gasFactors: current.gasFactors.filter(
                  (_, position) => position !== index,
                ),
              }));
            }}
          />
        ) : (
          <FormSkeleton rows={4} />
        )}
      </MeterDetailLayout>

      {meter && values && units && sheet?.kind === "base" ? (
        <MeterBaseSheet
          units={units}
          defaultValues={values}
          onSubmit={async (next) => {
            await save(() => next);
            closeSheet();
          }}
          onClose={closeSheet}
        />
      ) : null}

      {meter && values && costTypes && sheet?.kind === "assignment" ? (
        <MeterAssignmentSheet
          costTypes={costTypes}
          locked={meter.costAllocationModeLocked}
          defaultValues={values}
          onSubmit={async (next) => {
            await save(() => next);
            closeSheet();
          }}
          onClose={closeSheet}
        />
      ) : null}

      {values && sheet?.kind === "hkv" ? (
        <MeterHkvSheet
          defaultValues={values}
          onSubmit={async (next) => {
            await save(() => next);
            closeSheet();
          }}
          onClose={closeSheet}
        />
      ) : null}

      {values && sheet?.kind === "difference" ? (
        <MeterDifferenceSheet
          defaultValues={values}
          currentMeterId={meterId}
          onSubmit={async (next) => {
            await save(() => next);
            closeSheet();
          }}
          onClose={closeSheet}
        />
      ) : null}

      {values && sheet?.kind === "gasFactor" ? (
        <MeterGasFactorSheet
          title={
            sheet.index === null
              ? t("ui.meters.gasFactors.addPeriod")
              : t("ui.meters.gasFactors.editPeriod")
          }
          defaultValues={
            sheet.index === null
              ? { ...emptyGasFactorRow(), validFrom: values.validFrom }
              : (values.gasFactors[sheet.index] ?? emptyGasFactorRow())
          }
          onSubmit={async (row) => {
            const { index } = sheet;
            await save((current) => ({
              ...current,
              gasFactors:
                index === null
                  ? [...current.gasFactors, row]
                  : current.gasFactors.map((entry, position) =>
                      position === index ? row : entry,
                    ),
            }));
            closeSheet();
          }}
          onClose={closeSheet}
        />
      ) : null}

      {deletion.dialog}
    </>
  );
};

/**
 * View-Card der Stammdaten, je nach Zählerart ergänzt um
 * Heizkostenverteiler-, Differenz- und Brennwert-Angaben.
 */
const MeterCards = ({
  meter,
  values,
  unitName,
  costTypes,
  onOpenSheet,
  onDeleteGasFactor,
}: {
  meter: Meter;
  values: ReturnType<typeof meterToFormValues>;
  unitName: string | null;
  costTypes: { id: string; name: string; allocation: string }[];
  onOpenSheet: (sheet: SheetState) => void;
  onDeleteGasFactor: (index: number) => Promise<void>;
}) => {
  const dash = t("ui.common.emptyValue");
  const isVirtual = meter.role === "virtual_difference";
  const isHkv = meter.type === "heat_cost_allocator";

  return (
    <div>
      <MeterViewCard
        icon={RiDashboard2Line}
        title={t("ui.meters.detail.baseSection")}
        rows={[
          { label: t("ui.meters.fields.label"), value: meter.label },
          {
            label: t("ui.meters.fields.type"),
            value: meterTypeLabel(meter.type),
          },
          {
            label: t("ui.meters.fields.role"),
            value: meterRoleLabel(meter.role),
          },
          ...(meter.unitId && meter.unitId !== UNIT_NONE
            ? [{ label: t("ui.meters.fields.unit"), value: unitName ?? dash }]
            : []),
          {
            label: t("ui.meters.fields.serialNumber"),
            value: meter.serialNumber ?? dash,
          },
          { label: t("ui.meters.fields.room"), value: meter.room ?? dash },
          {
            label: t("ui.meters.fields.validity"),
            value: formatPeriod(meter.validFrom, meter.validUntil),
          },
        ]}
        onEdit={() => onOpenSheet({ kind: "base" })}
      />

      {isHkv ? (
        <MeterViewCard
          icon={RiFireLine}
          title={t("ui.meters.detail.hkvSection")}
          rows={[
            {
              label: t("ui.meters.fields.radiator"),
              value: meter.radiator ?? dash,
            },
            {
              label: t("ui.meters.fields.kTotal"),
              value:
                meter.kTotal === null ? dash : formatNumber(meter.kTotal, 3),
            },
            {
              label: t("ui.meters.fields.resetDay"),
              value:
                meter.resetDay === null
                  ? dash
                  : t(`ui.meters.resetDayOptions.${meter.resetDay}`),
            },
          ]}
          onEdit={() => onOpenSheet({ kind: "hkv" })}
        />
      ) : null}

      {isVirtual ? (
        <MeterViewCard
          icon={RiSubtractLine}
          title={t("ui.meters.differenceConfig.title")}
          titleHelp={
            <HelpHint>{t("ui.meters.hints.differenceMeterHelp")}</HelpHint>
          }
          rows={[
            {
              label: t("ui.meters.fields.baseMeter"),
              value: meter.differenceConfig?.baseMeterId ? (
                <MeterName meterId={meter.differenceConfig.baseMeterId} />
              ) : (
                dash
              ),
            },
            {
              label: t("ui.meters.fields.subtractedMeters"),
              value:
                (meter.differenceConfig?.subtractedMeterIds.length ?? 0) === 0
                  ? dash
                  : t("ui.meters.differenceConfig.subtractedCount", {
                      count:
                        meter.differenceConfig?.subtractedMeterIds.length ?? 0,
                    }),
            },
          ]}
          onEdit={() => onOpenSheet({ kind: "difference" })}
        />
      ) : null}

      {meter.type === "gas" ? (
        <RowListSection<GasFactorRowValues>
          icon={RiFireLine}
          title={t("ui.meters.gasFactors.title")}
          addLabel={t("ui.meters.gasFactors.addPeriod")}
          emptyHint={t("ui.meters.gasFactors.emptyHint")}
          rows={values.gasFactors}
          renderRow={(row) => (
            <>
              <p className="truncate font-semibold tabular-nums">
                {row.energyFactor === ""
                  ? t("ui.meters.gasFactors.noFactor")
                  : t("ui.meters.gasFactors.factorValue", {
                      value: formatNumber(
                        Number.parseFloat(row.energyFactor.replace(",", ".")),
                      ),
                    })}
              </p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {formatPeriod(row.validFrom, row.validUntil)}
              </p>
            </>
          )}
          sortIndex={(rows) =>
            rows
              .map((row, index) => ({ row, index }))
              .sort((a, b) => a.row.validFrom.localeCompare(b.row.validFrom))
              .map((entry) => entry.index)
          }
          onAdd={() => onOpenSheet({ kind: "gasFactor", index: null })}
          onEditRow={(index) => onOpenSheet({ kind: "gasFactor", index })}
          onDeleteRow={onDeleteGasFactor}
          confirmDeleteTitle={t("ui.meters.gasFactors.confirmRemovePeriod")}
        />
      ) : null}

      {isHkv ? null : (
        <MeterAssignmentCard
          meter={meter}
          costTypes={costTypes}
          onEdit={() => onOpenSheet({ kind: "assignment" })}
        />
      )}
    </div>
  );
};

/**
 * Zeigt den Namen eines referenzierten Zählers (Basiszähler)
 */
const MeterName = ({ meterId }: { meterId: string }) => {
  const { data } = useQuery(meterQueryOptions(meterId));
  return <>{data?.label ?? t("ui.common.emptyValue")}</>;
};
