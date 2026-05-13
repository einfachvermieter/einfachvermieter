import { type TenantSaveDto, tenantSaveSchema } from "@einfachvermieter/shared";
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
import { TenantsService } from "./tenants.service.js";

@Controller("tenants")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("admin")
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  list(
    @Query("buildingId") buildingId?: string,
    @Query("unitId") unitId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("sort") sort?: string,
    @Query("order") order?: string,
    @Query("q") q?: string,
  ) {
    if (unitId) {
      return this.tenantsService.listByUnit(unitId);
    }
    const allowedSort = new Set([
      "unit",
      "building",
      "kind",
      "resident",
      "term",
      "rent",
      "status",
      "occupants",
    ] as const);
    return this.tenantsService.list({
      buildingId,
      ...parsePaginationQuery({ page, pageSize, sort, order, q }, allowedSort),
    });
  }

  @Get("links")
  listLinks() {
    return this.tenantsService.listLinks();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.tenantsService.getAggregate(id);
  }

  @Post()
  @Roles("admin")
  create(@Body(new ZodValidationPipe(tenantSaveSchema)) dto: TenantSaveDto) {
    return this.tenantsService.create(dto);
  }

  @Patch(":id")
  @Roles("admin")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(tenantSaveSchema)) dto: TenantSaveDto,
  ) {
    return this.tenantsService.update(id, dto);
  }

  @Delete(":id")
  @Roles("admin")
  delete(@Param("id") id: string) {
    return this.tenantsService.delete(id);
  }
}
