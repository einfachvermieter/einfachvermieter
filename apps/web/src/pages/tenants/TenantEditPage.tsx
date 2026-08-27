import { tenantAggregateToFormValues } from "@einfachvermieter/shared";
import {
  RiBankCardLine,
  RiDeleteBinLine,
  RiGroupLine,
  RiMapPinLine,
  RiMoneyEuroCircleLine,
  RiMoreLine,
} from "@remixicon/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { RowListSection } from "@/components/common/RowListSection";
import { HelpHint } from "@/components/help/HelpHint";
import { Button } from "../../components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/DropdownMenu";
import { formatPeriod, isPeriodActiveToday } from "../../lib/format";
import { t } from "../../lib/i18n";
import { contractPartyNames, tenantQueryOptions } from "../../lib/tenants";
import { unitsQueryOptions } from "../../lib/units";
import { useDeleteResource } from "../../lib/useDeleteResource";
import { TenantContractCard } from "./cards/TenantContractCard";
import { TenantNotesCard } from "./cards/TenantNotesCard";
import { AddressRowSummary } from "./components/addresses/AddressRowSummary";
import { emptyAddressRow } from "./components/addresses/addressRow";
import { BankAccountRowSummary } from "./components/bankAccounts/BankAccountRowSummary";
import { emptyBankAccountRow } from "./components/bankAccounts/bankAccountRow";
import { RentRowSummary } from "./components/rents/RentRowSummary";
import { emptyRentRow } from "./components/rents/rentRow";
import { ResidentRowSummary } from "./components/residents/ResidentRowSummary";
import {
  buildResidentSortIndex,
  emptyResidentRow,
  type ResidentRowValues,
} from "./components/residents/residentRow";
import { TenantAddressSheet } from "./sheets/TenantAddressSheet";
import { TenantBankAccountSheet } from "./sheets/TenantBankAccountSheet";
import { TenantContractSheet } from "./sheets/TenantContractSheet";
import { TenantNotesSheet } from "./sheets/TenantNotesSheet";
import { TenantRentSheet } from "./sheets/TenantRentSheet";
import { TenantResidentSheet } from "./sheets/TenantResidentSheet";
import { TenantDetailLayout } from "./TenantDetailLayout";
import { useTenantAggregateSave } from "./useTenantAggregateSave";

const routeApi = getRouteApi("/mieter/$tenantId");

type SheetState =
  | { kind: "contract" }
  | { kind: "resident"; index: number | null }
  | { kind: "rent"; index: number | null }
  | { kind: "bank"; index: number | null }
  | { kind: "address"; index: number | null }
  | { kind: "notes" }
  | null;

const upsert = <T,>(list: T[], index: number | null, row: T): T[] =>
  index === null
    ? [...list, row]
    : list.map((item, i) => (i === index ? row : item));

const removeAt = <T,>(list: T[], index: number): T[] =>
  list.filter((_, i) => i !== index);

