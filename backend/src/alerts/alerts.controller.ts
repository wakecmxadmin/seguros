import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AlertsService } from './alerts.service';

/**
 * Sem permissão própria: cada grupo de pendências respeita a permissão de
 * leitura do que ele lista (cotações, averbações, apólices).
 */
@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private alerts: AlertsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.alerts.list(user);
  }
}
