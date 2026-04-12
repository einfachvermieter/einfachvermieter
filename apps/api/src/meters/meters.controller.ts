import {
  type MeterCreateDto,
  type MeterReadingCreateDto,
  type MeterReadingUpdateDto,
  type MeterUpdateDto,
  meterCreateSchema,
  meterReadingCreateSchema,
  meterReadingUpdateSchema,
  meterUpdateSchema,
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
  UseGuards,
} from "@nestjs/common";
import { Roles, RolesGuard, SessionAuthGuard } from "../auth/auth.guards.js";
import { parsePaginationQuery } from "../common/pagination.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { MetersService } from "./meters.service.js";

@Controller("meters")
@UseGuards(SessionAuthGuard, RolesGuard)
export class MetersController {
  constructor(private readonly metersService: MetersService) {}

  @Get()
  list(
    @Query("buildingId") buildingId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("sort") sort?: string,
    @Query("order") order?: string,
    @Query("q") q?: string,
  ) {
    const allowedSort = new Set(["label", "type", "role"] as const);

    return this.metersService.list({
      buildingId,
      ...parsePaginationQuery({ page, pageSize, sort, order, q }, allowedSort),
    });
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.metersService.get(id);
  }

  @Post()
  @Roles("admin")
  create(@Body(new ZodValidationPipe(meterCreateSchema)) dto: MeterCreateDto) {
    return this.metersService.create(dto);
  }

  @Patch(":id")
  @Roles("admin")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(meterUpdateSchema)) dto: MeterUpdateDto,
  ) {
    return this.metersService.update(id, dto);
  }

  @Delete(":id")
  @Roles("admin")
  delete(@Param("id") id: string) {
    return this.metersService.delete(id);
  }

  @Patch(":id/deactivate")
  @Roles("admin")
  deactivate(@Param("id") id: string) {
    return this.metersService.deactivate(id);
  }

  @Get(":id/readings")
  listReadings(@Param("id") meterId: string) {
    return this.metersService.listReadings(meterId);
  }

  @Post("readings")
  @Roles("admin")
  createReading(
    @Body(new ZodValidationPipe(meterReadingCreateSchema))
    dto: MeterReadingCreateDto,
  ) {
    return this.metersService.createReading(dto);
  }

  @Patch("readings/:id")
  @Roles("admin")
  updateReading(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(meterReadingUpdateSchema))
    dto: MeterReadingUpdateDto,
  ) {
    return this.metersService.updateReading(id, dto);
  }

  @Delete("readings/:id")
  @Roles("admin")
  deleteReading(@Param("id") id: string) {
    return this.metersService.deleteReading(id);
  }
}
