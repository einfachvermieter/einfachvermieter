import logoUrl from "../../img/logo/logo.svg";
import { t } from "../../lib/i18n";

/**
 * Logo und App-Name nebeneinander
 */
export const AppBrand = () => (
  <div className="flex items-center gap-2">
    <img src={logoUrl} alt="" className="size-7 shrink-0" />
    <span className="truncate font-heading font-bold text-xl">
      <span className="text-sky-700">{t("common.appName.Einfach")}</span>
      <span className="text-teal-600">{t("common.appName.Vermieter")}</span>
    </span>
  </div>
);
