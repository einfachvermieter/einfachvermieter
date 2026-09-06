import { translateMessageKey } from "@einfachvermieter/i18n";
import {
  type ArgumentMetadata,
  Injectable,
  type PipeTransform,
} from "@nestjs/common";
import type { ZodType } from "zod";
import { getI18n } from "../i18n/i18n.registry.js";
import { FieldValidationException } from "./field-validation.exception.js";

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  /**
   * Parst den Wert gegen das Schema, liefert bei Erfolg die typisierten Daten
   * und wirft sonst eine `FieldValidationException` mit den Feldpfaden.
   */
  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const i18n = getI18n();
      throw new FieldValidationException(
        result.error.issues.map((issue) => ({
          // zod 4 typed `path` als `PropertyKey[]`. Validierungspfade enthalten
          // nie Symbole, daher auf string/number einengen.
          path: issue.path.filter(
            (segment): segment is string | number =>
              typeof segment === "string" || typeof segment === "number",
          ),
          message: translateMessageKey(i18n, issue.message),
        })),
      );
    }

    return result.data;
  }
}
