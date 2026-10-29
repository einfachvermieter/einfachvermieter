import {
  emptyTenantFormValues,
  formatDate,
  type TenantFormValues,
  tenantFormSchemaRefined,
  tenantFormToDto,
  todayIso,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiKey2Line, RiMoneyEuroCircleLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { FormSheet } from "@/components/form/FormSheet";
import { SheetSection } from "@/components/form/SheetSection";
import { FieldGroup } from "@/components/ui/Field";
import { IconUsers } from "@/lib/icons";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { api } from "../../lib/api";
import { domainVisuals } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import {
  type TenantAggregate,
  type TenantOverviewRow,
  tenantsOverviewQueryOptions,
} from "../../lib/tenants";
import { unitsQueryOptions } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { emptyRentRow } from "./components/rents/rentRow";
import { emptyResidentRow } from "./components/residents/residentRow";
import { ContractFields } from "./fields/ContractFields";
import { RentFields } from "./fields/RentFields";
import { ResidentFields } from "./fields/ResidentFields";

/**
 * Meldung, wenn die Wohnung im gewählten Zeitraum schon an jemand anderen
 * vermietet ist (gleiche Regel wie beim Speichern), sonst null
 */
const unitOccupiedMessage = (
  contracts: TenantOverviewRow[],
  unitId: string,
  startDate: string,
  endDate: string,
): string | null => {
  if (!(unitId && startDate)) {
    return null;
  }
  const newEnd = endDate || "9999-12-31";
  const existing = contracts.find(
    (contract) =>
      contract.unitId === unitId &&
      startDate <= (contract.endDate ?? "9999-12-31") &&
      contract.startDate <= newEnd,
  );
  if (!existing) {
    return null;
  }
  return existing.endDate
    ? t("ui.tenant.create.unitOccupiedUntil", {
        start: formatDate(existing.startDate),
        end: formatDate(existing.endDate),
      })
    : t("ui.tenant.create.unitOccupiedOpen", {
        start: formatDate(existing.startDate),
      });
};

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

  // Steht schon fest, dass die Wohnung im Zeitraum vermietet ist, gleich
  // am ersten Feld sagen, nicht erst nach dem Ausfüllen beim Speichern
  const { data: contracts } = useQuery(
    tenantsOverviewQueryOptions({ page: 0, pageSize: 1000, buildingId }),
  );
  const [unitId, startDate, endDate] = useWatch({
    control: form.control,
    name: ["unitId", "startDate", "endDate"],
  });
  const occupied = unitOccupiedMessage(
    contracts?.items ?? [],
    unitId,
    startDate,
    endDate,
  );
  const { submitCount } = form.formState;
  // biome-ignore lint/correctness/useExhaustiveDependencies: submitCount setzt die Meldung nach jedem Absenden erneut, weil die Formularprüfung dabei alle Fehler ersetzt
  useEffect(() => {
    if (occupied) {
      form.setError("unitId", { type: "occupied", message: occupied });
    } else if (form.getFieldState("unitId").error?.type === "occupied") {
      form.clearErrors("unitId");
    }
  }, [occupied, form, submitCount]);

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
        if (occupied) {
          form.setError("unitId", { type: "occupied", message: occupied });
          return;
        }
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
        <FieldGroup>
          <ContractFields control={form.control} units={units} />
        </FieldGroup>
      </SheetSection>

      <SheetSection
        icon={IconUsers}
        title={t("ui.tenant.create.contractPartyTitle")}
        description={t("ui.tenant.create.contractPartyHint")}
      >
        <ResidentFields
          control={form.control}
          prefix="residents.0."
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
