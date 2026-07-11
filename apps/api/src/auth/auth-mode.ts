/**
 * Auth-Modus der Instanz. `session` (Default) verlangt den Cookie-Login;
 * `local` ist für die Desktop-App gedacht: jeder Request gilt als lokaler
 * Admin, der Zugriffsschutz kommt dort vom Loopback-Token des
 * Electron-Main-Prozesses.
 */
export type AuthMode = "session" | "local";

export const authMode = (): AuthMode =>
  process.env.AUTH_MODE === "local" ? "local" : "session";
