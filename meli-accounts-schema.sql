-- ============================================================
--  TABLA: meli_accounts
--  Almacena los tokens OAuth 2.0 de Mercado Libre por usuario
-- ============================================================

CREATE TABLE IF NOT EXISTS meli_accounts (
  id              uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  meli_user_id    text          NOT NULL UNIQUE,   -- ID numérico de MeLi (llave única)
  access_token    text          NOT NULL,           -- Token de acceso (caduca según expires_at)
  refresh_token   text          NOT NULL,           -- Token para renovar sin re-autorizar
  token_type      text          NOT NULL DEFAULT 'Bearer',
  expires_at      timestamptz   NOT NULL,           -- Fecha/hora de expiración del access_token
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);

-- Índice para búsquedas rápidas por meli_user_id
CREATE INDEX IF NOT EXISTS idx_meli_accounts_user_id ON meli_accounts (meli_user_id);

-- RLS: sólo el service_role puede leer/escribir (la Edge Function usa service_role)
ALTER TABLE meli_accounts ENABLE ROW LEVEL SECURITY;

-- Política: acceso total sólo para service_role (backend seguro)
CREATE POLICY "service_role_full_access" ON meli_accounts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
