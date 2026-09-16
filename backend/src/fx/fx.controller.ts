import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { FxService } from './fx.service';
import { ImportPtaxDto, ListRatesDto, UpsertRateDto } from './dto/fx.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const context = (req: Request) => ({
  ip: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('exchange-rates')
export class FxController {
  constructor(private fx: FxService) {}

  @RequirePermissions('exchange_rate:list')
  @Get()
  list(@Query() filters: ListRatesDto) {
    return this.fx.list(filters);
  }

  /** Taxa vigente numa data, com fallback para o último dia útil. */
  @RequirePermissions('exchange_rate:list')
  @Get('current')
  current(@Query('currencyId') currencyId: string, @Query('date') date?: string) {
    return this.fx.rateFor(currencyId, date ? new Date(date) : new Date());
  }

  @RequirePermissions('exchange_rate:update')
  @Post()
  upsert(@Body() dto: UpsertRateDto, @CurrentUser('id') authorId: string, @Req() req: Request) {
    return this.fx.upsert(dto, authorId, context(req));
  }

  @RequirePermissions('exchange_rate:update')
  @Post('import-ptax')
  importPtax(@Body() dto: ImportPtaxDto, @CurrentUser('id') authorId: string, @Req() req: Request) {
    return this.fx.importPtax(dto, authorId, context(req));
  }
}
