# Nova: Roadmap de Produccion + Decision WhatsApp

> Fecha: Abril 2026
> Ultima actualizacion: Abril 2026 (post PR #67)
> Estado: WhatsApp eliminado. Catalogo publico, rate limiting, y error boundary implementados.
> Siguiente paso: Infra ops (crear DB en Hetzner), luego testing y features pendientes.

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

### Razones adicionales

- **Numero unico multi-tenant**: Nova tendria un solo numero de WA para todos los tenants. Cuando un cliente escribe, no hay forma de saber de cual negocio habla. Ser BSP de Meta es un proceso enterprise completamente diferente.
- **Modo developer**: max 250 mensajes, 5 numeros verificados, sin templates aprobados. Inviable para MVP.
- **Vector de ataque**: webhook publico sin auth expone datos de negocios a prompt injection, enumeracion, y abuso.

### Decision: eliminado en PR #67

---

## Parte 2: Como Reemplazamos lo que WhatsApp Hacia

### Catalogo publico -- IMPLEMENTADO (PR #67)

Pagina web publica `/catalogo/{slug}` que el dueno comparte donde quiera (WA personal, Instagram, flyer).

```
Dueno abre Nova -> Catalogo -> "Compartir" -> Copia link
    |
    v
Lo pega en su WA personal, Instagram, Facebook, flyer impreso
    |
    v
Cliente abre link: nova.app/catalogo/{slug}
    |
    v
Ve productos con fotos, precios, disponibilidad
    |
    v
Toca "Pedir por WhatsApp" -> abre wa.me/{numero_del_negocio}?text=...
```

Zero infraestructura de WhatsApp. Solo una pagina web publica y un link `wa.me/`.

### Notificaciones al dueno -- PENDIENTE

| Notificacion | Canal | Estado |
|---|---|---|
| Resumen diario | Email (Resend) | Pendiente |
| Resumen semanal | Email (Resend) | Pendiente |
| Alerta de stock critico | Web Push | Pendiente |
| Alerta de anomalia | Web Push | Pendiente |

### Cobros a clientes -- YA EXISTE

El boton "Cobrar" en la PWA ya genera links `wa.me/` (routes/customers.ts linea 325). No necesita API de Meta.

---

## Parte 3: Roadmap de Produccion -- Estado Actual

### Fase A: Bloqueantes para Deploy

| # | Item | Estado | Notas |
|---|---|---|---|
| A1 | Crear DB "nova" en Data Plane | **Pendiente (ops)** | Requiere acceso a Hetzner via Tailscale. Agregar "nova" a init-databases.sh en platform-infra |
| A2 | Ejecutar Drizzle migrations | **Pendiente (ops)** | Depende de A1. drizzle-kit push + init.sql para RLS. Crear role nova_app |
| A3 | Validacion de env vars al boot | **Hecho** | `config.ts` ya valida DATABASE_URL y CLERK_SECRET_KEY al arrancar |
| A4 | CORS configurable | **Hecho** | `process.env.CORS_ORIGIN?.split(",")` ya en app.ts |
| A5 | Iconos PWA | **Pendiente** | Crear icon-192x192.png y icon-512x512.png en apps/web/public/ |
| A6 | Health check profundo | **Hecho** | routes/health.ts ya verifica DB + Redis, retorna status/degraded/error |
| A7 | Tasa de cambio inicial | **Pendiente (ops)** | POST /api/exchange-rate ya existe. El dueno la configura desde la PWA |
| A8 | Eliminar codigo WhatsApp | **Hecho** (PR #67) | routes/whatsapp.ts, services/whatsapp-*.ts, constantes, env vars eliminados |

### Fase B: Seguridad y Hardening

| # | Item | Estado | Notas |
|---|---|---|---|
| B1 | Error boundary global | **Hecho** (PR #67) | error.vue con manejo de 404 y errores no manejados |
| B2 | Structured logging | **Pendiente** | Reemplazar hono/logger con JSON structured logging (request ID, user ID, business ID) |
| B3 | Validacion env vars frontend | **Pendiente** | Verificar NUXT_PUBLIC_API_BASE y NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY al arrancar |
| B4 | Rate limiting general | **Hecho** (PR #67) | middleware/rate-limit.ts con Redis sliding window (60/120/30 req/min) |

### Fase C: Catalogo Publico + Notificaciones

| # | Item | Estado | Notas |
|---|---|---|---|
| C1 | Pagina publica de catalogo | **Hecho** (PR #67) | /catalogo/[slug] con grid, filtro por categoria, wa.me/ links, Open Graph |
| C1b | Schema: slug + whatsappNumber | **Hecho** (PR #67) | Campos en tabla businesses con unique index en slug |
| C2 | Web Push notifications | **Pendiente** | Configurar Web Push API via @vite-pwa/nuxt. Pedir permiso, enviar alertas de stock |
| C3 | Email transaccional | **Pendiente** | Integrar Resend. Resumen diario/semanal, reporte al contador |
| C4 | Exportacion PDF | **Pendiente** | PDFs server-side para reportes, libro de ventas SENIAT, P&L |

### Fase D: Testing

| # | Item | Estado | Notas |
|---|---|---|---|
| D1 | Tests flujo de ventas | **Pendiente** | POST /api/sales: stock, fiado, descuento, anulacion |
| D2 | Tests autenticacion | **Pendiente** | Clerk JWT, X-Acting-As, dev mode |
| D3 | Tests RLS/multi-tenant | **Pendiente** | Negocio A no ve datos de B |
| D4 | Tests catalogo publico | **Pendiente** | GET /catalog/:slug, 404s, productos inactivos |
| D5 | E2E smoke tests | **Pendiente** | Playwright: login, producto, venta, dashboard, catalogo |

### Fase E: Features Pendientes

| # | Item | Estado | Notas |
|---|---|---|---|
| E1 | Segmentos de clientes automaticos | **Pendiente** | Tabla existe, falta logica de calculo (VIP, frecuente, en riesgo, etc.) |
| E2 | Exportacion Excel | **Pendiente** | xlsx ya en dependencias. Falta endpoint /reports/{type}/export |
| E3 | Importacion Excel (conectar) | **Pendiente** | inventory/import.vue parsea pero no hace POST |
| E4 | Gamificacion (conectar) | **Pendiente** | Tablas y endpoint existen. Falta actualizar goals/streaks al crear venta |
| E5 | Seed de datos iniciales | **Pendiente** | Cuentas contables, categorias, unidades de medida por tipo de negocio |
| E6 | Prediccion de flujo de caja | **Pendiente** | Proyectar ingresos/gastos, alertar deficit |
| E7 | ReportLayout period selector | **Pendiente** | Selector de periodo no emite eventos. Reportes usan periodo default |
| E8 | Dockerfile verificacion | **Pendiente** | Multi-stage existe pero no probado con codigo actual |

### Fase F: Observabilidad

| # | Item | Estado | Notas |
|---|---|---|---|
| F1 | Error tracking (Sentry) | **Pendiente** | @sentry/node + @sentry/vue |
| F2 | Metricas basicas | **Pendiente** | Negocios activos, ventas/dia, errores/hora, latencia |
| F3 | Uptime monitoring | **Pendiente** | Configurar Uptime Kuma para /health, frontend, catalogo |

### Fase G: Optimizacion y Escala

| # | Item | Estado | Notas |
|---|---|---|---|
| G1 | PgBouncer + RLS | **Pendiente** | set_config session vs transaction mode. Usar conexion directa para empezar |
| G2 | Service Worker offline real | **Pendiente** | Verificar que @vite-pwa/nuxt intercepta navegacion offline |
| G3 | Migraciones Drizzle versionadas | **Pendiente** | Migrar de drizzle-kit push a generate + migrate |
| G4 | CI/CD automatico | **Pendiente** | Push a main -> staging, tag v* -> produccion |

---

## Resumen: Que Esta Hecho vs Que Falta

### Hecho (7 items)

| Item | PR |
|---|---|
| Eliminar WhatsApp Business API | #67 |
| Catalogo publico (API + pagina + schema) | #67 |
| Rate limiting Redis (pub/auth/write) | #67 |
| Error boundary global (error.vue) | #67 |
| Env validation al boot | Ya existia (config.ts) |
| CORS configurable | Ya existia (app.ts) |
| Health check profundo (DB + Redis) | Ya existia (health.ts) |

### Pendiente: Ops manuales (requieren acceso a Hetzner)

| Item | Que hacer |
|---|---|
| A1. Crear DB "nova" | Agregar a init-databases.sh en platform-infra, crear nova.ts |
| A2. Ejecutar migrations | drizzle-kit push + init.sql + crear role nova_app |
| A5. Iconos PWA | Crear icon-192x192.png y icon-512x512.png |
| A7. Tasa de cambio inicial | El dueno la configura desde la PWA al primer uso |

### Pendiente: Codigo (siguiente PR)

**Prioridad alta:**

| Item | Descripcion |
|---|---|
| B2. Structured logging | JSON logging con request ID, user ID, business ID |
| B3. Env vars frontend | Validar NUXT_PUBLIC_API_BASE al arrancar Nuxt |
| D1-D5. Tests | Ventas, auth, RLS, catalogo, E2E |
| E8. Dockerfile verificacion | Probar build Docker con codigo actual |

**Prioridad media:**

| Item | Descripcion |
|---|---|
| C2. Web Push | Alertas de stock critico via service worker |
| C3. Email transaccional | Resend: resumen diario, reporte al contador |
| C4. Exportacion PDF | Reportes, libro de ventas SENIAT |
| E1. Segmentos de clientes | Calculo automatico de VIP, frecuente, en riesgo |
| E2. Exportacion Excel | Endpoint /reports/{type}/export |
| E3. Import Excel (conectar) | inventory/import.vue -> POST /api/products batch |
| E4. Gamificacion (conectar) | Actualizar goals/streaks al crear venta |
| E5. Seed datos iniciales | Cuentas contables, categorias por tipo de negocio |
| E7. ReportLayout period selector | Conectar selector de periodo a los reportes |

**Prioridad baja:**

| Item | Descripcion |
|---|---|
| E6. Prediccion flujo de caja | Proyectar ingresos/gastos, alertar deficit |
| F1-F3. Observabilidad | Sentry, metricas, Uptime Kuma |
| G1-G4. Optimizacion | PgBouncer, SW offline, migraciones, CI/CD |

---

## Diagrama de Dependencias

```
Fase A (Bloqueantes)          <- ops manuales pendientes (A1, A2, A5)
  |
  v
Fase B (Seguridad)            <- B2 structured logging, B3 env frontend
  |
  v
Fase C (Notificaciones)       <- C2 Web Push, C3 email, C4 PDF
  |
  v
Fase D (Testing)              <- D1-D5 todos pendientes
  |
  v
Fase E (Features)             <- E1-E8 todos pendientes
  |
  v
Fase F (Observabilidad)       <- F1-F3 todos pendientes
  |
  v
Fase G (Optimizacion)         <- G1-G4 todos pendientes
```

---

## Actualizacion a Docs Anteriores

Los siguientes documentos contienen disenos de WhatsApp que ya no aplican:

| Documento | Que cambiar |
|---|---|
| **doc 08** (WhatsApp entrada + diferenciadores) | Seccion "WhatsApp como entrada" descartada. Diferenciador 1 (WA bidireccional) eliminado. Diferenciador 10 (catalogo) se mantiene como pagina web publica |
| **doc 19** (WhatsApp arquitectura y seguridad) | Documento completo descartado. Webhook, LLM interpreter, executor ya no aplican |
| **doc 11** (Especificacion final) | Actualizar seccion WhatsApp: solo salida via links wa.me/ y catalogo publico |
| **doc 21** (Fases de desarrollo) | Fase 7 (WhatsApp) cambia: ya no es webhook + LLM. Es catalogo publico + Web Push + email |
| **PRODUCTION-ROADMAP.md** | Items 7-9 (WhatsApp) ya no aplican. Este documento (doc 22) es el roadmap vigente |

---

## Arquitectura de Deploy en Coolify

```
Coolify (Control Plane 10.0.1.10)
+-- nova-api (Docker, puerto 3001)
|   +-- DATABASE_URL -> 10.0.1.20:5432/nova (directo, no PgBouncer por RLS)
|   +-- REDIS_URL -> 10.0.1.20:6379/4
|   +-- CLERK_SECRET_KEY
|   +-- CORS_ORIGIN -> https://nova.tudominio.com
|   +-- OPENROUTER_API_KEY (opcional, para narrativas IA)
|
+-- nova-web (Docker, puerto 3000)
|   +-- NUXT_PUBLIC_API_BASE -> https://api.nova.tudominio.com
|   +-- NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY
|
+-- Traefik (reverse proxy)
    +-- nova.tudominio.com -> nova-web:3000
    +-- api.nova.tudominio.com -> nova-api:3001
```
