import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { RolesGuard, SessionAuthGuard } from "../auth/auth.guards.js";
import { parsePaginationQuery } from "../common/pagination.js";
import { HeatingService, type HeatingSort } from "./heating.service.js";

const ALLOWED_SORTS: ReadonlySet<HeatingSort> = new Set([
  "building",
  "mode",
  "validFrom",
]);

/**
 * Paginierte Übersicht aller Gebäude mit ihrer Heizkostenkonfiguration
 */
@Controller("heating")
@UseGuards(SessionAuthGuard, RolesGuard)
export class HeatingOverviewController {
  constructor(private readonly heatingService: HeatingService) {}

  /**
   * Liefert eine Version per ID, ohne buildingId-Constraint
   */
  @Get(":id")
  getById(@Param("id") id: string) {
    return this.heatingService.getByIdGlobal(id);
  }

  @Get()
  list(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("sort") sort?: string,
    @Query("order") order?: string,
    @Query("q") q?: string,
    @Query("buildingId") buildingId?: string,
  ) {
    return this.heatingService.list({
      ...parsePaginationQuery(
        { page, pageSize, sort, order, q },
        ALLOWED_SORTS,
      ),
      buildingId: buildingId?.trim() || undefined,
    });
  }
}
