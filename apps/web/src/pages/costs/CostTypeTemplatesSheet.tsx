import {
  type CostTypeTemplate,
  type CostTypeTemplateGroup,
  costTypeFieldsFromTemplate,
  costTypeTemplateGroup,
  costTypeTemplates,
  normalizeCostTypeName,
  todayIso,
} from "@einfachvermieter/shared";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { CheckboxGroupInput } from "@/components/form/CheckboxGroupInput";
import { FormSheet } from "@/components/form/FormSheet";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { api } from "../../lib/api";
import {
  allocationLabel,
  type CostType,
  costTypesQueryOptions,
} from "../../lib/costs";
import {
  existingCostTypeNames,
  hasUnitWaterMeters,
  heatingNoticeMode,
  usesCo2Split,
} from "../../lib/costTypeTemplates";
import { heatingSettingsListQueryOptions } from "../../lib/heating";
import { t } from "../../lib/i18n";
import { metersOverviewQueryOptions } from "../../lib/meters";
import { useCrudMutation } from "../../lib/useCrudMutation";

type FormValues = { keys: string[] };

const GROUPS: readonly CostTypeTemplateGroup[] = [
  "operating",
  "heating",
  "other",
];

const nameOf = (template: CostTypeTemplate): string =>
  t(`ui.costs.templates.${template.key}.name`);

/**
 * Mehrere Kostenarten des aktiven Gebäudes aus dem Vorlagenkatalog anlegen
 */
export const CostTypeTemplatesSheet = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const { buildingId = "" } = useActiveBuilding();
  const form = useForm<FormValues>({ defaultValues: { keys: [] } });
  const selectedCount = form.watch("keys").length;

  const costTypes = useQuery(costTypesQueryOptions);
  const meters = useQuery({
    ...metersOverviewQueryOptions({ page: 0, pageSize: 1000, buildingId }),
    enabled: buildingId !== "",
  });
  const heatingVersions = useQuery({
    ...heatingSettingsListQueryOptions(buildingId),
    enabled: buildingId !== "",
  });
  // Ohne alle drei Abfragen wären Vorbelegung und "bereits vorhanden" falsch
  const loading = [costTypes, meters, heatingVersions].some(
    (query) => !query.isSuccess,
  );

  const existingNames = existingCostTypeNames(costTypes.data ?? [], buildingId);
  const context = {
    hasUnitWaterMeters: hasUnitWaterMeters(meters.data?.items ?? []),
    usesCo2Split: usesCo2Split(heatingVersions.data ?? []),
  };
  const noticeMode = heatingNoticeMode(heatingVersions.data ?? [], todayIso());

  const createCostTypes = useCrudMutation({
    mutationFn: (keys: string[]) =>
      api.post<CostType[]>("/costs/types/bulk", {
        buildingId,
        items: costTypeTemplates
          .filter(
            (template) =>
              keys.includes(template.key) &&
              !existingNames.has(normalizeCostTypeName(nameOf(template))),
          )
          .map((template) =>
            costTypeFieldsFromTemplate(template, {
              ...context,
              name: nameOf(template),
            }),
          ),
      }),
    invalidateKeys: [["costTypes"], ["stats"]],
    successMessage: null,
  });

  const optionOf = (template: CostTypeTemplate) => {
    const fields = costTypeFieldsFromTemplate(template, {
      ...context,
      name: nameOf(template),
    });
    const alreadyExists = existingNames.has(normalizeCostTypeName(fields.name));
    return {
      value: template.key,
      label: fields.name,
      disabled: alreadyExists,
      description: (
        <>
          <span className="block">
            {t(`ui.costs.templates.${template.key}.hint`)}
          </span>
          {fields.defaultAllocationKey ? (
            <span className="block">
              {t("ui.costs.templateAllocation", {
                key: allocationLabel(fields.defaultAllocationKey),
              })}
            </span>
          ) : null}
          {fields.co2Tracked ? (
            <span className="block">{t("ui.costs.templateWithCo2")}</span>
          ) : null}
          {fields.defaultAllocationKey === "per_consumption_m3" ? (
            <span className="block">
              {t("ui.costs.templateWaterMetersHint")}
            </span>
          ) : null}
          {alreadyExists ? (
            <span className="block">{t("ui.costs.templateAlreadyExists")}</span>
          ) : null}
        </>
      ),
    };
  };

  return (
    <FormSheet
      form={form}
      title={t("ui.costs.templatesTitle")}
      description={t("ui.costs.templatesIntro")}
      submitLabel={t("ui.costs.templatesSubmit", { count: selectedCount })}
      submitDisabled={loading || selectedCount === 0}
      onSubmit={async ({ keys }) => {
        const created = await createCostTypes.mutateAsync(keys);
        toast.success(
          t("ui.costs.templatesCreated", { count: created.length }),
        );
        onClose();
      }}
      onClose={onClose}
    >
      {GROUPS.map((group) => (
        <div key={group} className="flex flex-col gap-3">
          {group === "heating" && noticeMode ? (
            <Alert variant="info">
              <AlertDescription>
                {noticeMode === "external"
                  ? t("ui.costs.templatesHeatingExternalHint")
                  : t("ui.costs.templatesHeatingNoneHint")}
              </AlertDescription>
            </Alert>
          ) : null}
          <CheckboxGroupInput
            control={form.control}
            name="keys"
            label={t(`ui.costs.templateGroups.${group}`)}
            description={
              group === "other" ? t("ui.costs.templatesOtherHint") : undefined
            }
            options={costTypeTemplates
              .filter((template) => costTypeTemplateGroup(template) === group)
              .map(optionOf)}
          />
        </div>
      ))}
    </FormSheet>
  );
};
