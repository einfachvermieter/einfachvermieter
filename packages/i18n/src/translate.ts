import type { I18nInstance } from "./instance.js";
import { parseMessageKey } from "./messageKey.js";

export type TranslateFn = (
  key: string,
  params?: Record<string, unknown>,
) => string;

export const createTranslate =
  (instance: I18nInstance): TranslateFn =>
  (key, params) =>
    instance.t(key, params ?? {}) as string;

export const translateMessageKey = (
  instance: I18nInstance,
  raw: string,
): string => {
  const parsed = parseMessageKey(raw);
  if (!parsed) {
    return raw;
  }

  return instance.t(parsed.key, parsed.params ?? {}) as string;
};
