-- ============================================================
-- PASO 3: CREAR FUNCIONES RPC PARA ESTADÍSTICAS
-- Copia y pega esto en Supabase SQL Editor y ejecuta
-- ============================================================

-- FUNCIÓN: get_ventas_stats
CREATE OR REPLACE FUNCTION get_ventas_stats(
  fecha_desde TEXT,
  fecha_hasta TEXT
)
RETURNS TABLE (
  total_facturado BIGINT,
  cant_ventas BIGINT,
  metodo_top TEXT,
  producto_top TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(v.total), 0)::BIGINT as total_facturado,
    COUNT(v.id)::BIGINT as cant_ventas,
    (SELECT metodo_pago FROM ventas_repuestos 
     WHERE created_at >= fecha_desde::timestamp 
       AND created_at <= (fecha_hasta::timestamp + INTERVAL '23:59:59')
       AND status = 'activa'
     GROUP BY metodo_pago 
     ORDER BY COUNT(*) DESC 
     LIMIT 1) as metodo_top,
    (SELECT vi.producto FROM ventas_items vi
     JOIN ventas_repuestos v ON vi.venta_id = v.id
     WHERE v.created_at >= fecha_desde::timestamp 
       AND v.created_at <= (fecha_hasta::timestamp + INTERVAL '23:59:59')
       AND v.status = 'activa'
     GROUP BY vi.producto 
     ORDER BY SUM(vi.cantidad) DESC 
     LIMIT 1) as producto_top
  FROM ventas_repuestos v
  WHERE v.created_at >= fecha_desde::timestamp
    AND v.created_at <= (fecha_hasta::timestamp + INTERVAL '23:59:59')
    AND v.status = 'activa';
END;
$$;

-- FUNCIÓN: get_ventas_por_dia
CREATE OR REPLACE FUNCTION get_ventas_por_dia(
  fecha_desde TEXT,
  fecha_hasta TEXT
)
RETURNS TABLE (
  dia TEXT,
  total BIGINT,
  cant BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(v.created_at, 'YYYY-MM-DD') as dia,
    SUM(v.total)::BIGINT as total,
    COUNT(v.id)::BIGINT as cant
  FROM ventas_repuestos v
  WHERE v.created_at >= fecha_desde::timestamp
    AND v.created_at <= (fecha_hasta::timestamp + INTERVAL '23:59:59')
    AND v.status = 'activa'
  GROUP BY TO_CHAR(v.created_at, 'YYYY-MM-DD')
  ORDER BY dia;
END;
$$;

-- FUNCIÓN: get_top_productos
CREATE OR REPLACE FUNCTION get_top_productos(
  fecha_desde TEXT,
  fecha_hasta TEXT,
  top_n INTEGER DEFAULT 5
)
RETURNS TABLE (
  producto TEXT,
  cantidad BIGINT,
  total BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vi.producto,
    SUM(vi.cantidad)::BIGINT as cantidad,
    SUM(vi.subtotal)::BIGINT as total
  FROM ventas_items vi
  JOIN ventas_repuestos v ON vi.venta_id = v.id
  WHERE v.created_at >= fecha_desde::timestamp
    AND v.created_at <= (fecha_hasta::timestamp + INTERVAL '23:59:59')
    AND v.status = 'activa'
  GROUP BY vi.producto
  ORDER BY cantidad DESC
  LIMIT top_n;
END;
$$;

-- Mensaje de éxito
SELECT '✅ PASO 3 COMPLETADO: Funciones RPC creadas correctamente' as estado;
