import type { StatementResult } from "@einfachvermieter/shared";
import { formatDate } from "@einfachvermieter/shared";
import { TableFrame } from "@/components/common/TableFrame";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { IconUsers } from "@/lib/icons";
import { SectionCard } from "../../../../components/common/SectionCard";
import { t } from "../../../../lib/i18n";

type ResidentGroup = {
  count: number;
  from: string;
  to: string;
  days: number;
};

const groupResidentsBySpan = (
  residents: NonNullable<
    StatementResult["occupancyDetail"]
  >["perUnit"][number]["residents"],
): ResidentGroup[] => {
  const groups = new Map<string, ResidentGroup>();
  for (const r of residents) {
    const key = `${r.from}|${r.to}|${r.days}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, { count: 1, from: r.from, to: r.to, days: r.days });
    }
  }
  return [...groups.values()];
};

export const OccupancyCard = ({
  detail,
  targetUnitId,
}: {
  detail: NonNullable<StatementResult["occupancyDetail"]>;
  targetUnitId: string;
}) => {
  const periodTotalDays = detail.perUnit.length * detail.periodDays;

  return (
    <SectionCard
      icon={IconUsers}
      title={t("ui.statements.detail.occupancyTitle")}
      description={t("ui.statements.detail.occupancyDescription")}
    >
      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                {t("ui.statements.detail.occupancyColumnUnit")}
              </TableHead>
              <TableHead>
                {t("ui.statements.detail.occupancyColumnResident")}
              </TableHead>
              <TableHead>
                {t("ui.statements.detail.occupancyColumnSpan")}
              </TableHead>
              <TableHead className="text-right">
                {t("ui.statements.detail.occupancyColumnDays")}
              </TableHead>
              <TableHead className="text-right">
                {t("ui.statements.detail.occupancyColumnPersonDays")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.perUnit.flatMap((unit) => {
              const unitCellClass =
                unit.unitId === targetUnitId
                  ? "font-semibold text-foreground"
                  : "text-foreground";
              if (unit.residents.length === 0) {
                return [
                  <TableRow key={unit.unitId}>
                    <TableCell className={unitCellClass}>
                      {unit.unitName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t("ui.common.emptyValue")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t("ui.common.emptyValue")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {0}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {0}
                    </TableCell>
                  </TableRow>,
                ];
              }
              const groups = groupResidentsBySpan(unit.residents);
              return groups.map((g) => (
                <TableRow key={`${unit.unitId}-${g.from}-${g.to}-${g.days}`}>
                  <TableCell className={unitCellClass}>
                    {unit.unitName}
                  </TableCell>
                  <TableCell>
                    {g.count === 1
                      ? t("ui.statements.detail.occupancyPersonSingular")
                      : t("ui.statements.detail.occupancyPersonPlural", {
                          count: g.count,
                        })}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {`${formatDate(g.from)}${t("ui.common.separators.dash")}${formatDate(g.to)}`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {g.count === 1
                      ? g.days
                      : t("ui.statements.detail.occupancyDaysGroup", {
                          count: g.count,
                          days: g.days,
                        })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {g.count * g.days}
                  </TableCell>
                </TableRow>
              ));
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-semibold" colSpan={4}>
                {t("ui.statements.detail.occupancyTotalPersonDays")}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {detail.totalPersonDays}
              </TableCell>
            </TableRow>
            {detail.landlordPersonDays > 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={4}>
                  {t("ui.statements.detail.occupancyLandlordPersonDays")}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {detail.landlordPersonDays}
                </TableCell>
              </TableRow>
            ) : null}
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={4}>
                {t("ui.statements.detail.occupancyTotalOccupiedDays")}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {detail.totalOccupiedDays}
              </TableCell>
            </TableRow>
            {detail.landlordOccupiedDays > 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={4}>
                  {t("ui.statements.detail.occupancyLandlordDays")}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {detail.landlordOccupiedDays}
                </TableCell>
              </TableRow>
            ) : null}
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={4}>
                {t("ui.statements.detail.occupancyPeriodTotal", {
                  units: detail.perUnit.length,
                  days: detail.periodDays,
                })}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {periodTotalDays}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableFrame>
    </SectionCard>
  );
};
