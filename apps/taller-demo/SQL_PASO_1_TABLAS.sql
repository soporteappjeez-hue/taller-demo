-- ============================================================
-- PASO 1: CREAR TODAS LAS TABLAS
-- Copia y pega esto en Supabase SQL Editor y ejecuta
-- ============================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- TABLA: reparaciones (órdenes de trabajo)
CREATE TABLE IF NOT EXISTS reparaciones (
  id                  TEXT PRIMARY KEY,
  client_name         TEXT NOT NULL,
  client_phone        TEXT NOT NULL,
  motor_type          TEXT NOT NULL CHECK (motor_type IN ('desmalezadora', 'motosierra', 'grupo_electrogeno', 'otros')),
  machine_type_other  TEXT,
  brand               TEXT NOT NULL,
  model               TEXT NOT NULL,
  reported_issues     TEXT NOT NULL,
  budget              INTEGER,
  estimated_days      INTEGER,
  status              TEXT NOT NULL DEFAULT 'ingresado' CHECK (status IN ('ingresado', 'diagnosticando', 'esperando_repuesto', 'en_reparacion', 'listo_para_retiro', 'entregado')),
  client_notification TEXT NOT NULL DEFAULT 'pendiente_de_aviso' CHECK (client_notification IN ('pendiente_de_aviso', 'avisado', 'sin_respuesta')),
  budget_accepted     BOOLEAN DEFAULT FALSE,
  entry_date          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completion_date     TIMESTAMPTZ,
  delivery_date       TIMESTAMPTZ,
  linked_parts        TEXT[] DEFAULT '{}',
  internal_notes      TEXT DEFAULT '',
  photo_urls          TEXT[] DEFAULT '{}',
  extra_machines      JSONB DEFAULT '[]',
  deposit             INTEGER DEFAULT 0,
  total_paid          INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABLA: stock (inventario)
CREATE TABLE IF NOT EXISTS stock (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 0,
  location     TEXT DEFAULT '',
  min_quantity INTEGER NOT NULL DEFAULT 0,
  notes        TEXT DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABLA: repuestos_a_pedir
CREATE TABLE IF NOT EXISTS repuestos_a_pedir (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  quantity          INTEGER NOT NULL DEFAULT 1,
  order_id          TEXT REFERENCES reparaciones(id) ON DELETE SET NULL,
  order_client_name TEXT,
  supplier          TEXT DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'pedido', 'recibido')),
  notes             TEXT DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABLA: pagos
CREATE TABLE IF NOT EXISTS pagos (
  id       TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES reparaciones(id) ON DELETE CASCADE,
  amount   INTEGER NOT NULL,
  method   TEXT NOT NULL CHECK (method IN ('efectivo', 'transferencia', 'tarjeta', 'otro')),
  notes    TEXT DEFAULT '',
  paid_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABLA: plantillas_whatsapp
CREATE TABLE IF NOT EXISTS plantillas_whatsapp (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABLA: agenda_clientes
CREATE TABLE IF NOT EXISTS agenda_clientes (
  id         TEXT PRIMARY KEY,
  nombre     TEXT NOT NULL,
  telefono   TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABLA: historial_reparaciones
CREATE TABLE IF NOT EXISTS historial_reparaciones (
  id            TEXT PRIMARY KEY,
  cliente_id    TEXT NOT NULL REFERENCES agenda_clientes(id) ON DELETE CASCADE,
  orden_id      TEXT,
  fecha_ingreso TEXT NOT NULL,
  motor_type    TEXT NOT NULL,
  brand         TEXT NOT NULL,
  model         TEXT NOT NULL,
  falla         TEXT NOT NULL,
  trabajo       TEXT DEFAULT '',
  presupuesto   INTEGER,
  estado_final  TEXT NOT NULL,
  photo_urls    TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABLA: flex_envios
CREATE TABLE IF NOT EXISTS flex_envios (
  id                  TEXT PRIMARY KEY,
  fecha               TEXT NOT NULL,
  localidad           TEXT NOT NULL,
  zona                TEXT NOT NULL CHECK (zona IN ('cercana', 'media', 'lejana')),
  precio_ml           INTEGER NOT NULL DEFAULT 0,
  pago_flete          INTEGER NOT NULL DEFAULT 0,
  ganancia            INTEGER NOT NULL DEFAULT 0,
  descripcion         TEXT DEFAULT '',
  nro_seguimiento     TEXT UNIQUE,
  usuario_ml          TEXT DEFAULT '',
  nombre_destinatario TEXT DEFAULT '',
  direccion           TEXT DEFAULT '',
  codigo_postal       TEXT DEFAULT '',
  producto_sku        TEXT DEFAULT '',
  pack_id             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABLA: flex_tarifas
CREATE TABLE IF NOT EXISTS flex_tarifas (
  zona   TEXT PRIMARY KEY CHECK (zona IN ('cercana', 'media', 'lejana')),
  label  TEXT NOT NULL,
  precio INTEGER NOT NULL DEFAULT 0
);

-- TABLA: ventas_repuestos
CREATE TABLE IF NOT EXISTS ventas_repuestos (
  id          TEXT PRIMARY KEY,
  vendedor    TEXT NOT NULL DEFAULT 'AppJeez',
  metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('efectivo', 'transferencia', 'debito', 'credito', 'mercado_pago')),
  total       INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'activa' CHECK (status IN ('activa', 'cancelada')),
  notas       TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABLA: ventas_items
CREATE TABLE IF NOT EXISTS ventas_items (
  id          TEXT PRIMARY KEY,
  venta_id    TEXT NOT NULL REFERENCES ventas_repuestos(id) ON DELETE CASCADE,
  producto    TEXT NOT NULL,
  sku         TEXT DEFAULT '',
  cantidad    INTEGER NOT NULL DEFAULT 1,
  precio_unit INTEGER NOT NULL DEFAULT 0,
  subtotal    INTEGER NOT NULL DEFAULT 0
);

-- Mensaje de éxito
SELECT '✅ PASO 1 COMPLETADO: Todas las tablas creadas correctamente' as estado;
