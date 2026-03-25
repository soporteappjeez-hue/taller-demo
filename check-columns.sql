-- ============================================================
-- DIAGNÓSTICO: Ver columnas reales de la tabla reparaciones
-- Correr en: Supabase Dashboard → SQL Editor
-- ============================================================

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'reparaciones'
ORDER BY ordinal_position;
