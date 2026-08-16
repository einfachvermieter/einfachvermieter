/**
 * Auth-Modus der Instanz. `session` (Default) verlangt den Cookie-Login;
 * `local` ist für die Desktop-App gedacht: jeder Request gilt als lokaler
 * Admin, der Zugriffsschutz kommt dort vom Loopback-Token des
 * Electron-Main-Prozesses.
 */
export type AuthMode = "session" | "local";

export const authMode = (): AuthMode =>
  process.env.AUTH_MODE === "local" ? "local" : "session";

/**
 * Rücksetz-Modus: Ist `PASSWORD_RESET` mit einem Wert belegt, startet die
 * Instanz nur mit dem Formular für ein neues Passwort, alles andere ist
 * gesperrt. So kommt ein ausgesperrter Betreiber ohne Datenbank-Zugriff
 * wieder herein, und die Sperre erzwingt, dass die Variable danach wieder
 * entfernt wird. Der Wert selbst ist der Code, den das Formular verlangt.
 */
export const recoveryCode = (): string =>
  process.env.PASSWORD_RESET?.trim() ?? "";

export const recoveryMode = (): boolean => recoveryCode().length > 0;
