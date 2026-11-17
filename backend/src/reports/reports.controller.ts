import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { RankingParamDto, ReportFiltersDto } from './dto/reports.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function sendFile(res: Response, file: { filename: string; buffer: Buffer }) {
  res.setHeader('Content-Type', XLSX);
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.send(file.buffer);
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  /** Planilha de Produção — uma linha por definitiva do período. */
  @RequirePermissions('report:production')
  @Get('production')
  production(@Query() filters: ReportFiltersDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reports.production(filters, user);
  }

  @RequirePermissions('report:export')
  @Get('production/export')
  async productionExport(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    sendFile(res, await this.reports.productionWorkbook(filters, user));
  }

  /** Rankings por cliente, parceiro, apólice ou estado. */
  @RequirePermissions('report:ranking')
  @Get('rankings/:dimension')
  ranking(
    @Param() { dimension }: RankingParamDto,
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reports.ranking(dimension, filters, user);
  }

  @RequirePermissions('report:export')
  @Get('rankings/:dimension/export')
  async rankingExport(
    @Param() { dimension }: RankingParamDto,
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    sendFile(res, await this.reports.rankingWorkbook(dimension, filters, user));
  }
}
