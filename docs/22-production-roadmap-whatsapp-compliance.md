# Nova: Roadmap de Produccion + Decision WhatsApp

> Fecha: Abril 2026
> Estado: Backend y frontend conectados a DB real. Zero mock data.
> Siguiente paso: Resolver bloqueantes, eliminar WhatsApp API, deploy a Coolify.

---

## Parte 1: Por Que Eliminamos la WhatsApp Business API de Nova

### El problema de compliance (Meta 2026)

El 15 de enero de 2026, Meta prohibio chatbots de proposito general en la WhatsApp Business Platform:

> "AI Providers are strictly prohibited from accessing or using the WhatsApp Business Solution [...] when such technologies are the primary (rather than incidental or ancillary) functionality being made available for use."

El diseno original de Nova (docs 08 y 19) usa GPT-4o-mini como interprete de lenguaje natural para que el dueno consulte metricas y ejecute acciones por WhatsApp. Esto es un asistente conversacional de IA como funcionalidad principal, exactamente lo que Meta prohibe.

Fuentes:
- https://business.whatsapp.com/policy
- https://respond.io/blog/whatsapp-general-purpose-chatbots-ban
- https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform/

### El problema del numero unico

Nova tendria un solo numero de WhatsApp Business para todos los tenants. Cuando un cliente externo escribe, no hay forma de saber de cual negocio habla. Para que cada tenant tenga su propio numero, Nova necesitaria ser BSP (Business Solution Provider) de Meta, un proceso de verificacion enterprise completamente diferente y mucho mas complejo.

### El problema del modo developer

En modo developer de Meta Cloud API:
- Maximo 250 mensajes salientes
- Solo puedes enviar a numeros verificados (hasta 5)
- Los templates no se aprueban hasta pasar a produccion
- Para produccion necesitas verificacion de negocio completa

Esto hace que toda la infraestructura de templates sea inviable para el MVP.

### El vector de ataque

Un webhook publico sin autenticacion donde cualquiera puede escribir y potencialmente extraer informacion del negocio es superficie de ataque innecesaria:
- Prompt injection contra el LLM
- Enumeracion de datos de negocios
- Abuso del rate limit
- Costos de LLM por mensajes maliciosos

### Decision: eliminar WhatsApp Business API completamente

No vale la pena la complejidad, el riesgo de compliance, la superficie de ataque, y las limitaciones del modo developer para el valor que aporta. La PWA ya es mobile-first y cubre todos los casos de uso del dueno.

### Que se elimina del codigo

| Archivo | Accion |
|---|---|
| `apps/api/src/routes/whatsapp.ts` | **Eliminar** |
| `apps/api/src/services/whatsapp-interpreter.ts` | **Eliminar** |
| `apps/api/src/services/whatsapp-sender.ts` | **Eliminar** |
| Variables `WA_*` en `.env.example` | **Eliminar** |
| Ruta `/webhooks/whatsapp` en `app.ts` | **Eliminar** |
| Import de `whatsapp` en `app.ts` | **Eliminar** |
| `WA_RATE_LIMIT_PER_HOUR` en `@nova/shared` | **Eliminar** |

### Que NO se elimina

| Archivo | Razon |
|---|---|
| `services/ai-narrative.ts` | Genera narrativas para reportes en la PWA. No tiene relacion con WhatsApp |
| `services/ocr-pipeline.ts` | OCR de facturas desde la camara de la PWA. No tiene relacion con WhatsApp |
| `services/exchange-rate.ts` | Tasa de cambio BCV. No tiene relacion con WhatsApp |

---

## Parte 2: Como Reemplazamos lo que WhatsApp Hacia

### Catalogo publico (el diferenciador que se mantiene)

El catalogo compartible es valioso por si solo, sin necesidad de la API de Meta. Es una pagina web publica que el dueno comparte donde quiera.

