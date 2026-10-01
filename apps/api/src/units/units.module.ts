import { Module } from "@nestjs/common";
import { UnitSupplyExclusionsController } from "./unit-supply-exclusions.controller.js";
import { UnitSupplyExclusionsService } from "./unit-supply-exclusions.service.js";
import { UnitsController } from "./units.controller.js";
import { UnitsService } from "./units.service.js";

@Module({
  controllers: [UnitsController, UnitSupplyExclusionsController],
  providers: [UnitsService, UnitSupplyExclusionsService],
  exports: [UnitsService],
})
export class UnitsModule {}
