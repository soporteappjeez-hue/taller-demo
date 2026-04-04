-- ============================================================
-- PASO 5: CONFIGURAR ROW LEVEL SECURITY (RLS)
-- Copia y pega esto en Supabase SQL Editor y ejecuta
-- ============================================================

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

-- Políticas para service_role (backend)
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

-- Políticas para anon (demo sin autenticación)
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

-- Mensaje de éxito
SELECT '✅ PASO 5 COMPLETADO: RLS configurado correctamente' as estado;
