import { createHash, timingSafeEqual } from "node:crypto";
import { recoveryCode } from "./auth-mode.js";

/**
 * Ein Rücksetzen pro Prozess. Der Betreiber soll die Umgebungsvariable danach
 * entfernen und neu starten; bis dahin bleibt das Formular verschlossen,
 * damit ein offenes Fenster nicht mehrfach genutzt werden kann.
 */
let used = false;

export const isRecoveryUsed = (): boolean => used;

export const markRecoveryUsed = (): void => {
  used = true;
};

/**
 * Prüft den Code aus dem Formular gegen den Wert von `PASSWORD_RESET`.
 * Vergleich über Hashes, weil `timingSafeEqual` gleiche Längen verlangt.
 */
export const isRecoveryCodeValid = (input: string): boolean => {
  const expected = createHash("sha256").update(recoveryCode()).digest();
  const provided = createHash("sha256").update(input.trim()).digest();

  return timingSafeEqual(expected, provided);
};
