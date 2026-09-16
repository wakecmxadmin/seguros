import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { FinanceService } from './finance.service';
import {
  CreateCashRequestDto, ListCashRequestsDto, ListCommissionsDto, PayCommissionsDto,
  RequestInvoiceDto, SendCashRequestsDto, SettleCashRequestDto,
} from './dto/finance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';

const context = (req: Request) => ({
  ip: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class FinanceController {
  constructor(private finance: FinanceService) {}

  @RequirePermissions('cash_request:create')
  @Get('finance/summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.summary(user);
  }

  // --- Numerário ------------------------------------------------------------

  @RequirePermissions('cash_request:create')
  @Get('cash-requests')
  listCashRequests(@Query() filters: ListCashRequestsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.finance.listCashRequests(filters, user);
  }

  /** Definitivas sem numerário — a fila de trabalho. */
  @RequirePermissions('cash_request:create')
  @Get('cash-requests/pending-endorsements')
  pendingEndorsements(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.pendingEndorsements(user);
  }

  @RequirePermissions('cash_request:create')
  @Post('cash-requests')
  createCashRequest(
    @Body() dto: CreateCashRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.finance.createCashRequest(dto, user, context(req));
  }

  @RequirePermissions('cash_request:create')
  @Post('cash-requests/send')
  send(
    @Body() dto: SendCashRequestsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.finance.sendCashRequests(dto.ids, user, context(req));
  }

  @RequirePermissions('cash_request:settle')
  @Patch('cash-requests/:id/settle')
  settle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SettleCashRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.finance.settleCashRequest(id, dto, user, context(req));
  }

  @RequirePermissions('cash_request:settle')
  @Patch('cash-requests/:id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.finance.cancelCashRequest(id, user, context(req));
  }

  // --- Comissões ------------------------------------------------------------

  @RequirePermissions('commission:list')
  @Get('commissions')
  listCommissions(@Query() filters: ListCommissionsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.finance.listCommissions(filters, user);
  }

  @RequirePermissions('commission:list')
  @Get('commissions/statement')
  statement(@Query() filters: ListCommissionsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.finance.commissionStatement(filters, user);
  }

  @RequirePermissions('commission:pay')
  @Post('commissions/request-invoice')
  requestInvoices(
    @Body() dto: RequestInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.finance.requestInvoices(dto, user, context(req));
  }

  @RequirePermissions('commission:pay')
  @Post('commissions/pay')
  pay(
    @Body() dto: PayCommissionsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.finance.payCommissions(dto, user, context(req));
  }
}
