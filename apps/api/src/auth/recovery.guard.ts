import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Request } from "express";
import { getI18n } from "../i18n/i18n.registry.js";
import { recoveryMode } from "./auth-mode.js";

export const RECOVERY_PATH = "/api/auth/recover";

/**
 * Im Rücksetz-Modus noch erreichbar: der Einrichtungs-Status (daran erkennt
 * das Frontend den Modus), die Passwort-Richtlinie fürs Formular, das
 * Zurücksetzen selbst und der Health-Check (sonst meldet Docker den Container
 * als ungesund).
 */
const ALLOWED_IN_RECOVERY = new Set([
  "/api/setup/status",
  "/api/auth/password-policy",
  "/api/health",
  RECOVERY_PATH,
]);

/**
 * Sperrt die API, solange der Rücksetz-Modus läuft, und versteckt umgekehrt
 * den Rücksetz-Endpunkt im Normalbetrieb. Die statischen Web-Assets laufen
 * nicht durch Guards, das Formular ist also weiterhin aufrufbar.
 */
@Injectable()
export class RecoveryGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { path } = context.switchToHttp().getRequest<Request>();

    if (!recoveryMode()) {
      if (path === RECOVERY_PATH) {
        throw new NotFoundException();
      }

      return true;
    }

    if (!ALLOWED_IN_RECOVERY.has(path)) {
      throw new ServiceUnavailableException(
        getI18n().t("errors.recoveryModeActive"),
      );
    }

    return true;
  }
}
