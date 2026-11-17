import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { EndorsementsService } from './endorsements.service';
import { EndorsementOutputService } from './endorsement-output.service';
import {
  CancelExtensionDto, ChangePositionDto, EndorsementSelectionDto, IssueExtensionDto,
  IssueFinalDto, IssueProvisionalDto, ListEndorsementsDto,
} from './dto/endorsements.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';

const context = (req: Request) => ({
  ip: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('endorsements')
export class EndorsementsController {
  constructor(
    private endorsements: EndorsementsService,
    private output: EndorsementOutputService,
  ) {}

  @RequirePermissions('endorsement:list')
  @Get()
  list(@Query() filters: ListEndorsementsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.endorsements.list(filters, user);
  }

  @RequirePermissions('endorsement:list')
  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.endorsements.summary(user);
  }

  /** Relação para impressão por faixa (`ImpressaoProvisoria/Definitiva`). */
  @RequirePermissions('document:generate')
  @Get('selection/print')
  printSelection(@Query() filters: EndorsementSelectionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.output.printData(filters, user);
  }

  /** Arquivo de remessa por faixa (`ArquivoProvisoria/Definitiva`). */
  @RequirePermissions('report:export')
  @Get('selection/file')
  async fileSelection(
    @Query() filters: EndorsementSelectionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { filename, content } = await this.output.file(filters, user);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @RequirePermissions('endorsement:list')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.endorsements.findOne(id, user);
  }

  @RequirePermissions('endorsement:issue_provisional')
  @Post('provisional')
  issueProvisional(
    @Body() dto: IssueProvisionalDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.endorsements.issueProvisional(dto, user, context(req));
  }

  @RequirePermissions('endorsement:issue_final')
  @Post('final')
  issueFinal(
    @Body() dto: IssueFinalDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.endorsements.issueFinal(dto, user, context(req));
  }

  @RequirePermissions('endorsement:change_position')
  @Patch(':id/position')
  changePosition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePositionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.endorsements.changePosition(id, dto, user, context(req));
  }

  @RequirePermissions('endorsement:issue_final')
  @Post(':id/extensions')
  issueExtension(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueExtensionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.endorsements.issueExtension(id, dto, user, context(req));
  }

  @RequirePermissions('endorsement:change_position')
  @Patch(':id/extensions/:extensionId/cancel')
  cancelExtension(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('extensionId', ParseUUIDPipe) extensionId: string,
    @Body() dto: CancelExtensionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.endorsements.cancelExtension(id, extensionId, dto, user, context(req));
  }
}
