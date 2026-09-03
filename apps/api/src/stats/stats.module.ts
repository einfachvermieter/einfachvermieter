import { Module } from "@nestjs/common";
import { AccountsModule } from "../accounts/accounts.module.js";
import { DashboardService } from "./dashboard.service.js";
import { StatsController } from "./stats.controller.js";
import { StatsService } from "./stats.service.js";

@Module({
  imports: [AccountsModule],
  controllers: [StatsController],
  providers: [StatsService, DashboardService],
})
export class StatsModule {}
