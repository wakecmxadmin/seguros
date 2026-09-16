import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service';
import {
  CreateUserDto, ListUsersDto, ToggleStatusDto, UpdateUserDto,
} from './dto/users.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const context = (req: Request) => ({
  ip: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @RequirePermissions('user:list')
  @Get()
  list(@Query() filters: ListUsersDto) {
    return this.users.list(filters);
  }

  @RequirePermissions('user:read')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.findOne(id);
  }

  @RequirePermissions('user:create')
  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser('id') authorId: string, @Req() req: Request) {
    return this.users.create(dto, authorId, context(req));
  }

  @RequirePermissions('user:update')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('id') authorId: string,
    @Req() req: Request,
  ) {
    return this.users.update(id, dto, authorId, context(req));
  }

  @RequirePermissions('user:deactivate')
  @Patch(':id/status')
  toggleStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleStatusDto,
    @CurrentUser('id') authorId: string,
    @Req() req: Request,
  ) {
    return this.users.toggleStatus(id, dto.active, authorId, context(req));
  }

  @RequirePermissions('user:reset_password')
  @Post(':id/resend-access')
  resendAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') authorId: string,
    @Req() req: Request,
  ) {
    return this.users.resendAccess(id, authorId, context(req));
  }
}
