import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InventarioService } from './application/services/inventario.service';
import { FefoDispatchService } from './application/services/fefo-dispatch.service';
import { MermaService } from './application/services/merma.service';
import { ReceptionsController } from './presentation/http/receptions.controller';
import { LotsController } from './presentation/http/lots.controller';
import { InventoryController } from './presentation/http/inventory.controller';
import { WasteController } from './presentation/http/waste.controller';

@Module({
  imports: [AuthModule],
  controllers: [
    ReceptionsController,
    LotsController,
    InventoryController,
    WasteController,
  ],
  providers: [
    InventarioService,
    FefoDispatchService,
    MermaService,
  ],
  exports: [
    InventarioService,
    FefoDispatchService,
    MermaService,
  ],
})
export class InventoryModule {}
