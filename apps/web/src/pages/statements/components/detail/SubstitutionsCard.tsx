import type {
  HeatingDetail,
  Period,
  SubstitutionScope,
} from "@einfachvermieter/shared";
import { RiErrorWarningLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SectionCard } from "@/components/common/SectionCard";
import { Button } from "@/components/ui/Button";
import { t } from "../../../../lib/i18n";
import type { SubstitutionSheetTarget } from "../../../../lib/substitutionForm";
import {
  substitutionGapsOf,
  substitutionsQueryOptions,
} from "../../../../lib/substitutions";
import { supplyIssuesOf } from "../../../../lib/unitSupply";
import { SubstitutionAreaShares } from "./SubstitutionAreaShares";
import { SubstitutionCompensationList } from "./SubstitutionCompensationList";
import { SubstitutionGapList } from "./SubstitutionGapList";
import { SubstitutionSheet } from "./SubstitutionSheet";
import { SubstitutionTable } from "./SubstitutionTable";
import { SupplyIssueList } from "./SupplyIssueList";

/**
 * Verbrauchserfassung nach § 9a HeizkostenV im Tab "Heizkosten":
 * offene Lücken, erfasste Erfassungsausfälle, Flächenanteil je Bereich und
 * Ausgleich aus der Vorperiode. Im Entwurf mit Aktionen, finalisiert
 * nur der Snapshot.
 */
export const SubstitutionsCard = ({
  buildingId,
  period,
  isDraft,
  detail,
}: {
  buildingId: string;
  period: Period;
  isDraft: boolean;
  detail: HeatingDetail;
}) => {
  const [target, setTarget] = useState<SubstitutionSheetTarget | null>(null);
  const { data: records } = useQuery({
    ...substitutionsQueryOptions(buildingId, period),
    enabled: isDraft,
  });

  const gaps = substitutionGapsOf(detail.warnings);
  const hasSubstitutions = (detail.substitutions ?? []).length > 0;
  const hasCompensations = (detail.compensations ?? []).length > 0;
  const supplyIssues = supplyIssuesOf(detail.warnings);
  const hasContent =
    gaps.length > 0 ||
    supplyIssues.length > 0 ||
    hasSubstitutions ||
    hasCompensations;
  if (!(isDraft || hasContent)) {
    return null;
  }

  const units = detail.perUnit.map((row) => ({
    id: row.unitId,
    name: row.unitName,
  }));
  const scopes: SubstitutionScope[] = detail.hotWaterDetail
    ? ["heating", "hot_water"]
    : ["heating"];

  return (
    <SectionCard
      icon={RiErrorWarningLine}
      title={t("ui.substitutions.title")}
      description={t("ui.substitutions.description")}
      action={
        isDraft ? (
          <Button
            variant="addLink"
            size="text"
            onClick={() => setTarget({ kind: "new", units, scopes })}
          >
            {t("ui.substitutions.add")}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-5 text-sm">
        {hasContent ? null : (
          <p className="text-muted-foreground">
            {t("ui.substitutions.emptyHint")}
          </p>
        )}
        {supplyIssues.length > 0 ? (
          <SupplyIssueList
            issues={supplyIssues}
            buildingId={buildingId}
            isDraft={isDraft}
          />
        ) : null}
        {gaps.length > 0 ? (
          <SubstitutionGapList
            gaps={gaps}
            isDraft={isDraft}
            onRecord={(gap) =>
              setTarget({
                kind: "new",
                units,
                scopes,
                unitId: gap.unitId,
                scope: gap.scope,
                meterIds: gaps
                  .filter(
                    (entry) =>
                      entry.unitId === gap.unitId && entry.scope === gap.scope,
                  )
                  .map((entry) => entry.meterId),
              })
            }
          />
        ) : null}
        {hasSubstitutions ? (
          <SubstitutionTable
            detail={detail}
            records={isDraft ? (records ?? []) : null}
            onEdit={(record) =>
              setTarget({ kind: "edit", units, scopes, record })
            }
          />
        ) : null}
        {detail.substitutionArea ? (
          <SubstitutionAreaShares areas={detail.substitutionArea} />
        ) : null}
        {hasCompensations ? (
          <SubstitutionCompensationList detail={detail} />
        ) : null}
      </div>

      {target ? (
        <SubstitutionSheet
          buildingId={buildingId}
          period={period}
          target={target}
          onClose={() => setTarget(null)}
        />
      ) : null}
    </SectionCard>
  );
};
