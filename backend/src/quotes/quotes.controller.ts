import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, Req,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import type { Request } from 'express';
import { QuotesService } from './quotes.service';
import {
  CancelQuoteDto, DecideQuoteDto, ListQuotesDto, PreviewQuoteDto, SaveQuoteDto,
} from './dto/quotes.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';

const context = (req: Request) => ({
  ip: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

/** Origens conhecidas de referência — ver docs/12-reuniao-cliente.md. */
class AddReferenceDto {
  @IsIn(['PINHO', 'SIGRA', 'CLIENT', 'PARTNER', 'INSURER', 'OTHER'])
  source: string;

  @IsOptional() @IsString()
  label?: string;

  @IsString() @MinLength(1, { message: 'Informe a referência.' })
  value: string;
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('quotes')
export class QuotesController {
  constructor(private quotes: QuotesService) {}

  @RequirePermissions('quote:list')
  @Get()
  list(@Query() filters: ListQuotesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.quotes.list(filters, user);
  }

  @RequirePermissions('quote:list')
  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.quotes.summary(user);
  }

  /** Prévia do cálculo — usada pelo recálculo reativo da tela, sem persistir nada. */
  @RequirePermissions('quote:list')
  @Post('preview')
  preview(@Body() dto: PreviewQuoteDto) {
    return this.quotes.preview(dto);
  }

  /** Localiza processos por qualquer referência cadastrada. */
  @RequirePermissions('quote:list')
  @Get('by-reference')
  findByReference(@Query('value') value: string, @CurrentUser() user: AuthenticatedUser) {
    return this.quotes.findByReference(value, user);
  }

  /** Sugestões de preenchimento a partir de um processo do SIGRA — botão "Puxar do SIGRA". */
  @RequirePermissions('quote:create', 'sigra:read')
  @Get('sigra-draft/:sigraId')
  getSigraDraft(@Param('sigraId', ParseIntPipe) sigraId: number) {
    return this.quotes.getSigraDraft(sigraId);
  }

  @RequirePermissions('quote:list')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.quotes.findOne(id, user);
  }

  /** Dados do processo no SIGRA vinculado à cotação (`null` se não houver referência SIGRA). */
  @RequirePermissions('quote:list', 'sigra:read')
  @Get(':id/sigra')
  getSigraData(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.quotes.getSigraData(id, user);
  }

  @RequirePermissions('quote:create')
  @Post()
  create(
    @Body() dto: SaveQuoteDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.quotes.create(dto, user, context(req));
  }

  @RequirePermissions('quote:update')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveQuoteDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.quotes.update(id, dto, user, context(req));
  }

  @RequirePermissions('quote:update')
  @Post(':id/references')
  addReference(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddReferenceDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.quotes.addReference(id, dto, user, context(req));
  }

  @RequirePermissions('quote:update')
  @Delete(':id/references/:referenceId')
  removeReference(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('referenceId', ParseUUIDPipe) referenceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.quotes.removeReference(id, referenceId, user, context(req));
  }

  @RequirePermissions('quote:approve')
  @Patch(':id/decision')
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideQuoteDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.quotes.decide(id, dto.approved, dto.reason, user, context(req));
  }

  @RequirePermissions('quote:cancel')
  @Patch(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelQuoteDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.quotes.cancel(id, dto.reason, user, context(req));
  }
}
