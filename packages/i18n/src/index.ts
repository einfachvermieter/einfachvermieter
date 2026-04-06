export {
  createI18n,
  createI18nSync,
  DEFAULT_LOCALE,
  type I18nInstance,
  type Locale,
} from "./instance.js";
export { deTranslations, type Translations } from "./locales/de.js";
export {
  type MessageKey,
  messageKey,
  parseMessageKey,
} from "./messageKey.js";
export {
  createTranslate,
  type TranslateFn,
  translateMessageKey,
} from "./translate.js";
export { i18nZodErrorMap } from "./zodErrorMap.js";
