import { Controller, Get, UseGuards } from "@nestjs/common";
import { Roles, RolesGuard, SessionAuthGuard } from "../auth/auth.guards.js";
import { UpdatesService } from "./updates.service.js";

/**
 * Versionsstand der Installation
 */
@Controller("updates")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("admin")
export class UpdatesController {
  constructor(private readonly updatesService: UpdatesService) {}

  @Get()
  status() {
    return this.updatesService.getStatus();
  }
}
