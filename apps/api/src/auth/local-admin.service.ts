import { hashPassword, UserSchema } from "@einfachvermieter/db";
import { EntityManager } from "@mikro-orm/core";
import { Injectable, type OnModuleInit } from "@nestjs/common";
import type { AuthUser } from "./auth.service.js";
import { authMode } from "./auth-mode.js";

/**
 * E-Mail-Kennung des automatisch angelegten Desktop-Admins
 */
export const LOCAL_ADMIN_EMAIL = "local.admin@einfachvermieter.invalid";

/**
 * Verwaltet den festen Admin-Benutzer des `local`-Auth-Modus. Es ist ein
 * echter Datensatz mit Zufallspasswort statt einer virtuellen Identität.
 */
@Injectable()
export class LocalAdminService implements OnModuleInit {
  private cached: AuthUser | null = null;

  constructor(private readonly em: EntityManager) {}

  async onModuleInit(): Promise<void> {
    // Beim Start anlegen
    if (authMode() === "local") {
      await this.ensure();
    }
  }

  /**
   * Liefert den lokalen Admin und legt ihn beim ersten Aufruf an.
   */
  async ensure(): Promise<AuthUser> {
    if (this.cached) {
      return this.cached;
    }

    // Läuft auch außerhalb eines Request-Kontexts (onModuleInit) -> fork
    const em = this.em.fork();
    let user = await em.findOne(UserSchema, { email: LOCAL_ADMIN_EMAIL });
    if (!user) {
      user = em.create(UserSchema, {
        email: LOCAL_ADMIN_EMAIL,
        passwordHash: await hashPassword(crypto.randomUUID()),
        role: "admin",
        residentId: null,
      });
      em.persist(user);
      await em.flush();
    }

    this.cached = {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: "admin",
      residentId: null,
    };

    return this.cached;
  }
}