```
Dueno abre Nova -> Catalogo -> "Compartir" -> Copia link
    |
    v
Lo pega en su WA personal, Instagram, Facebook, flyer impreso
    |
    v
Cliente abre link en el navegador: nova.app/catalogo/{slug}
    |
    v
Ve productos con fotos, precios, disponibilidad
    |
    v
Toca "Pedir por WhatsApp" en un producto
    |
    v
Se abre wa.me/{numero_del_negocio}?text=Hola, me interesa: 3x Pan Campesino ($4.50)
(el numero del negocio, NO de Nova)
    |
    v
El dueno ve el pedido en su WA personal y lo registra en la PWA
```

**Zero infraestructura de WhatsApp.** Solo una pagina web publica y un link `wa.me/`. El patron `wa.me/` es lo que ya hacen todos los comerciantes en Venezuela.

Implementacion:
- `apps/web/app/pages/catalogo/[slug].vue` - pagina publica (sin auth)
- `apps/api/src/routes/catalog.ts` - API para obtener productos publicos de un negocio por slug
- Campo `slug` en tabla `businesses` (generado en onboarding)
- Campo `whatsappNumber` en tabla `businesses` (para el link `wa.me/`)

### Notificaciones al dueno (sin WhatsApp)

En lugar de templates de Meta, usamos canales mas simples:

| Notificacion | Canal | Implementacion |
|---|---|---|
| Resumen diario | **Email** (Resend, 100/dia gratis) | Boton "Enviar resumen" en PWA o cron |
| Resumen semanal | **Email** | Cron lunes 8am |
| Alerta de stock critico | **Web Push** (ya en el stack: `@vite-pwa/nuxt`) | Service worker notification |
| Alerta de anomalia | **Web Push** | Service worker notification |

Web Push es nativo de la PWA, no requiere servicio externo, y funciona en Android/iOS. Email via Resend es gratis hasta 100 emails/dia y no requiere verificacion de negocio.

Si en el futuro se necesita SMS, Twilio es una API key y ya. Sin webhooks, sin templates, sin verificacion de Meta.

### Cobros a clientes (sin WhatsApp API)

El boton "Cobrar" en la PWA ya genera links `wa.me/`:

```typescript
// Ya existe en routes/customers.ts linea 325
whatsappUrl: `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`
```

El dueno toca "Cobrar", se abre WhatsApp con el mensaje prellenado, y lo envia desde su telefono personal. No necesita API de Meta.

### Reporte al contador (sin WhatsApp API)

Generar PDF y enviarlo por email (Resend). O el dueno descarga el PDF desde la PWA y lo comparte manualmente por WA. No necesita API de Meta.

---

## Parte 3: Roadmap Completo de Produccion

### Fase A: Bloqueantes para Deploy (Semana 1-2)

Estos items deben resolverse ANTES del primer deploy en Coolify.

#### A1. Crear DB "nova" en el Data Plane

En el repo `platform-infra`, agregar "nova" a `init-databases.sh`:

```
DATABASES="whabi docflow aurora nova"
```

Crear `src/projects/nova.ts` con:
- `novaPostgresUrl` (directo, puerto 5432, para RLS)
- `novaRedisUrl` (DB 4)
- MinIO bucket: `nova-receipts` (futuro)

#### A2. Ejecutar Drizzle Migrations

```bash
DATABASE_URL=postgresql://platform:<pw>@10.0.1.20:5432/nova npx drizzle-kit push
psql postgresql://platform:<pw>@10.0.1.20:5432/nova < packages/db/init.sql
```

Crear role `nova_app` con permisos limitados (RLS no funciona con superuser).

**Futuro**: migrar de `drizzle-kit push` a `drizzle-kit migrate` con archivos de migracion versionados.

#### A3. Validacion de env vars al boot

Crear schema Zod que valide variables requeridas al arrancar el servidor. Si falta `DATABASE_URL` o `CLERK_SECRET_KEY`, el servidor debe fallar inmediatamente con mensaje claro, no en runtime.

