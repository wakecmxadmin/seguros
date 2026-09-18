import { Module } from '@nestjs/common';
import { SigraConnectionService } from './sigra-connection.service';
import { SigraProcessService } from './sigra-process.service';
import { SigraController } from './sigra.controller';

@Module({
  controllers: [SigraController],
  providers: [SigraConnectionService, SigraProcessService],
  exports: [SigraProcessService],
})
export class SigraModule {}
