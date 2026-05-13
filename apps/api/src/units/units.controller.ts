import {
  type UnitCreateDto,
  type UnitUpdateDto,
  unitCreateSchema,
  unitUpdateSchema,
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
import { UnitsService } from "./units.service.js";

@Controller("units")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("admin")
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get()
  list(
    @Query("buildingId") buildingId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("sort") sort?: string,
    @Query("order") order?: string,
    @Query("q") q?: string,
  ) {
    const allowedSort = new Set(["name", "areaSqm"] as const);
    return this.unitsService.list({
      buildingId,
      ...parsePaginationQuery({ page, pageSize, sort, order, q }, allowedSort),
    });
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.unitsService.get(id);
  }

  @Post()
  @Roles("admin")
  create(@Body(new ZodValidationPipe(unitCreateSchema)) dto: UnitCreateDto) {
    return this.unitsService.create(dto);
  }

  @Patch(":id")
  @Roles("admin")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(unitUpdateSchema)) dto: UnitUpdateDto,
  ) {
    return this.unitsService.update(id, dto);
  }

  @Delete(":id")
  @Roles("admin")
  delete(@Param("id") id: string) {
    return this.unitsService.delete(id);
  }
}
