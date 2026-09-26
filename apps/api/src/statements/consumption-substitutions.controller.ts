import {
  type ConsumptionSubstitutionWriteDto,
  consumptionSubstitutionWriteSchema,
  isoDate,
  substitutionScopes,
} from "@einfachvermieter/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { Roles, RolesGuard, SessionAuthGuard } from "../auth/auth.guards.js";
import type { AuthUser } from "../auth/auth.service.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { ConsumptionSubstitutionsService } from "./consumption-substitutions.service.js";

const periodQuerySchema = z.object({
  periodStart: isoDate().optional(),
  periodEnd: isoDate().optional(),
});

const optionsQuerySchema = z.object({
  unitId: z.string().min(1),
  scope: z.enum(substitutionScopes),
  periodStart: isoDate(),
  periodEnd: isoDate(),
  meterIds: z.string().optional(),
});

const previewSchema = z.object({
  existingId: z.string().min(1).nullable(),
  substitution: consumptionSubstitutionWriteSchema,
});

@Controller()
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("admin")
export class ConsumptionSubstitutionsController {
  constructor(private readonly service: ConsumptionSubstitutionsService) {}

  @Get("buildings/:buildingId/consumption-substitutions")
  list(
    @Param("buildingId") buildingId: string,
    @Query(new ZodValidationPipe(periodQuerySchema))
    query: z.infer<typeof periodQuerySchema>,
  ) {
    return this.service.list(
      buildingId,
      query.periodStart && query.periodEnd
        ? { start: query.periodStart, end: query.periodEnd }
        : undefined,
    );
  }

  @Get("buildings/:buildingId/consumption-substitutions/options")
  options(
    @Param("buildingId") buildingId: string,
    @Query(new ZodValidationPipe(optionsQuerySchema))
    query: z.infer<typeof optionsQuerySchema>,
  ) {
    return this.service.options(
      buildingId,
      query.unitId,
      query.scope,
      { start: query.periodStart, end: query.periodEnd },
      query.meterIds ? query.meterIds.split(",").filter(Boolean) : [],
    );
  }

  @Post("buildings/:buildingId/consumption-substitutions/preview")
  preview(
    @Param("buildingId") buildingId: string,
    @Body(new ZodValidationPipe(previewSchema))
    body: z.infer<typeof previewSchema>,
  ) {
    return this.service.preview(buildingId, body.substitution, body.existingId);
  }

  @Post("buildings/:buildingId/consumption-substitutions")
  create(
    @Param("buildingId") buildingId: string,
    @Body(new ZodValidationPipe(consumptionSubstitutionWriteSchema))
    dto: ConsumptionSubstitutionWriteDto,
    @Req() req: Request,
  ) {
    return this.service.create(buildingId, dto, (req.user as AuthUser).userId);
  }

  @Patch("consumption-substitutions/:id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(consumptionSubstitutionWriteSchema))
    dto: ConsumptionSubstitutionWriteDto,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, (req.user as AuthUser).userId);
  }

  @Delete("consumption-substitutions/:id")
  delete(@Param("id") id: string) {
    return this.service.delete(id);
  }
}
