import {
  type HeatingSettingsWriteDto,
  heatingSettingsWriteSchema,
  isoDate,
} from "@einfachvermieter/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { Roles, RolesGuard, SessionAuthGuard } from "../auth/auth.guards.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { HeatingService } from "./heating.service.js";

const atQuerySchema = z.object({ at: isoDate().optional() });

@Controller("buildings/:buildingId/heating")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("admin")
export class HeatingController {
  constructor(private readonly heatingService: HeatingService) {}

  /**
   * Liefert entweder alle Versionen (Liste) oder die zu einem Stichtag
   * gültige Version (`?at=YYYY-MM-DD`).
   */
  @Get()
  list(
    @Param("buildingId") buildingId: string,
    @Query(new ZodValidationPipe(atQuerySchema))
    query: z.infer<typeof atQuerySchema>,
  ) {
    if (query.at) {
      return this.heatingService.getForBuildingAt(buildingId, query.at);
    }

    return this.heatingService.listForBuilding(buildingId);
  }

  @Get(":id")
  getById(@Param("buildingId") buildingId: string, @Param("id") id: string) {
    return this.heatingService.getById(buildingId, id);
  }

  @Post()
  @Roles("admin")
  create(
    @Param("buildingId") buildingId: string,
    @Body(new ZodValidationPipe(heatingSettingsWriteSchema))
    dto: HeatingSettingsWriteDto,
  ) {
    return this.heatingService.create(buildingId, dto);
  }

  @Patch(":id")
  @Roles("admin")
  update(
    @Param("buildingId") buildingId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(heatingSettingsWriteSchema))
    dto: HeatingSettingsWriteDto,
  ) {
    return this.heatingService.update(buildingId, id, dto);
  }

  @Delete(":id")
  @Roles("admin")
  @HttpCode(204)
  async delete(
    @Param("buildingId") buildingId: string,
    @Param("id") id: string,
  ): Promise<void> {
    await this.heatingService.delete(buildingId, id);
  }
}
