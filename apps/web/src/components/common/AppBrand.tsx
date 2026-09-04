import logoDarkUrl from "../../img/logo/logo_dark.svg";
import logoLightUrl from "../../img/logo/logo_light.svg";
import { t } from "../../lib/i18n";

/**
 * Logo und Wortmarke in Bricolage: weiß auf der dunklen Sidebar, dunkel auf
 * den weißen Seiten außerhalb der App (Anmeldung, Einrichtung, Hinweise).
 * Das Logo gibt es in zwei Fassungen; auf dunklem Grund die mit den helleren
 * Grüntönen.
 */
export const AppBrand = ({ tone = "dark" }: { tone?: "light" | "dark" }) => (
  <div className="flex items-center gap-2.5">
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
  </div>
);
