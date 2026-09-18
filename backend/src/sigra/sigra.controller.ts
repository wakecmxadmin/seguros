import { Controller, Get, NotFoundException, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { SigraProcessService } from './sigra-process.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sigra')
export class SigraController {
  constructor(private sigra: SigraProcessService) {}

  @RequirePermissions('sigra:read')
  @Get('processes/:id')
  async getProcess(@Param('id', ParseIntPipe) id: number) {
    const data = await this.sigra.getFullProcess(id);
    if (!data.summary) {
      throw new NotFoundException(`Processo ${id} não encontrado no SIGRA.`);
    }
    return data;
  }
}
