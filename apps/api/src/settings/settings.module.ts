import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module.js";
import { TelemetryModule } from "../telemetry/telemetry.module.js";
import { SettingsController } from "./settings.controller.js";
import { SettingsService } from "./settings.service.js";

@Module({
  imports: [StorageModule, TelemetryModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
