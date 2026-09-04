import {
  emptyTenantFormValues,
  type TenantFormValues,
  tenantFormSchemaRefined,
  tenantFormToDto,
  todayIso,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  RiGroupLine,
  RiKey2Line,
  RiMoneyEuroCircleLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { FormSheet } from "@/components/form/FormSheet";
import { SheetSection } from "@/components/form/SheetSection";
import { FieldGroup } from "@/components/ui/Field";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { api } from "../../lib/api";
import { domainVisuals } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import type { TenantAggregate } from "../../lib/tenants";
import { unitsQueryOptions } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { emptyRentRow } from "./components/rents/rentRow";
import { emptyResidentRow } from "./components/residents/residentRow";
import { ContractFields } from "./fields/ContractFields";
import { RentFields } from "./fields/RentFields";
import { ResidentFields } from "./fields/ResidentFields";

const buildDefaults = (startDate: string): TenantFormValues => ({
  ...emptyTenantFormValues(startDate),
  // "0 = keine Kaution" vorbelegen, damit das Pflichtformat nicht blockt
  depositEuros: "0,00",
  residents: [emptyResidentRow()],
  rents: [emptyRentRow()],
});

/**
 * Mietvertrag anlegen im FormSheet: Vertrag, erster Vertragspartner und
 * erster Mietsatz. Anlegen speichert sofort und führt auf die Detailseite,
 * wo alles Weitere über die dortigen Blätter ergänzt wird.
 */
export const TenantCreateSheet = ({ onClose }: { onClose: () => void }) => {
  const { buildingId } = useActiveBuilding();
  const { data: allUnits } = useQuery(unitsQueryOptions);
  const units = (allUnits ?? []).filter(
    (unit) => unit.buildingId === buildingId,
  );
  const navigate = useNavigate();

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantFormSchemaRefined),
    reValidateMode: "onSubmit",
    defaultValues: buildDefaults(todayIso()),
  });

  const showRent = form.watch("kind") !== "owner";

  const createTenant = useCrudMutation({
    mutationFn: (dto: ReturnType<typeof tenantFormToDto>) =>
      api.post<TenantAggregate>("/tenants", dto),
    invalidateKeys: [["tenants"], ["stats"]],
  });

  return (
    <FormSheet
      form={form}
      icon={domainVisuals.tenants.icon}
      title={t("ui.tenants.createTitle")}
      submitLabel={t("ui.common.action.create")}
      onSubmit={async (values) => {
        const created = await createTenant.mutateAsync(tenantFormToDto(values));
        // Direkt zur Detailseite; der Routenwechsel schließt das Sheet
        await navigate({
          to: "/mieter/$tenantId",
          params: { tenantId: created.tenant.id },
        });
      }}
      onClose={onClose}
    >
      <SheetSection
        icon={RiKey2Line}
        title={t("ui.tenant.sections.contract.title")}
        divider={false}
      >
        <FieldGroup className="gap-4">
          <ContractFields control={form.control} units={units} />
        </FieldGroup>
      </SheetSection>

      <SheetSection
        icon={RiGroupLine}
        title={t("ui.tenant.create.contractPartyTitle")}
        description={t("ui.tenant.create.contractPartyHint")}
      >
        <ResidentFields
          control={form.control}
          prefix="residents.0."
          lockContractParty={true}
          variant="initial"
        />
      </SheetSection>

      {showRent ? (
        <SheetSection
          icon={RiMoneyEuroCircleLine}
          title={t("ui.tenant.create.rentTitle")}
          description={t("ui.tenant.create.rentDescription")}
        >
          <RentFields
            control={form.control}
            prefix="rents.0."
            variant="initial"
          />
        </SheetSection>
      ) : null}
    </FormSheet>
  );
};
