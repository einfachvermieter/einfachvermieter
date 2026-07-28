import {
  DEGREE_DAYS_PROMILLE_PER_MONTH,
  formatNumber,
  type HeatingProrationMethod,
} from "@einfachvermieter/shared";
import { t } from "../../../../lib/i18n";

const MONTH_KEYS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

const maxPromille = Math.max(...DEGREE_DAYS_PROMILLE_PER_MONTH);
/**
 * Summe Promille = 1.000 (HeizkostenV-Anlage), lineare Vergleichslinie = Jahr/12
 */
const linearAvgPromille = Math.round(1000 / MONTH_KEYS.length);

/**
 * Diagramm, wie ein Heizjahr bei Mieter-/Leerstandswechsel auf die
 * Monate verteilt wird: gradtagsgewichtet gegenüber linear
 */
export const HeatingProrationChart = ({
  method,
}: {
  method: HeatingProrationMethod;
}) => {
  const isLinear = method === "linear";
  // Linear: leere, gestrichelt umrandete Balken + durchgezogene Vergleichslinie.
  // Gradtagszahlen: gefüllte sky-Balken + gestrichelte Vergleichslinie.
  const barClass = isLinear
    ? "border border-dashed border-slate-400"
    : "bg-sky-600";
  const refClass = isLinear
    ? "border-solid border-sky-600"
    : "border-dashed border-slate-400";

  return (
    <div className="mt-2 rounded-xl border border-border p-4">
      <div className="mb-3.5 flex flex-wrap items-center justify-end gap-3">
        <div className="flex gap-4 text-xs font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className={`inline-block size-3 rounded-sm ${barClass}`} />
            {t("ui.heating.detail.prorationChartLegendDegreeDays")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`inline-block w-4 border-t-2 ${refClass}`} />
            {t("ui.heating.detail.prorationChartLegendLinear")}
          </span>
        </div>
      </div>

      <div className="pt-6">
        <div className="relative grid h-29.5 grid-cols-12 items-end gap-1.5">
          {DEGREE_DAYS_PROMILLE_PER_MONTH.map((promille, index) => (
            <div
              key={MONTH_KEYS[index]}
              className={`relative min-h-1.25 rounded-t-sm ${barClass}`}
              style={{ height: `${(promille / maxPromille) * 100}%` }}
              title={t("ui.heating.detail.prorationChartBarTitle", {
                month: t(`common.months.${MONTH_KEYS[index]}`),
                promille,
                percent: formatNumber(promille / 10, 1),
              })}
            >
              {isLinear ? null : (
                <span className="-top-5 absolute inset-x-0 text-center text-[10px] font-semibold text-slate-600 tabular-nums">
                  <span className="xl:hidden">{promille}</span>
                  <span className="hidden xl:inline">{`${promille} ‰`}</span>
                </span>
              )}
            </div>
          ))}
          <div
            className={`pointer-events-none absolute right-0 left-0 border-t-2 ${refClass}`}
            style={{ bottom: `${(linearAvgPromille / maxPromille) * 100}%` }}
          >
            {isLinear ? (
              <em className="-top-4.75 absolute right-0 rounded bg-card px-1.25 text-[11px] font-semibold text-slate-600 not-italic tabular-nums">
                {t("ui.heating.detail.prorationChartRefLabel", {
                  promille: linearAvgPromille,
                })}
              </em>
            ) : null}
          </div>
        </div>
        <div className="mt-1.75 grid grid-cols-12 gap-1.5 text-center text-[10.5px] font-semibold text-slate-400">
          {MONTH_KEYS.map((key) => (
            <span key={key}>
              <span className="xl:hidden">
                {t(`common.months.${key}`).charAt(0)}
              </span>
              <span className="hidden xl:inline">
                {t(`common.monthsShort.${key}`)}
              </span>
            </span>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500 leading-relaxed">
        {isLinear
          ? t("ui.heating.detail.prorationChartNoteLinear", {
              promille: linearAvgPromille,
            })
          : t("ui.heating.detail.prorationChartNoteDegreeDays")}
      </p>
    </div>
  );
};
