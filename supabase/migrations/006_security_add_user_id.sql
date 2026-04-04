-- ============================================================
-- PASO 1: AGREGAR user_id A TODAS LAS TABLAS
-- Seguridad Multi-Tenant para MaqJeez
-- ============================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- IMPORTANTE: Ejecutar ANTES de que los usuarios empiecen a usar la app
-- ============================================================

-- ============================================================
-- 1. AGREGAR COLUMNA user_id A CADA TABLA
-- ============================================================

-- Tabla: reparaciones (órdenes de trabajo del taller)
ALTER TABLE reparaciones 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Tabla: stock (inventario de repuestos)
ALTER TABLE stock 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Tabla: repuestos_a_pedir (pedidos pendientes)
ALTER TABLE repuestos_a_pedir 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Tabla: pagos (registro de pagos)
ALTER TABLE pagos 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Tabla: plantillas_whatsapp
ALTER TABLE plantillas_whatsapp 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Tabla: historial_reparaciones (si existe)
ALTER TABLE historial_reparaciones 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Tabla: flex_envios (si existe)
ALTER TABLE flex_envios 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Tabla: etiquetas_history (historial de etiquetas)
ALTER TABLE etiquetas_history 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Tabla: etiquetas_stats (estadísticas)
ALTER TABLE etiquetas_stats 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Tabla: meli_printed_labels (etiquetas impresas legacy)
ALTER TABLE meli_printed_labels 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Tabla: ventas_repuestos (si existe)
ALTER TABLE ventas_repuestos 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Tabla: ventas_items (si existe)
ALTER TABLE ventas_items 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;


-- ============================================================
-- 2. CREAR ÍNDICES PARA PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_reparaciones_user_id ON reparaciones(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_user_id ON stock(user_id);
CREATE INDEX IF NOT EXISTS idx_repuestos_user_id ON repuestos_a_pedir(user_id);
CREATE INDEX IF NOT EXISTS idx_pagos_user_id ON pagos(user_id);
CREATE INDEX IF NOT EXISTS idx_plantillas_user_id ON plantillas_whatsapp(user_id);
CREATE INDEX IF NOT EXISTS idx_historial_reparaciones_user_id ON historial_reparaciones(user_id);
CREATE INDEX IF NOT EXISTS idx_flex_envios_user_id ON flex_envios(user_id);
CREATE INDEX IF NOT EXISTS idx_etiquetas_history_user_id ON etiquetas_history(user_id);
CREATE INDEX IF NOT EXISTS idx_etiquetas_stats_user_id ON etiquetas_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_meli_printed_labels_user_id ON meli_printed_labels(user_id);
CREATE INDEX IF NOT EXISTS idx_ventas_repuestos_user_id ON ventas_repuestos(user_id);
CREATE INDEX IF NOT EXISTS idx_ventas_items_user_id ON ventas_items(user_id);


-- ============================================================
-- 3. CREAR VISTA SEGURA PARA CUENTAS MELI
-- ============================================================

-- Vista que muestra las cuentas MeLi del usuario (sin tokens sensibles)
CREATE OR REPLACE VIEW user_meli_accounts_safe AS
SELECT 
  id,
  user_id,
  meli_user_id,
  meli_nickname,
  is_active,
  token_expiry_date,
  created_at,
  updated_at
FROM linked_meli_accounts;


-- ============================================================
-- VERIFICACIÓN - Ejecutar después para confirmar
-- ============================================================
-- SELECT column_name, table_name 
-- FROM information_schema.columns 
-- WHERE column_name = 'user_id' 
-- AND table_schema = 'public'
-- ORDER BY table_name;
-- ============================================================

-- Mensaje de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ PASO 1 COMPLETADO: Columnas user_id agregadas a todas las tablas';
  RAISE NOTICE '⚠️ IMPORTANTE: Los datos existentes tienen user_id = NULL';
  RAISE NOTICE '📝 SIGUIENTE PASO: Ejecutar 007_security_rls_policies.sql';
END $$;
