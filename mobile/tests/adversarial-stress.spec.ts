import React from 'react';
import { Database } from '@nozbe/watermelondb';
import { createTestDatabase } from './helpers/test-db';
import { schema } from '../src/database/schema';
import { Producto, Categoria, Lote, VentaOutbox, TurnoLocal } from '../src/database/models';
import {
  VentaTabletScreen,
  formatCOP,
  formatWeight,
  type VentaTabletScreenProps,
  type CompletedSale,
  type TicketItem,
} from '../src/screens';

// ============================================================================
// HELPER UTILITIES FOR REACT VIRTUAL TREE INSPECTION
// ============================================================================

function findElement(element: any, predicate: (el: any) => boolean): any {
  if (!element) return null;
  if (Array.isArray(element)) {
    for (const item of element) {
      const found = findElement(item, predicate);
      if (found) return found;
    }
    return null;
  }
  if (typeof element !== 'object') return null;
  if (predicate(element)) return element;
  if (element.props?.children) {
    return findElement(element.props.children, predicate);
  }
  return null;
}

function findAllElements(element: any, predicate: (el: any) => boolean): any[] {
  const results: any[] = [];
  function search(el: any) {
    if (!el) return;
    if (Array.isArray(el)) {
      el.forEach(search);
      return;
    }
    if (typeof el !== 'object') return;
    if (predicate(el)) results.push(el);
    if (el.props?.children) {
      search(el.props.children);
    }
  }
  search(element);
  return results;
}

function getElementText(element: any): string {
  if (element === null || element === undefined) return '';
  if (typeof element === 'string' || typeof element === 'number') return String(element);
  if (Array.isArray(element)) {
    return element.map(getElementText).join('');
  }
  if (element.props?.children) {
    return getElementText(element.props.children);
  }
  return '';
}

