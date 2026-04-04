-- ============================================================
-- VERIFICACIÓN FINAL: Comprobar que todo está bien
-- Copia y pega esto en Supabase SQL Editor y ejecuta
-- ============================================================

-- Verificar tablas creadas
SELECT 
  'TABLAS CREADAS' as categoria,
  table_name as nombre,
  '✅' as estado
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'reparaciones', 'stock', 'repuestos_a_pedir', 'pagos',
    'plantillas_whatsapp', 'agenda_clientes', 'historial_reparaciones',
    'flex_envios', 'flex_tarifas', 'ventas_repuestos', 'ventas_items'
  )
ORDER BY table_name;

-- Verificar funciones RPC
SELECT 
  'FUNCIONES RPC' as categoria,
  routine_name as nombre,
  '✅' as estado
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION'
  AND routine_name IN ('get_ventas_stats', 'get_ventas_por_dia', 'get_top_productos', 'update_updated_at_column')
ORDER BY routine_name;

-- Verificar datos iniciales
SELECT 'DATOS INICIALES' as categoria, 'Tarifas Flex' as nombre, COUNT(*)::text || ' registros' as estado FROM flex_tarifas
UNION ALL
SELECT 'DATOS INICIALES', 'Plantillas WhatsApp', COUNT(*)::text || ' registros' FROM plantillas_whatsapp;

-- Mensaje final
SELECT '🎉 ¡CONFIGURACIÓN COMPLETADA!' as mensaje;
SELECT 'Tu base de datos está lista para usar.' as info;
SELECT 'Ahora puedes ejecutar: npm run dev' as siguiente_paso;
