import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/roles.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const context = (req: Request) => ({
  ip: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private roles: RolesService) {}

  @RequirePermissions('role:list')
  @Get()
  list() {
    return this.roles.list();
  }

  /** Catálogo completo de permissões, agrupado por módulo. */
  @RequirePermissions('role:list')
  @Get('permissions')
  listPermissions() {
    return this.roles.listPermissions();
  }

  @RequirePermissions('role:list')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.roles.findOne(id);
  }

  @RequirePermissions('role:create')
  @Post()
  create(@Body() dto: CreateRoleDto, @CurrentUser('id') authorId: string, @Req() req: Request) {
    return this.roles.create(dto, authorId, context(req));
  }

  @RequirePermissions('role:update')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser('id') authorId: string,
    @Req() req: Request,
  ) {
    return this.roles.update(id, dto, authorId, context(req));
  }

  @RequirePermissions('role:delete')
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') authorId: string,
    @Req() req: Request,
  ) {
    return this.roles.remove(id, authorId, context(req));
  }
}
