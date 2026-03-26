-- ============================================================
--  APPJEEZ — OAUTH 2.0 MERCADO LIBRE con pgcrypto
--  Ejecutar en Supabase SQL Editor
-- ============================================================

-- ── PARTE 1: Extensiones ─────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── PARTE 2: Ajustar tabla existente ─────────────────────────
-- Eliminar columnas del esquema Vault anterior (si existen)
ALTER TABLE public.meli_accounts
  DROP COLUMN IF EXISTS access_token_id,
  DROP COLUMN IF EXISTS refresh_token_id;

-- Agregar columnas de tokens encriptados con pgcrypto
ALTER TABLE public.meli_accounts
  ADD COLUMN IF NOT EXISTS access_token_enc  text,
  ADD COLUMN IF NOT EXISTS refresh_token_enc text,
  ADD COLUMN IF NOT EXISTS nickname          text,
  ADD COLUMN IF NOT EXISTS user_id           uuid,
  ADD COLUMN IF NOT EXISTS status            text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz NOT NULL DEFAULT now();

-- Constraint de status
ALTER TABLE public.meli_accounts
  DROP CONSTRAINT IF EXISTS meli_accounts_status_check;
ALTER TABLE public.meli_accounts
  ADD CONSTRAINT meli_accounts_status_check
  CHECK (status IN ('active','expired','revoked'));

-- Índices
CREATE INDEX IF NOT EXISTS idx_meli_accounts_expires_at ON public.meli_accounts (expires_at);
CREATE INDEX IF NOT EXISTS idx_meli_accounts_user_id    ON public.meli_accounts (user_id);

-- ── PARTE 3: RLS ─────────────────────────────────────────────
ALTER TABLE public.meli_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON public.meli_accounts;
CREATE POLICY "service_role_full_access" ON public.meli_accounts
  FOR ALL
  USING    (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "owner_can_read" ON public.meli_accounts;
CREATE POLICY "owner_can_read" ON public.meli_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

-- ── PARTE 4: Función upsert (guarda tokens ya encriptados) ────
-- La Edge Function encripta con AES-GCM antes de llamar esta función.
-- La DB sólo recibe y almacena texto encriptado (nunca texto plano).
CREATE OR REPLACE FUNCTION public.upsert_meli_account(
  p_meli_user_id    bigint,
  p_nickname        text,
  p_access_token    text,   -- ya viene encriptado (base64 AES-GCM)
  p_refresh_token   text,   -- ya viene encriptado (base64 AES-GCM)
  p_expires_at      timestamptz,
  p_user_id         uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.meli_accounts
    (meli_user_id, nickname, access_token_enc, refresh_token_enc,
     expires_at, status, user_id, updated_at)
  VALUES
    (p_meli_user_id, p_nickname, p_access_token, p_refresh_token,
     p_expires_at, 'active', p_user_id, now())
  ON CONFLICT (meli_user_id) DO UPDATE SET
    nickname          = EXCLUDED.nickname,
    access_token_enc  = EXCLUDED.access_token_enc,
    refresh_token_enc = EXCLUDED.refresh_token_enc,
    expires_at        = EXCLUDED.expires_at,
    status            = 'active',
    updated_at        = now();
END;
$$;

-- ── PARTE 5: Función para obtener cuentas próximas a expirar ─
-- Devuelve filas con tokens encriptados; la Edge Function desencripta.
CREATE OR REPLACE FUNCTION public.get_meli_accounts_to_refresh(
  p_threshold timestamptz DEFAULT (now() + interval '30 minutes')
)
RETURNS TABLE (
  id               uuid,
  meli_user_id     bigint,
  nickname         text,
  access_token_enc text,
  refresh_token_enc text,
  expires_at       timestamptz,
  status           text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, meli_user_id, nickname, access_token_enc, refresh_token_enc, expires_at, status
    FROM public.meli_accounts
   WHERE status = 'active'
     AND expires_at <= p_threshold;
$$;

-- ── PARTE 6: Función para marcar cuenta como expirada ────────
CREATE OR REPLACE FUNCTION public.expire_meli_account(p_meli_user_id bigint)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.meli_accounts
     SET status = 'expired', updated_at = now()
   WHERE meli_user_id = p_meli_user_id;
$$;
