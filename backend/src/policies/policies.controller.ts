import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { PoliciesService } from './policies.service';
import {
  CreateCoverageDto, CreatePolicyDto, ListPoliciesDto, UpdateCoverageDto, UpdatePolicyDto,
} from './dto/policies.dto';
import { CreateClientRateDto, UpdateClientRateDto } from './dto/client-rates.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const context = (req: Request) => ({
  ip: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class PoliciesController {
  constructor(private policies: PoliciesService) {}

  // --- Coberturas (antes de :id para não conflitar) -------------------------

  @RequirePermissions('coverage:list')
  @Get('coverages')
  listCoverages() {
    return this.policies.listCoverages();
  }

  @RequirePermissions('coverage:update')
  @Post('coverages')
  createCoverage(
    @Body() dto: CreateCoverageDto,
    @CurrentUser('id') authorId: string,
    @Req() req: Request,
  ) {
    return this.policies.createCoverage(dto, authorId, context(req));
  }

  @RequirePermissions('coverage:update')
  @Patch('coverages/:id')
  updateCoverage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCoverageDto,
    @CurrentUser('id') authorId: string,
    @Req() req: Request,
  ) {
    return this.policies.updateCoverage(id, dto, authorId, context(req));
  }

  // --- Taxas por cliente ----------------------------------------------------

  @RequirePermissions('policy:list')
  @Get('client-rates')
  listClientRates(@Query('clientId') clientId?: string) {
    return this.policies.listClientRates(clientId);
  }

  /** Mostra qual regra seria aplicada num contexto — usado na tela de cotação. */
  @RequirePermissions('policy:list')
  @Get('client-rates/preview')
  previewClientRate(@Query() query: Record<string, string>) {
    return this.policies.previewClientRate(query.clientId, query);
  }

  @RequirePermissions('rate:update')
  @Post('client-rates')
  createClientRate(
    @Body() dto: CreateClientRateDto,
    @CurrentUser('id') authorId: string,
    @Req() req: Request,
  ) {
    return this.policies.createClientRate(dto, authorId, context(req));
  }

  @RequirePermissions('rate:update')
  @Patch('client-rates/:id')
  updateClientRate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientRateDto,
    @CurrentUser('id') authorId: string,
    @Req() req: Request,
  ) {
    return this.policies.updateClientRate(id, dto, authorId, context(req));
  }

  @RequirePermissions('rate:update')
  @Delete('client-rates/:id')
  removeClientRate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') authorId: string,
    @Req() req: Request,
  ) {
    return this.policies.removeClientRate(id, authorId, context(req));
  }

  // --- Apólices -------------------------------------------------------------

  @RequirePermissions('policy:list')
  @Get('policies')
  list(@Query() filters: ListPoliciesDto) {
    return this.policies.list(filters);
  }

  @RequirePermissions('policy:list')
  @Get('policies/options')
  options(@Query('kind') kind?: string, @Query('insurerId') insurerId?: string) {
    return this.policies.options(kind, insurerId);
  }

  @RequirePermissions('policy:update')
  @Post('policies')
  create(@Body() dto: CreatePolicyDto, @CurrentUser('id') authorId: string, @Req() req: Request) {
    return this.policies.create(dto, authorId, context(req));
  }

  @RequirePermissions('policy:update')
  @Patch('policies/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePolicyDto,
    @CurrentUser('id') authorId: string,
    @Req() req: Request,
  ) {
    return this.policies.update(id, dto, authorId, context(req));
  }

  @RequirePermissions('policy:update')
  @Delete('policies/:id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') authorId: string,
    @Req() req: Request,
  ) {
    return this.policies.remove(id, authorId, context(req));
  }
}
