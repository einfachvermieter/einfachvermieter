import i18next, { type i18n as I18nInstance } from "i18next";
import { createIcuFormat } from "./icuFormat.js";
import { deTranslations } from "./locales/de.js";

export const DEFAULT_LOCALE = "de" as const;
export type Locale = typeof DEFAULT_LOCALE;

export const createI18nSync = (): I18nInstance => {
  const instance = i18next.createInstance();

  instance.use(createIcuFormat()).init({
    lng: DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [DEFAULT_LOCALE],
    resources: {
      [DEFAULT_LOCALE]: { translation: deTranslations },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
    initAsync: false,
  });

  return instance;
};

export const createI18n = async (): Promise<I18nInstance> => createI18nSync();

export type { I18nInstance };
