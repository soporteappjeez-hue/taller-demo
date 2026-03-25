-- ============================================================
-- SCHEMA v2 — Taller MAQJEEZ
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- Incluye: tablas nuevas + columna photo_urls
-- ============================================================

-- Tabla principal de reparaciones (órdenes de trabajo)
CREATE TABLE IF NOT EXISTS reparaciones (
  id                  TEXT PRIMARY KEY,
  client_name         TEXT NOT NULL,
  client_phone        TEXT NOT NULL,
  motor_type          TEXT NOT NULL CHECK (motor_type IN ('2T', '4T')),
  brand               TEXT NOT NULL,
  model               TEXT NOT NULL,
  reported_issues     TEXT NOT NULL DEFAULT '',
  budget              NUMERIC,
  estimated_days      INTEGER,
  status              TEXT NOT NULL DEFAULT 'ingresado',
  client_notification TEXT NOT NULL DEFAULT 'pendiente_de_aviso',
  budget_accepted     BOOLEAN NOT NULL DEFAULT FALSE,
  entry_date          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completion_date     TIMESTAMPTZ,
  delivery_date       TIMESTAMPTZ,
  linked_parts        TEXT[] DEFAULT '{}',
  internal_notes      TEXT NOT NULL DEFAULT '',
  photo_urls          TEXT[] DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar photo_urls si la tabla ya existe (migración)
ALTER TABLE reparaciones ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';

-- Stock de repuestos
CREATE TABLE IF NOT EXISTS stock (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 0,
  location     TEXT NOT NULL DEFAULT '',
  min_quantity INTEGER NOT NULL DEFAULT 1,
  notes        TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Repuestos a pedir
CREATE TABLE IF NOT EXISTS repuestos_a_pedir (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  quantity           INTEGER NOT NULL DEFAULT 1,
  order_id           TEXT REFERENCES reparaciones(id) ON DELETE SET NULL,
  order_client_name  TEXT,
  supplier           TEXT NOT NULL DEFAULT '',
  status             TEXT NOT NULL DEFAULT 'pendiente',
  notes              TEXT NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Historial de notificaciones WhatsApp
CREATE TABLE IF NOT EXISTS notificaciones_enviadas (
  id           TEXT PRIMARY KEY,
  order_id     TEXT REFERENCES reparaciones(id) ON DELETE CASCADE,
  client_name  TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  type         TEXT NOT NULL,
  message      TEXT NOT NULL,
  sent_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Registro de pagos por orden
CREATE TABLE IF NOT EXISTS pagos (
  id        TEXT PRIMARY KEY,
  order_id  TEXT NOT NULL REFERENCES reparaciones(id) ON DELETE CASCADE,
  amount    NUMERIC NOT NULL,
  method    TEXT NOT NULL DEFAULT 'efectivo',
  notes     TEXT NOT NULL DEFAULT '',
  paid_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plantillas de mensajes WhatsApp
CREATE TABLE IF NOT EXISTS plantillas_whatsapp (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security ─────────────────────────────────────────
ALTER TABLE reparaciones            ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE repuestos_a_pedir       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones_enviadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantillas_whatsapp     ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas (MVP — anon key con acceso total)
CREATE POLICY IF NOT EXISTS "allow_all_reparaciones"            ON reparaciones            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_all_stock"                   ON stock                   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_all_repuestos_a_pedir"       ON repuestos_a_pedir       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_all_notificaciones_enviadas" ON notificaciones_enviadas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_all_pagos"                   ON pagos                   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_all_plantillas_whatsapp"     ON plantillas_whatsapp     FOR ALL USING (true) WITH CHECK (true);
