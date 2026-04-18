# Nova: Roadmap de Produccion

> Ultima actualizacion: Abril 2026 (post PRs #66-#73)
> Estado: Nova corriendo en produccion. Subdomain-per-tenant implementado. Pendiente: comprar dominio dedicado.
> **Plan de ejecucion definitivo: [doc 25 - Auditoria y roadmap definitivo](25-auditoria-y-roadmap-definitivo.md)**

---

## Estado de la Infraestructura

```
API:      https://nova-api.aikalabs.cc/health -> {"status":"ok","services":{"database":true,"redis":true}}
Web:      https://nova.aikalabs.cc
ESC:      aikapenelope-org/platform-infra/nova
CI:       GitHub Actions — typecheck + lint + test + build (PostgreSQL 16 + Redis 7)
Tests:    17 tests en 5 archivos, CI verde
Tenancy:  Subdomain-per-tenant listo en codigo. Pendiente: dominio dedicado + DNS
```

---

## Cambios Realizados (PRs #66-#73)

### PR #66: Roadmap + analisis WhatsApp compliance
- Documento de roadmap de produccion (este documento)
- Analisis de compliance Meta 2026 para WhatsApp Business API

### PR #67: Eliminar WhatsApp, catalogo publico, rate limiting, error boundary
- **Eliminar WhatsApp Business API**: routes/whatsapp.ts, services/whatsapp-interpreter.ts, services/whatsapp-sender.ts, constantes WA_*, env vars WA_*
- **Catalogo publico**: API `GET /catalog/:slug` + pagina `/catalogo/[slug].vue` + campos slug y whatsappNumber en businesses
- **Rate limiting**: middleware Redis con sliding window (publico 60/min, auth 120/min, write 30/min) + fallback in-memory
- **Error boundary**: `error.vue` global para 404s y errores no manejados

### PR #69: Eliminar gamificacion, structured logging, tests, config validation
- **Eliminar gamificacion**: tablas seller_goals/seller_streaks, RLS policies, endpoint /reports/gamification, componente EmployeePerformance.vue, funciones goalProgress/dailyGoalSchema
- **Structured logging**: JSON logger con method, path, status, ms, requestId, userId, businessId. Header X-Request-Id en cada response
- **Tests**: 17 tests en 5 archivos (health, auth, catalog, sales, rate-limit)
- **Config validation**: plugin Nuxt que valida NUXT_PUBLIC_API_BASE al arrancar

### PR #71: Analisis subdomain-per-tenant
- Investigacion de Shopify, Slack, Notion, Linear, Square, Fina
- Auditoria del codigo actual (5 puntos de resolucion de tenant)
- Impacto en PWA, Clerk, RLS
- Plan de implementacion en 5 sprints

### PR #72: Fix aislamiento exchange_rates
- **Bug fix**: tabla exchange_rates no tenia business_id. Todos los tenants compartian la misma tasa de cambio global
- Agregar business_id a exchange_rates con FK a businesses
- Cambiar unique index de (date) a (business_id, date)
- Agregar RLS policy para exchange_rates
- Scopear Redis cache key: `nova:{businessId}:exchange_rate:current`
- Actualizar getCurrentRate() y setCurrentRate() para requerir businessId

### PR #73: Subdomain-per-tenant
- **Nitro server middleware**: parsea subdominio del Host header, extrae tenant slug
- **useTenant composable**: funciona en SSR y client, expone tenantSlug, hasTenant, tenantUrl
- **Auth middleware subdomain-aware**: visitante en subdominio ve catalogo, empleado ve PIN screen
- **Slug en onboarding**: campo auto-generado del nombre, verificacion de disponibilidad en tiempo real (debounced), preview de URL
- **Endpoint check-slug**: `GET /onboarding/check-slug/:slug` con rate limiting
- **CORS wildcard**: origin function acepta subdominios del TENANT_DOMAIN
- **Slugs reservados**: onboarding rechaza www, api, admin, catalogo, etc.

---

## Decisiones Arquitecturales

### WhatsApp Business API (eliminado)
- Compliance Meta 2026: LLM interpreter viola prohibicion de chatbots de proposito general
- Numero unico multi-tenant no funciona sin ser BSP de Meta
- Modo developer: max 250 mensajes, sin templates aprobados
- Webhook publico = vector de ataque innecesario
- **Reemplazo**: catalogo publico con links wa.me/, cobros via wa.me/ desde PWA

### Gamificacion (eliminado)
- Tablas nunca usadas, endpoint calculaba on-the-fly
- Feature completo requiere hooks en ventas, cron, config por negocio
- **Se mantiene**: ranking de vendedores en /reports/sellers

### Subdomain-per-tenant (implementado)
- Patron de Shopify, Slack, Fina (competidor directo)
- Frontend-only: backend sigue resolviendo tenant via JWT
- Cada subdominio = origen separado = mejor aislamiento offline
- Clerk comparte sesiones entre subdominios del mismo root domain
- **Pendiente**: comprar dominio dedicado (SSL gratis en primer nivel)

### Exchange rates per-tenant (fix)
- Tabla era global, ahora tiene business_id + RLS
- Redis cache scopeado por tenant

---

## Pendiente

### Activar subdominios (ops manual, 1 dia)

| Paso | Que hacer |
|---|---|
| 1 | Comprar dominio dedicado (ej: novaincs.com, usenova.com) |
| 2 | Configurar DNS en Cloudflare: `*.novaincs.com` CNAME `nova.aikalabs.cc` (proxied) |
| 3 | Agregar `*.novaincs.com` como dominio en Coolify (nova-web) |
| 4 | Agregar env vars: `NUXT_PUBLIC_TENANT_DOMAIN=novaincs.com` y `TENANT_DOMAIN=novaincs.com` |
| 5 | Configurar Clerk: agregar novaincs.com como dominio permitido |
| 6 | Verificar: `curl https://test.novaincs.com` |

### Ops manuales (2 items)

| Item | Que hacer |
|---|---|
| Iconos PWA | Crear icon-192x192.png y icon-512x512.png en apps/web/public/ |
| Tasa de cambio inicial | El dueno la configura desde la PWA (POST /api/exchange-rate ya existe) |

### Prioridad alta (7 items)

| # | Item | Descripcion |
|---|---|---|
| 1 | Web Push notifications | Alertas de stock critico via @vite-pwa/nuxt |
| 2 | Email transaccional | Resend: boton "Enviar resumen" y "Enviar al contador" en PWA |
| 3 | Exportacion PDF | Reportes, P&L |
| 4 | Exportacion Excel | Endpoint /reports/{type}/export?format=xlsx |
| 5 | Import Excel (conectar) | inventory/import.vue -> POST /api/products batch |
| 6 | Segmentos de clientes | Calculo automatico: VIP, frecuente, en riesgo, inactivo |
| 7 | ReportLayout period selector | Conectar selector de periodo a los reportes |

### Prioridad media (5 items)

| # | Item | Descripcion |
|---|---|---|
| 8 | Seed de datos iniciales | Cuentas contables, categorias, unidades de medida por tipo de negocio |
| 9 | Prediccion de flujo de caja | Proyectar ingresos/gastos, alertar deficit |
| 10 | Error tracking (Sentry) | @sentry/node + @sentry/vue |
| 11 | Uptime monitoring | Configurar Uptime Kuma |
| 12 | Migraciones Drizzle versionadas | Migrar de push --force a generate + migrate |

### Prioridad baja (4 items)

| # | Item | Descripcion |
|---|---|---|
| 13 | PgBouncer + RLS | Evaluar cuando el trafico lo justifique |
| 14 | Service Worker offline | Verificar que funciona sin internet |
| 15 | CI/CD automatico | Push a main -> staging, tag -> produccion |
| 16 | E2E tests (Playwright) | Login, producto, venta, dashboard, catalogo |

---

## Arquitectura de Deploy

```
Coolify (Control Plane 10.0.1.10)
+-- nova-api (Docker, puerto 3001)
|   +-- DATABASE_URL -> 10.0.1.20:5432/nova
|   +-- REDIS_URL -> 10.0.1.20:6379/4
|   +-- CLERK_SECRET_KEY
|   +-- CORS_ORIGIN -> https://nova.aikalabs.cc
|   +-- TENANT_DOMAIN -> novaincs.com (pendiente)
|   +-- OPENROUTER_API_KEY (opcional)
|
+-- nova-web (Docker, puerto 3000)
|   +-- NUXT_PUBLIC_API_BASE -> https://nova-api.aikalabs.cc
|   +-- NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY
|   +-- NUXT_PUBLIC_TENANT_DOMAIN -> novaincs.com (pendiente)
|
+-- Traefik (reverse proxy)
    +-- nova.aikalabs.cc -> nova-web:3000
    +-- nova-api.aikalabs.cc -> nova-api:3001
    +-- *.novaincs.com -> nova-web:3000 (pendiente)
```
