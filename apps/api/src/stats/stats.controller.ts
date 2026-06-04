import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Roles, RolesGuard, SessionAuthGuard } from "../auth/auth.guards.js";
import { StatsService } from "./stats.service.js";

@Controller("stats")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("admin")
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  overview(@Query("buildingId") buildingId?: string) {
    return this.statsService.overview(buildingId);
  }
}
