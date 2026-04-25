import type { StatementResult } from "@einfachvermieter/shared";
import { formatDate } from "@einfachvermieter/shared";
import { Description } from "../../../../components/common/Description";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/Card";
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
}: {
  detail: NonNullable<StatementResult["occupancyDetail"]>;
}) => {
  const periodTotalDays = detail.perUnit.length * detail.periodDays;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("ui.statements.detail.occupancyTitle")}</CardTitle>
        <Description>
          {t("ui.statements.detail.occupancyDescription")}
        </Description>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
              <th className="py-1.5">
                {t("ui.statements.detail.occupancyColumnUnit")}
              </th>
              <th className="py-1.5">
                {t("ui.statements.detail.occupancyColumnResident")}
              </th>
              <th className="py-1.5">
                {t("ui.statements.detail.occupancyColumnSpan")}
              </th>
              <th className="py-1.5 text-right">
                {t("ui.statements.detail.occupancyColumnDays")}
              </th>
              <th className="py-1.5 text-right">
                {t("ui.statements.detail.occupancyColumnPersonDays")}
              </th>
            </tr>
          </thead>
          <tbody>
            {detail.perUnit.flatMap((unit) => {
              if (unit.residents.length === 0) {
                return [
                  <tr key={unit.unitId} className="border-b border-border">
                    <td className="py-1.5">{unit.unitName}</td>
                    <td className="py-1.5 text-muted-foreground">
                      {t("ui.common.emptyValue")}
                    </td>
                    <td className="py-1.5 text-muted-foreground">
                      {t("ui.common.emptyValue")}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{0}</td>
                    <td className="py-1.5 text-right tabular-nums">{0}</td>
                  </tr>,
                ];
              }
              const groups = groupResidentsBySpan(unit.residents);
              return groups.map((g, idx) => (
                <tr
                  key={`${unit.unitId}-${g.from}-${g.to}-${g.days}`}
                  className="border-b border-border"
                >
                  <td className="py-1.5">{idx === 0 ? unit.unitName : ""}</td>
                  <td className="py-1.5">
                    {g.count === 1
                      ? t("ui.statements.detail.occupancyPersonSingular")
                      : t("ui.statements.detail.occupancyPersonPlural", {
                          count: g.count,
                        })}
                  </td>
                  <td className="py-1.5 tabular-nums">
                    {`${formatDate(g.from)}${t("ui.common.separators.dash")}${formatDate(g.to)}`}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {g.count === 1
                      ? g.days
                      : t("ui.statements.detail.occupancyDaysGroup", {
                          count: g.count,
                          days: g.days,
                        })}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {idx === groups.length - 1 ? unit.personDays : ""}
                  </td>
                </tr>
              ));
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-foreground">
              <td className="py-2 font-semibold" colSpan={4}>
                {t("ui.statements.detail.occupancyTotalPersonDays")}
              </td>
              <td className="py-2 text-right font-semibold tabular-nums">
                {detail.totalPersonDays}
              </td>
            </tr>
            {detail.landlordPersonDays > 0 ? (
              <tr>
                <td className="py-1 text-muted-foreground" colSpan={4}>
                  {t("ui.statements.detail.occupancyLandlordPersonDays")}
                </td>
                <td className="py-1 text-right tabular-nums text-muted-foreground">
                  {detail.landlordPersonDays}
                </td>
              </tr>
            ) : null}
            <tr>
              <td className="py-1 text-muted-foreground" colSpan={4}>
                {t("ui.statements.detail.occupancyTotalOccupiedDays")}
              </td>
              <td className="py-1 text-right tabular-nums text-muted-foreground">
                {detail.totalOccupiedDays}
              </td>
            </tr>
            {detail.landlordOccupiedDays > 0 ? (
              <tr>
                <td className="py-1 text-muted-foreground" colSpan={4}>
                  {t("ui.statements.detail.occupancyLandlordDays")}
                </td>
                <td className="py-1 text-right tabular-nums text-muted-foreground">
                  {detail.landlordOccupiedDays}
                </td>
              </tr>
            ) : null}
            <tr>
              <td className="py-1 text-muted-foreground" colSpan={4}>
                {t("ui.statements.detail.occupancyPeriodTotal", {
                  units: detail.perUnit.length,
                  days: detail.periodDays,
                })}
              </td>
              <td className="py-1 text-right tabular-nums text-muted-foreground">
                {periodTotalDays}
              </td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
};
