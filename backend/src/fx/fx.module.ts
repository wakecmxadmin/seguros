import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FxService } from './fx.service';
import { FxController } from './fx.controller';

@Module({
  imports: [HttpModule],
  controllers: [FxController],
  providers: [FxService],
  exports: [FxService],
})
export class FxModule {}
