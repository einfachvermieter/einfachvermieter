import { Module } from "@nestjs/common";
import { ExternalHeatingEntriesController } from "./external-heating-entries.controller.js";
import { ExternalHeatingEntriesService } from "./external-heating-entries.service.js";
import { HeatingController } from "./heating.controller.js";
import { HeatingService } from "./heating.service.js";
import { HeatingOverviewController } from "./heating-overview.controller.js";

@Module({
  controllers: [
    HeatingOverviewController,
    HeatingController,
    ExternalHeatingEntriesController,
  ],
  providers: [HeatingService, ExternalHeatingEntriesService],
  exports: [HeatingService, ExternalHeatingEntriesService],
})
export class HeatingModule {}
