import {
  makeSetupSchema,
  passwordPolicyFromEnv,
  type SetupDto,
} from "@einfachvermieter/shared";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { setAuthCookie } from "../auth/auth-cookie.js";
import { authMode } from "../auth/auth-mode.js";
import { SessionService } from "../auth/session.service.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { SetupService } from "./setup.service.js";

/**
 * Erststart-Einrichtung. Bewusst ohne `SessionAuthGuard` (vor der Einrichtung
 * gibt es keinen Benutzer). Der Schreib-Endpoint ist im Service hart gesperrt,
 * sobald ein Benutzer existiert, und zusätzlich rate-limitiert.
 */
@Controller("setup")
export class SetupController {
  constructor(
    private readonly setupService: SetupService,
    private readonly sessionService: SessionService,
  ) {}

  @Get("status")
  status() {
    return this.setupService.getStatus();
  }

  // Strikt limitiert: legt Argon2-Hashes an und ist unauthentifiziert.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post()
  @HttpCode(HttpStatus.OK)
  async run(
    @Body(
      new ZodValidationPipe(
        makeSetupSchema(passwordPolicyFromEnv(process.env), {
          requireAdmin: authMode() !== "local",
        }),
      ),
    )
    dto: SetupDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = await this.setupService.runSetup(dto);

    // Direkt einloggen, gleiches Cookie wie beim regulären Login. Im
    // `local`-Modus gibt es keine Sessions; jede Request ist lokaler Admin
    if (authMode() !== "local") {
      const { token, expiresAt } = await this.sessionService.create(user.id);
      setAuthCookie(response, token, expiresAt);
    }

    return { user };
  }
}
