import {
  type AccountFeeCreateDto,
  type AccountFeeUpdateDto,
  accountFeeCreateSchema,
  accountFeeUpdateSchema,
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
import { Roles, RolesGuard, SessionAuthGuard } from "../auth/auth.guards.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AccountsService } from "./accounts.service.js";

@Controller("accounts")
@UseGuards(SessionAuthGuard, RolesGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get("balances")
  getAllBalances(
    @Query("asOf") asOfDate?: string,
    @Query("buildingId") buildingId?: string,
  ) {
    const date = asOfDate ?? todayIso();
    return this.accountsService.getAllBalances(date, buildingId);
  }

  @Get(":tenantId/balance")
  getBalance(
    @Param("tenantId") tenantId: string,
    @Query("asOf") asOfDate?: string,
  ) {
    const date = asOfDate ?? todayIso();
    return this.accountsService.getTenantBalance(tenantId, date);
  }

  @Get(":tenantId/months")
  getMonthGrid(
    @Param("tenantId") tenantId: string,
    @Query("from") rangeStart: string,
    @Query("to") rangeEnd: string,
  ) {
    return this.accountsService.getMonthGrid(tenantId, rangeStart, rangeEnd);
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
