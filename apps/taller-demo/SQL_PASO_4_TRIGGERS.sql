-- ============================================================
-- PASO 4: CREAR TRIGGERS PARA UPDATED_AT AUTOMÁTICO
-- Copia y pega esto en Supabase SQL Editor y ejecuta
-- ============================================================

-- Función genérica para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para cada tabla
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

-- Mensaje de éxito
SELECT '✅ PASO 4 COMPLETADO: Triggers creados correctamente' as estado;
