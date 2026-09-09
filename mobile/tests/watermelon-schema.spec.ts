import { Database } from '@nozbe/watermelondb';
import { createTestDatabase } from './helpers/test-db';
import { schema } from '../src/database/schema';
import { Producto, Categoria, Lote, VentaOutbox, TurnoLocal } from '../src/database/models';

describe('WatermelonDB Schema & Models v1 Suite', () => {
  let database: Database;

  beforeEach(() => {
    database = createTestDatabase();
  });

  describe('1. Schema Validation', () => {
    it('should initialize schema with version 1 and 5 required tables', () => {
      expect(schema.version).toBe(1);
      const tableNames = Object.keys(schema.tables);
      expect(tableNames).toContain('productos');
      expect(tableNames).toContain('categorias');
      expect(tableNames).toContain('lotes');
      expect(tableNames).toContain('ventas_outbox');
      expect(tableNames).toContain('turnos');
      expect(tableNames.length).toBe(5);
    });

    it('should have indexed columns configured appropriately', () => {
      const productosTable = schema.tables['productos'];
      expect(productosTable.columns['categoria_id'].isIndexed).toBe(true);

      const lotesTable = schema.tables['lotes'];
      expect(lotesTable.columns['producto_id'].isIndexed).toBe(true);

      const outboxTable = schema.tables['ventas_outbox'];
      expect(outboxTable.columns['status'].isIndexed).toBe(true);
    });
  });

  describe('2. CRUD Operations (Categoria and Producto)', () => {
    it('should create, fetch, update, and delete a Categoria', async () => {
      const cat = await database.write(async () => {
        return await database.get<Categoria>('categorias').create((record) => {
          record.nombre = 'Res';
          record.ordenVisualizacion = 1;
          record.negocioId = 'negocio-001';
        });
      });

      expect(cat.id).toBeDefined();
      expect(cat.nombre).toBe('Res');
      expect(cat.ordenVisualizacion).toBe(1);

      // Read
      const found = await database.get<Categoria>('categorias').find(cat.id);
      expect(found.nombre).toBe('Res');

      // Update
      await database.write(async () => {
        await found.update((record) => {
          record.nombre = 'Carnes de Res';
        });
      });
      expect(found.nombre).toBe('Carnes de Res');

      // Delete (markAsDeleted)
      await database.write(async () => {
        await found.markAsDeleted();
      });

      const remaining = await database.get<Categoria>('categorias').query().fetch();
      expect(remaining.length).toBe(0);
    });

    it('should create and fetch a Producto with all attributes', async () => {
      const prod = await database.write(async () => {
        return await database.get<Producto>('productos').create((record) => {
          record.negocioId = 'negocio-001';
          record.categoriaId = 'cat-001';
          record.nombre = 'Lomo Fino de Res';
          record.codigoBarras = '7701234567890';
          record.tipoVenta = 'peso';
          record.unidadMedida = 'kg';
          record.precio = 38000;
          record.costoPromedio = 28000;
          record.fotoUrl = 'https://pos.carniceria.com/lomo.png';
          record.activo = true;
        });
      });

      expect(prod.id).toBeDefined();
      expect(prod.nombre).toBe('Lomo Fino de Res');
      expect(prod.tipoVenta).toBe('peso');
      expect(prod.unidadMedida).toBe('kg');
      expect(prod.precio).toBe(38000);
      expect(prod.activo).toBe(true);

      const prods = await database.get<Producto>('productos').query().fetch();
      expect(prods.length).toBe(1);
      expect(prods[0].nombre).toBe('Lomo Fino de Res');
    });
  });

  describe('3. Relational Associations', () => {
    it('should resolve belongs_to (producto -> categoria) and has_many (categoria -> productos)', async () => {
      const cat = await database.write(async () => {
        return await database.get<Categoria>('categorias').create((record) => {
          record.nombre = 'Cerdo';
          record.ordenVisualizacion = 2;
        });
      });

      const prod = await database.write(async () => {
        return await database.get<Producto>('productos').create((record) => {
          record.negocioId = 'neg-01';
          record.categoriaId = cat.id;
          record.nombre = 'Costilla de Cerdo';
          record.tipoVenta = 'peso';
          record.unidadMedida = 'kg';
          record.precio = 24500;
          record.activo = true;
        });
      });

      // producto.categoria.fetch()
      const fetchedCat = await prod.categoria.fetch();
      expect(fetchedCat).not.toBeNull();
      expect(fetchedCat?.id).toBe(cat.id);
      expect(fetchedCat?.nombre).toBe('Cerdo');

      // categoria.productos.fetch()
      const prodsInCat = await cat.productos.fetch();
      expect(prodsInCat.length).toBe(1);
      expect(prodsInCat[0].id).toBe(prod.id);
      expect(prodsInCat[0].nombre).toBe('Costilla de Cerdo');
    });

    it('should resolve has_many (producto -> lotes) and belongs_to (lote -> producto)', async () => {
      const prod = await database.write(async () => {
        return await database.get<Producto>('productos').create((record) => {
          record.negocioId = 'neg-01';
          record.categoriaId = 'cat-01';
          record.nombre = 'Pechuga de Pollo';
          record.tipoVenta = 'peso';
          record.unidadMedida = 'kg';
          record.precio = 18000;
          record.activo = true;
        });
      });

      const lote1 = await database.write(async () => {
        return await database.get<Lote>('lotes').create((record) => {
          record.productoId = prod.id;
          record.sucursalId = 'suc-01';
          record.codigoLote = 'LOT-POL-001';
          record.proveedor = 'Avícola Santa Rita';
          record.cantidadRecibida = 50.0;
          record.cantidadDisponible = 42.5;
          record.costoUnitario = 12000;
          record.fechaRecepcion = new Date('2026-09-05T08:00:00Z');
          record.fechaVencimiento = new Date('2026-09-12T08:00:00Z');
          record.temperaturaRecepcion = 3.2;
          record.estado = 'activo';
        });
      });

      const lote2 = await database.write(async () => {
        return await database.get<Lote>('lotes').create((record) => {
          record.productoId = prod.id;
          record.sucursalId = 'suc-01';
          record.codigoLote = 'LOT-POL-002';
          record.cantidadDisponible = 20.0;
          record.estado = 'activo';
        });
      });

      // producto.lotes.fetch()
      const lotes = await prod.lotes.fetch();
      expect(lotes.length).toBe(2);
      const lotCodes = lotes.map((l) => l.codigoLote);
      expect(lotCodes).toContain('LOT-POL-001');
      expect(lotCodes).toContain('LOT-POL-002');

      // lote.producto.fetch()
      const parentProd = await lote1.producto.fetch();
      expect(parentProd).not.toBeNull();
      expect(parentProd?.id).toBe(prod.id);
      expect(parentProd?.nombre).toBe('Pechuga de Pollo');
      expect(lote1.fechaRecepcion).toBeInstanceOf(Date);
      expect(lote1.temperaturaRecepcion).toBe(3.2);
    });
  });

  describe('4. Outbox & Turno Lifecycle', () => {
    it('should manage VentaOutbox status transitions from pending to synced', async () => {
      const salePayload = JSON.stringify({
        id: 'sale-client-uuid-001',
        sucursalId: 'suc-01',
        cajeroId: 'cajero-01',
        total: 76000,
        detalles: [{ productoId: 'prod-01', cantidad: 2.0, totalLinea: 76000 }],
      });

      const outboxRecord = await database.write(async () => {
        return await database.get<VentaOutbox>('ventas_outbox').create((record) => {
          record.payload = salePayload;
          record.status = 'pending';
        });
      });

      expect(outboxRecord.status).toBe('pending');
      expect(outboxRecord.createdAt).toBeInstanceOf(Date);
      expect(outboxRecord.syncedAt).toBeNull();

      // Query pending outbox records
      const pendingItems = await database
        .get<VentaOutbox>('ventas_outbox')
        .query()
        .fetch();
      const filtered = pendingItems.filter((item) => item.status === 'pending');
      expect(filtered.length).toBe(1);

      // Transition to synced
      const syncDate = new Date();
      await database.write(async () => {
        await outboxRecord.update((record) => {
          record.status = 'synced';
          record.syncedAt = syncDate;
        });
      });

      expect(outboxRecord.status).toBe('synced');
      expect(outboxRecord.syncedAt).toBeInstanceOf(Date);
    });

    it('should open and close a TurnoLocal shift properly', async () => {
      const turno = await database.write(async () => {
        return await database.get<TurnoLocal>('turnos').create((record) => {
          record.usuarioId = 'cajero-usr-01';
          record.sucursalId = 'sucursal-norte';
          record.dispositivoId = 'tablet-01';
          record.estado = 'abierta';
          record.montoApertura = 150000;
        });
      });

      expect(turno.estado).toBe('abierta');
      expect(turno.montoApertura).toBe(150000);
      expect(turno.fechaApertura).toBeInstanceOf(Date);
      expect(turno.fechaCierre).toBeNull();

      // Close shift
      const closeDate = new Date();
      await database.write(async () => {
        await turno.update((record) => {
          record.estado = 'cerrada';
          record.fechaCierre = closeDate;
          record.totalEfectivoEsperado = 450000;
          record.totalEfectivoContado = 450000;
          record.diferencia = 0;
        });
      });

      expect(turno.estado).toBe('cerrada');
      expect(turno.fechaCierre).toBeInstanceOf(Date);
      expect(turno.totalEfectivoEsperado).toBe(450000);
      expect(turno.totalEfectivoContado).toBe(450000);
      expect(turno.diferencia).toBe(0);
    });
  });

  describe('5. Reactive Query Observables (RxJS)', () => {
    it('should emit on initial observe and on subsequent inserts', async () => {
      const emissions: Producto[][] = [];

      const query = database.get<Producto>('productos').query();
      const subscription = query.observe().subscribe((prods) => {
        emissions.push([...prods]);
      });

      // Initial emission is empty
      expect(emissions.length).toBeGreaterThanOrEqual(1);
      expect(emissions[0].length).toBe(0);

      // Insert first product
      await database.write(async () => {
        await database.get<Producto>('productos').create((record) => {
          record.negocioId = 'neg-01';
          record.categoriaId = 'cat-01';
          record.nombre = 'Hígado de Res';
          record.tipoVenta = 'peso';
          record.unidadMedida = 'kg';
          record.precio = 12000;
          record.activo = true;
        });
      });

      expect(emissions.length).toBeGreaterThanOrEqual(2);
      const latestEmission = emissions[emissions.length - 1];
      expect(latestEmission.length).toBe(1);
      expect(latestEmission[0].nombre).toBe('Hígado de Res');

      subscription.unsubscribe();
    });
  });
});
