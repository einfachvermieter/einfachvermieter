import { createHash, randomBytes } from "node:crypto";
import { SessionSchema, UserSchema } from "@einfachvermieter/db";
import { EntityManager } from "@mikro-orm/core";
import { Injectable } from "@nestjs/common";
import type { AuthUser } from "./auth.service.js";
import { SESSION_TTL_MS } from "./const.js";

@Injectable()
export class SessionService {
  constructor(private readonly em: EntityManager) {}

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  /**
   * Session anlegen und Session-ID/Token zurückliefern
   */
  async create(userId: string): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    const em = this.em.fork();
    const session = em.create(SessionSchema, {
      id: this.hashToken(token),
      userId,
      expiresAt,
    });

    em.persist(session);
    await em.flush();

    return token;
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
      role: user.role,
      residentId: user.residentId,
    };
  }

  /**
   * Session löschen (logout)
   */
  async destroy(token: string): Promise<void> {
    await this.em.fork().nativeDelete(SessionSchema, {
      id: this.hashToken(token),
    });
  }
}
