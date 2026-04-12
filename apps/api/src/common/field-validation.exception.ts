import {
  FIELD_VALIDATION_ERROR,
  type FieldValidationError,
  type FieldValidationErrorResponse,
} from "@einfachvermieter/shared";
import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Wirft strukturierte Feld-Validierungsfehler im einheitlichen Format.
 *
 * Wird sowohl aus `ZodValidationPipe` (Schema-Verstöße) als auch aus
 * Services (fachliche Prüfungen wie Unique-Constraints) geworfen.
 *
 * Das Response-Body-Format ist das gleiche, sodass der Client nicht
 * unterscheiden muss, woher der Fehler kommt.
 */
export class FieldValidationException extends HttpException {
  constructor(errors: FieldValidationError[]) {
    const body: FieldValidationErrorResponse = {
      statusCode: HttpStatus.BAD_REQUEST,
      error: FIELD_VALIDATION_ERROR,
      errors,
    };

    super(body, HttpStatus.BAD_REQUEST);
  }
}
