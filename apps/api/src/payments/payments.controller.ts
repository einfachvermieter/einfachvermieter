import {
  type PaymentCreateDto,
  type PaymentUpdateDto,
  paymentCreateSchema,
  paymentUpdateSchema,
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
import { PaymentsService } from "./payments.service.js";

@Controller("payments")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("admin")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  list(
    @Query("tenantId") tenantId?: string,
    @Query("buildingId") buildingId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("sort") sort?: string,
    @Query("order") order?: string,
    @Query("q") q?: string,
  ) {
    const allowedSort = new Set(["date", "amount", "reference"] as const);

    return this.paymentsService.listPaginated({
      tenantId,
      buildingId,
      ...parsePaginationQuery(
        { page, pageSize, sort, order, q },
        allowedSort,
        "desc",
      ),
    });
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.paymentsService.getById(id);
  }

  @Post()
  @Roles("admin")
  create(
    @Body(new ZodValidationPipe(paymentCreateSchema)) dto: PaymentCreateDto,
  ) {
    return this.paymentsService.create(dto);
  }

  @Patch(":id")
  @Roles("admin")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(paymentUpdateSchema)) dto: PaymentUpdateDto,
  ) {
    return this.paymentsService.update(id, dto);
  }

  @Delete(":id")
  @Roles("admin")
  delete(@Param("id") id: string) {
    return this.paymentsService.delete(id);
  }
}