function renderScreen(initialProps: VentaTabletScreenProps = {}) {
  let currentProps = { ...initialProps };
  const states: any[] = [];
  let stateCursor = 0;

  const dispatcher = {
    useState(initial: any) {
      const index = stateCursor++;
      if (states[index] === undefined) {
        states[index] = typeof initial === 'function' ? initial() : initial;
      }
      const setter = (val: any) => {
        const next = typeof val === 'function' ? val(states[index]) : val;
        states[index] = next;
      };
      return [states[index], setter];
    },
    useMemo(fn: () => any) {
      return fn();
    },
  };

  function renderTree() {
    stateCursor = 0;
    const prev = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current;
    try {
      (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = dispatcher;
      return VentaTabletScreen(currentProps);
    } finally {
      (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = prev;
    }
  }

  return {
    getTree: () => renderTree(),
    setProps: (newProps: Partial<VentaTabletScreenProps>) => {
      currentProps = { ...currentProps, ...newProps };
    },
    findByTestId: (testID: string) => findElement(renderTree(), (el) => el?.props?.testID === testID),
    findAllByTestId: (prefix: string) =>
      findAllElements(renderTree(), (el) => typeof el?.props?.testID === 'string' && el.props.testID.startsWith(prefix)),
    firePress: (testID: string) => {
      const el = findElement(renderTree(), (node) => node?.props?.testID === testID);
      if (!el) throw new Error(`Element with testID "${testID}" not found`);
      if (typeof el.props?.onPress !== 'function') throw new Error(`Element "${testID}" has no onPress`);
      el.props.onPress();
    },
  };
}

// ============================================================================
// PART 1: WATERMELONDB SCHEMA & CONCURRENCY ADVERSARIAL CHALLENGES
// ============================================================================

describe('ADVERSARIAL SUITE 1: WatermelonDB Schema, Associations & Concurrency', () => {
  let database: Database;

  beforeEach(() => {
    database = createTestDatabase();
  });

  describe('1.1 Indexed Fields & Schema Constraint Verification', () => {
    it('should strictly have isIndexed true on foreign keys and status columns', () => {
      const productos = schema.tables['productos'];
      const lotes = schema.tables['lotes'];
      const outbox = schema.tables['ventas_outbox'];

      // Crucial indexing for relational and offline queue lookups
      expect(productos.columns['categoria_id'].isIndexed).toBe(true);
      expect(lotes.columns['producto_id'].isIndexed).toBe(true);
      expect(outbox.columns['status'].isIndexed).toBe(true);

      // Verify unindexed fields are not accidentally marked as indexed (avoiding index bloat)
      expect(productos.columns['nombre'].isIndexed).toBeUndefined();
      expect(productos.columns['precio'].isIndexed).toBeUndefined();
      expect(lotes.columns['codigo_lote'].isIndexed).toBeUndefined();
      expect(outbox.columns['payload'].isIndexed).toBeUndefined();
    });

    it('should verify optional vs non-optional constraints across all tables', () => {
      const productos = schema.tables['productos'];
      expect(productos.columns['codigo_barras'].isOptional).toBe(true);
      expect(productos.columns['costo_promedio'].isOptional).toBe(true);
      expect(productos.columns['foto_url'].isOptional).toBe(true);
      expect(productos.columns['nombre'].isOptional).toBeUndefined();
      expect(productos.columns['precio'].isOptional).toBeUndefined();

      const lotes = schema.tables['lotes'];
      expect(lotes.columns['recepcion_id'].isOptional).toBe(true);
      expect(lotes.columns['proveedor'].isOptional).toBe(true);
      expect(lotes.columns['cantidad_recibida'].isOptional).toBe(true);
      expect(lotes.columns['costo_unitario'].isOptional).toBe(true);
      expect(lotes.columns['notas'].isOptional).toBe(true);
      expect(lotes.columns['cantidad_disponible'].isOptional).toBeUndefined();

      const outbox = schema.tables['ventas_outbox'];
      expect(outbox.columns['synced_at'].isOptional).toBe(true);
      expect(outbox.columns['error_message'].isOptional).toBe(true);
      expect(outbox.columns['retry_count'].isOptional).toBe(true);
      expect(outbox.columns['payload'].isOptional).toBeUndefined();
      expect(outbox.columns['status'].isOptional).toBeUndefined();
    });
  });

  describe('1.2 Model Associations (belongs_to & has_many) and Edge Cases', () => {
    it('should resolve belongs_to with non-existent foreign key without crashing (orphan check)', async () => {
      // Create a product referencing a non-existent category
      const prod = await database.write(async () => {
        return await database.get<Producto>('productos').create((record) => {
          record.negocioId = 'neg-01';
          record.categoriaId = 'orphan-cat-9999';
          record.nombre = 'Carne Huérfana';
          record.tipoVenta = 'peso';
          record.unidadMedida = 'kg';
          record.precio = 25000;
          record.activo = true;
        });
      });

      // Fetching non-existent relation in WatermelonDB triggers an invariant Diagnostic error
      await expect(prod.categoria.fetch()).rejects.toThrow(/Record categorias#orphan-cat-9999 not found/);
    });

    it('should resolve belongs_to on Lote with non-existent product by throwing diagnostic error', async () => {
      const lote = await database.write(async () => {
        return await database.get<Lote>('lotes').create((record) => {
          record.productoId = 'orphan-prod-9999';
          record.sucursalId = 'suc-01';
          record.codigoLote = 'LOT-ORPHAN-01';
          record.cantidadDisponible = 15.0;
          record.estado = 'activo';
        });
      });

      await expect(lote.producto.fetch()).rejects.toThrow(/Record productos#orphan-prod-9999 not found/);
    });

    it('should handle has_many queries on Categoria with 0 products', async () => {
      const emptyCat = await database.write(async () => {
        return await database.get<Categoria>('categorias').create((record) => {
          record.nombre = 'Categoría Vacía';
          record.ordenVisualizacion = 99;
        });
      });

      const prods = await emptyCat.productos.fetch();
      expect(Array.isArray(prods)).toBe(true);
      expect(prods.length).toBe(0);
    });

    it('should handle has_many queries on Producto with 50 associated Lotes', async () => {
      const prod = await database.write(async () => {
        return await database.get<Producto>('productos').create((record) => {
          record.negocioId = 'neg-01';
          record.categoriaId = 'cat-01';
          record.nombre = 'Lomo Fino Masivo';
          record.tipoVenta = 'peso';
          record.unidadMedida = 'kg';
          record.precio = 38000;
          record.activo = true;
        });
      });

      // Insert 50 lotes in a batch
      await database.write(async () => {
        const batchOperations = [];
        for (let i = 1; i <= 50; i++) {
          batchOperations.push(
            database.get<Lote>('lotes').prepareCreate((record) => {
              record.productoId = prod.id;
              record.sucursalId = 'suc-01';
              record.codigoLote = `LOT-BATCH-${String(i).padStart(3, '0')}`;
              record.cantidadDisponible = i * 1.5;
              record.estado = 'activo';
            }),
          );
        }
        await database.batch(...batchOperations);
      });

      const lotes = await prod.lotes.fetch();
      expect(lotes.length).toBe(50);
      const lotCodes = lotes.map((l) => l.codigoLote);
      expect(lotCodes).toContain('LOT-BATCH-001');
      expect(lotCodes).toContain('LOT-BATCH-050');
    });
  });

  describe('1.3 Simultaneous Transactions & Writer Lock Stress Test', () => {
    it('should handle 30 simultaneous concurrent database.write operations without deadlock or race condition', async () => {
      const concurrentWrites = 30;
      const promises: Promise<VentaOutbox>[] = [];

      // Launch 30 writes simultaneously into the event loop
      for (let i = 0; i < concurrentWrites; i++) {
        const p = database.write(async () => {
          return await database.get<VentaOutbox>('ventas_outbox').create((record) => {
            record.payload = JSON.stringify({ saleIndex: i, amount: (i + 1) * 10000 });
            record.status = 'pending';
          });
        });
        promises.push(p);
      }

      const results = await Promise.all(promises);
      expect(results.length).toBe(concurrentWrites);

      // Verify all 30 records were successfully committed
      const allOutbox = await database.get<VentaOutbox>('ventas_outbox').query().fetch();
      expect(allOutbox.length).toBe(concurrentWrites);
    });

    it('should isolate aborted transactions and ensure subsequent writes succeed (writer lock recovery)', async () => {
      // Failed transaction
      await expect(
        database.write(async () => {
          await database.get<Categoria>('categorias').create((record) => {
            record.nombre = 'Cat Que Falla';
            record.ordenVisualizacion = 10;
          });
          throw new Error('SIMULATED_TRANSACTION_FAILURE');
        }),
      ).rejects.toThrow('SIMULATED_TRANSACTION_FAILURE');

      // The writer lock must not be stuck; next transaction must succeed
      const successfulCat = await database.write(async () => {
        return await database.get<Categoria>('categorias').create((record) => {
          record.nombre = 'Cat Recuperada';
          record.ordenVisualizacion = 11;
        });
      });

      expect(successfulCat.id).toBeDefined();
      expect(successfulCat.nombre).toBe('Cat Recuperada');

      const allCats = await database.get<Categoria>('categorias').query().fetch();
      expect(allCats.length).toBeGreaterThanOrEqual(1);
      const catNames = allCats.map((c) => c.nombre);
      expect(catNames).toContain('Cat Recuperada');
    });
  });

  describe('1.4 Outbox Lifecycle & State Transitions Under High Load', () => {
    it('should accurately handle outbox state transitions (pending -> error -> pending retry -> synced)', async () => {
      const recordsCount = 20;

      // 1. Create 20 pending records
      const records: VentaOutbox[] = [];
      await database.write(async () => {
        const batch = [];
        for (let i = 0; i < recordsCount; i++) {
          const rec = database.get<VentaOutbox>('ventas_outbox').prepareCreate((record) => {
            record.payload = JSON.stringify({ saleId: `sale-${i}`, total: 50000 });
            record.status = 'pending';
          });
          records.push(rec);
          batch.push(rec);
        }
        await database.batch(...batch);
      });

      expect(records.length).toBe(recordsCount);

      // 2. Concurrently transition 10 to synced
      await Promise.all(
        records.slice(0, 10).map((rec: VentaOutbox) =>
          database.write(async () => {
            await rec.update((r: VentaOutbox) => {
              r.status = 'synced';
              r.syncedAt = new Date();
            });
          }),
        ),
      );

      // 3. Concurrently transition 10 to error with retry_count = 1
      await Promise.all(
        records.slice(10, 20).map((rec: VentaOutbox) =>
          database.write(async () => {
            await rec.update((r: VentaOutbox) => {
              r.status = 'error';
              r.errorMessage = 'Network timeout 504';
              r.retryCount = 1;
            });
          }),
        ),
      );

      // Verify intermediate counts
      const allRecordsAfterPhase1 = await database.get<VentaOutbox>('ventas_outbox').query().fetch();
      const syncedPhase1 = allRecordsAfterPhase1.filter((r) => r.status === 'synced');
      const errorPhase1 = allRecordsAfterPhase1.filter((r) => r.status === 'error');
      expect(syncedPhase1.length).toBe(10);
      expect(errorPhase1.length).toBe(10);

      // 4. Retry loop: transition the 10 errors back to pending with retryCount = 2
      await Promise.all(
        errorPhase1.map((rec: VentaOutbox) =>
          database.write(async () => {
            await rec.update((r: VentaOutbox) => {
              r.status = 'pending';
              r.errorMessage = null;
              r.retryCount = 2;
            });
          }),
        ),
      );

      const pendingRetrying = (await database.get<VentaOutbox>('ventas_outbox').query().fetch()).filter(
        (r) => r.status === 'pending',
      );
      expect(pendingRetrying.length).toBe(10);

      // 5. Finally sync the retried ones
      await Promise.all(
        pendingRetrying.map((rec: VentaOutbox) =>
          database.write(async () => {
            await rec.update((r: VentaOutbox) => {
              r.status = 'synced';
              r.syncedAt = new Date();
            });
          }),
        ),
      );

      // All 20 must now be synced
      const finalRecords = await database.get<VentaOutbox>('ventas_outbox').query().fetch();
      const allSynced = finalRecords.filter((r) => r.status === 'synced');
      expect(allSynced.length).toBe(20);
      allSynced.forEach((r) => {
        expect(r.syncedAt).toBeInstanceOf(Date);
      });
    });
  });
});

// ============================================================================
// PART 2: VENTATABLETSCREEN UI LOGIC ADVERSARIAL CHALLENGES
// ============================================================================

describe('ADVERSARIAL SUITE 2: VentaTabletScreen UI Edge Cases & Stress Scenarios', () => {
  describe('2.1 Fast Cash Calculations Edge Cases', () => {
    it('should correctly display shortage (faltante) when cash is LESS than total', () => {
      // Total = $38.000 (1 kg Lomo Fino)
      const { firePress, findByTestId } = renderScreen({ liveWeight: 1.000 });
      firePress('product-card-prod-res-01');

      // Pay with $20.000 bill
      firePress('btn-cash-20000');

      // Total = $38.000, Efectivo = $20.000, Faltante = $18.000
      expect(getElementText(findByTestId('gran-total-display'))).toBe('$ 38.000');
      expect(getElementText(findByTestId('efectivo-recibido-display'))).toBe('$ 20.000');

      // Shortage display must exist and show $ 18.000
      const faltanteDisplay = findByTestId('faltante-display');
      expect(faltanteDisplay).toBeTruthy();
      expect(getElementText(faltanteDisplay)).toBe('$ 18.000');

      // Cambio display must NOT exist
      const cambioDisplay = findByTestId('cambio-display');
      expect(cambioDisplay).toBeNull();

      // Cobrar button must be disabled
      const btnCobrar = findByTestId('btn-cobrar');
      expect(btnCobrar.props.accessibilityState?.disabled ?? btnCobrar.props.disabled).toBe(true);
    });

    it('should reject checkout when cash is insufficient even if firePress is called directly', () => {
      const onCobrarMock = jest.fn();
      const { firePress, findByTestId, getTree } = renderScreen({
        liveWeight: 1.000,
        onCobrar: onCobrarMock,
      });

      // Add $38.000 cut
      firePress('product-card-prod-res-01');
      // Pay only $10.000
      firePress('btn-cash-10000');

      // Attempt checkout
      firePress('btn-cobrar');

      // onCobrar MUST NOT have been called
      expect(onCobrarMock).not.toHaveBeenCalled();

      // Status message must show shortage warning
      const treeText = getElementText(getTree());
      expect(treeText).toContain('Efectivo insuficiente. Faltan $ 28.000');
    });

    it('should handle zero change (cambio = $0) when cash EXACTLY equals grand total', () => {
      const onCobrarMock = jest.fn();
      const { firePress, findByTestId } = renderScreen({
        liveWeight: 2.000,
        onCobrar: onCobrarMock,
      });

      // 2 kg Costilla de Res ($22.000 * 2 = $44.000)
      firePress('product-card-prod-res-02');
      expect(getElementText(findByTestId('gran-total-display'))).toBe('$ 44.000');

      // Press Exacto
      firePress('btn-cash-exacto');

      expect(getElementText(findByTestId('efectivo-recibido-display'))).toBe('$ 44.000');

      // Cambio display must exist and show exactly $ 0
      const cambioDisplay = findByTestId('cambio-display');
      expect(cambioDisplay).toBeTruthy();
      expect(getElementText(cambioDisplay)).toBe('$ 0');

      // Faltante display must NOT exist
      expect(findByTestId('faltante-display')).toBeNull();

      // Cobrar button must be active
      firePress('btn-cobrar');
      expect(onCobrarMock).toHaveBeenCalledTimes(1);
      const sale: CompletedSale = onCobrarMock.mock.calls[0][0];
      expect(sale.total).toBe(44000);
      expect(sale.efectivo).toBe(44000);
      expect(sale.cambio).toBe(0);
    });

    it('should handle MASSIVE cash amount ($10,000,000 COP) without arithmetic breakdown or overflow', () => {
      const onCobrarMock = jest.fn();
      const { firePress, findByTestId } = renderScreen({
        liveWeight: 1.000,
        onCobrar: onCobrarMock,
      });

      // Add Lomo Fino ($38.000)
      firePress('product-card-prod-res-01');

      // Simulate 100 presses of $100.000 bill = $10.000.000 COP
      for (let i = 0; i < 100; i++) {
        firePress('btn-cash-100000');
      }

      // Verify Cash = $ 10.000.000
      const cashDisplay = findByTestId('efectivo-recibido-display');
      expect(getElementText(cashDisplay)).toBe('$ 10.000.000');

      // Expected change: 10,000,000 - 38,000 = 9,962,000 COP
      const cambioDisplay = findByTestId('cambio-display');
      expect(cambioDisplay).toBeTruthy();
      expect(getElementText(cambioDisplay)).toBe('$ 9.962.000');

      // Complete sale
      firePress('btn-cobrar');
      expect(onCobrarMock).toHaveBeenCalledTimes(1);
      const sale: CompletedSale = onCobrarMock.mock.calls[0][0];
      expect(sale.total).toBe(38000);
      expect(sale.efectivo).toBe(10000000);
      expect(sale.cambio).toBe(9962000);
    });

    it('should allow clearing cash with "Limpiar" button when cash > 0', () => {
      const { firePress, findByTestId } = renderScreen();

      firePress('btn-cash-50000');
      expect(getElementText(findByTestId('efectivo-recibido-display'))).toBe('$ 50.000');

      // Press Limpiar
      firePress('btn-clear-cash');
      expect(getElementText(findByTestId('efectivo-recibido-display'))).toBe('$ 0');
    });
  });

  describe('2.2 Comanda Item Addition/Removal & Scale Zero Prevention', () => {
    it('should strictly BLOCK adding a weighted cut when liveWeight is 0.000 kg', () => {
      const { firePress, findByTestId, getTree } = renderScreen({ liveWeight: 0.000 });

      // Click on weighted cut (Lomo Fino)
      firePress('product-card-prod-res-01');

      // Grand total must remain $0
      expect(getElementText(findByTestId('gran-total-display'))).toBe('$ 0');

      // Status message must alert the cashier
      const treeText = getElementText(getTree());
      expect(treeText).toContain('Coloque el corte en la báscula (peso debe ser mayor a 0.000 kg)');

      // Ticket items list must still show empty state
      expect(treeText).toContain('Comanda vacía');
    });

    it('should strictly BLOCK adding a weighted cut when liveWeight is NEGATIVE (e.g. tare error -0.500 kg)', () => {
      const { firePress, findByTestId, getTree } = renderScreen({ liveWeight: -0.500 });

      firePress('product-card-prod-res-01');

      expect(getElementText(findByTestId('gran-total-display'))).toBe('$ 0');
      const treeText = getElementText(getTree());
      expect(treeText).toContain('Coloque el corte en la báscula');
    });

    it('should allow adding unit-based products even when liveWeight is 0.000 kg (US-03 mixed sale)', () => {
      const { firePress, findByTestId } = renderScreen({ liveWeight: 0.000 });

      // Select Cerdo tab -> Chorizo Casero (Unid) $3.500
      firePress('tab-category-Cerdo');
      firePress('product-card-prod-cer-05');

      // Grand total should be $3.500
      expect(getElementText(findByTestId('gran-total-display'))).toBe('$ 3.500');
    });

    it('should support mixed sales of multiple cuts and unit products in a single comanda (US-03)', () => {
      const { firePress, findByTestId, setProps } = renderScreen({ liveWeight: 1.500 });

      // 1. Add 1.500 kg of Lomo Fino ($38.000 * 1.5 = $57.000)
      firePress('product-card-prod-res-01');

      // 2. Change liveWeight to 2.000 kg for next cut
      setProps({ liveWeight: 2.000 });
      // Add 2.000 kg of Costilla de Res ($22.000 * 2 = $44.000)
      firePress('product-card-prod-res-02');

      // 3. Add 2 units of Chorizo Casero ($3.500 each)
      firePress('tab-category-Cerdo');
      firePress('product-card-prod-cer-05');
      firePress('product-card-prod-cer-05');

      // Expected Gran Total: 57,000 + 44,000 + 3,500 + 3,500 = $108.000
      expect(getElementText(findByTestId('gran-total-display'))).toBe('$ 108.000');
    });

    it('should correctly remove individual items from comanda and recalculate Gran Total', () => {
      const { firePress, findByTestId, findAllByTestId } = renderScreen({ liveWeight: 1.000 });

      // Add 2 products: Lomo Fino ($38.000) + Costilla de Res ($22.000)
      firePress('product-card-prod-res-01');
      firePress('product-card-prod-res-02');

      // Total = $60.000
      expect(getElementText(findByTestId('gran-total-display'))).toBe('$ 60.000');

      // Find remove buttons
      const removeButtons = findAllByTestId('remove-item-');
      expect(removeButtons.length).toBe(2);

      // Remove first item
      firePress(removeButtons[0].props.testID);

      // Remaining Total should be $38.000 (or $22.000 depending on order)
      const remainingTotalText = getElementText(findByTestId('gran-total-display'));
      expect(['$ 38.000', '$ 22.000']).toContain(remainingTotalText);
    });

    it('should completely clear the ticket and reset state with "Vaciar" comanda button', () => {
      const { firePress, findByTestId, getTree } = renderScreen({ liveWeight: 1.000 });

      // Add item and fast cash
      firePress('product-card-prod-res-01');
      firePress('btn-cash-50000');

      expect(getElementText(findByTestId('gran-total-display'))).toBe('$ 38.000');
      expect(getElementText(findByTestId('efectivo-recibido-display'))).toBe('$ 50.000');

      // Press Vaciar comanda
      firePress('btn-clear-ticket');

      expect(getElementText(findByTestId('gran-total-display'))).toBe('$ 0');
      expect(getElementText(findByTestId('efectivo-recibido-display'))).toBe('$ 0');
      expect(getElementText(getTree())).toContain('Comanda vacía');
    });
  });

  describe('2.3 Offline Mode Badge Rendering (EARS-SYNC-03)', () => {
    it('should render "Modo Sin Conexión (0 pendientes)" when offlineMode is true and pendingCount is 0', () => {
      const { findByTestId } = renderScreen({ offlineMode: true, pendingOutboxCount: 0 });

      const offlineBadge = findByTestId('offline-badge');
      expect(offlineBadge).toBeTruthy();
      expect(getElementText(offlineBadge)).toBe('●Modo Sin Conexión (0 pendientes)');
      expect(findByTestId('online-badge')).toBeNull();
    });

    it('should render "Modo Sin Conexión (1 pendientes)" when offlineMode is true and pendingCount is 1', () => {
      const { findByTestId } = renderScreen({ offlineMode: true, pendingOutboxCount: 1 });

      const offlineBadge = findByTestId('offline-badge');
      expect(offlineBadge).toBeTruthy();
      expect(getElementText(offlineBadge)).toBe('●Modo Sin Conexión (1 pendientes)');
      expect(findByTestId('online-badge')).toBeNull();
    });

    it('should render "Modo Sin Conexión (999 pendientes)" when offlineMode is true and pendingCount is 999', () => {
      const { findByTestId } = renderScreen({ offlineMode: true, pendingOutboxCount: 999 });

      const offlineBadge = findByTestId('offline-badge');
      expect(offlineBadge).toBeTruthy();
      expect(getElementText(offlineBadge)).toBe('●Modo Sin Conexión (999 pendientes)');
      expect(findByTestId('online-badge')).toBeNull();
    });

    it('should render "En Línea (Sincronizado)" when offlineMode is false regardless of pendingCount', () => {
      const { findByTestId } = renderScreen({ offlineMode: false, pendingOutboxCount: 999 });

      const onlineBadge = findByTestId('online-badge');
      expect(onlineBadge).toBeTruthy();
      expect(getElementText(onlineBadge)).toBe('●En Línea (Sincronizado)');
      expect(findByTestId('offline-badge')).toBeNull();
    });
  });
});
