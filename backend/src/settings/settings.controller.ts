import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import type { Request } from 'express';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

class SetSettingDto {
  @IsString() @MinLength(1, { message: 'Informe o valor.' })
  value: string;
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  /** Leitura liberada a quem cota: o cálculo depende desses parâmetros. */
  @RequirePermissions('quote:list')
  @Get()
  list() {
    return this.settings.list();
  }

  @RequirePermissions('rate:update')
  @Put(':key')
  set(
    @Param('key') key: string,
    @Body() dto: SetSettingDto,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    return this.settings.set(key, dto.value, userId, {
      ip: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });
  }
}
