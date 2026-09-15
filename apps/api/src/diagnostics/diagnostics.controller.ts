import { Controller, Get, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { Roles, RolesGuard, SessionAuthGuard } from "../auth/auth.guards.js";
import { DiagnosticsService } from "./diagnostics.service.js";

@Controller("diagnostics")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("admin")
export class DiagnosticsController {
  constructor(private readonly diagnosticsService: DiagnosticsService) {}

  /**
   * Nur admin, denn auf einer Instanz mit mehreren Nutzern
   * steht im Protokoll, was alle gemacht haben
   */
  @Get("report")
  report(@Res({ passthrough: true }) response: Response): string {
    const fileName = this.diagnosticsService.fileName();

    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );

    return this.diagnosticsService.buildReport();
  }
}
