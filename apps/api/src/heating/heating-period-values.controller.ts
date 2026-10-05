import {
  type HeatingPeriodValuesWriteDto,
  heatingPeriodValuesWriteSchema,
  isoDate,
} from "@einfachvermieter/shared";
import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { Roles, RolesGuard, SessionAuthGuard } from "../auth/auth.guards.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { HeatingPeriodValuesService } from "./heating-period-values.service.js";

const periodQuerySchema = z.object({
  periodStart: isoDate(),
  periodEnd: isoDate(),
});

@Controller("buildings/:buildingId/heating/period-values")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("admin")
export class HeatingPeriodValuesController {
  constructor(private readonly service: HeatingPeriodValuesService) {}

  @Get()
  get(
    @Param("buildingId") buildingId: string,
    @Query(new ZodValidationPipe(periodQuerySchema))
    query: z.infer<typeof periodQuerySchema>,
  ) {
    return this.service.get(buildingId, {
      start: query.periodStart,
      end: query.periodEnd,
    });
  }

  @Put()
  put(
    @Param("buildingId") buildingId: string,
    @Body(new ZodValidationPipe(heatingPeriodValuesWriteSchema))
    dto: HeatingPeriodValuesWriteDto,
  ) {
    return this.service.put(buildingId, dto);
  }
}
