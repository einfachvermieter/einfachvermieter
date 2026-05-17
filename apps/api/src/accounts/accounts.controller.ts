import {
  type AccountFeeCreateDto,
  type AccountFeeUpdateDto,
  accountFeeCreateSchema,
  accountFeeUpdateSchema,
  isoDate,
  todayIso,
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
import { z } from "zod";
import { Roles, RolesGuard, SessionAuthGuard } from "../auth/auth.guards.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AccountsService } from "./accounts.service.js";

const balancesQuerySchema = z.object({
  asOf: isoDate().optional(),
  buildingId: z.string().min(1).optional(),
});

const asOfQuerySchema = z.object({ asOf: isoDate().optional() });

const monthGridQuerySchema = z.object({ from: isoDate(), to: isoDate() });

@Controller("accounts")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("admin")
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get("balances")
  getAllBalances(
    @Query(new ZodValidationPipe(balancesQuerySchema))
    query: z.infer<typeof balancesQuerySchema>,
  ) {
    const date = query.asOf ?? todayIso();
    return this.accountsService.getAllBalances(date, query.buildingId);
  }

  @Get(":tenantId/balance")
  getBalance(
    @Param("tenantId") tenantId: string,
    @Query(new ZodValidationPipe(asOfQuerySchema))
    query: z.infer<typeof asOfQuerySchema>,
  ) {
    const date = query.asOf ?? todayIso();
    return this.accountsService.getTenantBalance(tenantId, date);
  }

  @Get(":tenantId/months")
  getMonthGrid(
    @Param("tenantId") tenantId: string,
    @Query(new ZodValidationPipe(monthGridQuerySchema))
    query: z.infer<typeof monthGridQuerySchema>,
  ) {
    return this.accountsService.getMonthGrid(tenantId, query.from, query.to);
  }

  @Get(":tenantId/settlements")
  getSettlements(@Param("tenantId") tenantId: string) {
    return this.accountsService.getSettlementRows(tenantId);
  }

  @Get(":tenantId/deposit")
  getDeposit(@Param("tenantId") tenantId: string) {
    return this.accountsService.getDepositRow(tenantId);
  }

  @Get(":tenantId/fees")
  getFees(@Param("tenantId") tenantId: string) {
    return this.accountsService.getFeeRows(tenantId);
  }

  @Post("fees")
  @Roles("admin")
  createFee(
    @Body(new ZodValidationPipe(accountFeeCreateSchema))
    dto: AccountFeeCreateDto,
  ) {
    return this.accountsService.createFee(dto);
  }

  @Patch("fees/:id")
  @Roles("admin")
  updateFee(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(accountFeeUpdateSchema))
    dto: AccountFeeUpdateDto,
  ) {
    return this.accountsService.updateFee(id, dto);
  }

  @Delete("fees/:id")
  @Roles("admin")
  deleteFee(@Param("id") id: string) {
    return this.accountsService.deleteFee(id);
  }
}
