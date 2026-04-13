# Nova: Roadmap de Produccion

> Ultima actualizacion: Abril 2026 (post PR #67)
> Estado: Nova corriendo en produccion (nova-api.aikalabs.cc). DB, Redis, Clerk conectados.
> WhatsApp Business API eliminado. Catalogo publico, rate limiting, y error boundary implementados.

---

## Estado de la Infraestructura

Nova ya esta desplegado y funcionando:

```
API:  https://nova-api.aikalabs.cc/health -> {"status":"ok","services":{"database":true,"redis":true}}
Web:  https://nova.aikalabs.cc
ESC:  aikapenelope-org/platform-infra/nova (DATABASE_URL, REDIS_URL, CORS_ORIGIN, etc.)
```

Para verificar que la DB esta viva:

```bash
curl -s https://nova-api.aikalabs.cc/health | jq .
```

---

## Decision WhatsApp (eliminado)

La WhatsApp Business API fue eliminada del codigo en PR #67. Razones:

1. **Compliance Meta 2026**: el diseno original (LLM interpreter) viola la prohibicion de chatbots de proposito general
2. **Numero unico multi-tenant**: no funciona para SaaS multi-tenant sin ser BSP de Meta
3. **Modo developer**: max 250 mensajes, sin templates aprobados, inviable para MVP
4. **Vector de ataque**: webhook publico sin auth expone datos de negocios

**Reemplazos:**
- Metricas del dueno -> PWA mobile (ya es mobile-first)
- Catalogo compartible -> pagina web publica `/catalogo/{slug}` con links `wa.me/`
- Cobros a clientes -> links `wa.me/` desde la PWA (ya existia)
- Notificaciones -> Web Push + email (pendiente)

---

## Decision Gamificacion (eliminado)

### Que era

Sistema de ranking, metas diarias, y rachas para vendedores:
- Ranking diario por ventas
- Meta del dia con barra de progreso
- Racha de dias consecutivos cumpliendo la meta
- Widget de rendimiento para empleados

### Que existe en el codigo

| Componente | Que hace | Conectado? |
|---|---|---|
| `@nova/shared/gamification.ts` | Funciones puras: `rankSellers()`, `goalProgress()` | Si, usadas por el API |
| `GET /reports/gamification` | Endpoint que calcula ranking + goals + streaks on-the-fly desde la tabla `sales` | Si, funciona |
| `reports/sellers.vue` | Pagina que muestra ranking + metas + rachas | Si, consume el endpoint |
| `EmployeePerformance.vue` | Widget para dashboard del empleado | No conectado al dashboard |
| Tablas `seller_goals`, `seller_streaks` | Tablas para persistir metas y rachas | **Nunca usadas**. El endpoint calcula todo on-the-fly |

### Analisis de complejidad

**Lo que ya funciona sin esfuerzo adicional:**
- El ranking de vendedores (`/reports/sellers`) ya funciona. Es una query simple a la tabla `sales` agrupada por usuario. Esto es un reporte, no gamificacion.
- La funcion `goalProgress()` es una division. Trivial.

**Lo que falta para que sea "gamificacion" real:**
- Persistir metas diarias configurables por negocio (actualmente hardcoded a $100)
- Actualizar `sellerGoals` automaticamente al crear cada venta (hook en POST /sales)
- Calcular y persistir rachas en `sellerStreaks` (cron de cierre de dia)
- Mostrar `EmployeePerformance` en el dashboard cuando un empleado inicia sesion
- Notificaciones de logros ("Primera venta del dia", "Meta cumplida")
- Configuracion por negocio (activar/desactivar, cambiar meta)

**Complejidad que agrega:**
- Hook en el flujo de ventas (el endpoint mas critico) para actualizar goals
- Cron job para calcular rachas diarias
- Logica de configuracion por negocio
- UI de configuracion para el dueno
- 2 tablas extra que necesitan RLS, tests, y mantenimiento
- Edge cases: que pasa si el dueno cambia la meta a mitad del dia? Si un empleado se desactiva?

### Recomendacion: eliminar

El ranking de vendedores por periodo ya funciona como reporte (`/reports/sellers`). Eso es util y no requiere infraestructura adicional.

La gamificacion real (metas, rachas, logros, notificaciones) agrega complejidad significativa al flujo de ventas y al sistema de cron jobs por un beneficio marginal en el MVP. Es un feature de v2 cuando haya negocios con multiples empleados activos.

**Que eliminar:**
- Tablas `seller_goals` y `seller_streaks` del schema
- RLS policies de esas tablas en `init.sql`
- Componente `EmployeePerformance.vue`
- Seccion de gamificacion en `reports/sellers.vue` (mantener el ranking)
- Funciones `goalProgress()` y tipos `SellerStreak` de `@nova/shared`
- Endpoint `/reports/gamification` (el ranking ya esta en `/reports/sellers`)

**Que mantener:**
- `rankSellers()` en `@nova/shared` (usado por `/reports/sellers`)
- Reporte de vendedores con ranking, ventas, ticket promedio

---

## Roadmap: Estado Actual

### Hecho (8 items)

| Item | Como |
|---|---|
| Eliminar WhatsApp Business API | PR #67 |
| Catalogo publico (API + pagina + schema) | PR #67 |
| Rate limiting Redis (pub/auth/write) | PR #67 |
| Error boundary global (error.vue) | PR #67 |
| Env validation al boot | Ya existia (config.ts) |
| CORS configurable | Ya existia (app.ts) |
| Health check profundo (DB + Redis) | Ya existia (health.ts) |
| Crear DB + deploy en Hetzner | Ya hecho (nova-api.aikalabs.cc funcionando) |

### Pendiente: Ops manuales

| Item | Que hacer |
|---|---|
| Iconos PWA | Crear icon-192x192.png y icon-512x512.png en apps/web/public/ |
| Tasa de cambio inicial | El dueno la configura desde la PWA (POST /api/exchange-rate ya existe) |

### Pendiente: Codigo prioridad alta

| Item | Descripcion |
|---|---|
| Eliminar gamificacion | Tablas, RLS, componente, endpoint /reports/gamification. Mantener ranking en /reports/sellers |
| Structured logging | JSON logging con request ID, user ID, business ID |
| Env vars frontend | Validar NUXT_PUBLIC_API_BASE al arrancar Nuxt |
| Tests de ventas | POST /api/sales: stock, fiado, descuento, anulacion |
| Tests de auth | Clerk JWT, X-Acting-As, dev mode |
| Tests RLS | Negocio A no ve datos de B |
| Tests catalogo | GET /catalog/:slug, 404s, productos inactivos |
| Dockerfile verificacion | Probar build Docker con codigo actual |

### Pendiente: Codigo prioridad media

| Item | Descripcion |
|---|---|
| Web Push | Alertas de stock critico via service worker |
| Email transaccional | Resend: resumen diario, reporte al contador |
| Exportacion PDF | Reportes, libro de ventas SENIAT |
| Exportacion Excel | Endpoint /reports/{type}/export |
| Segmentos de clientes | Calculo automatico de VIP, frecuente, en riesgo |
| Import Excel (conectar) | inventory/import.vue -> POST /api/products batch |
| Seed datos iniciales | Cuentas contables, categorias por tipo de negocio |
| ReportLayout period selector | Conectar selector de periodo a los reportes |

### Pendiente: Codigo prioridad baja

| Item | Descripcion |
|---|---|
| Prediccion flujo de caja | Proyectar ingresos/gastos, alertar deficit |
| Error tracking (Sentry) | @sentry/node + @sentry/vue |
| Metricas basicas | Negocios activos, ventas/dia, errores/hora |
| Uptime monitoring | Configurar Uptime Kuma |
| PgBouncer + RLS | set_config session vs transaction mode |
| Service Worker offline | Verificar que @vite-pwa/nuxt intercepta navegacion offline |
| Migraciones Drizzle | Migrar de push a generate + migrate |
| CI/CD automatico | Push a main -> staging, tag v* -> produccion |
| E2E smoke tests | Playwright: login, producto, venta, dashboard, catalogo |

---

## Arquitectura de Deploy

```
Coolify (Control Plane 10.0.1.10)
+-- nova-api (Docker, puerto 3001)
|   +-- DATABASE_URL -> 10.0.1.20:5432/nova
|   +-- REDIS_URL -> 10.0.1.20:6379/4
|   +-- CLERK_SECRET_KEY
|   +-- CORS_ORIGIN -> https://nova.aikalabs.cc
|   +-- OPENROUTER_API_KEY (opcional, para narrativas IA)
|
+-- nova-web (Docker, puerto 3000)
|   +-- NUXT_PUBLIC_API_BASE -> https://nova-api.aikalabs.cc
|   +-- NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY
|
+-- Traefik (reverse proxy)
    +-- nova.aikalabs.cc -> nova-web:3000
    +-- nova-api.aikalabs.cc -> nova-api:3001
```

---

## Docs Anteriores que Necesitan Actualizacion

| Documento | Que cambiar |
|---|---|
| **doc 08** | Seccion "WhatsApp como entrada" descartada. Diferenciador 1 eliminado. Diferenciador 10 (catalogo) se mantiene como pagina web |
| **doc 19** | Documento completo descartado (webhook, LLM interpreter, executor) |
| **doc 11** | Actualizar seccion WhatsApp: solo links wa.me/ y catalogo publico |
| **doc 21** | Fase 7 cambia: catalogo publico + Web Push + email en vez de webhook + LLM |
| **PRODUCTION-ROADMAP.md** | Reemplazado por este documento (doc 22) |
