import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InventarioService } from './application/services/inventario.service';
import { FefoDispatchService } from './application/services/fefo-dispatch.service';
import { ReceptionsController } from './presentation/http/receptions.controller';
import { LotsController } from './presentation/http/lots.controller';
import { InventoryController } from './presentation/http/inventory.controller';

@Module({
  imports: [AuthModule],
  controllers: [ReceptionsController, LotsController, InventoryController],
  providers: [InventarioService, FefoDispatchService],
  exports: [InventarioService, FefoDispatchService],
})
export class InventoryModule {}
