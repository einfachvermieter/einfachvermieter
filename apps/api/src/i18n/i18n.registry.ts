import type { I18nInstance } from "@einfachvermieter/i18n";

let instance: I18nInstance | null = null;

export const setI18n = (i18n: I18nInstance): void => {
  instance = i18n;
};

/**
 * Liefert die global registrierte i18n-Instanz fuer Code ausserhalb der
 * Nest-DI (Helper, Exceptions)
 */
export const getI18n = (): I18nInstance => {
  if (!instance) {
    throw new Error("i18n instance not initialised, I18nModule not loaded");
  }
  return instance;
};
