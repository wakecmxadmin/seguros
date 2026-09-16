import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { ListAuditDto } from './dto/audit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('audit')
export class AuditController {
  constructor(private audit: AuditService) {}

  @RequirePermissions('audit:list')
  @Get()
  list(@Query() filters: ListAuditDto) {
    return this.audit.list(filters);
  }

  /** Ações e entidades já registradas, para montar os filtros da tela. */
  @RequirePermissions('audit:list')
  @Get('facets')
  facets() {
    return this.audit.facets();
  }
}
