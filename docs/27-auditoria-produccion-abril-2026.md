# Nova: Auditoria de Produccion - Abril 2026

> Codebase: ~19,500 lineas | 26 tablas (todas con RLS) | 51 endpoints | 32 paginas | 47 tests
> Stack: Nuxt 4.4 + Hono + PostgreSQL 16 + Redis 7 + Clerk + Drizzle ORM
> Produccion: novaincs.com, api.novaincs.com, *.novaincs.com

---

## Estado actual: 95% production-ready

Todos los sprints completados. Seguridad RLS completa en 29 tablas, offline queue
integrada, 47 tests en CI, SEO para catalogo. Pendiente: error tracking (herramienta
por decidir) y PWA icons (logo por subir).

---

## Features (PR #102) -- COMPLETADO

| # | Tarea | Estado |
|---|-------|--------|
| 1 | Settings UI: pagina /settings/business (email contador, WhatsApp) | HECHO |
| 2 | Segmentos de clientes: endpoint recalculate + segments en list/detail | HECHO |
| 3 | Prediccion flujo de caja: endpoint /reports/cash-flow (7d, 30d, trend) | HECHO |

---

## Sprint 1: Seguridad y estabilidad -- COMPLETADO (PR #103)

| # | Tarea | Estado |
|---|-------|--------|
| 4 | RLS safety: tenant middleware limpia contexto despues de cada request | HECHO |
| 5 | handleDbError en onboarding y team (mensajes en espanol) | HECHO |
| 6 | CI: typecheck ahora corre en todos los packages incluyendo web | HECHO |
| 7 | Team-roster 401: roster download no bloquea login, retry con delay | HECHO |

---

## Sprint 2: RLS en tablas hijas + migracion -- COMPLETADO (PR #104)

| # | Tarea | Estado |
|---|-------|--------|
| 8 | business_id + RLS en sale_items, sale_payments, expense_items | HECHO |
| 9 | Migracion 0002 con backfill desde tablas padre | HECHO |
| 10 | RLS policies para las 3 tablas hijas en init.sql | HECHO |
| 11 | INSERT statements actualizados en sales, accounting, tests | HECHO |

---

## Sprint 3: UX y observabilidad -- COMPLETADO (PR #106)

| # | Tarea | Estado |
|---|-------|--------|
| 12 | Dashboard dedup guard: previene 4x exchange-rate 503 loop | HECHO |
| 13 | Health check SSR: endpoint /api/health en Nuxt + Dockerfile actualizado | HECHO |
| 14 | Fix $fetch type error pre-existente en useApi.ts | HECHO |

Nota: error tracking (Sentry u otra herramienta) diferido hasta decidir solucion para todos los proyectos.

---

## Sprint 4: Offline y PWA -- COMPLETADO (PR #107)

| # | Tarea | Estado |
|---|-------|--------|
| 15 | Offline queue integrada en checkout (IndexedDB + sync FIFO) | HECHO |
| 16 | Indicador offline + mensaje "Venta guardada" diferenciado | HECHO |
| 17 | SEO catalogo: og:url, og:image, og:locale, twitter:card | HECHO |
| 18 | PWA icons reales | PENDIENTE (logo por subir) |

---

## Sprint 5: Testing -- COMPLETADO (PR #109)

| # | Tarea | Estado |
|---|-------|--------|
| 19 | 30 API E2E tests con Vitest + Hono app.request() | HECHO |
| 20 | e2e-sales: ciclo completo venta, void, fiado, stock | HECHO |
| 21 | e2e-inventory-customers: CRUD productos, busqueda, clientes, segmentos | HECHO |
| 22 | e2e-reports-settings: 8 reportes, cash flow, settings, team, contabilidad | HECHO |
| 23 | Corren en CI con PostgreSQL + Redis (sin Clerk, sin browser) | HECHO |
| 24 | Backups DB: cubierto por Hetzner Cloud backup diario | OK |

