-- ============================================================
-- APPJEEZ DEMO - SCRIPTS SQL PARA SUPABASE
-- Configuración completa de base de datos
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. HABILITAR EXTENSIONES NECESARIAS
-- ─────────────────────────────────────────────────────────────

-- Habilitar UUID (generalmente ya viene habilitado)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- 2. TABLAS PRINCIPALES
-- ─────────────────────────────────────────────────────────────

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

-- Índices para reparaciones
CREATE INDEX IF NOT EXISTS idx_reparaciones_entry_date ON reparaciones(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_reparaciones_status ON reparaciones(status);
CREATE INDEX IF NOT EXISTS idx_reparaciones_client_phone ON reparaciones(client_phone);

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

-- TABLA: pagos (de órdenes de trabajo)
CREATE TABLE IF NOT EXISTS pagos (
  id       TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES reparaciones(id) ON DELETE CASCADE,
  amount   INTEGER NOT NULL,
  method   TEXT NOT NULL CHECK (method IN ('efectivo', 'transferencia', 'tarjeta', 'otro')),
  notes    TEXT DEFAULT '',
  paid_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para pagos
CREATE INDEX IF NOT EXISTS idx_pagos_order_id ON pagos(order_id);

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

-- Índice para agenda_clientes
CREATE INDEX IF NOT EXISTS idx_agenda_clientes_telefono ON agenda_clientes(telefono);

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

-- Índice para historial_reparaciones
CREATE INDEX IF NOT EXISTS idx_historial_cliente_id ON historial_reparaciones(cliente_id);

-- TABLA: flex_envios (logística Mercado Libre Flex)
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

-- Índices para flex_envios
CREATE INDEX IF NOT EXISTS idx_flex_envios_fecha ON flex_envios(fecha DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_flex_envios_nro_seguimiento ON flex_envios(nro_seguimiento) WHERE nro_seguimiento IS NOT NULL;

-- TABLA: flex_tarifas (tarifas por zona)
CREATE TABLE IF NOT EXISTS flex_tarifas (
  zona   TEXT PRIMARY KEY CHECK (zona IN ('cercana', 'media', 'lejana')),
  label  TEXT NOT NULL,
  precio INTEGER NOT NULL DEFAULT 0
);

-- Insertar tarifas por defecto
INSERT INTO flex_tarifas (zona, label, precio) VALUES
  ('cercana', 'Zona Cercana', 4490),
  ('media', 'Zona Media', 6490),
  ('lejana', 'Zona Lejana', 8490)
ON CONFLICT (zona) DO UPDATE SET
  label = EXCLUDED.label,
  precio = EXCLUDED.precio;

-- TABLA: ventas_repuestos (ventas de productos)
CREATE TABLE IF NOT EXISTS ventas_repuestos (
  id          TEXT PRIMARY KEY,
  vendedor    TEXT NOT NULL DEFAULT 'AppJeez',
  metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('efectivo', 'transferencia', 'debito', 'credito', 'mercado_pago')),
  total       INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'activa' CHECK (status IN ('activa', 'cancelada')),
  notas       TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para ventas_repuestos
CREATE INDEX IF NOT EXISTS idx_ventas_repuestos_created_at ON ventas_repuestos(created_at DESC);

-- TABLA: ventas_items (items de cada venta)
CREATE TABLE IF NOT EXISTS ventas_items (
  id          TEXT PRIMARY KEY,
  venta_id    TEXT NOT NULL REFERENCES ventas_repuestos(id) ON DELETE CASCADE,
  producto    TEXT NOT NULL,
  sku         TEXT DEFAULT '',
  cantidad    INTEGER NOT NULL DEFAULT 1,
  precio_unit INTEGER NOT NULL DEFAULT 0,
  subtotal    INTEGER NOT NULL DEFAULT 0
);

-- Índice para ventas_items
CREATE INDEX IF NOT EXISTS idx_ventas_items_venta_id ON ventas_items(venta_id);

-- ─────────────────────────────────────────────────────────────
-- 3. FUNCIONES RPC PARA ESTADÍSTICAS
-- ─────────────────────────────────────────────────────────────

-- FUNCIÓN: get_ventas_stats (estadísticas generales)
CREATE OR REPLACE FUNCTION get_ventas_stats(
  fecha_desde TEXT,
  fecha_hasta TEXT
)
RETURNS TABLE (
  total_facturado BIGINT,
  cant_ventas BIGINT,
  metodo_top TEXT,
  producto_top TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(v.total), 0)::BIGINT as total_facturado,
    COUNT(v.id)::BIGINT as cant_ventas,
    (SELECT metodo_pago FROM ventas_repuestos 
     WHERE created_at >= fecha_desde::timestamp 
       AND created_at <= (fecha_hasta::timestamp + INTERVAL '23:59:59')
       AND status = 'activa'
     GROUP BY metodo_pago 
     ORDER BY COUNT(*) DESC 
     LIMIT 1) as metodo_top,
    (SELECT vi.producto FROM ventas_items vi
     JOIN ventas_repuestos v ON vi.venta_id = v.id
     WHERE v.created_at >= fecha_desde::timestamp 
       AND v.created_at <= (fecha_hasta::timestamp + INTERVAL '23:59:59')
       AND v.status = 'activa'
     GROUP BY vi.producto 
     ORDER BY SUM(vi.cantidad) DESC 
     LIMIT 1) as producto_top
  FROM ventas_repuestos v
  WHERE v.created_at >= fecha_desde::timestamp
    AND v.created_at <= (fecha_hasta::timestamp + INTERVAL '23:59:59')
    AND v.status = 'activa';
END;
$$;

-- FUNCIÓN: get_ventas_por_dia (ventas agrupadas por día)
CREATE OR REPLACE FUNCTION get_ventas_por_dia(
  fecha_desde TEXT,
  fecha_hasta TEXT
)
RETURNS TABLE (
  dia TEXT,
  total BIGINT,
  cant BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(v.created_at, 'YYYY-MM-DD') as dia,
    SUM(v.total)::BIGINT as total,
    COUNT(v.id)::BIGINT as cant
  FROM ventas_repuestos v
  WHERE v.created_at >= fecha_desde::timestamp
    AND v.created_at <= (fecha_hasta::timestamp + INTERVAL '23:59:59')
    AND v.status = 'activa'
  GROUP BY TO_CHAR(v.created_at, 'YYYY-MM-DD')
  ORDER BY dia;
END;
$$;

-- FUNCIÓN: get_top_productos (productos más vendidos)
CREATE OR REPLACE FUNCTION get_top_productos(
  fecha_desde TEXT,
  fecha_hasta TEXT,
  top_n INTEGER DEFAULT 5
)
RETURNS TABLE (
  producto TEXT,
  cantidad BIGINT,
  total BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vi.producto,
    SUM(vi.cantidad)::BIGINT as cantidad,
    SUM(vi.subtotal)::BIGINT as total
  FROM ventas_items vi
  JOIN ventas_repuestos v ON vi.venta_id = v.id
  WHERE v.created_at >= fecha_desde::timestamp
    AND v.created_at <= (fecha_hasta::timestamp + INTERVAL '23:59:59')
    AND v.status = 'activa'
  GROUP BY vi.producto
  ORDER BY cantidad DESC
  LIMIT top_n;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. TRIGGERS PARA UPDATED_AT
-- ─────────────────────────────────────────────────────────────

-- Función genérica para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para cada tabla con updated_at
CREATE TRIGGER update_reparaciones_updated_at
  BEFORE UPDATE ON reparaciones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_updated_at
  BEFORE UPDATE ON stock
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repuestos_a_pedir_updated_at
  BEFORE UPDATE ON repuestos_a_pedir
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_historial_reparaciones_updated_at
  BEFORE UPDATE ON historial_reparaciones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 5. POLÍTICAS RLS (Row Level Security)
-- ─────────────────────────────────────────────────────────────

-- Habilitar RLS en todas las tablas
ALTER TABLE reparaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE repuestos_a_pedir ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantillas_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_reparaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE flex_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE flex_tarifas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_repuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_items ENABLE ROW LEVEL SECURITY;

-- Política: Permitir todo para usuarios autenticados con service_role
-- (Esto es para el backend, el frontend usa ANON key)
CREATE POLICY "Service role full access" ON reparaciones FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON stock FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON repuestos_a_pedir FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON pagos FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON plantillas_whatsapp FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON agenda_clientes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON historial_reparaciones FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON flex_envios FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON flex_tarifas FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON ventas_repuestos FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON ventas_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Política: Permitir todo para usuarios anónimos (demo sin autenticación)
-- IMPORTANTE: En producción, deshabilitar estas políticas y usar autenticación real
CREATE POLICY "Anon full access" ON reparaciones FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access" ON stock FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access" ON repuestos_a_pedir FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access" ON pagos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access" ON plantillas_whatsapp FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access" ON agenda_clientes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access" ON historial_reparaciones FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access" ON flex_envios FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access" ON flex_tarifas FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access" ON ventas_repuestos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access" ON ventas_items FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 6. PLANTILLAS WHATSAPP POR DEFECTO
-- ─────────────────────────────────────────────────────────────

INSERT INTO plantillas_whatsapp (id, name, message, created_at) VALUES
  ('tpl_1', 'Presupuesto listo', 'Hola {{nombre}}, te informamos que el presupuesto para tu {{marca}} {{modelo}} ({{motor}}) está listo. Por favor comunicate con nosotros para confirmarlo. ¡Gracias por confiar en AppJeez!', NOW()),
  ('tpl_2', 'Equipo listo para retiro', 'Hola {{nombre}}, tu {{marca}} {{modelo}} ({{motor}}) ya está lista para ser retirada. Te esperamos en el local. ¡Gracias!', NOW()),
  ('tpl_3', 'Recordatorio de retiro', 'Hola {{nombre}}, te recordamos que tu {{marca}} {{modelo}} ({{motor}}) sigue esperando ser retirada en nuestro local. Comunicate con nosotros para coordinar la entrega.', NOW())
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 7. CONFIGURACIÓN DE STORAGE (EJECUTAR EN SUPABASE DASHBOARD)
-- ─────────────────────────────────────────────────────────────

-- IMPORTANTE: Crear el bucket "fotos-maquinas" manualmente en:
-- Supabase Dashboard → Storage → Create a new bucket
-- Nombre: fotos-maquinas
-- ✅ Public bucket (marcar como público)

-- Política para el bucket (ejecutar después de crear el bucket):
/*
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-maquinas', 'fotos-maquinas', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'fotos-maquinas');

CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fotos-maquinas');

CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'fotos-maquinas');

CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'fotos-maquinas');

-- Para demo sin autenticación, permitir todo a anon:
CREATE POLICY "Anon can upload"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'fotos-maquinas');

CREATE POLICY "Anon can update"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'fotos-maquinas');

CREATE POLICY "Anon can delete"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'fotos-maquinas');
*/

-- ─────────────────────────────────────────────────────────────
-- 8. VARIABLES DE ENTORNO NECESARIAS
-- ─────────────────────────────────────────────────────────────

-- En Railway (Variables de entorno):
-- NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
-- NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
-- SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

-- En Supabase Dashboard → Settings → API:
-- - URL: tu NEXT_PUBLIC_SUPABASE_URL
-- - anon public: tu NEXT_PUBLIC_SUPABASE_ANON_KEY
-- - service_role: tu SUPABASE_SERVICE_ROLE_KEY

-- ─────────────────────────────────────────────────────────────
-- 9. VERIFICACIÓN
-- ─────────────────────────────────────────────────────────────

-- Verificar que todas las tablas existen
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'reparaciones', 'stock', 'repuestos_a_pedir', 'pagos',
    'plantillas_whatsapp', 'agenda_clientes', 'historial_reparaciones',
    'flex_envios', 'flex_tarifas', 'ventas_repuestos', 'ventas_items'
  )
ORDER BY table_name;

-- Verificar funciones RPC
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION'
  AND routine_name IN ('get_ventas_stats', 'get_ventas_por_dia', 'get_top_productos', 'update_updated_at_column');

-- ─────────────────────────────────────────────────────────────
-- FIN DEL SCRIPT
-- ─────────────────────────────────────────────────────────────
