import { Module } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { FxModule } from '../fx/fx.module';
import { SigraModule } from '../sigra/sigra.module';

@Module({
  imports: [FxModule, SigraModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
