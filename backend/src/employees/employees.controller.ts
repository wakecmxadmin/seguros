import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, ListEmployeesDto, UpdateEmployeeDto } from './dto/employees.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const context = (req: Request) => ({
  ip: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private employees: EmployeesService) {}

  @RequirePermissions('employee:list')
  @Get()
  list(@Query() filters: ListEmployeesDto) {
    return this.employees.list(filters);
  }

  @RequirePermissions('employee:list')
  @Get('salespeople')
  salespeople() {
    return this.employees.salespeople();
  }

  @RequirePermissions('employee:update')
  @Post()
  create(@Body() dto: CreateEmployeeDto, @CurrentUser('id') authorId: string, @Req() req: Request) {
    return this.employees.create(dto, authorId, context(req));
  }

  @RequirePermissions('employee:update')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser('id') authorId: string,
    @Req() req: Request,
  ) {
    return this.employees.update(id, dto, authorId, context(req));
  }

  @RequirePermissions('employee:update')
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') authorId: string,
    @Req() req: Request,
  ) {
    return this.employees.remove(id, authorId, context(req));
  }
}
