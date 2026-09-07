import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SalesModule } from '../sales/sales.module';
import { SyncService } from './application/services/sync.service';
import { SyncController } from './presentation/http/sync.controller';

@Module({
  imports: [AuthModule, SalesModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
