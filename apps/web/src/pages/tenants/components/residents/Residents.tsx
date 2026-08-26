import {
  formatName,
  type TenantFormValues,
  todayIso,
} from "@einfachvermieter/shared";
import { RiGroupLine } from "@remixicon/react";
import { type UseFormReturn, useFieldArray } from "react-hook-form";
import {
  EditableListSection,
  type EditableListSectionRowFormProps,
} from "@/components/form/EditableListSection";
import { HelpHint } from "@/components/help/HelpHint";
import { Badge } from "@/components/ui/Badge";
import {
  formatPeriod,
  getPeriodStatusToday,
  isPeriodActiveToday,
} from "../../../../lib/format";
import { t, translateKey } from "../../../../lib/i18n";
import { ResidentRowForm } from "./ResidentRowForm";
import { emptyResidentRow, type ResidentRowValues } from "./residentRow";

/**
 * Sort-Reihenfolge für die Bewohner-Anzeige im Formular:
 * 1. Vertragspartner vor Mitbewohner
 * 2. Aktiv (heute im Vertragszeitraum) vor inaktiv
 * 3. Spätestes (oder fehlendes) Auszugsdatum zuerst
 * 4. Spätestes (oder fehlendes) Einzugsdatum zuerst
 * 5. Alphabetisch nach Vorname Nachname
 *
 * Liefert eine Liste der Original-Indizes in der Anzeige-Reihenfolge.
 */
const buildResidentSortIndex = (
  residents: ResidentRowValues[],
  tenantStartDate: string,
  tenantEndDate: string,
): number[] => {
  const today = todayIso();
  const isActive = (r: ResidentRowValues) => {
    const start = r.moveInDate || tenantStartDate;
    const end = r.moveOutDate || tenantEndDate;
    if (start && start > today) {
      return false;
    }
    if (end && end < today) {
      return false;
    }
    return Boolean(start);
  };

  // "Später oder kein Datum" -> leerer String wird höher sortiert als jedes
  // gefüllte ISO-Datum (Sentinel "9999-12-31").
  const sentinelHigh = (value: string) => value || "9999-12-31";

  return residents
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      // 1. Vertragspartner zuerst
      if (a.row.isContractParty !== b.row.isContractParty) {
        return a.row.isContractParty ? -1 : 1;
      }

      // 2. Aktiv zuerst
      const aActive = isActive(a.row);
      const bActive = isActive(b.row);
      if (aActive !== bActive) {
        return aActive ? -1 : 1;
      }

      // 3. Spätestes (oder fehlendes) Auszugsdatum zuerst
      const aOut = sentinelHigh(a.row.moveOutDate);
      const bOut = sentinelHigh(b.row.moveOutDate);
      if (aOut !== bOut) {
        return aOut > bOut ? -1 : 1;
      }

      // 4. Spätestes (oder fehlendes) Einzugsdatum zuerst
      const aIn = sentinelHigh(a.row.moveInDate);
      const bIn = sentinelHigh(b.row.moveInDate);
      if (aIn !== bIn) {
        return aIn > bIn ? -1 : 1;
      }

      // 5. Alphabetisch Vorname Nachname
      const aName = formatName(a.row.firstName, a.row.lastName);
      const bName = formatName(b.row.firstName, b.row.lastName);
      return aName.localeCompare(bName, "de");
    })
    .map((entry) => entry.index);
};

export const Residents = ({
  form,
  tenantStartDate,
  tenantEndDate,
}: {
  form: UseFormReturn<TenantFormValues>;
  tenantStartDate: string;
  tenantEndDate: string;
}) => {
  const residentsArray = useFieldArray({
    control: form.control,
    name: "residents",
  });
  const watchedResidents = form.watch("residents");
  const error = translateKey(form.formState.errors.residents?.message);

  // Vertragspartner-Lock: nur erzwingen, wenn nach dem Speichern höchstens
  // ein Bewohner existiert. Beim Add zählt der neue Eintrag mit.
  const lockFor = (editIndex: number | null) => {
    const total =
      editIndex === null
        ? residentsArray.fields.length + 1
        : residentsArray.fields.length;
    return total <= 1;
  };

  const resolveDefaultValues = (
    editIndex: number | null,
    current: ResidentRowValues | undefined,
  ): ResidentRowValues => {
    const base = current ?? emptyResidentRow();
    if (lockFor(editIndex)) {
      return { ...base, isContractParty: true };
    }
    if (editIndex === null) {
      // Beim Hinzufügen: wenn aktuell schon ein aktiver Vertragspartner
      // existiert, neuen Bewohner als Mitbewohner vorschlagen.
      const hasActiveContractParty = watchedResidents.some(
        (r) =>
          r.isContractParty &&
          isPeriodActiveToday(
            r.moveInDate || tenantStartDate,
            r.moveOutDate || tenantEndDate,
          ),
      );
      if (hasActiveContractParty) {
        return { ...base, isContractParty: false };
      }
    }
    return base;
  };

  const renderRowForm = ({
    defaultValues,
    editIndex,
    onSubmit,
    onCancel,
  }: EditableListSectionRowFormProps<ResidentRowValues>) => (
    <ResidentRowForm
      key={editIndex !== null ? `edit-${editIndex}` : "new"}
      defaultValues={defaultValues}
      lockContractParty={lockFor(editIndex)}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );

  return (
    <EditableListSection<ResidentRowValues>
      title={t("ui.tenant.fields.residents")}
      titleHelp={<HelpHint>{t("ui.tenant.residentsHelp")}</HelpHint>}
      emptyHint={t("ui.tenant.residentsEmptyHint")}
      addLabel={t("ui.tenant.addResident")}
      icon={RiGroupLine}
      fieldKeys={residentsArray.fields}
      rows={watchedResidents}
      renderRow={(row, index) => {
        const effectiveMoveIn = row.moveInDate || tenantStartDate;
        const effectiveMoveOut = row.moveOutDate || tenantEndDate;
        const periodStatus = getPeriodStatusToday(
          effectiveMoveIn,
          effectiveMoveOut,
          tenantEndDate,
        );
        return (
          <>
            <div className="flex items-center gap-2">
              <p className="truncate font-semibold">
                {row.firstName && row.lastName
                  ? formatName(row.firstName, row.lastName)
                  : t("ui.tenant.residentIndex", { index: index + 1 })}
              </p>
              {row.isContractParty ? (
                <Badge variant="info">
                  {t("ui.tenant.fields.isContractParty")}
                </Badge>
              ) : null}
              {periodStatus === "active" ? (
                <Badge variant="ok">{t("ui.tenant.active")}</Badge>
              ) : null}
              {periodStatus === "last" ? (
                <Badge variant="warn">{t("ui.tenant.lastResident")}</Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">
              {formatPeriod(effectiveMoveIn, effectiveMoveOut)}
            </p>
          </>
        );
      }}
      onAppend={(values) => residentsArray.append(values)}
      onUpdate={(index, values) => residentsArray.update(index, values)}
      onRemove={(index) => residentsArray.remove(index)}
      resolveDefaultValues={resolveDefaultValues}
      renderRowForm={renderRowForm}
      confirmDeleteTitle={t("ui.tenant.confirmRemoveResident")}
      error={error}
      rowError={(index) =>
        translateKey(form.formState.errors.residents?.[index]?.message)
      }
      sortIndex={(rows) =>
        buildResidentSortIndex(rows, tenantStartDate, tenantEndDate)
      }
    />
  );
};
