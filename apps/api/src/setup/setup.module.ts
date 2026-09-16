import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { TelemetryModule } from "../telemetry/telemetry.module.js";
import { SetupController } from "./setup.controller.js";
import { SetupService } from "./setup.service.js";

@Module({
  imports: [AuthModule, TelemetryModule],
  controllers: [SetupController],
  providers: [SetupService],
})
export class SetupModule {}
