import logoUrl from "../../img/logo/logo.svg";
import { t } from "../../lib/i18n";

/**
 * Logo und App-Name nebeneinander. `lg` (zentriert) ist der Kopf der
 * Seiten außerhalb der App (Anmeldung, Passwort vergessen, Einrichtung),
 * `sm` (linksbündig, gekürzt) der Kopf der Seitenleiste
 */
export const AppBrand = ({ size = "lg" }: { size?: "lg" | "sm" }) =>
  size === "lg" ? (
    <div className="flex items-center justify-center gap-3">
      <img src={logoUrl} alt="" className="size-12" />
      <span className="font-heading font-bold text-3xl">
        <AppBrandName />
      </span>
    </div>
  ) : (
    <div className="flex h-12 items-center gap-2 px-2 pl-3.5">
      <img src={logoUrl} alt="" className="size-7 shrink-0" />
      <span className="max-w-48 truncate font-heading font-bold text-xl">
        <AppBrandName />
      </span>
    </div>
  );

const AppBrandName = () => (
  <>
    <span className="text-sky-700">{t("common.appName.Einfach")}</span>
    <span className="text-teal-600">{t("common.appName.Vermieter")}</span>
  </>
);
