# Nova: Roadmap de Produccion

> Ultima actualizacion: Abril 2026 (post PRs #66, #67, #69)
> Estado: Nova corriendo en produccion. DB, Redis, Clerk conectados. CI verde.

---

## Estado de la Infraestructura

```
API:  https://nova-api.aikalabs.cc/health -> {"status":"ok","services":{"database":true,"redis":true}}
Web:  https://nova.aikalabs.cc
ESC:  aikapenelope-org/platform-infra/nova
CI:   GitHub Actions — typecheck + lint + test + build en cada push/PR (PostgreSQL 16 + Redis 7 como services)
```

Verificar que la DB esta viva:

```bash
curl -s https://nova-api.aikalabs.cc/health | jq .
```

---

## Decisiones Tomadas

### WhatsApp Business API (eliminado, PR #67)

1. **Compliance Meta 2026**: el diseno original (LLM interpreter para consultas del dueno) viola la prohibicion de chatbots de proposito general
2. **Numero unico multi-tenant**: un solo numero de WA para todos los tenants no funciona. Ser BSP de Meta es un proceso enterprise aparte
3. **Modo developer**: max 250 mensajes, 5 numeros verificados, sin templates aprobados
4. **Vector de ataque**: webhook publico sin auth expone datos de negocios a prompt injection y enumeracion

**Reemplazos implementados:**
- Metricas del dueno -> PWA mobile (ya es mobile-first)
- Catalogo compartible -> pagina web publica `/catalogo/{slug}` con links `wa.me/` (PR #67)
- Cobros a clientes -> links `wa.me/` desde la PWA (ya existia en routes/customers.ts)

**Reemplazos pendientes:**
- Notificaciones al dueno -> Web Push + email (ver seccion pendientes)

### Gamificacion (eliminado, PR #69)

Las tablas `seller_goals` y `seller_streaks` nunca se usaban. El endpoint `/reports/gamification` calculaba todo on-the-fly desde `sales`. El componente `EmployeePerformance.vue` no estaba conectado al dashboard.

Para que la gamificacion funcione en produccion necesitaria: hooks en el flujo de ventas, cron de rachas, metas configurables por negocio, UI de configuracion, y manejo de edge cases. Eso es un feature completo que se puede agregar cuando haya negocios con multiples empleados activos.

**Se mantiene**: ranking de vendedores en `/reports/sellers` (funciona, es un reporte simple).

---

## Hecho (14 items)

| Item | PR/Origen | Verificado en CI |
|---|---|---|
| Eliminar WhatsApp Business API (routes, services, constants, env vars) | #67 | Si |
| Catalogo publico: API `GET /catalog/:slug` + pagina `/catalogo/[slug]` + schema (slug, whatsappNumber) | #67 | Si |
| Rate limiting Redis (publico 60/min, auth 120/min, write 30/min) con fallback in-memory | #67 | Si |
| Error boundary global (`error.vue`) para 404s y errores no manejados | #67 | Si |
| Eliminar gamificacion (tablas, RLS, endpoint, componente, funciones) | #69 | Si |
| Structured logging JSON (method, path, status, ms, requestId, userId, businessId) | #69 | Si |
| Validacion de env vars frontend (plugin Nuxt para NUXT_PUBLIC_API_BASE) | #69 | Si |
| Tests: 17 tests en 5 archivos (health, auth, catalog, sales, rate-limit) | #69 | Si |
| Validacion de env vars backend al boot (config.ts) | Ya existia | Si |
| CORS configurable por entorno (CORS_ORIGIN env var) | Ya existia | Si |
| Health check profundo (DB + Redis, retorna status/degraded/error) | Ya existia | Si |
| Crear DB "nova" + deploy en Hetzner | Infra ops | Verificado via curl |
| Dockerfile multi-stage (API + Web) verificado con codigo actual | #69 | Paths validados |
| CI pipeline: typecheck + lint + test + build con PostgreSQL 16 + Redis 7 | Ya existia | 3 runs exitosos |

---

## Pendiente

### Ops manuales (2 items)

| Item | Que hacer | Bloquea deploy? |
|---|---|---|
| Iconos PWA | Crear icon-192x192.png y icon-512x512.png en `apps/web/public/`. Sin estos la PWA no se instala en Android/iOS | No (la app web funciona, solo la instalacion PWA falla) |
| Tasa de cambio inicial | El dueno la configura desde la PWA al primer uso. `POST /api/exchange-rate` ya existe. Sin tasa, las ventas fallan con 503 | No (es config de primer uso) |

### Prioridad alta (7 items)

Estos items son necesarios para que Nova funcione correctamente en produccion con usuarios reales.

| # | Item | Que es | Que hacer |
|---|---|---|---|
| 1 | **Web Push notifications** | Alertas de stock critico y anomalias llegan al dueno sin que abra la app. La PWA ya usa `@vite-pwa/nuxt` pero las notificaciones push no estan configuradas | Configurar Web Push API: pedir permiso, almacenar suscripciones, enviar notificaciones cuando un producto baja de stock_critical o se detecta anomalia |
| 2 | **Email transaccional** | Resumen diario, resumen semanal, reporte al contador. Actualmente no hay forma de enviar emails | Integrar Resend (100/dia gratis). Crear `services/email.ts`. Cron o boton manual para resumenes. Boton "Enviar al contador" genera PDF y lo envia |
| 3 | **Exportacion PDF** | Los reportes no se pueden descargar ni enviar. El contador necesita libro de ventas en formato SENIAT | Generar PDFs server-side con `pdfmake`. Endpoints `GET /api/reports/{type}/export?format=pdf`. Reporte diario, semanal, P&L, libro de ventas |
| 4 | **Exportacion Excel** | Los reportes no se pueden exportar a Excel. `xlsx` ya esta en dependencias del frontend | Endpoints `GET /api/reports/{type}/export?format=xlsx`. Usar `xlsx` para generar archivos |
| 5 | **Import Excel (conectar)** | `inventory/import.vue` parsea archivos Excel/CSV localmente pero no hace POST para crear productos | Conectar a `POST /api/products` en batch. Validacion de columnas, preview antes de importar, reporte de errores por fila |
| 6 | **Segmentos de clientes** | La tabla `customerSegments` existe pero no hay logica que calcule segmentos automaticamente | Implementar calculo: VIP (>10 compras + ticket alto), frecuente (>5 en 30d), en riesgo (30-60d sin compra), inactivo (60d+), con deuda, nuevo. Ejecutar al crear venta o como cron diario |
| 7 | **ReportLayout period selector** | El selector de periodo en `ReportLayout.vue` no emite eventos. Los reportes siempre cargan el periodo default | Conectar el v-model del selector para que los reportes reaccionen al cambio de periodo |

### Prioridad media (5 items)

Mejoran la calidad y mantenibilidad pero no bloquean funcionalidad core.

| # | Item | Que es | Que hacer |
|---|---|---|---|
| 8 | **Seed de datos iniciales** | No hay datos pre-configurados para negocios nuevos. El onboarding crea un negocio vacio | Crear seed con: catalogo de cuentas contables por tipo de negocio (ferreteria, bodega, tienda de ropa), categorias default, unidades de medida comunes (unidad, caja, kg, litro) |
| 9 | **Prediccion de flujo de caja** | No hay proyeccion de ingresos/gastos futuros | Proyectar ingresos (promedio ventas por dia de semana), sumar gastos fijos y cuentas por pagar, alertar si algun dia el balance proyectado es negativo |
| 10 | **Error tracking (Sentry)** | Los errores en produccion no se capturan ni notifican. Solo se ven en logs de Coolify | Integrar `@sentry/node` en Hono y `@sentry/vue` en Nuxt. Capturar errores no manejados con contexto (userId, businessId, requestId) |
| 11 | **Uptime monitoring** | No hay alertas si la API o el frontend se caen | Configurar Uptime Kuma (ya en el control plane) para monitorear `/health`, frontend, y catalogo |
| 12 | **Migraciones Drizzle versionadas** | `entrypoint-api.sh` ejecuta `drizzle-kit push --force` en cada deploy. Esto es destructivo y puede perder datos | Migrar a `drizzle-kit generate` + `drizzle-kit migrate` con archivos de migracion versionados en el repo |

### Prioridad baja (4 items)

Optimizaciones para escala futura.

| # | Item | Que es | Que hacer |
|---|---|---|---|
| 13 | **PgBouncer + RLS** | `set_config` con `false` (session-level) puede no funcionar con PgBouncer en modo transaction. Actualmente Nova usa conexion directa (puerto 5432) | Evaluar si el trafico justifica PgBouncer. Si si, migrar a `set_config(..., true)` con transacciones explicitas |
| 14 | **Service Worker offline** | `@vite-pwa/nuxt` esta configurado pero no verificado. La cola offline (`useOfflineQueue`) existe en codigo pero no se ha probado sin internet | Verificar que el SW intercepta navegacion offline, muestra pagina cached, y la cola sincroniza al volver |
| 15 | **CI/CD automatico** | El deploy a Coolify es manual. No hay pipeline de staging | Configurar: push a main -> deploy a staging, tag v* -> deploy a produccion, smoke tests post-deploy |
| 16 | **E2E tests (Playwright)** | `e2e/smoke.spec.ts` existe pero esta vacio. No hay tests end-to-end | Escribir tests: login con Clerk, crear producto, registrar venta, ver dashboard, ver catalogo publico |

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
| **doc 08** | Seccion "WhatsApp como entrada" descartada. Diferenciador 1 (WA bidireccional) eliminado. Diferenciador 10 (catalogo) se mantiene como pagina web publica |
| **doc 19** | Documento completo descartado (webhook, LLM interpreter, executor ya no existen) |
| **doc 11** | Actualizar seccion WhatsApp: solo links wa.me/ y catalogo publico |
| **doc 21** | Fase 7 cambia: catalogo publico + Web Push + email en vez de webhook + LLM. Fase 8 (gamificacion) eliminada |
| **PRODUCTION-ROADMAP.md** | Reemplazado por este documento (doc 22). Items 7-9 (WhatsApp) ya no aplican |
