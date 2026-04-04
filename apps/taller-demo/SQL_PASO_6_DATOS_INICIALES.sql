-- ============================================================
-- PASO 6: INSERTAR DATOS INICIALES
-- Copia y pega esto en Supabase SQL Editor y ejecuta
-- ============================================================

-- Insertar tarifas Flex
INSERT INTO flex_tarifas (zona, label, precio) VALUES
  ('cercana', 'Zona Cercana', 4490),
  ('media', 'Zona Media', 6490),
  ('lejana', 'Zona Lejana', 8490)
ON CONFLICT (zona) DO UPDATE SET
  label = EXCLUDED.label,
  precio = EXCLUDED.precio;

-- Insertar plantillas WhatsApp
INSERT INTO plantillas_whatsapp (id, name, message, created_at) VALUES
  ('tpl_1', 'Presupuesto listo', 'Hola {{nombre}}, te informamos que el presupuesto para tu {{marca}} {{modelo}} ({{motor}}) está listo. Por favor comunicate con nosotros para confirmarlo. ¡Gracias por confiar en AppJeez!', NOW()),
  ('tpl_2', 'Equipo listo para retiro', 'Hola {{nombre}}, tu {{marca}} {{modelo}} ({{motor}}) ya está lista para ser retirada. Te esperamos en el local. ¡Gracias!', NOW()),
  ('tpl_3', 'Recordatorio de retiro', 'Hola {{nombre}}, te recordamos que tu {{marca}} {{modelo}} ({{motor}}) sigue esperando ser retirada en nuestro local. Comunicate con nosotros para coordinar la entrega.', NOW())
ON CONFLICT (id) DO NOTHING;

-- Mensaje de éxito
SELECT '✅ PASO 6 COMPLETADO: Datos iniciales insertados correctamente' as estado;
SELECT 'Tarifas Flex:' as info;
SELECT * FROM flex_tarifas;
SELECT 'Plantillas WhatsApp:' as info;
SELECT * FROM plantillas_whatsapp;
