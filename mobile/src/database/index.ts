import { Database } from '@nozbe/watermelondb';
import { schema } from './schema';
import { Producto, Categoria, Lote, VentaOutbox, TurnoLocal } from './models';

export const modelClasses = [Producto, Categoria, Lote, VentaOutbox, TurnoLocal];

export interface DatabaseOptions {
  isTesting?: boolean;
  dbName?: string;
}

export function createDatabase(options: DatabaseOptions = {}): Database {
  const isTesting = options.isTesting ?? (process.env.NODE_ENV === 'test');

  if (isTesting) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const LokiJSAdapter = require('@nozbe/watermelondb/adapters/lokijs').default;
    const adapter = new LokiJSAdapter({
      schema,
      useWebWorker: false,
      useIncrementalIndexedDB: false,
    });
    return new Database({
      adapter,
      modelClasses,
    });
  }

  // Native SQLite adapter for mobile production
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const SQLiteAdapter = require('@nozbe/watermelondb/adapters/sqlite').default;
  const adapter = new SQLiteAdapter({
    schema,
    dbName: options.dbName ?? 'pos_carniceria_db',
    jsi: true,
    onSetUpError: (error: any) => {
      console.error('WatermelonDB SQLite setup error:', error);
    },
  });

  return new Database({
    adapter,
    modelClasses,
  });
}

let databaseInstance: Database | null = null;

export function getDatabase(options?: DatabaseOptions): Database {
  if (!databaseInstance) {
    databaseInstance = createDatabase(options);
  }
  return databaseInstance;
}

export { schema } from './schema';
export * from './models';
