import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { CompanyRoleType } from '@prisma/client';
import type { Request } from 'express';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, ListCompaniesDto, UpdateCompanyDto } from './dto/companies.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const context = (req: Request) => ({
  ip: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private companies: CompaniesService) {}

  @RequirePermissions('company:list')
  @Get()
  list(@Query() filters: ListCompaniesDto) {
    return this.companies.list(filters);
  }

  /** Autocomplete das cotações — substitui o "código + lupa" do legado. */
  @RequirePermissions('company:list')
  @Get('options')
  options(@Query('role') role?: CompanyRoleType, @Query('search') search?: string) {
    return this.companies.options(role, search);
  }

  @RequirePermissions('company:list')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.companies.findOne(id);
  }

  @RequirePermissions('company:update')
  @Post()
  create(@Body() dto: CreateCompanyDto, @CurrentUser('id') authorId: string, @Req() req: Request) {
    return this.companies.create(dto, authorId, context(req));
  }

  @RequirePermissions('company:update')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser('id') authorId: string,
    @Req() req: Request,
  ) {
    return this.companies.update(id, dto, authorId, context(req));
  }

  @RequirePermissions('company:delete')
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') authorId: string,
    @Req() req: Request,
  ) {
    return this.companies.remove(id, authorId, context(req));
  }
}
