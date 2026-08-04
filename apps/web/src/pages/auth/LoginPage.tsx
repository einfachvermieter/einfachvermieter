import logoUrl from "../../img/logo/logo.svg";
import { useDocumentTitle } from "../../lib/documentTitle";
import { t } from "../../lib/i18n";
import { LoginForm } from "./LoginForm";

export const LoginPage = () => {
  useDocumentTitle(t("ui.auth.login"));
  return (
    <div className="grid min-h-dvh grid-rows-[1fr_auto] max-md:[@media(min-height:780px)]:grid-rows-[556px_1fr] bg-white md:grid-cols-[min(480px,50%)_1fr] md:grid-rows-1">
      <div className="flex flex-col items-center justify-center gap-16 p-6 md:p-10">
        <div className="flex items-center gap-3 font-medium">
          <img
            src={logoUrl}
            alt=""
            className="size-12 max-[379px]:size-10 max-[329px]:size-8 md:max-[959px]:size-10"
          />
          <span className="font-heading font-bold text-3xl max-[379px]:text-2xl max-[329px]:text-xl md:max-[959px]:text-2xl">
            <span className="text-sky-700">{t("common.appName.Einfach")}</span>
            <span className="text-teal-600">
              {t("common.appName.Vermieter")}
            </span>
          </span>
        </div>
        <div className="w-full max-w-xs">
          <LoginForm />
        </div>
      </div>
      <div className="relative h-56 bg-muted max-md:[@media(max-height:699px)]:hidden max-md:[@media(min-height:780px)]:h-full md:h-auto">
        <img
          src="/login-house.webp"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover object-[80%_50%]"
        />
      </div>
    </div>
  );
};
