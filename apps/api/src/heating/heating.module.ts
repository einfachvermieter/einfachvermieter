import { Module } from "@nestjs/common";
import { ExternalHeatingEntriesController } from "./external-heating-entries.controller.js";
import { ExternalHeatingEntriesService } from "./external-heating-entries.service.js";
import { HeatingController } from "./heating.controller.js";
import { HeatingService } from "./heating.service.js";
import { HeatingOverviewController } from "./heating-overview.controller.js";
import { HeatingPeriodValuesController } from "./heating-period-values.controller.js";
import { HeatingPeriodValuesService } from "./heating-period-values.service.js";

@Module({
  controllers: [
    HeatingOverviewController,
    // Vor dem HeatingController registrieren: dessen ":id"-Route würde
    // sonst ".../heating/external-entries" abfangen (id = "external-entries").
    // Dasselbe gilt für ".../heating/period-values".
    ExternalHeatingEntriesController,
    HeatingPeriodValuesController,
    HeatingController,
  ],
  providers: [
    HeatingService,
    ExternalHeatingEntriesService,
    HeatingPeriodValuesService,
  ],
  exports: [
    HeatingService,
    ExternalHeatingEntriesService,
    HeatingPeriodValuesService,
  ],
})
export class HeatingModule {}