```typescript
// apps/api/src/env.ts
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3001),
  REDIS_URL: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
});
```

#### A4. CORS configurable por entorno

Ya esta parcialmente implementado (`process.env.CORS_ORIGIN?.split(",")`) pero necesita documentacion y verificacion de que funciona con Coolify.

#### A5. Iconos PWA

Crear `/icon-192x192.png` y `/icon-512x512.png` en `apps/web/public/`. Sin estos, la PWA no se instala correctamente en Android/iOS.

#### A6. Health check profundo

El `/health` actual solo retorna 200. Debe verificar:
- Conexion a PostgreSQL (query simple)
- Conexion a Redis (PING)
- Retornar estado de cada dependencia

```json
{
  "status": "healthy",
  "postgres": "ok",
  "redis": "ok",
  "uptime": 3600
}
```

#### A7. Tasa de cambio inicial

Insertar tasa BCV inicial en la DB o documentar que el dueno debe configurarla desde la PWA antes de crear ventas. El endpoint `POST /api/exchange-rate` ya existe.

#### A8. Eliminar codigo de WhatsApp

Eliminar los archivos listados en la Parte 1. Limpiar imports en `app.ts`. Eliminar variables `WA_*` de `.env.example`. Esto reduce complejidad y superficie de ataque antes del deploy.

---

### Fase B: Seguridad y Hardening (Semana 2-3)

#### B1. Error boundary global (frontend)

No hay error handler global en Nuxt. Agregar `app:error` hook para capturar errores no manejados y mostrar UI de error amigable.

#### B2. Structured logging

Reemplazar `hono/logger` (texto plano) con logging estructurado (JSON) para facilitar debugging en produccion. Incluir request ID, user ID, business ID en cada log.

#### B3. Validacion de env vars (frontend)

Similar a A3 pero para Nuxt. Verificar que `NUXT_PUBLIC_API_BASE` y `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY` estan configurados.

#### B4. Rate limiting general

Agregar rate limiting basico a la API (no solo WhatsApp). Usar Redis con sliding window:
- Endpoints publicos: 60 req/min por IP
- Endpoints autenticados: 120 req/min por usuario
- Endpoints de escritura: 30 req/min por usuario

---

### Fase C: Catalogo Publico + Notificaciones (Semana 3-5)

#### C1. Pagina publica de catalogo

`/catalogo/{slug}` - pagina publica (sin auth) que muestra:
- Nombre y logo del negocio
- Productos con foto, nombre, precio, disponibilidad
- Filtro por categoria
- Boton "Pedir por WhatsApp" que abre `wa.me/{numero}?text={mensaje_prellenado}`
- SEO basico (meta tags, Open Graph para que el link se vea bien al compartir)

Requiere:
- Campo `slug` en tabla `businesses` (unico, generado en onboarding)
- Campo `whatsappNumber` en tabla `businesses`
- Endpoint `GET /api/catalog/{slug}` (publico, sin auth)

#### C2. Web Push notifications

Configurar Web Push API (ya en el stack via `@vite-pwa/nuxt`):
- Pedir permiso al usuario en la PWA
- Enviar notificaciones de stock critico
- Enviar notificaciones de anomalias
- Almacenar suscripciones en DB o Redis

#### C3. Email transaccional

Integrar Resend (o SendGrid) para emails:
- Resumen diario (cron 9pm o boton manual)
- Resumen semanal (cron lunes 8am)
- Reporte al contador (boton "Enviar al contador")

Requiere:
- Campo `email` del dueno (ya existe via Clerk)
- Campo `accountantEmail` en tabla `businesses` (opcional)
- Servicio `services/email.ts` con Resend SDK

#### C4. Exportacion PDF para reportes

Generar PDFs server-side para:
- Reporte diario/semanal
- Libro de ventas (formato SENIAT)
- P&L simplificado

