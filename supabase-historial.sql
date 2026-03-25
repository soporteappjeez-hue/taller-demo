-- ============================================================
-- HISTORIAL PERMANENTE DE CLIENTES — MAQJEEZ
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Tabla de historial INDEPENDIENTE de reparaciones
-- NO tiene FK hacia reparaciones → borrar una orden NO borra el historial
CREATE TABLE IF NOT EXISTS historial_reparaciones (
  id            TEXT PRIMARY KEY,
  cliente_id    UUID NOT NULL REFERENCES agenda_clientes(id) ON DELETE RESTRICT,
  orden_id      TEXT,                    -- referencia informativa, sin FK
  fecha_ingreso TIMESTAMPTZ NOT NULL,
  motor_type    TEXT NOT NULL DEFAULT '',
  brand         TEXT NOT NULL DEFAULT '',
  model         TEXT NOT NULL DEFAULT '',
  falla         TEXT NOT NULL DEFAULT '',
  trabajo       TEXT NOT NULL DEFAULT '',
  presupuesto   NUMERIC,
  estado_final  TEXT NOT NULL DEFAULT '',
  photo_urls    TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE historial_reparaciones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'historial_reparaciones'
    AND policyname = 'allow_all_historial'
  ) THEN
    CREATE POLICY "allow_all_historial"
      ON historial_reparaciones FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Poblar historial con todas las órdenes existentes
-- Une reparaciones con agenda_clientes por teléfono
INSERT INTO historial_reparaciones (
  id, cliente_id, orden_id, fecha_ingreso,
  motor_type, brand, model, falla, trabajo,
  presupuesto, estado_final, photo_urls
)
SELECT
  r.id || '_hist'        AS id,
  a.id                   AS cliente_id,
  r.id                   AS orden_id,
  r.entry_date           AS fecha_ingreso,
  r.motor_type,
  r.brand,
  r.model,
  r.reported_issues      AS falla,
  COALESCE(r.internal_notes, '') AS trabajo,
  r.budget               AS presupuesto,
  r.status               AS estado_final,
  COALESCE(r.photo_urls, '{}')
FROM reparaciones r
JOIN agenda_clientes a ON a.telefono = r.client_phone
ON CONFLICT (id) DO NOTHING;
