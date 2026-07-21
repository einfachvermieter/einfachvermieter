import { createHash, randomBytes } from "node:crypto";
import { SessionSchema, UserSchema } from "@einfachvermieter/db";
import { EntityManager } from "@mikro-orm/core";
import { Injectable, Logger } from "@nestjs/common";
import type { AuthUser } from "./auth.service.js";
import { SESSION_TTL_MS } from "./const.js";

/**
 * Ablaufzeitpunkt einer Session: der nächste 03:00-UTC-Zeitpunkt,
 * aber mindestens `minHours` entfernt (Session-Ende besser nachts).
 */
const nextNightlyExpiry = (minHours: number, hour = 3): Date => {
  const floor = new Date(Date.now() + minHours * 3_600_000);

  const expiry = new Date(floor);
  expiry.setUTCHours(hour, 0, 0, 0);

  if (expiry <= floor) {
    expiry.setUTCDate(expiry.getUTCDate() + 1);
  }

  return expiry;
};

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(private readonly em: EntityManager) {}

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  /**
   * Session anlegen; liefert Token und Ablaufdatum (für das passende Cookie).
   * `persistent` (Default) läuft rund `SESSION_TTL_MS` später ab, ohne rund
   * 6 h, Beide auf 03 Uhr nachts gerundet.
   */
  async create(
    userId: string,
    persistent = true,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = nextNightlyExpiry(
      persistent ? SESSION_TTL_MS / 3_600_000 : 6,
    );

    const em = this.em.fork();

    // Abgelaufenen Sessions aufräumen
    await em.nativeDelete(SessionSchema, {
      expiresAt: { $lte: new Date().toISOString() },
    });

    const session = em.create(SessionSchema, {
      id: this.hashToken(token),
      userId,
      expiresAt: expiresAt.toISOString(),
    });

    em.persist(session);
    await em.flush();

    return { token, expiresAt };
  }

  /**
   * Löst einen Cookie-Token zur aktuellen Identität auf. Liefert `null`, wenn
   * keine gültige Session existiert (unbekannt, abgelaufen oder User gelöscht)
   */
  async resolveUser(token: string): Promise<AuthUser | null> {
    const em = this.em.fork();

    const session = await em.findOne(SessionSchema, {
      id: this.hashToken(token),
    });
    if (!session) {
      return null;
    }

    // Session abgelaufen
    if (session.expiresAt <= new Date().toISOString()) {
      em.remove(session);
      await em.flush();
      return null;
    }

    // Kein passender User zum Session-User
    const user = await em.findOne(UserSchema, { id: session.userId });
    if (!user) {
      em.remove(session);
      await em.flush();
      return null;
    }

    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      residentId: user.residentId,
    };
  }

  /**
   * Session löschen (logout)
   */
  async destroy(token: string): Promise<void> {
    // Fehler nicht durchreichen, nur loggen: Der Client verliert das Cookie ohnehin
    try {
      await this.em.fork().nativeDelete(SessionSchema, {
        id: this.hashToken(token),
      });
    } catch (error) {
      this.logger.error(
        "Session konnte beim Logout nicht gelöscht werden",
        error,
      );
    }
  }
}
