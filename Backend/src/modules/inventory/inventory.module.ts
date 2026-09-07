import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InventarioService } from './application/services/inventario.service';
import { ReceptionsController } from './presentation/http/receptions.controller';
import { LotsController } from './presentation/http/lots.controller';
import { InventoryController } from './presentation/http/inventory.controller';

@Module({
  imports: [AuthModule],
  controllers: [ReceptionsController, LotsController, InventoryController],
  providers: [InventarioService],
  exports: [InventarioService],
})
export class InventoryModule {}
