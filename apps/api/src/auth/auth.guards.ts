// biome-ignore lint/nursery/noExcessiveClassesPerFile: paired NestJS guards belong together
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { getI18n } from "../i18n/i18n.registry.js";
import type { AuthUser } from "./auth.service.js";
import { authMode } from "./auth-mode.js";
import { AUTH_COOKIE_NAME } from "./const.js";
import { LocalAdminService } from "./local-admin.service.js";
import { SessionService } from "./session.service.js";

/**
 * Authentifiziert Requests über das Session-Cookie: löst den Token zur
 * aktuellen Identität auf und hängt sie als `request.user` an. Ohne gültige
 * Session -> 401. Im `local`-Auth-Modus (Desktop-App) entfällt die
 * Cookie-Prüfung; jeder Request läuft als lokaler Admin.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly localAdmin: LocalAdminService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    if (authMode() === "local") {
      request.user = await this.localAdmin.ensure();

      return true;
    }

    const cookies = request.cookies as Record<string, string> | undefined;
    const token = cookies?.[AUTH_COOKIE_NAME];
    if (!token) {
      throw new UnauthorizedException();
    }

    const user = await this.sessions.resolveUser(token);
    if (!user) {
      throw new UnauthorizedException();
    }

    request.user = user;

    return true;
  }
}

export const ROLES_KEY = "roles";
export const Roles = (...roles: Array<"admin" | "resident">) =>
  SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<
      Array<"admin" | "resident"> | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!required || required.length === 0) {
      // Deny-by-default: @Roles muss am Endpunkt definiert sein.
      throw new ForbiddenException(
        getI18n().t("errors.insufficientPermission"),
      );
    }

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user) {
      throw new ForbiddenException(getI18n().t("errors.notAuthenticated"));
    }

    if (!required.includes(user.role)) {
      throw new ForbiddenException(
        getI18n().t("errors.insufficientPermission"),
      );
    }

    return true;
  }
}
