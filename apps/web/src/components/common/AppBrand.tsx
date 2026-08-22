import logoUrl from "../../img/logo/logo.svg";
import { t } from "../../lib/i18n";

/**
 * Logo und App-Name nebeneinander, zentriert. Gemeinsamer Kopf der
 * Seiten außerhalb der App (Anmeldung, Passwort vergessen, Einrichtung)
 */
export const AppBrand = () => (
  <div className="flex items-center justify-center gap-3">
    <img src={logoUrl} alt="" className="size-12" />
    <span className="font-heading font-bold text-3xl">
      <span className="text-sky-700">{t("common.appName.Einfach")}</span>
      <span className="text-teal-600">{t("common.appName.Vermieter")}</span>
    </span>
  </div>
);
