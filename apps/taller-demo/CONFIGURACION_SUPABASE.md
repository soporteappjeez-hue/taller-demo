# 🚀 Configuración de Supabase y Railway - Demo AppJeez

## 📋 Checklist de Configuración

### 1️⃣ Supabase (Base de Datos)

#### Paso 1: Crear proyecto en Supabase
1. Ve a [supabase.com](https://supabase.com) y crea un nuevo proyecto
2. Guarda la **contraseña** de la base de datos (la necesitarás después)
3. Espera a que el proyecto esté listo (~2 minutos)

#### Paso 2: Ejecutar el script SQL
1. En el dashboard de Supabase, ve a **SQL Editor**
2. Crea un nuevo query
3. Copia y pega todo el contenido del archivo `supabase-setup.sql`
4. Ejecuta el script (Run)
5. Verifica que no haya errores

#### Paso 3: Crear bucket de Storage para fotos
1. Ve a **Storage** en el menú lateral
2. Click en **"Create a new bucket"**
3. Configura:
   - **Name**: `fotos-maquinas`
   - **Public bucket**: ✅ (marcar)
4. Click en **"Create bucket"**

#### Paso 4: Configurar políticas del Storage
1. Ve al bucket `fotos-maquinas`
2. Click en **"Policies"**
3. Ejecuta este SQL en el SQL Editor:

```sql
-- Permitir acceso público de lectura
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'fotos-maquinas');

-- Permitir uploads a usuarios anónimos (demo)
CREATE POLICY "Anon can upload"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'fotos-maquinas');

-- Permitir updates a usuarios anónimos
CREATE POLICY "Anon can update"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'fotos-maquinas');

-- Permitir deletes a usuarios anónimos
CREATE POLICY "Anon can delete"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'fotos-maquinas');
```

#### Paso 5: Obtener credenciales
1. Ve a **Settings** → **API**
2. Copia estos valores:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY` (click en "Reveal" para verlo)

---

### 2️⃣ Railway (Hosting)

#### Paso 1: Crear proyecto en Railway
1. Ve a [railway.app](https://railway.app)
2. Crea un nuevo proyecto
3. Selecciona **"Deploy from GitHub repo"**
4. Autoriza y selecciona tu repositorio

#### Paso 2: Configurar variables de entorno
En Railway, ve a **Settings** → **Variables** y agrega:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
```

#### Paso 3: Configurar dominio
1. Ve a **Settings** → **Networking**
2. Click en **"Generate Domain"** o usa uno personalizado
3. Tu app estará disponible en: `https://tu-app.railway.app`

---

### 3️⃣ Configuración Local (Desarrollo)

#### Crear archivo `.env.local`
En la raíz del proyecto (`apps/taller-demo/`), crea el archivo:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui

# Opcional: Puerto local
PORT=3001
```

#### Instalar dependencias
```bash
cd apps/taller-demo
npm install
```

#### Ejecutar en desarrollo
```bash
npm run dev
```

---

## 🔧 Verificación de Tablas

Ejecuta este query en Supabase SQL Editor para verificar que todo esté bien:

```sql
-- Verificar tablas creadas
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns 
        WHERE table_name = t.table_name) as columnas
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN (
    'reparaciones', 'stock', 'repuestos_a_pedir', 'pagos',
    'plantillas_whatsapp', 'agenda_clientes', 'historial_reparaciones',
    'flex_envios', 'flex_tarifas', 'ventas_repuestos', 'ventas_items'
  )
ORDER BY table_name;

-- Verificar funciones RPC
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION'
  AND routine_name LIKE 'get_%';

-- Verificar datos de prueba
SELECT COUNT(*) as flex_tarifas FROM flex_tarifas;
SELECT COUNT(*) as plantillas FROM plantillas_whatsapp;
```

---

## 🐛 Solución de Problemas Comunes

### Error: "relation 'X' does not exist"
- **Solución**: Ejecuta el script `supabase-setup.sql` completo en Supabase SQL Editor

### Error: "permission denied for table X"
- **Solución**: Verifica que las políticas RLS estén activadas (ejecuta la sección 5 del script)

### Error: "storage policy violation"
- **Solución**: Verifica que el bucket `fotos-maquinas` exista y tenga las políticas correctas

### Error: "invalid API key"
- **Solución**: Verifica que las variables de entorno estén correctamente configuradas

### Las fotos no cargan
1. Verifica que el bucket `fotos-maquinas` sea público
2. Verifica las políticas de storage
3. Verifica que `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` estén configuradas

### Error en deploy de Railway
1. Verifica que todas las variables de entorno estén configuradas
2. Revisa los logs en Railway (Deployments → Logs)
3. Verifica que el build sea exitoso

---

## 📊 Estructura de la Base de Datos

```
┌─────────────────────┐
│   reparaciones      │ ← Tabla principal de órdenes
└──────────┬──────────┘
           │
           ├───┬──────┐
           │   │      │
           ▼   ▼      ▼
    ┌─────────┐ ┌────────────┐
    │  pagos  │ │ repuestos  │
    └─────────┘ │ _a_pedir   │
                └────────────┘

┌─────────────────────┐
│   agenda_clientes   │
└──────────┬──────────┘
           │
           ▼
    ┌───────────────────┐
    │ historial_        │
    │ reparaciones      │
    └───────────────────┘

┌─────────────────────┐
│ ventas_repuestos    │
└──────────┬──────────┘
           │
           ▼
    ┌─────────────┐
    │ ventas_items│
    └─────────────┘

┌─────────────────────┐
│     flex_envios     │
└─────────────────────┘

┌─────────────────────┐
│    flex_tarifas     │
└─────────────────────┘

┌─────────────────────┐
│ plantillas_whatsapp │
└─────────────────────┘

┌─────────────────────┐
│       stock         │
└─────────────────────┘
```

---

## 🚀 Deploy Final

1. **Push a GitHub**: Asegúrate de que tu código esté en GitHub
2. **Railway**: Conecta tu repo y configura las variables
3. **Verifica**: Que el build sea exitoso
4. **Prueba**: Accede a tu URL de Railway y verifica que funcione

---

## 📝 Notas Importantes

1. **Seguridad**: Este es un DEMO. Las políticas RLS permiten acceso total a usuarios anónimos. Para producción, implementa autenticación real.

2. **Backup**: Supabase hace backups automáticos, pero es recomendable hacer backups manuales antes de cambios importantes.

3. **Límites**: Supabase gratuito tiene límites:
   - 500MB de base de datos
   - 1GB de almacenamiento
   - 2GB de transferencia/mes

4. **Logs**: Revisa los logs en Railway y Supabase para debugging.

---

## ✅ Checklist Final

- [ ] Proyecto creado en Supabase
- [ ] Script SQL ejecutado correctamente
- [ ] Bucket `fotos-maquinas` creado y configurado
- [ ] Políticas de Storage configuradas
- [ ] Credenciales copiadas
- [ ] Variables de entorno configuradas en Railway
- [ ] Proyecto deployado exitosamente
- [ ] App funcionando en producción

¡Listo! Tu Demo AppJeez debería estar funcionando correctamente.
