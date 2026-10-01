import type {
  SubstitutionScope,
  UnitSupplyExclusion,
} from "@einfachvermieter/shared";
import { RiFireLine } from "@remixicon/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RowListSection } from "@/components/common/RowListSection";
import { heatingSettingsListQueryOptions } from "../../../../lib/heating";
import { t } from "../../../../lib/i18n";
import {
  deleteUnitSupplyExclusion,
  unitSupplyInvalidateKeys,
  unitSupplyQueryOptions,
  unitSupplyRowLabel,
} from "../../../../lib/unitSupply";
import { UnitSupplySheet } from "../../sheets/UnitSupplySheet";

type SheetTarget = { existing: UnitSupplyExclusion | null };

/**
 * Versorgung der Wohnung aus der zentralen Anlage. Erfasst werden nur die
 * Ausnahmen; ohne Eintrag nimmt die Wohnung an Heizung und Warmwasser teil.
 */
export const UnitSupplySection = ({
  unitId,
  buildingId,
}: {
  unitId: string;
  buildingId: string;
}) => {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<SheetTarget | null>(null);
  const { data: rows } = useQuery(unitSupplyQueryOptions(unitId));
  const { data: heatingVersions } = useQuery(
    heatingSettingsListQueryOptions(buildingId),
  );

  // Warmwasser nur, wenn das Gebäude es zentral bereitstellt
  const hasCentralHotWater = (heatingVersions ?? []).some(
    (version) => version.heatingType === "central_with_hot_water",
  );
  const scopes: SubstitutionScope[] = hasCentralHotWater
    ? ["heating", "hot_water"]
    : ["heating"];
  const list = rows ?? [];

  return (
    <>
      <RowListSection
        icon={RiFireLine}
        title={t("ui.units.supply.title")}
        addLabel={t("ui.units.supply.add")}
        emptyHint={t(
          hasCentralHotWater
            ? "ui.units.supply.empty"
            : "ui.units.supply.emptyHeatingOnly",
        )}
        rows={list}
        renderRow={(row) => (
          <>
            <div className="text-sm font-medium">{unitSupplyRowLabel(row)}</div>
            {row.notes ? (
              <div className="text-sm text-muted-foreground">{row.notes}</div>
            ) : null}
          </>
        )}
        onAdd={() => setTarget({ existing: null })}
        onEditRow={(index) => setTarget({ existing: list[index] ?? null })}
        onDeleteRow={async (index) => {
          const row = list[index];
          if (!row) {
            return;
          }
          await deleteUnitSupplyExclusion(row.id);
          await Promise.all(
            unitSupplyInvalidateKeys.map((queryKey) =>
              queryClient.invalidateQueries({ queryKey }),
            ),
          );
        }}
        confirmDeleteTitle={t("ui.units.supply.confirmDelete")}
      />

      {target ? (
        <UnitSupplySheet
          unitId={unitId}
          scopes={scopes}
          existing={target.existing}
          onClose={() => setTarget(null)}
        />
      ) : null}
    </>
  );
};
