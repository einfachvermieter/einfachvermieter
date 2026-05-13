import { Controller, Get, UseGuards } from "@nestjs/common";
import { Roles, RolesGuard, SessionAuthGuard } from "../auth/auth.guards.js";
import { StatsService } from "./stats.service.js";

@Controller("stats")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("admin")
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  overview() {
    return this.statsService.overview();
  }
}
