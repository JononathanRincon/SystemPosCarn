/**
 * Mock Data Helper
 * Generador de datos simulados para pruebas del sistema POS Carnicería
 */

export const mockNegocio = (overrides = {}) => ({
  id: "negocio-uuid-1111",
  nombre_comercial: "Carnicería La Esperanza",
  razon_social: "La Esperanza SAS",
  nit_rut: "900123456-7",
  plan: "pro",
  activo: true,
  fecha_registro: new Date(),
  ...overrides,
});

export const mockSucursal = (overrides = {}) => ({
  id: "sucursal-uuid-2222",
  negocio_id: "negocio-uuid-1111",
  nombre: "Sede Centro",
  direccion: "Calle 10 # 5-20",
  ciudad: "Bogotá",
  zona_horaria: "America/Bogota",
  activo: true,
  ...overrides,
});

export const mockUsuario = (overrides = {}) => ({
  id: "usuario-uuid-3333",
  negocio_id: "negocio-uuid-1111",
  sucursal_id: "sucursal-uuid-2222",
  rol_id: "rol-cajero-uuid",
  nombre_completo: "Carlos Pérez",
  email: "carlos@carniceria.com",
  pin_pos: "$2b$10$hashedpin1234",
  activo: true,
  ...overrides,
});

export const mockProductoPeso = (overrides = {}) => ({
  id: "prod-peso-uuid-4444",
  negocio_id: "negocio-uuid-1111",
  categoria_id: "cat-res-uuid",
  nombre: "Lomo Fino de Res",
  codigo_barras: "770123456789",
  tipo_venta: "peso",
  unidad_medida: "kg",
  precio: 38000.0,
  costo_promedio: 28000.0,
  activo: true,
  ...overrides,
});

export const mockProductoUnidad = (overrides = {}) => ({
  id: "prod-unidad-uuid-5555",
  negocio_id: "negocio-uuid-1111",
  categoria_id: "cat-embutidos-uuid",
  nombre: "Paquete Salchichas x6",
  codigo_barras: "770987654321",
  tipo_venta: "unidad",
  unidad_medida: "unidad",
  precio: 15000.0,
  costo_promedio: 10500.0,
  activo: true,
  ...overrides,
});

export const mockVentaOffline = (overrides = {}) => ({
  id: "venta-offline-uuid-9999",
  sucursal_id: "sucursal-uuid-2222",
  dispositivo_id: "disp-tablet-01",
  cajero_id: "usuario-uuid-3333",
  subtotal: 47500.0,
  descuento: 0.0,
  total: 47500.0,
  metodo_pago: "mixto",
  estado: "completada",
  fecha_hora_dispositivo: new Date().toISOString(),
  sincronizada: false,
  detalles: [
    {
      id: "detalle-uuid-1",
      producto_id: "prod-peso-uuid-4444",
      cantidad: 1.25, // 1.250 kg
      precio_unitario: 38000.0,
      subtotal_linea: 47500.0,
      peso_bruto: 1.255,
      peso_neto: 1.25,
    },
  ],
  pagos: [
    { metodo: "efectivo", monto: 20000.0 },
    { metodo: "tarjeta", monto: 27500.0, referencia_transaccion: "VOUCHER-987" },
  ],
  ...overrides,
});
