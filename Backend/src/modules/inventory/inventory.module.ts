import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../../common/events/events.module';
import { InventarioService } from './application/services/inventario.service';
import { FefoDispatchService } from './application/services/fefo-dispatch.service';
import { MermaService } from './application/services/merma.service';
import { CadenaFrioAlertService } from './application/services/cadena-frio-alert.service';
import { InventoryEventListener } from './application/listeners/inventory-event.listener';
import { ReceptionsController } from './presentation/http/receptions.controller';
import { LotsController } from './presentation/http/lots.controller';
import { InventoryController } from './presentation/http/inventory.controller';
import { WasteController } from './presentation/http/waste.controller';

@Module({
  imports: [AuthModule, EventsModule],
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
    CadenaFrioAlertService,
    InventoryEventListener,
  ],
  exports: [
    InventarioService,
    FefoDispatchService,
    MermaService,
    CadenaFrioAlertService,
    InventoryEventListener,
  ],
})
export class InventoryModule {}
