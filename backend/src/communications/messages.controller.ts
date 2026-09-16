import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/communications.dto';
import { QuotesService } from '../quotes/quotes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';

/** Timeline de mensagens por processo — ver docs/12-reuniao-cliente.md § 5 (tarefa 31). */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('quotes/:quoteId/messages')
export class MessagesController {
  constructor(
    private messages: MessagesService,
    private quotes: QuotesService,
  ) {}

  @RequirePermissions('message:list')
  @Get()
  async list(@Param('quoteId', ParseUUIDPipe) quoteId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.quotes.findOne(quoteId, user);
    return this.messages.list(quoteId);
  }

  @RequirePermissions('message:send')
  @Post()
  async send(
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.quotes.findOne(quoteId, user);
    return this.messages.send(quoteId, dto, user.id);
  }
}
