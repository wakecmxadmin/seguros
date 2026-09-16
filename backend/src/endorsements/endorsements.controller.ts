import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { EndorsementsService } from './endorsements.service';
import {
  ChangePositionDto, IssueFinalDto, IssueProvisionalDto, ListEndorsementsDto,
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
  constructor(private endorsements: EndorsementsService) {}

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
}
