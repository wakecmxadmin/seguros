import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { AttachmentsService } from './attachments.service';
import { AttachmentsController } from './attachments.controller';
import { GmailModule } from '../gmail/gmail.module';
import { QuotesModule } from '../quotes/quotes.module';

@Module({
  imports: [GmailModule, QuotesModule],
  controllers: [MessagesController, AttachmentsController],
  providers: [MessagesService, AttachmentsService],
})
export class CommunicationsModule {}