Usar `pdfmake` o `@react-pdf/renderer`. El PDF se descarga desde la PWA o se envia por email.

---

### Fase D: Testing (Semana 4-6)

#### D1. Tests de flujo de ventas

El endpoint mas critico (`POST /api/sales`) necesita tests de integracion:
- Venta exitosa con stock suficiente
- Venta rechazada por stock insuficiente
- Venta con fiado (crea accounts_receivable)
- Venta con descuento
- Anulacion de venta (restaura stock)

#### D2. Tests de autenticacion

- Clerk JWT valido -> acceso permitido
- JWT invalido -> 401
- X-Acting-As con empleado valido -> contexto correcto
- X-Acting-As con empleado de otro negocio -> 403
- Dev mode sin CLERK_SECRET_KEY -> mock user

#### D3. Tests de RLS/multi-tenant

- Negocio A no puede ver datos de negocio B
- `set_config` funciona correctamente con el pool de conexiones

#### D4. Tests de catalogo publico

- GET /api/catalog/{slug} retorna productos del negocio correcto
- Slug inexistente -> 404
- Negocio inactivo -> 404
- Productos inactivos no aparecen

#### D5. E2E smoke tests

Expandir `e2e/smoke.spec.ts` con Playwright:
- Login con Clerk
- Crear producto
- Registrar venta
- Ver dashboard
- Ver reportes
- Ver catalogo publico

---

### Fase E: Features Pendientes (Semana 5-8)

#### E1. Segmentos de clientes automaticos

La tabla `customerSegments` existe pero no hay logica que calcule segmentos. Implementar:
- VIP: >10 compras Y ticket promedio > promedio del negocio
- Frecuente: >5 compras en ultimos 30 dias
- En riesgo: no compra hace 30-60 dias
- Inactivo: no compra hace 60+ dias
- Con deuda: balance > 0
- Nuevo: primera compra en ultimos 7 dias

Ejecutar calculo como cron diario o al crear una venta.

#### E2. Exportacion Excel

Los reportes necesitan exportacion Excel:
- Usar `xlsx` (ya en dependencias del frontend) para generar archivos
- Endpoints: `GET /api/reports/{type}/export?format=xlsx`

#### E3. Importacion Excel (conectar)

`inventory/import.vue` parsea archivos pero no hace POST. Conectar a `POST /api/products` en batch. Agregar:
- Validacion de columnas requeridas
- Preview antes de importar
- Reporte de errores por fila

#### E4. Gamificacion (conectar)

Las tablas `sellerGoals` y `sellerStreaks` existen. El endpoint `/reports/gamification` existe. Falta:
- Actualizar `sellerGoals` automaticamente al crear una venta
- Actualizar `sellerStreaks` en el cron de cierre de dia
- Mostrar gamificacion en el dashboard del empleado

#### E5. Seed de datos iniciales

Crear seed para:
- Catalogo de cuentas contables por tipo de negocio (ferreteria, bodega, tienda de ropa, etc.)
- Categorias default por tipo de negocio
- Unidades de medida comunes (unidad, caja, kg, litro)

#### E6. Prediccion de flujo de caja

Implementar el feature descrito en doc 08:
- Proyectar ingresos basado en promedio de ventas por dia de la semana
- Sumar gastos fijos conocidos
- Sumar cuentas por pagar con fecha proxima
- Alertar si algun dia el balance proyectado es negativo

---

### Fase F: Observabilidad (Semana 6-8)

#### F1. Error tracking

Integrar Sentry (o alternativa) para capturar errores en produccion:
- Backend: `@sentry/node` en Hono
- Frontend: `@sentry/vue` en Nuxt

#### F2. Metricas basicas

Agregar metricas de negocio al health check o endpoint dedicado:
- Numero de negocios activos
- Ventas del dia (agregado)
- Errores por hora
- Latencia de endpoints criticos

#### F3. Uptime monitoring

