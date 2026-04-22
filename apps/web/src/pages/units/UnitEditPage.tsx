import type { UnitCreateDto } from "@einfachvermieter/shared";
import { RiHome6Line } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { FormPage } from "../../components/common/FormPage";
import { FormSkeleton } from "../../components/FormSkeleton";
import { api } from "../../lib/api";
import { buildingsQueryOptions } from "../../lib/buildings";
import { t } from "../../lib/i18n";
import type { Unit } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useGoBack } from "../../lib/useGoBack";
import { UnitForm } from "./UnitForm";

const routeApi = getRouteApi("/wohnungen/$unitId");

export const UnitEditPage = () => {
  const { unitId } = routeApi.useParams();

  const unit = routeApi.useLoaderData();
  const { data: buildings } = useQuery(buildingsQueryOptions);

  const goBack = useGoBack("/wohnungen");

  const updateUnit = useCrudMutation({
    mutationFn: ({ buildingId: _ignored, ...dto }: UnitCreateDto) =>
      api.patch<Unit>(`/units/${unitId}`, dto),
    invalidateKeys: [["units"], ["unit", unitId]],
    onSuccess: goBack,
  });

  if (!unit) {
    return (
      <EntityNotFound
        title={t("ui.units.notFound.title")}
        description={t("ui.units.notFound.description")}
        to="/wohnungen"
      />
    );
  }

  if (!buildings) {
    return <FormSkeleton rows={3} />;
  }

  return (
    <FormPage icon={<RiHome6Line />} title={unit.name}>
      <UnitForm
        mode="edit"
        buildings={buildings}
        defaultValues={{
          buildingId: unit.buildingId,
          name: unit.name,
          unitNumber: unit.unitNumber ?? "",
          areaSqm: String(unit.areaSqm),
          heatingAreaSqm:
            unit.heatingAreaSqm === null ? "" : String(unit.heatingAreaSqm),
        }}
        onSubmit={async (values) => {
          await updateUnit.mutateAsync(values);
        }}
        onCancel={goBack}
      />
    </FormPage>
  );
};
