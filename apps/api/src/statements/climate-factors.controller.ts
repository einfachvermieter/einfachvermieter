import {
  type ClimateFactorReloadDto,
  type ClimateFactorWriteDto,
  climateFactorReloadSchema,
  climateFactorWriteSchema,
} from "@einfachvermieter/shared";
import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Roles, RolesGuard, SessionAuthGuard } from "../auth/auth.guards.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { ClimateFactorService } from "./climate-factor.service.js";

/**
 * Klimafaktoren-Verwaltung für die Witterungsbereinigung (§ 6a Abs. 3
 * Nr. 5 HeizkostenV): Übersicht je Gebäude, manuelles Erfassen als
 * Notausgang ohne Internet und Neu-Laden vom DWD.
 */
@Controller("climate-factors")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("admin")
export class ClimateFactorsController {
  constructor(private readonly climateFactorService: ClimateFactorService) {}

  @Get()
  list(@Query("statementId") statementId: string) {
    return this.climateFactorService.listForStatement(statementId);
  }

  @Put()
  setManual(
    @Body(new ZodValidationPipe(climateFactorWriteSchema))
    dto: ClimateFactorWriteDto,
  ) {
    return this.climateFactorService.setManual(
      dto.buildingId,
      { start: dto.periodStart, end: dto.periodEnd },
      dto.factor,
    );
  }

  @Post("reload")
  reload(
    @Body(new ZodValidationPipe(climateFactorReloadSchema))
    dto: ClimateFactorReloadDto,
  ) {
    return this.climateFactorService.reloadFromDwd(dto.buildingId, {
      start: dto.periodStart,
      end: dto.periodEnd,
    });
  }
}
