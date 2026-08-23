import { hashPassword, SessionSchema, UserSchema } from "@einfachvermieter/db";
import type {
  PasswordChangeDto,
  PasswordRecoveryDto,
  ProfileUpdateDto,
} from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import argon2 from "argon2";
import { FieldValidationException } from "../common/field-validation.exception.js";
import { getI18n } from "../i18n/i18n.registry.js";
import {
  isRecoveryCodeValid,
  isRecoveryUsed,
  markRecoveryUsed,
} from "./recovery-state.js";

export type AuthUser = {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
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

  async updateProfile(userId: string, dto: ProfileUpdateDto) {
    const user = await this.em.findOne(UserSchema, { id: userId });
    if (!user) {
      throw new UnauthorizedException(getI18n().t("errors.sessionUserMissing"));
    }

    const email = dto.email.toLowerCase();
    if (email !== user.email) {
      const taken = await this.em.findOne(UserSchema, { email });
      if (taken) {
        throw new FieldValidationException([
          { path: ["email"], message: getI18n().t("errors.emailTaken") },
        ]);
      }
    }

    this.em.assign(user, {
      email,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      updatedAt: new Date().toISOString(),
    });
    await this.em.flush();

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      residentId: user.residentId,
    };
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

  /**
   * Setzt das Passwort ohne Kenntnis des alten. Nur aus dem Rücksetz-Modus
   * heraus erreichbar (siehe RecoveryGuard), nur mit dem Code aus der
   * Umgebungsvariable und nur einmal pro Prozess. Verworfen werden alle
   * Sitzungen sämtlicher User.
   */
  async resetPassword(dto: PasswordRecoveryDto) {
    if (isRecoveryUsed()) {
      throw new ConflictException(getI18n().t("errors.recoveryAlreadyUsed"));
    }

    if (!isRecoveryCodeValid(dto.code)) {
      throw new FieldValidationException([
        {
          path: ["code"],
          message: getI18n().t("errors.recoveryCodeWrong"),
        },
      ]);
    }

    const user = await this.em.findOne(UserSchema, {
      email: dto.email.toLowerCase(),
      role: "admin",
    });
    if (!user) {
      throw new FieldValidationException([
        {
          path: ["email"],
          message: getI18n().t("errors.recoveryUserUnknown"),
        },
      ]);
    }

    this.em.assign(user, {
      passwordHash: await hashPassword(dto.newPassword),
      updatedAt: new Date().toISOString(),
    });
    await this.em.nativeDelete(SessionSchema, {});
    await this.em.flush();
    markRecoveryUsed();

    return { success: true };
  }
}
