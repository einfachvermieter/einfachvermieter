import { Controller, Get } from "@nestjs/common";
import { recoveryMode } from "../auth/auth-mode.js";
import { databaseNewerThanApp } from "../updates/database-version-guard.js";
import { migrationFailure } from "../updates/migration-guard.js";

/**
 * Grund, aus dem die App gesperrt ist (siehe AppLockGuard)
 */
const lockReason = (): string | null => {
  if (migrationFailure()) {
    return "migrationFailed";
  }

  if (databaseNewerThanApp()) {
    return "databaseNewerThanApp";
  }

  return recoveryMode() ? "recovery" : null;
};

/**
 * Sagt nur, ob der API-Prozess läuft und ausliefert, nicht ob die Anwendung
 * benutzbar ist. Eine gesperrte App antwortet deshalb mit 200: Sie muss die
 * Sperrseite ausliefern, und ein Reverse-Proxy nähme einen ungesunden
 * Container aus dem Verkehr. Die Sperre steht im Rumpf.
 */
@Controller("health")
export class HealthController {
  @Get()
  check() {
    const reason = lockReason();

    return {
      status: reason ? "locked" : "ok",
      ...(reason ? { reason } : {}),
      timestamp: new Date().toISOString(),
    };
  }
}
