import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { SyncService } from '../../application/services/sync.service';
import { SyncSalesBatchDto, SyncResponseDto } from '../../application/dtos/sync.dto';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';

@Controller('sales/sync')
@UseGuards(AuthGuard, RolesGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async syncSalesBatch(@Body() dto: SyncSalesBatchDto): Promise<SyncResponseDto> {
    return this.syncService.sincronizarLoteVentas(dto);
  }
}
