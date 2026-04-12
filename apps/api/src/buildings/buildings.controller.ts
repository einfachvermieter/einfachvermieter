import {
  type BuildingCreateDto,
  type BuildingUpdateDto,
  buildingCreateSchema,
  buildingUpdateSchema,
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
import { BuildingsService } from "./buildings.service.js";

@Controller("buildings")
@UseGuards(SessionAuthGuard, RolesGuard)
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Get()
  list(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("sort") sort?: string,
    @Query("order") order?: string,
    @Query("q") q?: string,
  ) {
    const allowedSort = new Set([
      "name",
      "addressStreet",
      "addressPostalCode",
      "addressCity",
    ] as const);

    return this.buildingsService.list(
      parsePaginationQuery({ page, pageSize, sort, order, q }, allowedSort),
    );
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.buildingsService.get(id);
  }

  @Post()
  @Roles("admin")
  create(
    @Body(new ZodValidationPipe(buildingCreateSchema)) dto: BuildingCreateDto,
  ) {
    return this.buildingsService.create(dto);
  }

  @Patch(":id")
  @Roles("admin")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(buildingUpdateSchema)) dto: BuildingUpdateDto,
  ) {
    return this.buildingsService.update(id, dto);
  }

  @Delete(":id")
  @Roles("admin")
  delete(@Param("id") id: string) {
    return this.buildingsService.delete(id);
  }
}
