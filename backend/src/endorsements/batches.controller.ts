import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { BatchStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import type { Request, Response } from 'express';
import { BatchesService } from './batches.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

class CloseBatchDto {
  @Matches(PERIOD, { message: 'Informe a competência no formato AAAA-MM.' })
  period: string;

  @IsUUID('4', { message: 'Selecione a seguradora.' })
  insurerId: string;
}

class ListBatchesDto {
  @IsOptional() @Matches(PERIOD) period?: string;
  @IsOptional() @IsUUID() insurerId?: string;
  @IsOptional() @IsEnum(BatchStatus) status?: BatchStatus;
}

class StatementDto {
  @Matches(PERIOD, { message: 'Informe a competência no formato AAAA-MM.' })
  period: string;

  @IsOptional() @IsUUID() clientId?: string;
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('batches')
export class BatchesController {
  constructor(private batches: BatchesService) {}

  @RequirePermissions('endorsement:list')
  @Get()
  list(@Query() filters: ListBatchesDto) {
    return this.batches.list(filters);
  }

  /** Averbações da competência que ainda não entraram em lote. */
  @RequirePermissions('endorsement:list')
  @Get('preview')
  preview(@Query('period') period: string, @Query('insurerId') insurerId: string) {
    return this.batches.preview(period, insurerId);
  }

  /** Extrato mensal por cliente, com o acréscimo aplicado. */
  @RequirePermissions('report:production')
  @Get('statement')
  statement(@Query() query: StatementDto) {
    return this.batches.monthlyStatement(query.period, query.clientId);
  }

  @RequirePermissions('endorsement:issue_final')
  @Post('close')
  close(
    @Body() dto: CloseBatchDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.batches.close(dto.period, dto.insurerId, user, {
      ip: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });
  }

  @RequirePermissions('endorsement:issue_final')
  @Patch(':id/sent')
  markSent(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.batches.markSent(id, user, {
      ip: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });
  }

  @RequirePermissions('report:export')
  @Get(':id/export')
  async export(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { filename, content } = await this.batches.exportCsv(id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }
}
