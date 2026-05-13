import {
  type ExternalHeatingEntryCreateDto,
  type ExternalHeatingEntryUpdateDto,
  externalHeatingEntryCreateSchema,
  externalHeatingEntryUpdateSchema,
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
import { ExternalHeatingEntriesService } from "./external-heating-entries.service.js";

@Controller()
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("admin")
export class ExternalHeatingEntriesController {
  constructor(private readonly service: ExternalHeatingEntriesService) {}

  @Get("buildings/:buildingId/heating/external-entries")
  list(@Param("buildingId") buildingId: string) {
    return this.service.listForBuilding(buildingId);
  }

  @Post("buildings/:buildingId/heating/external-entries")
  @Roles("admin")
  create(
    @Param("buildingId") buildingId: string,
    @Body(new ZodValidationPipe(externalHeatingEntryCreateSchema))
    dto: ExternalHeatingEntryCreateDto,
  ) {
    return this.service.create(buildingId, dto);
  }

  @Patch("heating/external-entries/:id")
  @Roles("admin")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(externalHeatingEntryUpdateSchema))
    dto: ExternalHeatingEntryUpdateDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete("heating/external-entries/:id")
  @Roles("admin")
  delete(@Param("id") id: string) {
    return this.service.delete(id);
  }
}
