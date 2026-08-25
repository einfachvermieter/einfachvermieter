import type { UnitCreateDto } from "@einfachvermieter/shared";
import { RiHome6Line } from "@remixicon/react";
import { BuildingContextCard } from "../../components/common/BuildingContextCard";
import { FormPage } from "../../components/common/FormPage";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { FormSkeleton } from "../../components/FormSkeleton";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { api } from "../../lib/api";
import { t } from "../../lib/i18n";
import type { Unit } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useGoBack } from "../../lib/useGoBack";
import { UnitForm } from "./UnitForm";

export const UnitCreatePage = () => {
  const { buildingId, building } = useActiveBuilding();

  const goBack = useGoBack("/wohnungen");

  const createUnit = useCrudMutation({
    mutationFn: (dto: UnitCreateDto) => api.post<Unit>("/units", dto),
    invalidateKeys: [["units"], ["stats"]],
    onSuccess: goBack,
  });

  return (
    <FormPage
      tile={<PageHeaderIcon icon={RiHome6Line} />}
      title={t("ui.units.createTitle")}
      aside={<BuildingContextCard building={building} />}
    >
      {buildingId ? (
        <UnitForm
          mode="create"
          defaultValues={{
            buildingId,
            name: "",
            unitNumber: "",
            areaSqm: "",
            heatingAreaSqm: "",
          }}
          onSubmit={async (values) => {
            await createUnit.mutateAsync(values);
          }}
          onCancel={goBack}
        />
      ) : (
        <FormSkeleton rows={4} />
      )}
    </FormPage>
  );
};
