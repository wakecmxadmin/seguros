import { Module } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { FxModule } from '../fx/fx.module';

@Module({
  imports: [FxModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
