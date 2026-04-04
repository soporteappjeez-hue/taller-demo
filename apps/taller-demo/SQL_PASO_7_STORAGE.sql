-- ============================================================
-- PASO 7: CONFIGURAR STORAGE PARA FOTOS
-- ============================================================
-- ⚠️ IMPORTANTE: Primero crea el bucket manualmente:
-- 1. Ve a Storage en el menú lateral
-- 2. Click en "Create a new bucket"
-- 3. Name: fotos-maquinas
-- 4. ✅ Public bucket (marcar)
-- 5. Click en "Create bucket"
--
-- Luego ejecuta ESTE SQL para configurar las políticas:
-- ============================================================

-- Políticas de acceso al bucket de fotos
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'fotos-maquinas');

CREATE POLICY "Anon can upload"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'fotos-maquinas');

CREATE POLICY "Anon can update"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'fotos-maquinas');

CREATE POLICY "Anon can delete"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'fotos-maquinas');

-- Mensaje de éxito
SELECT '✅ PASO 7 COMPLETADO: Políticas de Storage configuradas' as estado;
