import {
  Controller, Get, Param, ParseUUIDPipe, Post, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AttachmentsService } from './attachments.service';
import { StorageService } from '../storage/storage.service';
import { QuotesService } from '../quotes/quotes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('quotes/:quoteId/attachments')
export class AttachmentsController {
  constructor(
    private attachments: AttachmentsService,
    private storage: StorageService,
    private quotes: QuotesService,
  ) {}

  @RequirePermissions('message:list')
  @Get()
  async list(@Param('quoteId', ParseUUIDPipe) quoteId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.quotes.findOne(quoteId, user);
    return this.attachments.list(quoteId);
  }

  @RequirePermissions('message:send')
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }))
  async upload(
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.quotes.findOne(quoteId, user);
    return this.attachments.upload(quoteId, file, user.id);
  }

  @RequirePermissions('message:list')
  @Get(':id/download')
  async download(
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    await this.quotes.findOne(quoteId, user);
    const attachment = await this.attachments.getForQuote(quoteId, id);
    const stream = await this.storage.readStream(attachment.storageKey);
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.fileName)}"`);
    stream.pipe(res);
  }
}
