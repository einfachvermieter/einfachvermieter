import { createI18nSync, createTranslate } from "@einfachvermieter/i18n";

const i18n = createI18nSync();
export const t = createTranslate(i18n);