Configurar Uptime Kuma (ya en el control plane) para monitorear:
- `GET /health` de la API
- Pagina principal del frontend
- Pagina de catalogo

---

### Fase G: Optimizacion y Escala (Semana 8-10)

#### G1. PgBouncer + RLS

Resolver el conflicto entre PgBouncer transaction mode y `set_config` session-level. Opciones:
- Usar conexion directa (puerto 5432) para empezar
- Migrar a `set_config(..., true)` con transacciones explicitas
- Configurar PgBouncer en modo session para Nova

#### G2. Service Worker offline real

Verificar que el service worker de `@vite-pwa/nuxt` funciona correctamente:
- Intercepta requests de navegacion offline
- Muestra pagina cached cuando no hay internet
- La cola offline (`useOfflineQueue`) sincroniza al volver

#### G3. Migraciones Drizzle versionadas

Migrar de `drizzle-kit push` (destructivo) a `drizzle-kit generate` + `drizzle-kit migrate` con archivos de migracion versionados en el repo.

#### G4. CI/CD automatico

Configurar deploy automatico a Coolify:
- Push a `main` -> deploy a staging
- Tag `v*` -> deploy a produccion
- Smoke tests post-deploy

---

## Resumen de Prioridades

| Prioridad | Fase | Semana | Items |
|---|---|---|---|
| **Critico** | A: Bloqueantes | 1-2 | DB, migrations, env validation, CORS, PWA icons, health check, eliminar WA |
| **Alto** | B: Seguridad | 2-3 | Error boundary, structured logging, rate limiting general |
| **Alto** | C: Catalogo + Notif | 3-5 | Catalogo publico, Web Push, email transaccional, PDF export |
| **Alto** | D: Testing | 4-6 | Ventas, auth, RLS, catalogo, E2E |
| **Medio** | E: Features | 5-8 | Segmentos, export Excel, import Excel, gamificacion, seed, flujo de caja |
| **Medio** | F: Observabilidad | 6-8 | Sentry, metricas, uptime |
| **Bajo** | G: Optimizacion | 8-10 | PgBouncer, SW offline, migraciones, CI/CD |

---

## Diagrama de Dependencias

```
Fase A (Bloqueantes)
  |
  v
Fase B (Seguridad) -----> Fase C (Catalogo + Notificaciones)
  |                           |
  v                           v
Fase D (Testing) <-----------+
  |
  v
Fase E (Features) ---------> Fase F (Observabilidad)
  |                           |
  v                           v
Fase G (Optimizacion) <------+
```

Fases A y B son secuenciales. C puede empezar en paralelo con B. D depende de B y C. E y F pueden ir en paralelo. G es la ultima.

---

## Actualizacion a Docs Anteriores

Los siguientes documentos contienen disenos de WhatsApp que ya no aplican:

| Documento | Que cambiar |
|---|---|
| **doc 08** (WhatsApp entrada + diferenciadores) | La seccion de "WhatsApp como entrada" (consultas, ventas, acciones por chat) queda descartada. Los diferenciadores 1 (WhatsApp bidireccional) y 10 (catalogo compartible) cambian: el catalogo se mantiene como pagina web publica, WhatsApp bidireccional se elimina |
| **doc 19** (WhatsApp arquitectura y seguridad) | Todo el documento queda descartado. La arquitectura de webhook, LLM interpreter, executor, y el flujo de mensajes entrantes ya no aplica |
| **doc 11** (Especificacion final) | Actualizar la seccion de WhatsApp para reflejar que es solo salida via links `wa.me/` y catalogo publico |
| **doc 21** (Fases de desarrollo) | La Fase 7 (WhatsApp) cambia completamente. Ya no es webhook + LLM. Es catalogo publico + Web Push + email |
| **PRODUCTION-ROADMAP.md** | Los items 7-9 (WhatsApp lookup, HMAC, rate limiter) ya no aplican. Reemplazar con items de este documento |
