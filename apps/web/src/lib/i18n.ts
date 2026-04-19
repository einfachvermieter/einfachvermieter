import {
  createI18nSync,
  createTranslate,
  i18nZodErrorMap,
  type TranslateFn,
  translateMessageKey,
} from "@einfachvermieter/i18n";
import { z } from "zod";

export const i18n = createI18nSync();
z.config({ customError: i18nZodErrorMap });

export const t: TranslateFn = createTranslate(i18n);

export const translateKey = (raw: string | undefined | null): string =>
  raw ? translateMessageKey(i18n, raw) : "";
