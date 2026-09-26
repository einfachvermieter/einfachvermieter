import {
  formatNumber,
  type HeatingDetail,
  type SubstitutionAreaSnapshot,
} from "@einfachvermieter/shared";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { t } from "../../../../lib/i18n";

const sqm = (value: number) =>
  t("ui.common.measures.sqm", { value: formatNumber(value, 2) });

const AREA_TEXTS = {
  heating: {
    share: "ui.substitutions.areaHeating",
    limit: "ui.substitutions.limitHeating",
  },
  hotWater: {
    share: "ui.substitutions.areaHotWater",
    limit: "ui.substitutions.limitHotWater",
  },
} as const;

/**
 * Betroffene Fläche je Bereich; über 25% der Hinweis auf § 9a Abs. 2
 */
export const SubstitutionAreaShares = ({
  areas,
}: {
  areas: NonNullable<HeatingDetail["substitutionArea"]>;
}) => {
  const rows = (["heating", "hotWater"] as const)
    .map((scope) => ({ scope, area: areas[scope] }))
    .filter(
      (
        row,
      ): row is {
        scope: "heating" | "hotWater";
        area: SubstitutionAreaSnapshot;
      } => row.area !== undefined,
    );

  return (
    <section className="space-y-2">
      {rows.map(({ scope, area }) => (
        <div key={scope} className="space-y-2">
          <p className="tabular-nums">
            {t(AREA_TEXTS[scope].share, {
              affected: sqm(area.affectedAreaSqm),
              total: sqm(area.totalAreaSqm),
              percent: formatNumber(
                area.totalAreaSqm > 0
                  ? (area.affectedAreaSqm / area.totalAreaSqm) * 100
                  : 0,
                1,
              ),
            })}
          </p>
          {area.limitExceeded ? (
            <Alert variant="warning">
              <AlertDescription>{t(AREA_TEXTS[scope].limit)}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ))}
    </section>
  );
};
