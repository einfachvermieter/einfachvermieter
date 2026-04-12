import { Module } from "@nestjs/common";
import { BuildingsController } from "./buildings.controller.js";
import { BuildingsService } from "./buildings.service.js";

@Module({
  controllers: [BuildingsController],
  providers: [BuildingsService],
  exports: [BuildingsService],
})
export class BuildingsModule {}
