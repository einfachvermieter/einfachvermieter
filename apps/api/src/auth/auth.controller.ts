import {
  makePasswordChangeSchema,
  type PasswordChangeDto,
  passwordPolicyFromEnv,
} from "@einfachvermieter/shared";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { z } from "zod";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { getI18n } from "../i18n/i18n.registry.js";
import { SessionAuthGuard } from "./auth.guards.js";
import { AuthService, type AuthUser } from "./auth.service.js";
import { clearAuthCookie, setAuthCookie } from "./auth-cookie.js";
import { AUTH_COOKIE_NAME } from "./const.js";
import { SessionService } from "./session.service.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().default(false),
});

type LoginDto = z.infer<typeof loginSchema>;

/**
 * Striktes Limit gegen Brute-Force + Argon2-DoS: 10 Versuche pro Minute
 * und IP (überschreibt das globale Limit)
 */
const PASSWORD_BRUTE_FORCE_LIMITS = { ttl: 60_000, limit: 10 };

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  @Throttle({ default: { ...PASSWORD_BRUTE_FORCE_LIMITS } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = await this.authService.validateCredentials(
      dto.email,
      dto.password,
    );

    // V1 ist Admin-only: resident-Logins werden abgelehnt
    if (user.role !== "admin") {
      throw new UnauthorizedException(
        getI18n().t("errors.residentLoginDisabled"),
      );
    }

    const { token, expiresAt } = await this.sessionService.create(
      user.id,
      dto.rememberMe,
    );
    // Ohne "angemeldet bleiben" ein Session-Cookie (kein Ablaufdatum), das der
    // Browser beim Schließen verwirft; die DB-Session läuft trotzdem nachts ab.
    setAuthCookie(response, token, dto.rememberMe ? expiresAt : undefined);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        residentId: user.residentId,
      },
    };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookies = request.cookies as Record<string, string> | undefined;
    const token = cookies?.[AUTH_COOKIE_NAME];

    if (token) {
      await this.sessionService.destroy(token);
    }

    clearAuthCookie(response);

    return { success: true };
  }

  @Get("me")
  @UseGuards(SessionAuthGuard)
  me(@Req() request: Request) {
    const user = request.user as AuthUser;

    return {
      user: {
        id: user.userId,
        email: user.email,
        role: user.role,
        residentId: user.residentId,
      },
    };
  }

  // Öffentlich: das Frontend (Setup/Passwort ändern) braucht die Regeln,
  // um dieselbe Validierung anzuzeigen und vorab zu prüfen.
  @Get("password-policy")
  passwordPolicy() {
    return passwordPolicyFromEnv(process.env);
  }

  @Throttle({ default: { ...PASSWORD_BRUTE_FORCE_LIMITS } })
  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  async changePassword(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body(
      new ZodValidationPipe(
        makePasswordChangeSchema(passwordPolicyFromEnv(process.env)),
      ),
    )
    dto: PasswordChangeDto,
  ) {
    const user = request.user as AuthUser;

    const result = await this.authService.changePassword(user.userId, dto);

    // changePassword verwirft alle Sessions des Users; dem ändernden Client
    // ein frisches Cookie ausstellen, damit er eingeloggt bleibt.
    const { token, expiresAt } = await this.sessionService.create(user.userId);
    setAuthCookie(response, token, expiresAt);

    return result;
  }
}
