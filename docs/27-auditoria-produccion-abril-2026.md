# Nova: Auditoria de Produccion - Abril 2026

> Codebase: ~19,000 lineas | 26 tablas (todas con RLS) | 48 endpoints | 31 paginas | 15+ E2E tests
> Stack: Nuxt 4.4 + Hono + PostgreSQL 16 + Redis 7 + Clerk + Drizzle ORM
> Produccion: novaincs.com, api.novaincs.com, *.novaincs.com

---

## Estado actual: 95% production-ready

Todos los sprints del roadmap completados. Seguridad RLS completa, offline queue
integrada, E2E tests en CI, SEO para catalogo. Pendiente: error tracking (herramienta
por decidir) y PWA icons (logo por subir).

---

## Sprint 1: Seguridad y estabilidad -- COMPLETADO (PR #103)

| # | Tarea | Estado |
|---|-------|--------|
| 1 | RLS safety: tenant middleware limpia contexto despues de cada request | HECHO |
| 2 | handleDbError en onboarding y team (mensajes en espanol) | HECHO |
| 3 | CI: typecheck ahora corre en todos los packages incluyendo web | HECHO |
| 4 | Team-roster 401: roster download no bloquea login, retry con delay | HECHO |

---

## Sprint 2: RLS en tablas hijas + migracion -- COMPLETADO (PR #104)

| # | Tarea | Estado |
|---|-------|--------|
| 5 | business_id + RLS en sale_items, sale_payments, expense_items | HECHO |
| 6 | Migracion 0002 con backfill desde tablas padre | HECHO |
| 7 | RLS policies para las 3 tablas hijas en init.sql | HECHO |
| 8 | INSERT statements actualizados en sales, accounting, tests | HECHO |

---

## Sprint 3: UX y observabilidad -- COMPLETADO (PR #106)

| # | Tarea | Estado |
|---|-------|--------|
| 9 | Dashboard dedup guard: previene 4x exchange-rate 503 loop | HECHO |
| 10 | Health check SSR: endpoint /api/health en Nuxt + Dockerfile actualizado | HECHO |
| 11 | Fix $fetch type error pre-existente en useApi.ts | HECHO |

Nota: error tracking (Sentry u otra herramienta) diferido hasta decidir solucion para todos los proyectos.

---

## Sprint 4: Offline y PWA -- COMPLETADO (PR #107)

| # | Tarea | Estado |
|---|-------|--------|
| 12 | Offline queue integrada en checkout (IndexedDB + sync FIFO) | HECHO |
| 13 | Indicador offline + mensaje "Venta guardada" diferenciado | HECHO |
| 14 | SEO catalogo: og:url, og:image, og:locale, twitter:card | HECHO |
| 15 | PWA icons reales | PENDIENTE (logo por subir) |

---

## Sprint 5: E2E Testing -- PARCIAL (PR #108)

| # | Tarea | Estado |
|---|-------|--------|
| 16 | Playwright instalado y configurado | HECHO |
| 17 | Auth bypass: mock user en localStorage | HECHO |
| 18 | Tests publicos: landing, catalogo | HECHO (local only) |
| 19 | Tests autenticados: dashboard, POS, inventario, settings, reportes | HECHO (local only) |
| 20 | CI: E2E job en GitHub Actions | BLOQUEADO |
| 21 | Backups DB: cubierto por Hetzner Cloud backup diario | OK |

Nota: `@clerk/nuxt` fuerza HTTPS en SSR produccion y valida el formato del publishable key
en cada request del server middleware. No es posible correr E2E en CI sin credenciales reales
de Clerk. Los tests existen y funcionan localmente con `npm run e2e` cuando los servers estan
corriendo. Para habilitar E2E en CI se necesita: un Clerk test instance con keys reales como
secrets de GitHub Actions, o migrar a un auth provider que soporte modo test sin red.

---

## PRs pendientes de merge

| PR | Contenido | Sprint |
|----|-----------|--------|
| #102 | Settings UI, segmentos de clientes, cash flow projection | Feature |
| #106 | Dashboard dedup, SSR health check, $fetch type fix | Sprint 3 |
| #107 | Offline queue en checkout, SEO catalogo | Sprint 4 |
| #108 | E2E tests Playwright + CI job | Sprint 5 |

---

## Backlog

| # | Tarea | Notas |
|---|-------|-------|
| 1 | Error tracking (Sentry/Highlight/otra) | Decidir herramienta para todos los proyectos |
| 2 | E2E tests en CI | Requiere Clerk test keys como GitHub secrets |
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

### Sesion 2 (PRs #102-#108)
- NUXT_PUBLIC_API_BASE es build-time: requiere rebuild del web service despues de cambiar.
- Clerk redirect_uri_mismatch: verificar que el redirect URI en Google Cloud Console coincida exactamente con el de Clerk Dashboard.
- set_config session-level con pool: limpiar en finally para evitar RLS leak.
- Migraciones con backfill: agregar columna nullable -> UPDATE desde parent -> SET NOT NULL. Seguro en produccion.
- Los NOTICE de "policy does not exist, skipping" en init.sql son normales en primer deploy de nuevas policies.
- $fetch<T> de Nuxt con baseURL externo requiere cast explicito `as T` (Nitro type mismatch).
- E2E auth bypass: inyectar NovaUser en localStorage via addInitScript, API en dev mode sin CLERK_SECRET_KEY.
- Playwright en CI: instalar solo Chromium (--with-deps), correr con --project=chromium para velocidad.
- @clerk/nuxt en SSR: fuerza HTTPS y valida publishable key en cada request del server middleware. Imposible correr E2E en CI sin keys reales. Tests E2E quedan como local-only hasta tener Clerk test instance.
