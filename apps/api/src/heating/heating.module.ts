import { Module } from "@nestjs/common";
import { ExternalHeatingEntriesController } from "./external-heating-entries.controller.js";
import { ExternalHeatingEntriesService } from "./external-heating-entries.service.js";
import { HeatingController } from "./heating.controller.js";
import { HeatingService } from "./heating.service.js";
import { HeatingOverviewController } from "./heating-overview.controller.js";

@Module({
  controllers: [
    HeatingOverviewController,
    // Vor dem HeatingController registrieren: dessen ":id"-Route würde
    // sonst ".../heating/external-entries" abfangen (id = "external-entries").
    ExternalHeatingEntriesController,
    HeatingController,
  ],
  providers: [HeatingService, ExternalHeatingEntriesService],
  exports: [HeatingService, ExternalHeatingEntriesService],
})
export class HeatingModule {}
