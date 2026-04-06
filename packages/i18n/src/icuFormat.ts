import type { i18n as I18nInstance } from "i18next";
import { IntlMessageFormat } from "intl-messageformat";

type I18nFormatModule = {
  type: "i18nFormat";
  init: (i18next: I18nInstance | null) => void;
  parse: (
    res: unknown,
    options: Record<string, unknown>,
    lng: string,
    ns: string,
    key: string,
  ) => unknown;
  addLookupKeys: (finalKeys: string[]) => string[];
};

export const createIcuFormat = (): I18nFormatModule => {
  const cache = new Map<string, IntlMessageFormat>();

  return {
    type: "i18nFormat",
    init: () => {
      // ICU-Formatierung braucht kein Setup, i18next verlangt diesen Hook
    },
    parse: (res, options, lng, ns, key) => {
      if (typeof res !== "string") {
        return res;
      }

      const cacheKey = `${lng}.${ns}.${key}`;
      let formatter = cache.get(cacheKey);
      if (!formatter) {
        try {
          formatter = new IntlMessageFormat(res, lng, undefined, {
            ignoreTag: true,
          });

          cache.set(cacheKey, formatter);
        } catch {
          return res;
        }
      }
      try {
        return formatter.format(options) as string;
      } catch {
        return res;
      }
    },
    addLookupKeys: (finalKeys) => finalKeys,
  };
};
