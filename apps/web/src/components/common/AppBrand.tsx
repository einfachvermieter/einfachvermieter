import logoDarkUrl from "../../img/logo/logo_dark.svg";
import logoLightUrl from "../../img/logo/logo_light.svg";
import { isPrerelease, openBetaNotice } from "../../lib/appVersion";
import { t } from "../../lib/i18n";
import { Badge } from "../ui/Badge";

/**
 * Logo und Wortmarke in Bricolage: weiß auf der dunklen Sidebar, dunkel auf
 * den weißen Seiten außerhalb der App (Anmeldung, Einrichtung, Hinweise).
 * Das Logo gibt es in zwei Fassungen; auf dunklem Grund die mit den helleren
 * Grüntönen.
 */
export const AppBrand = ({
  tone = "dark",
  stacked = false,
}: {
  tone?: "light" | "dark";
  stacked?: boolean;
}) => {
  const badge = isPrerelease ? (
    <button
      type="button"
      onClick={openBetaNotice}
      className={
        stacked
          ? "-mt-0.75 flex cursor-help rounded-full"
          : "flex cursor-help rounded-full"
      }
    >
      <Badge variant="warn">{t("ui.beta.badge")}</Badge>
    </button>
  ) : null;

  const brand = (
    <div className="flex max-w-full items-center gap-2.5">
      <img
        src={tone === "dark" ? logoDarkUrl : logoLightUrl}
        alt=""
        className="size-8 shrink-0"
      />
      <span
        className={
          tone === "dark"
            ? "truncate font-heading text-xl font-semibold tracking-heading text-schiefer-50"
            : "truncate font-heading text-xl font-semibold tracking-heading text-foreground"
        }
      >
        {t("common.appName.EinfachVermieter")}
      </span>
      {stacked ? null : badge}
    </div>
  );

  return stacked ? (
    <div className="flex min-w-0 flex-col items-end">
      {brand}
      {badge}
    </div>
  ) : (
    brand
  );
};
