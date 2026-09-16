import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CatalogService, CATALOG_ENTITIES } from './catalog.service';
import { ListCatalogDto } from './dto/catalog.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const context = (req: Request) => ({
  ip: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

/**
 * Um controller para todas as tabelas de domínio: `/catalog/:entity`.
 * As entidades válidas estão em CATALOG_ENTITIES.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('catalog')
export class CatalogController {
  constructor(private catalog: CatalogService) {}

  /** Metadados dos cadastros disponíveis — o frontend monta a navegação com isso. */
  @RequirePermissions('catalog:list')
  @Get('entities')
  entities() {
    return Object.entries(CATALOG_ENTITIES).map(([key, config]) => ({
      key,
      label: config.label,
    }));
  }

  @RequirePermissions('catalog:list')
  @Get(':entity/options')
  options(@Param('entity') entity: string, @Query('parentId') parentId?: string) {
    return this.catalog.options(entity, parentId);
  }

  @RequirePermissions('catalog:list')
  @Get(':entity')
  list(@Param('entity') entity: string, @Query() query: ListCatalogDto) {
    return this.catalog.list(entity, query);
  }

  @RequirePermissions('catalog:update')
  @Post(':entity')
  create(
    @Param('entity') entity: string,
    @Body() data: Record<string, unknown>,
    @CurrentUser('id') authorId: string,
    @Req() req: Request,
  ) {
    return this.catalog.create(entity, data, authorId, context(req));
  }

  @RequirePermissions('catalog:update')
  @Patch(':entity/:id')
  update(
    @Param('entity') entity: string,
    @Param('id') id: string,
    @Body() data: Record<string, unknown>,
    @CurrentUser('id') authorId: string,
    @Req() req: Request,
  ) {
    return this.catalog.update(entity, id, data, authorId, context(req));
  }

  @RequirePermissions('catalog:delete')
  @Delete(':entity/:id')
  remove(
    @Param('entity') entity: string,
    @Param('id') id: string,
    @CurrentUser('id') authorId: string,
    @Req() req: Request,
  ) {
    return this.catalog.remove(entity, id, authorId, context(req));
  }
}
