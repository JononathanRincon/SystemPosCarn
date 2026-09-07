-- ====================================================================
-- MIGRACIÓN 001: ESQUEMA INICIAL DEL SISTEMA POS CARNICERÍA (SUPABASE)
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMS
CREATE TYPE plan_negocio AS ENUM ('basico', 'pro', 'enterprise');
CREATE TYPE tipo_venta AS ENUM ('peso', 'unidad');
CREATE TYPE unidad_medida AS ENUM ('kg', 'g', 'unidad');
CREATE TYPE tipo_movimiento AS ENUM ('venta', 'merma', 'recepcion', 'ajuste_manual', 'devolucion');
CREATE TYPE motivo_merma AS ENUM ('corte_proceso', 'vencimiento', 'dano', 'robo', 'otro');
CREATE TYPE estado_venta AS ENUM ('completada', 'anulada');
CREATE TYPE estado_corte AS ENUM ('abierta', 'cerrada');
CREATE TYPE estado_lote AS ENUM ('activo', 'agotado', 'vencido', 'retirado');

-- TABLAS PRINCIPALES
CREATE TABLE negocios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_comercial VARCHAR(150) NOT NULL,
    razon_social VARCHAR(150) NOT NULL,
    nit_rut VARCHAR(50) NOT NULL,
    plan plan_negocio DEFAULT 'basico',
    activo BOOLEAN DEFAULT TRUE,
    fecha_registro TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sucursales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE RESTRICT,
    nombre VARCHAR(100) NOT NULL,
    direccion VARCHAR(200),
    ciudad VARCHAR(100),
    zona_horaria VARCHAR(50) DEFAULT 'America/Bogota',
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE SET NULL,
    nombre_completo VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    pin_pos_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(50) NOT NULL,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    orden_visualizacion INT DEFAULT 0
);

CREATE TABLE productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
    nombre VARCHAR(150) NOT NULL,
    codigo_barras VARCHAR(100),
    tipo_venta tipo_venta NOT NULL,
    unidad_medida unidad_medida NOT NULL,
    precio NUMERIC(12,2) NOT NULL,
    costo_promedio NUMERIC(12,2) DEFAULT 0.00,
    foto_url TEXT,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(50),
    saldo_fiado NUMERIC(12,2) DEFAULT 0.00,
    limite_credito NUMERIC(12,2) DEFAULT 0.00
);

CREATE TABLE inventarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    cantidad_actual NUMERIC(10,3) DEFAULT 0.000,
    cantidad_minima_alerta NUMERIC(10,3) DEFAULT 5.000,
    version INT DEFAULT 1,
    ultima_actualizacion TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(producto_id, sucursal_id)
);

CREATE TABLE recepciones_mercancia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    proveedor VARCHAR(150) NOT NULL,
    fecha_recepcion TIMESTAMPTZ DEFAULT NOW(),
    observaciones TEXT,
    sincronizado BOOLEAN DEFAULT TRUE
);

CREATE TABLE lotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    recepcion_id UUID REFERENCES recepciones_mercancia(id) ON DELETE SET NULL,
    codigo_lote VARCHAR(100) NOT NULL,
    proveedor VARCHAR(150) NOT NULL,
    cantidad_recibida NUMERIC(10,3) NOT NULL,
    cantidad_disponible NUMERIC(10,3) NOT NULL,
    costo_unitario NUMERIC(12,2) NOT NULL,
    fecha_recepcion TIMESTAMPTZ DEFAULT NOW(),
    fecha_vencimiento DATE,
    temperatura_recepcion NUMERIC(4,1),
    estado estado_lote DEFAULT 'activo',
    notas TEXT,
    sincronizado BOOLEAN DEFAULT TRUE
);

CREATE TABLE movimientos_inventario (
    id UUID PRIMARY KEY, -- Generado offline en terminal
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    dispositivo_id UUID NOT NULL,
    lote_id UUID REFERENCES lotes(id) ON DELETE SET NULL,
    tipo tipo_movimiento NOT NULL,
    cantidad_delta NUMERIC(10,3) NOT NULL,
    referencia_id UUID,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    fecha_hora_dispositivo TIMESTAMPTZ NOT NULL,
    fecha_hora_servidor TIMESTAMPTZ DEFAULT NOW(),
    sincronizado BOOLEAN DEFAULT TRUE
);

CREATE TABLE mermas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    lote_id UUID REFERENCES lotes(id) ON DELETE SET NULL,
    dispositivo_id UUID NOT NULL,
    cantidad NUMERIC(10,3) NOT NULL,
    motivo motivo_merma NOT NULL,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    foto_evidencia_url TEXT,
    fecha_hora_dispositivo TIMESTAMPTZ NOT NULL
);

CREATE TABLE ventas (
    id UUID PRIMARY KEY, -- Generado offline (idempotencia)
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    dispositivo_id UUID NOT NULL,
    cajero_id UUID NOT NULL REFERENCES usuarios(id),
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    subtotal NUMERIC(12,2) NOT NULL,
    descuento NUMERIC(12,2) DEFAULT 0.00,
    total NUMERIC(12,2) NOT NULL,
    metodo_pago VARCHAR(30) NOT NULL,
    estado estado_venta DEFAULT 'completada',
    fecha_hora_dispositivo TIMESTAMPTZ NOT NULL,
    fecha_hora_servidor TIMESTAMPTZ DEFAULT NOW(),
    sincronizada BOOLEAN DEFAULT TRUE
);

CREATE TABLE detalles_venta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad NUMERIC(10,3) NOT NULL,
    precio_unitario NUMERIC(12,2) NOT NULL,
    subtotal_linea NUMERIC(12,2) NOT NULL,
    peso_bruto NUMERIC(10,3),
    peso_neto NUMERIC(10,3)
);

CREATE TABLE pagos_venta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    metodo VARCHAR(30) NOT NULL,
    monto NUMERIC(12,2) NOT NULL,
    referencia_transaccion VARCHAR(100)
);

CREATE TABLE cortes_caja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    dispositivo_id UUID,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    estado estado_corte DEFAULT 'abierta',
    fecha_apertura TIMESTAMPTZ NOT NULL,
    fecha_cierre TIMESTAMPTZ,
    monto_apertura NUMERIC(12,2) NOT NULL,
    total_efectivo_esperado NUMERIC(12,2) DEFAULT 0.00,
    total_efectivo_contado NUMERIC(12,2) DEFAULT 0.00,
    diferencia NUMERIC(12,2) DEFAULT 0.00,
    totales_por_metodo_pago JSONB DEFAULT '{}'::jsonb,
    observaciones TEXT
);

CREATE TABLE dispositivos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    nombre_alias VARCHAR(100) NOT NULL,
    modelo VARCHAR(100),
    sistema_operativo VARCHAR(100),
    token_dispositivo VARCHAR(255) UNIQUE NOT NULL,
    ultima_sincronizacion TIMESTAMPTZ,
    activo BOOLEAN DEFAULT TRUE
);

-- ====================================================================
-- ACTIVACIÓN DE ROW LEVEL SECURITY (RLS) PARA MULTI-TENANT SEGURO
-- ====================================================================
ALTER TABLE negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE recepciones_mercancia ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE mermas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalles_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortes_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispositivos ENABLE ROW LEVEL SECURITY;
