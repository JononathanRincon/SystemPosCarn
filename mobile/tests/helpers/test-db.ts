import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema } from '../../src/database/schema';
import { Producto, Categoria, Lote, VentaOutbox, TurnoLocal } from '../../src/database/models';

export function createTestDatabase(): Database {
  const adapter = new LokiJSAdapter({
    schema,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
  });

  return new Database({
    adapter,
    modelClasses: [Producto, Categoria, Lote, VentaOutbox, TurnoLocal],
  });
}
