import logoDarkUrl from "../../img/logo/logo_dark.svg";
import logoLightUrl from "../../img/logo/logo_light.svg";
import { openBetaNotice, showBetaMarker } from "../../lib/appVersion";
import { t } from "../../lib/i18n";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/Badge";

/**
 * Logo und Wortmarke in Bricolage: dunkel auf hellem Grund (Fensterleiste,
 * Anmeldung, Einrichtung, Hinweise), weiß auf dunklem Grund.
 * Das Logo gibt es in zwei Fassungen; auf dunklem Grund die mit den helleren
 * Grüntönen.
 */
export const AppBrand = ({
  tone = "dark",
  stacked = false,
  size = "default",
}: {
  tone?: "light" | "dark";
  stacked?: boolean;

  /**
   * "sm": kleiner für die Fensterleiste
   */
  size?: "default" | "sm";
}) => {
  const badge = showBetaMarker ? (
    <button
      type="button"
      onClick={openBetaNotice}
      className={stacked ? "-mt-0.75 flex rounded-sm" : "flex rounded-sm"}
    >
      <Badge variant="beta">{t("ui.beta.badge")}</Badge>
    </button>
  ) : null;

  const brand = (
    <div
      className={cn(
        "flex max-w-full items-center",
        size === "sm" ? "gap-2" : "gap-2.5",
      )}
    >
      <img
        src={tone === "dark" ? logoDarkUrl : logoLightUrl}
        alt=""
        className={size === "sm" ? "size-6 shrink-0" : "size-8 shrink-0"}
      />
      <span
        className={cn(
          "truncate font-heading font-semibold tracking-heading",
          size === "sm" ? "text-lg max-md:sr-only" : "text-2xl",
          tone === "dark" ? "text-schiefer-50" : "text-foreground",
        )}
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
