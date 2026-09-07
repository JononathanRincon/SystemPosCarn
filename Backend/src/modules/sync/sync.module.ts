import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SalesModule } from '../sales/sales.module';
import { SyncService } from './application/services/sync.service';
import { ConflictoService } from './application/services/conflicto.service';
import { SyncController } from './presentation/http/sync.controller';

@Module({
  imports: [AuthModule, SalesModule],
  controllers: [SyncController],
  providers: [SyncService, ConflictoService],
  exports: [SyncService, ConflictoService],
})
export class SyncModule {}

