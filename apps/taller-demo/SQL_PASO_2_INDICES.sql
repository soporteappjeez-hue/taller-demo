-- ============================================================
-- PASO 2: CREAR ÍNDICES (para mejor rendimiento)
-- Copia y pega esto en Supabase SQL Editor y ejecuta
-- ============================================================

-- Índices para reparaciones
CREATE INDEX IF NOT EXISTS idx_reparaciones_entry_date ON reparaciones(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_reparaciones_status ON reparaciones(status);
CREATE INDEX IF NOT EXISTS idx_reparaciones_client_phone ON reparaciones(client_phone);

-- Índices para pagos
CREATE INDEX IF NOT EXISTS idx_pagos_order_id ON pagos(order_id);

-- Índices para agenda_clientes
CREATE INDEX IF NOT EXISTS idx_agenda_clientes_telefono ON agenda_clientes(telefono);

-- Índices para historial_reparaciones
CREATE INDEX IF NOT EXISTS idx_historial_cliente_id ON historial_reparaciones(cliente_id);

-- Índices para flex_envios
CREATE INDEX IF NOT EXISTS idx_flex_envios_fecha ON flex_envios(fecha DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_flex_envios_nro_seguimiento ON flex_envios(nro_seguimiento) WHERE nro_seguimiento IS NOT NULL;

-- Índices para ventas
CREATE INDEX IF NOT EXISTS idx_ventas_repuestos_created_at ON ventas_repuestos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_items_venta_id ON ventas_items(venta_id);

-- Mensaje de éxito
SELECT '✅ PASO 2 COMPLETADO: Todos los índices creados correctamente' as estado;
