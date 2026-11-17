import { Controller, Get, Param, Query, ParseUUIDPipe, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private documents: DocumentsService) {}

  /**
   * Proposta em .docx a partir do modelo vigente. Marcadores que ficaram sem
   * valor vão no cabeçalho `X-Unresolved-Placeholders`, para a tela avisar.
   */
  @RequirePermissions('document:generate')
  @Get('quotes/:id/proposal')
  async proposal(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const file = await this.documents.proposal(id, user, {
      ip: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });
    res.setHeader('Content-Type', DOCX);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Unresolved-Placeholders');
    if (file.unresolved.length) res.setHeader('X-Unresolved-Placeholders', file.unresolved.join(','));
    res.send(file.buffer);
  }

  /** Dados do certificado (importação) ou da solicitação de cobertura (exportação). */
  @RequirePermissions('document:generate')
  @Get('endorsements/:id')
  endorsement(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    /** Prorrogação da definitiva — gera o certificado "PRG-" com o prêmio dela. */
    @Query('extension') extensionId?: string,
  ) {
    return this.documents.endorsementDocument(id, user, extensionId || undefined);
  }

  @RequirePermissions('template:update')
  @Get('templates/:id/placeholders')
  placeholders(@Param('id', ParseUUIDPipe) id: string) {
    return this.documents.templatePlaceholders(id);
  }
}
