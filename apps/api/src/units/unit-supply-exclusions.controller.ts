import {
  type UnitSupplyExclusionWriteDto,
  unitSupplyExclusionWriteSchema,
} from "@einfachvermieter/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Roles, RolesGuard, SessionAuthGuard } from "../auth/auth.guards.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { UnitSupplyExclusionsService } from "./unit-supply-exclusions.service.js";

@Controller()
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("admin")
export class UnitSupplyExclusionsController {
  constructor(private readonly service: UnitSupplyExclusionsService) {}

  @Get("units/:unitId/supply-exclusions")
  list(@Param("unitId") unitId: string) {
    return this.service.list(unitId);
  }

  @Post("units/:unitId/supply-exclusions")
  create(
    @Param("unitId") unitId: string,
    @Body(new ZodValidationPipe(unitSupplyExclusionWriteSchema))
    dto: UnitSupplyExclusionWriteDto,
  ) {
    return this.service.create(unitId, dto);
  }

  @Patch("unit-supply-exclusions/:id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(unitSupplyExclusionWriteSchema))
    dto: UnitSupplyExclusionWriteDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete("unit-supply-exclusions/:id")
  delete(@Param("id") id: string) {
    return this.service.delete(id);
  }
}
