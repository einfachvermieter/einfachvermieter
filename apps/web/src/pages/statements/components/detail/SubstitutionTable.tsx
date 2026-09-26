import {
  type ConsumptionSubstitution,
  formatNumber,
  type HeatingDetail,
  type SubstitutionAreaSnapshot,
  type SubstitutionSnapshot,
} from "@einfachvermieter/shared";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { t } from "../../../../lib/i18n";
import { formatSubstituteConsumption } from "../../../../lib/substitutions";

const statusBadge = (
  entry: SubstitutionSnapshot,
  area: SubstitutionAreaSnapshot | undefined,
) => {
  if (entry.appliedToDistribution) {
    return <Badge variant="ok">{t("ui.substitutions.status.applied")}</Badge>;
  }
  if (area?.limitExceeded) {
    return (
      <Badge variant="warn">{t("ui.substitutions.status.notApplied")}</Badge>
    );
  }

  return <Badge variant="bad">{t("ui.substitutions.status.invalid")}</Badge>;
};

/**
 * Erfasste Erfassungsausfälle der Periode, wie sie in die Berechnung
 * eingegangen sind
 */
export const SubstitutionTable = ({
  detail,
  records,
  onEdit,
}: {
  detail: HeatingDetail;
  records: ConsumptionSubstitution[] | null;
  onEdit: (record: ConsumptionSubstitution) => void;
}) => (
  <section className="space-y-2">
    <h3 className="font-semibold">{t("ui.substitutions.listTitle")}</h3>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("ui.substitutions.columns.unit")}</TableHead>
          <TableHead>{t("ui.substitutions.columns.scope")}</TableHead>
          <TableHead>{t("ui.substitutions.columns.reason")}</TableHead>
          <TableHead>{t("ui.substitutions.columns.method")}</TableHead>
          <TableHead className="text-right">
            {t("ui.substitutions.columns.area")}
          </TableHead>
          <TableHead className="text-right">
            {t("ui.substitutions.columns.consumption")}
          </TableHead>
          <TableHead>{t("ui.substitutions.columns.status")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(detail.substitutions ?? []).map((entry) => {
          const record = records?.find(
            (candidate) => candidate.id === entry.substitutionId,
          );
          return (
            <TableRow key={entry.substitutionId}>
              <TableCell>
                {record ? (
                  <Button
                    variant="addLink"
                    size="text"
                    onClick={() => onEdit(record)}
                  >
                    {entry.unitName}
                  </Button>
                ) : (
                  entry.unitName
                )}
              </TableCell>
              <TableCell>
                {t(`ui.substitutions.scope.${entry.scope}`)}
              </TableCell>
              <TableCell>
                {t(`ui.substitutions.reasonShort.${entry.reason}`)}
              </TableCell>
              <TableCell>
                {t(`ui.substitutions.methodShort.${entry.method}`)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {t("ui.common.measures.sqm", {
                  value: formatNumber(entry.affectedAreaSqm, 2),
                })}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatSubstituteConsumption(
                  entry.substituteConsumption,
                  entry.scope,
                  detail.consumptionMethod === "heat_cost_allocator",
                )}
              </TableCell>
              <TableCell>
                {statusBadge(
                  entry,
                  entry.scope === "heating"
                    ? detail.substitutionArea?.heating
                    : detail.substitutionArea?.hotWater,
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </section>
);
