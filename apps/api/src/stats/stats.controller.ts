import { Controller, Get, UseGuards } from "@nestjs/common";
import { RolesGuard, SessionAuthGuard } from "../auth/auth.guards.js";
import { StatsService } from "./stats.service.js";

@Controller("stats")
@UseGuards(SessionAuthGuard, RolesGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  overview() {
    return this.statsService.overview();
  }
}
