/**
 * Einheitliches Fehlerformat für Feld-Validierung. Wird vom Backend
 * für Zod-Schema-Verstöße und für fachliche Prüfungen (Unique-Constraints,
 * Cross-Field-Regeln) genutzt. Das Frontend mappt `path` sodass
 * Server-Fehler wie Client-Schema-Fehler inline am Feld erscheinen.
 *
 * Regel: `path: []` bezeichnet einen Formular-übergreifenden Fehler
 * (z. B. Netzwerkproblem, nicht einem Feld zuzuordnen) und wird als
 * Top-Level-Alert dargestellt.
 */
export type FieldValidationError = {
  path: (string | number)[];
  message: string;
};

export const FIELD_VALIDATION_ERROR = "FieldValidationError" as const;

export type FieldValidationErrorResponse = {
  statusCode: number;
  error: typeof FIELD_VALIDATION_ERROR;
  errors: FieldValidationError[];
};

export const isFieldValidationErrorResponse = (
  value: unknown,
): value is FieldValidationErrorResponse =>
  typeof value === "object" &&
  value !== null &&
  "error" in value &&
  (value as { error: unknown }).error === FIELD_VALIDATION_ERROR &&
  Array.isArray((value as { errors?: unknown }).errors);
