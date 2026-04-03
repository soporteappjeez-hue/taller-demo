# 🔧 Solución Error 404 - Login con Google OAuth

## Problema
El login con Google devuelve error 404 porque el callback no está configurado correctamente.

## Causas y Soluciones

### 1. Configurar URL de Redirección en Supabase

Ve a tu proyecto de Supabase:
1. Authentication → URL Configuration
2. En **Site URL**, agrega:
   ```
   https://web-production-86c137.up.railway.app
   ```
3. En **Redirect URLs**, agrega:
   ```
   https://web-production-86c137.up.railway.app/auth/callback
   https://web-production-86c137.up.railway.app/login
   ```

### 2. Configurar Google OAuth en Supabase

1. Ve a Authentication → Providers → Google
2. Asegúrate de que esté **Enabled**
3. El Client ID y Client Secret deben estar configurados (de Google Cloud Console)

### 3. Configurar en Google Cloud Console

1. Ve a https://console.cloud.google.com/
2. APIs & Services → Credentials → OAuth 2.0 Client IDs
3. Edita tu cliente web
4. En **Authorized redirect URIs**, agrega:
   ```
   https://ajhmajaclimccrkehsyy.supabase.co/auth/v1/callback
   ```
   (Reemplaza con tu URL de Supabase)

### 4. Estructura de Archivos (Verificada ✓)

Las siguientes rutas deben existir:

```
src/app/login/page.tsx              ✓ (existe)
src/app/register/page.tsx           ✓ (existe)  
src/app/auth/callback/page.tsx      ✓ (existe)
src/app/api/auth/callback/route.ts  ✓ (existe - para MeLi)
```

### 5. Variables de Entorno en Railway

Asegúrate de tener estas variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ajhmajaclimccrkehsyy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

## Flujo Correcto

```
1. Usuario clic "Continuar con Google"
         ↓
2. Supabase redirige a Google OAuth
         ↓
3. Google autoriza y redirige a Supabase
   (https://PROJECT.supabase.co/auth/v1/callback)
         ↓
4. Supabase procesa y redirige a tu app
   (/auth/callback con tokens en hash)
         ↓
5. Tu página /auth/callback procesa los tokens
         ↓
6. Redirige a /appjeez (dashboard)
```

## Verificación Rápida

Para verificar si el problema es de configuración o de código, prueba esto:

1. Abre: `https://web-production-86c137.up.railway.app/auth/callback`
2. Debería mostrar "Completando autenticación..."
3. Si da 404, el problema es el build de Railway
4. Si carga pero da error después, el problema es la config de Supabase

## Comandos para Verificar

```bash
# Verificar que el build incluya las páginas
cd .next/standalone
ls -la
# Debería mostrar server.js y las carpetas de páginas
```

## Solución Temporal (Si sigue sin funcionar)

Si el problema persiste, el build de Railway no está incluyendo las páginas. 
Como solución temporal, puedo mover el login y registro a la página principal
con un modal/modal para que no dependan de rutas dinámicas.

## Notas Importantes

- El 404 significa que Railway está sirviendo archivos estáticos, no ejecutando el servidor Node.js
- Con `output: 'standalone'` y el Dockerfile, el servidor debería ejecutarse correctamente
- Verifica en Railway Dashboard que el deployment use "Docker" como build method
- El puerto debe ser 3000 (configurado en Dockerfile)
