import { hashPassword, SessionSchema, UserSchema } from "@einfachvermieter/db";
import type { PasswordChangeDto } from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import argon2 from "argon2";
import { FieldValidationException } from "../common/field-validation.exception.js";
import { getI18n } from "../i18n/i18n.registry.js";

export type AuthUser = {
  userId: string;
  email: string;
  role: "admin" | "resident";
  residentId: string | null;
};

@Injectable()
export class AuthService {
  constructor(private readonly em: EntityManager) {}

  async validateCredentials(email: string, password: string) {
    const user = await this.em.findOne(UserSchema, {
      email: email.toLowerCase(),
    });
    if (!user) {
      throw new UnauthorizedException(getI18n().t("errors.loginFailed"));
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException(getI18n().t("errors.loginFailed"));
    }

    return user;
  }

  async createUser(input: {
    email: string;
    password: string;
    role: "admin" | "resident";
    residentId?: string | null;
  }) {
    const passwordHash = await hashPassword(input.password);
    const created = this.em.create(UserSchema, {
      email: input.email.toLowerCase(),
      passwordHash,
      role: input.role,
      residentId: input.residentId ?? null,
    });

    this.em.persist(created);
    await this.em.flush();

    return created;
  }

  async changePassword(userId: string, dto: PasswordChangeDto) {
    const user = await this.em.findOne(UserSchema, { id: userId });
    if (!user) {
      throw new UnauthorizedException(getI18n().t("errors.sessionUserMissing"));
    }

    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new FieldValidationException([
        {
          path: ["currentPassword"],
          message: getI18n().t("errors.passwordCurrentWrong"),
        },
      ]);
    }

    this.em.assign(user, {
      passwordHash: await hashPassword(dto.newPassword),
      updatedAt: new Date().toISOString(),
    });

    // Alle bestehenden Sessions verwerfen
    await this.em.nativeDelete(SessionSchema, { userId });

    await this.em.flush();

    return { success: true };
  }
}
