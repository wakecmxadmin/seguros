import { Module } from '@nestjs/common';
import { EndorsementsService } from './endorsements.service';
import { EndorsementsController } from './endorsements.controller';
import { BatchesService } from './batches.service';
import { BatchesController } from './batches.controller';
import { EndorsementOutputService } from './endorsement-output.service';
import { FxModule } from '../fx/fx.module';

@Module({
  imports: [FxModule],
  controllers: [EndorsementsController, BatchesController],
  providers: [EndorsementsService, BatchesService, EndorsementOutputService],
  exports: [EndorsementsService, BatchesService],
})
export class EndorsementsModule {}
