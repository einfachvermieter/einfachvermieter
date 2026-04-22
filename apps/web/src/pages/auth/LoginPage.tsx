import logoUrl from "../../img/logo/logo.svg";
import { t } from "../../lib/i18n";
import { LoginForm } from "./LoginForm";

export const LoginPage = () => (
  <div className="grid min-h-dvh bg-white md:grid-cols-2">
    <div className="flex flex-col items-center justify-center gap-16 p-6 md:p-10">
      <div className="flex items-center gap-3 font-medium">
        <img src={logoUrl} alt="" className="size-12" />
        <span className="font-heading font-bold text-3xl">
          <span className="text-sky-700">{t("common.appName.Einfach")}</span>
          <span className="text-teal-600">{t("common.appName.Vermieter")}</span>
        </span>
      </div>
      <div className="w-full max-w-xs">
        <LoginForm />
      </div>
    </div>
    <div className="relative hidden bg-muted md:block">
      <img
        src="/apartment-1024.jpg"
        srcSet="/apartment-512.jpg 512w, /apartment-768.jpg 768w, /apartment-1024.jpg 1024w"
        sizes="50vw"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 size-full object-cover"
      />
    </div>
  </div>
);