Nota: E2E browser tests (Playwright) bloqueados por @clerk/nuxt forzando HTTPS en SSR.
Para habilitarlos se necesita Clerk test instance con keys reales como GitHub secrets.

---

## PRs mergeados en esta sesion

| PR | Contenido |
|----|-----------|
| #102 | Settings UI, segmentos de clientes, cash flow projection |
| #103 | Sprint 1: RLS safety, error handling, CI, roster retry |
| #104 | Sprint 2: RLS en tablas hijas + migracion 0002 |
| #105 | Roadmap actualizado |
| #106 | Sprint 3: dashboard dedup, SSR health, $fetch fix |
| #107 | Sprint 4: offline queue, SEO catalogo |
| #109 | Sprint 5: 30 API E2E tests |

PR #108 (Playwright E2E) cerrado sin merge -- reemplazado por #109.

---

## Backlog

| # | Tarea | Notas |
|---|-------|-------|
| 1 | Error tracking (Sentry/Highlight/otra) | Decidir herramienta para todos los proyectos |
| 2 | E2E browser tests en CI | Requiere Clerk test keys como GitHub secrets |
| 3 | PWA icons (192x192, 512x512) | Subir logo de Nova |
| 4 | og:image real para catalogo | Subir /og-catalog.png (1200x630) |
| 5 | Rate limit en PIN attempts client-side | Mitigado por bcrypt lento |
| 6 | robots.txt con reglas utiles | Actual esta vacio |
| 7 | sitemap.xml para catalogo | SEO |
| 8 | PgBouncer + RLS transaccional | Solo a escala |
| 9 | Service Worker offline verificado | PWA registrada, no verificada |

---

## Variables de entorno (Coolify)

### API
| Variable | Critica | Estado |
|----------|---------|--------|
| DATABASE_URL | Si | OK |
| CLERK_SECRET_KEY | Si | OK |
| REDIS_URL | Si | OK |
| CORS_ORIGIN | Si | Verificar: `https://novaincs.com` |
| TENANT_DOMAIN | Si | Verificar: `novaincs.com` |
| OPENROUTER_API_KEY | No | Opcional (narrativas AI) |
| GROQ_API_KEY | No | Opcional (fallback AI) |

### Web (build args)
| Variable | Critica | Estado |
|----------|---------|--------|
| NUXT_PUBLIC_API_BASE | Si | OK |
| NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY | Si | OK |

---

## Lecciones aprendidas

### Sesion 1 (PRs #79-#101)
- Drizzle query builder: excelente. drizzle-kit CLI: fragil. Usar migrate.mjs propio.
- pdfmake es CJS-only: requiere createRequire(import.meta.url) en bundle ESM.
- xlsx (SheetJS) tiene ESM nativo, sin problemas.
- useState/useRuntimeConfig de Nuxt: NUNCA a nivel de modulo, siempre dentro de composables/setup.
- Coolify se satura con muchos PRs seguidos: mergear en batches de 2-3.

### Sesion 2 (PRs #102-#109)
- NUXT_PUBLIC_API_BASE es build-time: requiere rebuild del web service despues de cambiar.
- Clerk redirect_uri_mismatch: verificar que el redirect URI en Google Cloud Console coincida exactamente con el de Clerk Dashboard.
- set_config session-level con pool: limpiar en finally para evitar RLS leak.
- Migraciones con backfill: agregar columna nullable -> UPDATE desde parent -> SET NOT NULL. Seguro en produccion.
- Los NOTICE de "policy does not exist, skipping" en init.sql son normales en primer deploy de nuevas policies.
- $fetch<T> de Nuxt con baseURL externo requiere cast explicito `as T` (Nitro type mismatch).
- @clerk/nuxt en SSR: fuerza HTTPS y valida publishable key en cada request del server middleware. Imposible correr E2E browser en CI sin keys reales. Solucion: API E2E tests con Vitest + app.request() (sin HTTP, sin Clerk).
- Clerk publishable key format: pk_test_ + base64(dominio + "$"). No acepta placeholders arbitrarios.
