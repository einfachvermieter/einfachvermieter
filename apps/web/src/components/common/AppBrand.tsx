import logoUrl from "../../img/logo/logo.svg";
import { t } from "../../lib/i18n";

/**
 * Logo und Wortmarke in Bricolage: weiß auf der dunklen Sidebar, dunkel auf
 * den weißen Seiten außerhalb der App (Anmeldung, Einrichtung, Hinweise)
 */
export const AppBrand = ({ tone = "dark" }: { tone?: "light" | "dark" }) => (
  <div className="flex items-center gap-2.5">
    <img src={logoUrl} alt="" className="size-8 shrink-0" />
    <span
      className={
        tone === "dark"
          ? "truncate font-heading text-lg font-semibold tracking-heading text-white"
          : "truncate font-heading text-lg font-semibold tracking-heading text-foreground"
      }
    >
      {t("common.appName.Einfach")}
      {t("common.appName.Vermieter")}
    </span>
  </div>
);