/**
 * Stammdaten-Ansicht des Mieters
 */
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: sechs View-Cardn plus die zugehörigen Sheets
export const TenantEditPage = () => {
  const { tenantId } = routeApi.useParams();

  const { data: aggregate } = useSuspenseQuery(tenantQueryOptions(tenantId));
  const { data: units } = useQuery(unitsQueryOptions);
  const navigate = useNavigate();

  const save = useTenantAggregateSave(tenantId, aggregate);
  const [sheet, setSheet] = useState<SheetState>(null);
  const closeSheet = () => setSheet(null);

  const values = tenantAggregateToFormValues(aggregate);
  const { tenant } = aggregate;
  const unit = units?.find((entry) => entry.id === tenant.unitId);
  const showRents = values.kind !== "owner";
  const contractParties = contractPartyNames(aggregate.residents);

  const deletion = useDeleteResource<{ id: string }>({
    endpoint: (target) => `/tenants/${target.id}`,
    invalidateKeys: [["tenants"]],
    title: t("ui.tenants.confirmDeleteTenant"),
    describe: () =>
      contractParties
        ? t("ui.tenants.confirmDeleteTenantMessage", {
            residents: contractParties,
            unit: unit?.name ?? "",
            period: formatPeriod(tenant.startDate, tenant.endDate),
          })
        : t("ui.tenants.confirmDeleteTenantMessageNoResidents", {
            unit: unit?.name ?? "",
            period: formatPeriod(tenant.startDate, tenant.endDate),
          }),
    onDeleted: () =>
      navigate({ to: "/mieter", search: { buildingId: undefined } }),
  });

  // Vertragspartner-Lock: nur erzwingen, wenn nach dem Speichern höchstens
  // ein Bewohner existiert. Beim Hinzufügen zählt der neue Eintrag mit.
  const residentLock = (index: number | null) => {
    const total =
      index === null ? values.residents.length + 1 : values.residents.length;
    return total <= 1;
  };

  const residentDefaults = (index: number | null): ResidentRowValues => {
    if (index !== null) {
      return values.residents[index] ?? emptyResidentRow();
    }
    const base = emptyResidentRow();
    if (residentLock(null)) {
      return { ...base, isContractParty: true };
    }
    // Existiert schon ein aktiver Vertragspartner, neuen Bewohner als
    // Mitbewohner vorschlagen.
    const hasActiveContractParty = values.residents.some(
      (resident) =>
        resident.isContractParty &&
        isPeriodActiveToday(
          resident.moveInDate || values.startDate,
          resident.moveOutDate || values.endDate,
        ),
    );
    return hasActiveContractParty ? { ...base, isContractParty: false } : base;
  };

  return (
    <>
      <TenantDetailLayout
        tenantId={tenantId}
        active="stammdaten"
        className="pb-6"
        action={
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
                onSelect={() => deletion.request({ id: tenantId })}
              >
                <RiDeleteBinLine />
                {t("ui.tenant.actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        <div>
          <TenantContractCard
            tenant={tenant}
            unit={unit}
            onEdit={() => setSheet({ kind: "contract" })}
          />

          <RowListSection
            icon={RiGroupLine}
            title={t("ui.tenant.fields.residents")}
            titleHelp={<HelpHint>{t("ui.tenant.residentsHelp")}</HelpHint>}
            addLabel={t("ui.tenant.addResident")}
            emptyHint={t("ui.tenant.residentsEmptyHint")}
            rows={values.residents}
            renderRow={(row, index) => (
              <ResidentRowSummary
                row={row}
                index={index}
                tenantStartDate={values.startDate}
                tenantEndDate={values.endDate}
              />
            )}
            sortIndex={(rows) =>
              buildResidentSortIndex(rows, values.startDate, values.endDate)
            }
            onAdd={() => setSheet({ kind: "resident", index: null })}
            onEditRow={(index) => setSheet({ kind: "resident", index })}
            onDeleteRow={async (index) => {
              await save((current) => ({
                ...current,
                residents: removeAt(current.residents, index),
              }));
            }}
            confirmDeleteTitle={t("ui.tenant.confirmRemoveResident")}
          />

          {showRents ? (
            <RowListSection
              icon={RiMoneyEuroCircleLine}
              title={t("ui.tenant.rentsTitle")}
              titleHelp={<HelpHint>{t("ui.tenant.rentsHelp")}</HelpHint>}
              addLabel={t("ui.tenant.addRentChange")}
              emptyHint={t("ui.tenant.rentsEmptyHint")}
              rows={values.rents}
              renderRow={(row, index) => (
                <RentRowSummary
                  row={row}
                  index={index}
                  tenantStartDate={values.startDate}
                  tenantEndDate={values.endDate}
                />
              )}
              onAdd={() => setSheet({ kind: "rent", index: null })}
              onEditRow={(index) => setSheet({ kind: "rent", index })}
              onDeleteRow={async (index) => {
                await save((current) => ({
                  ...current,
                  rents: removeAt(current.rents, index),
                }));
              }}
              confirmDeleteTitle={t("ui.tenant.confirmRemoveRent")}
            />
          ) : null}

          <RowListSection
            icon={RiBankCardLine}
            title={t("ui.tenant.fields.bankAccount")}
            titleHelp={<HelpHint>{t("ui.tenant.bankAccountsHelp")}</HelpHint>}
            addLabel={t("ui.tenant.addBankAccount")}
            emptyHint={t("ui.tenant.bankAccountsEmptyHint")}
            rows={values.bankAccounts}
            renderRow={(row, index) => (
              <BankAccountRowSummary
                row={row}
                index={index}
                tenantStartDate={values.startDate}
                tenantEndDate={values.endDate}
              />
            )}
            onAdd={() => setSheet({ kind: "bank", index: null })}
            onEditRow={(index) => setSheet({ kind: "bank", index })}
            onDeleteRow={async (index) => {
              await save((current) => ({
                ...current,
                bankAccounts: removeAt(current.bankAccounts, index),
              }));
            }}
            confirmDeleteTitle={t("ui.tenant.confirmRemoveBankAccount")}
          />

          <RowListSection
            icon={RiMapPinLine}
            title={t("ui.tenant.fields.address")}
            titleHelp={<HelpHint>{t("ui.tenant.addressesHelp")}</HelpHint>}
            addLabel={t("ui.tenant.addAddress")}
            emptyHint={t("ui.tenant.addressesEmptyHint")}
            collapsible={true}
            defaultOpen={values.addresses.length > 0}
            rows={values.addresses}
            renderRow={(row, index) => (
              <AddressRowSummary
                row={row}
                index={index}
                tenantStartDate={values.startDate}
                tenantEndDate={values.endDate}
              />
            )}
            onAdd={() => setSheet({ kind: "address", index: null })}
            onEditRow={(index) => setSheet({ kind: "address", index })}
            onDeleteRow={async (index) => {
              await save((current) => ({
                ...current,
                addresses: removeAt(current.addresses, index),
              }));
            }}
            confirmDeleteTitle={t("ui.tenant.confirmRemoveAddress")}
          />

          <TenantNotesCard
            notes={values.notes}
            onEdit={() => setSheet({ kind: "notes" })}
          />
        </div>
      </TenantDetailLayout>

      {sheet?.kind === "contract" ? (
        <TenantContractSheet
          units={units ?? []}
          defaultValues={{
            unitId: values.unitId,
            kind: values.kind,
            startDate: values.startDate,
            endDate: values.endDate,
            depositEuros: values.depositEuros,
          }}
          onSubmit={async (contract) => {
            await save((current) => {
              const next = { ...current, ...contract };
              if (next.kind !== "owner" && next.rents.length === 0) {
                next.rents = [emptyRentRow(next.startDate)];
              }
              return next;
            });
            closeSheet();
          }}
          onClose={closeSheet}
        />
      ) : null}

      {sheet?.kind === "resident" ? (
        <TenantResidentSheet
          title={
            sheet.index === null
              ? t("ui.tenant.addResident")
              : t("ui.tenant.editResident")
          }
          defaultValues={residentDefaults(sheet.index)}
          lockContractParty={residentLock(sheet.index)}
          onSubmit={async (row) => {
            const { index } = sheet;
            await save((current) => ({
              ...current,
              residents: upsert(current.residents, index, row),
            }));
            closeSheet();
          }}
          onClose={closeSheet}
        />
      ) : null}

      {sheet?.kind === "rent" ? (
        <TenantRentSheet
          title={
            sheet.index === null
              ? t("ui.tenant.addRent")
              : t("ui.tenant.editRent")
          }
          defaultValues={
            sheet.index !== null
              ? (values.rents[sheet.index] ?? emptyRentRow(values.startDate))
              : emptyRentRow(values.startDate)
          }
          onSubmit={async (row) => {
            const { index } = sheet;
            await save((current) => ({
              ...current,
              rents: upsert(current.rents, index, row),
            }));
            closeSheet();
          }}
          onClose={closeSheet}
        />
      ) : null}

      {sheet?.kind === "bank" ? (
        <TenantBankAccountSheet
          title={
            sheet.index === null
              ? t("ui.tenant.addBankAccount")
              : t("ui.tenant.editBankAccount")
          }
          defaultValues={
            sheet.index !== null
              ? (values.bankAccounts[sheet.index] ?? emptyBankAccountRow())
              : emptyBankAccountRow()
          }
          onSubmit={async (row) => {
            const { index } = sheet;
            await save((current) => ({
              ...current,
              bankAccounts: upsert(current.bankAccounts, index, row),
            }));
            closeSheet();
          }}
          onClose={closeSheet}
        />
      ) : null}

      {sheet?.kind === "address" ? (
        <TenantAddressSheet
          title={
            sheet.index === null
              ? t("ui.tenant.addAddress")
              : t("ui.tenant.editAddress")
          }
          defaultValues={
            sheet.index !== null
              ? (values.addresses[sheet.index] ?? emptyAddressRow())
              : emptyAddressRow()
          }
          onSubmit={async (row) => {
            const { index } = sheet;
            await save((current) => ({
              ...current,
              addresses: upsert(current.addresses, index, row),
            }));
            closeSheet();
          }}
          onClose={closeSheet}
        />
      ) : null}

      {sheet?.kind === "notes" ? (
        <TenantNotesSheet
          defaultValues={{ notes: values.notes }}
          onSubmit={async (notes) => {
            await save((current) => ({ ...current, ...notes }));
            closeSheet();
          }}
          onClose={closeSheet}
        />
      ) : null}

      {deletion.dialog}
    </>
  );
};
