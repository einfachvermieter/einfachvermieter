import type { CalcWarning, DiagnosticParams } from "../types/index.js";

export type { CalcWarning, DiagnosticParams };

export class CalculationError extends Error {
  readonly code: string;
  readonly params?: DiagnosticParams;

  constructor(code: string, params?: DiagnosticParams) {
    super(`CalculationError: ${code}`);

    this.name = "CalculationError";
    this.code = code;
    this.params = params;
  }
}
