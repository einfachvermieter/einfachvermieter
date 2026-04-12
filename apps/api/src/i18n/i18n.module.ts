import {
  createI18n,
  type I18nInstance,
  i18nZodErrorMap,
} from "@einfachvermieter/i18n";
import { Global, Module } from "@nestjs/common";
import { z } from "zod";
import { setI18n } from "./i18n.registry.js";

export const I18N = Symbol("I18N");

@Global()
@Module({
  providers: [
    {
      provide: I18N,
      useFactory: async (): Promise<I18nInstance> => {
        const instance = await createI18n();
        setI18n(instance);
        z.config({ customError: i18nZodErrorMap });
        return instance;
      },
    },
  ],
  exports: [I18N],
})
export class I18nModule {}
