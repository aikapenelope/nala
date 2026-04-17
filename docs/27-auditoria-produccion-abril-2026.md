# Nova: Auditoria de Produccion - Abril 2026

> Codebase: ~19,000 lineas | 26 tablas (todas con RLS) | 48 endpoints | 31 paginas | 23 tests
> Stack: Nuxt 4.4 + Hono + PostgreSQL 16 + Redis 7 + Clerk + Drizzle ORM
> Produccion: novaincs.com, api.novaincs.com, *.novaincs.com

---

## Estado actual: 90% production-ready

Sprint 1 y 2 completados. Seguridad RLS completa, error handling robusto, CI corregido.
PR #102 (settings UI, segmentos, cash flow) pendiente de merge.

---

## Sprint 1: Seguridad y estabilidad (critico) -- COMPLETADO (PR #103)

| # | Tarea | Estado |
|---|-------|--------|
| 1 | RLS safety: tenant middleware limpia contexto despues de cada request | HECHO |
| 2 | handleDbError en onboarding y team (mensajes en espanol) | HECHO |
| 3 | CI: typecheck ahora corre en todos los packages incluyendo web | HECHO |
| 4 | Team-roster 401: roster download no bloquea login, retry con delay | HECHO |

---

## Sprint 2: RLS en tablas hijas + migracion (critico) -- COMPLETADO (PR #104)

| # | Tarea | Estado |
|---|-------|--------|
| 5 | business_id + RLS en sale_items, sale_payments, expense_items | HECHO |
| 6 | Migracion 0002 con backfill desde tablas padre | HECHO |
| 7 | RLS policies para las 3 tablas hijas en init.sql | HECHO |
| 8 | INSERT statements actualizados en sales, accounting, tests | HECHO |

---

## Sprint 3: UX y observabilidad (alto) -- SIGUIENTE

| # | Tarea | Archivos | Complejidad |
|---|-------|----------|-------------|
| 9 | **Sentry error tracking** | `apps/api/src/index.ts`, `apps/web/nuxt.config.ts` | Media |
|   | @sentry/node en API, @sentry/vue en web. Planificar DSN compartido para todos los proyectos (Nova, Aurora, Whabi). | | |
| 10 | **Investigar exchange-rate 503 loop** | `pages/index.vue`, componentes | Baja |
|    | El 503 se repite 4 veces en la consola. El dashboard usa Promise.allSettled (1 call). Buscar re-renders o componentes que re-triggeren el fetch. | | |
| 11 | **Health check en Nuxt SSR** | `apps/web/server/api/health.get.ts` | Baja |
|    | Agregar endpoint /api/health en Nuxt para verificar que SSR funciona. El Dockerfile ya tiene healthcheck pero apunta a fetch generico. | | |

**Resultado esperado:** Visibilidad de errores en produccion, dashboard sin requests innecesarios.

---

## Sprint 4: Offline y PWA (medio)

| # | Tarea | Archivos | Complejidad |
|---|-------|----------|-------------|
| 12 | **Verificar integracion offline queue en checkout** | `pages/sales/checkout.vue`, `useOfflineQueue.ts` | Media |
|    | Los composables existen pero verificar que checkout.vue usa queueSale() cuando offline. | | |
| 13 | **PWA icons reales** | `public/icon-*.png` | Baja |
|    | Reemplazar placeholders con iconos de Nova (192x192, 512x512). | | |
| 14 | **SEO meta tags en catalogo publico** | `pages/catalogo/[slug].vue` | Baja |
|    | Agregar title, description, og:image para compartir en WhatsApp/Instagram. | | |

---

## Sprint 5: Testing y CI/CD (medio)

| # | Tarea | Archivos | Complejidad |
|---|-------|----------|-------------|
| 15 | **E2E tests: login, venta, inventario** | `e2e/` | Alta |
|    | Expandir los 2 smoke tests a flujos completos con Playwright. | | |
| 16 | **Backups automaticos de DB** | Infra (Hetzner/Coolify) | Media |
|    | Configurar pg_dump cron o verificar backups de Hetzner Cloud. | | |

---

## Backlog (bajo)

| # | Tarea | Notas |
|---|-------|-------|
| 17 | Rate limit en PIN attempts client-side | Mitigado por bcrypt lento |
| 18 | robots.txt con reglas utiles | Actual esta vacio |
| 19 | sitemap.xml para catalogo | SEO |
| 20 | PgBouncer + RLS transaccional | Solo a escala |
| 21 | Service Worker offline verificado | PWA registrada, no verificada |

---

## PRs pendientes de merge

| PR | Contenido | Estado |
|----|-----------|--------|
| #102 | Settings UI, segmentos de clientes, cash flow projection | Abierto |

---

## Variables de entorno (verificar en Coolify)

### API
| Variable | Critica | Estado |
|----------|---------|--------|
| DATABASE_URL | Si | OK (health 200) |
| CLERK_SECRET_KEY | Si | OK (auth funciona) |
| REDIS_URL | Si | OK (health 200) |
| CORS_ORIGIN | Si | Verificar: debe ser `https://novaincs.com` |
| TENANT_DOMAIN | Si | Verificar: debe ser `novaincs.com` |
| OPENROUTER_API_KEY | No | Opcional (narrativas AI) |
| GROQ_API_KEY | No | Opcional (fallback AI) |

### Web (build args)
| Variable | Critica | Estado |
|----------|---------|--------|
| NUXT_PUBLIC_API_BASE | Si | OK (configurado) |
| NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY | Si | OK (login funciona) |

---

## Lecciones aprendidas

### Sesion anterior (PRs #79-#101)
- Drizzle query builder: excelente. drizzle-kit CLI: fragil. Usar migrate.mjs propio.
- pdfmake es CJS-only: requiere createRequire(import.meta.url) en bundle ESM.
- xlsx (SheetJS) tiene ESM nativo, sin problemas.
- useState/useRuntimeConfig de Nuxt: NUNCA a nivel de modulo, siempre dentro de composables/setup.
- Coolify se satura con muchos PRs seguidos: mergear en batches de 2-3.

### Sesion actual (PRs #102-#104)
- NUXT_PUBLIC_API_BASE es build-time: requiere rebuild del web service despues de cambiar.
- Clerk redirect_uri_mismatch: verificar que el redirect URI en Google Cloud Console coincida exactamente con el de Clerk Dashboard.
- set_config session-level con pool: limpiar en finally para evitar RLS leak.
- Migraciones con backfill: agregar columna nullable -> UPDATE desde parent -> SET NOT NULL. Seguro en produccion.
- Los NOTICE de "policy does not exist, skipping" en init.sql son normales en primer deploy de nuevas policies.
