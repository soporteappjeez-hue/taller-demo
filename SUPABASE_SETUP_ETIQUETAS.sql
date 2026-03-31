-- ============================================================================
-- TABLAS PARA GESTOR DE EXPEDICIÓN 2.0 (ETIQUETAS INTELIGENTES)
-- ============================================================================
-- Copiar TODO este contenido en Supabase → SQL Editor y ejecutar
-- ============================================================================

-- 1. TABLA: etiquetas_history
-- Almacena el historial de CADA etiqueta impresa con datos de zona y logística
CREATE TABLE IF NOT EXISTS etiquetas_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación
  shipment_id BIGINT NOT NULL,
  account_id TEXT NOT NULL,
  
  -- Datos de logística
  shipping_type TEXT NOT NULL,  -- 'flex', 'correo', 'turbo', 'full'
  status TEXT NOT NULL,         -- 'pending', 'printed', 'cancelled'
  
  -- Datos del cliente y producto
  buyer_name TEXT,
  buyer_nickname TEXT,
  product_title TEXT,
  product_image_url TEXT,
  
  -- Zona de distancia (cercana: <=2 días, media: 3-7 días, larga: >7 días)
  zone_distance TEXT NOT NULL,  -- 'cercana', 'media', 'larga', 'desconocida'
  
  -- Metadatos
  label_url TEXT,               -- URL al PDF o ZPL descargado
  printed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_account FOREIGN KEY (account_id) REFERENCES user_mercadolibre_accounts(nickname),
  CONSTRAINT unique_shipment UNIQUE(shipment_id)
);

-- Índices para velocidad de query
CREATE INDEX IF NOT EXISTS idx_etiquetas_account ON etiquetas_history(account_id);
CREATE INDEX IF NOT EXISTS idx_etiquetas_status ON etiquetas_history(status);
CREATE INDEX IF NOT EXISTS idx_etiquetas_zone ON etiquetas_history(zone_distance);
CREATE INDEX IF NOT EXISTS idx_etiquetas_shipping_type ON etiquetas_history(shipping_type);
CREATE INDEX IF NOT EXISTS idx_etiquetas_created_at ON etiquetas_history(created_at);


-- 2. TABLA: etiquetas_stats
-- Precalculadas diarias para PERFORMANCE de reportes
-- Se actualiza cada vez que se marca una etiqueta como impresa
CREATE TABLE IF NOT EXISTS etiquetas_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación
  account_id TEXT NOT NULL,
  
  -- Período (YYYY-MM-DD)
  stat_date DATE NOT NULL,
  stat_week TEXT,  -- 'YYYY-W##' para queries semanales
  stat_month TEXT, -- 'YYYY-MM' para queries mensuales
  
  -- Conteos por zona
  zone_cercana_total INT DEFAULT 0,
  zone_cercana_printed INT DEFAULT 0,
  zone_media_total INT DEFAULT 0,
  zone_media_printed INT DEFAULT 0,
  zone_larga_total INT DEFAULT 0,
  zone_larga_printed INT DEFAULT 0,
  
  -- Conteos por tipo (dentro de cada zona)
  zone_cercana_flex INT DEFAULT 0,
  zone_cercana_correo INT DEFAULT 0,
  zone_cercana_turbo INT DEFAULT 0,
  zone_media_flex INT DEFAULT 0,
  zone_media_correo INT DEFAULT 0,
  zone_media_turbo INT DEFAULT 0,
  zone_larga_flex INT DEFAULT 0,
  zone_larga_correo INT DEFAULT 0,
  zone_larga_turbo INT DEFAULT 0,
  
  -- Metadatos
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_account_stats FOREIGN KEY (account_id) REFERENCES user_mercadolibre_accounts(nickname),
  CONSTRAINT unique_stat UNIQUE(account_id, stat_date)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_stats_account ON etiquetas_stats(account_id);
CREATE INDEX IF NOT EXISTS idx_stats_date ON etiquetas_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_stats_week ON etiquetas_stats(stat_week);
CREATE INDEX IF NOT EXISTS idx_stats_month ON etiquetas_stats(stat_month);


-- 3. TRIGGER: Actualizar updated_at en etiquetas_history
CREATE OR REPLACE FUNCTION update_etiquetas_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_etiquetas_history_updated_at ON etiquetas_history;
CREATE TRIGGER trigger_etiquetas_history_updated_at
  BEFORE UPDATE ON etiquetas_history
  FOR EACH ROW
  EXECUTE FUNCTION update_etiquetas_history_updated_at();


-- 4. TRIGGER: Actualizar updated_at en etiquetas_stats
CREATE OR REPLACE FUNCTION update_etiquetas_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_etiquetas_stats_updated_at ON etiquetas_stats;
CREATE TRIGGER trigger_etiquetas_stats_updated_at
  BEFORE UPDATE ON etiquetas_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_etiquetas_stats_updated_at();

-- ============================================================================
-- FIN DE CREACIÓN DE TABLAS
-- ============================================================================
-- Si todo ejecutó sin errores, las tablas están listas.
-- Verdent actualizará el backend para usar estas nuevas tablas.
-- ============================================================================
