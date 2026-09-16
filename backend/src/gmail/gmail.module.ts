import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GmailService } from './gmail.service';
import { GmailController } from './gmail.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [GmailController],
  providers: [GmailService],
  exports: [GmailService],
})
export class GmailModule {}
