# Nova: Auditoria de Produccion - Abril 2026

> Codebase: ~19,000 lineas | 26 tablas | 48 endpoints | 31 paginas | 23 tests
> Stack: Nuxt 4.4 + Hono + PostgreSQL 16 + Redis 7 + Clerk + Drizzle ORM
> Produccion: novaincs.com, api.novaincs.com, *.novaincs.com

---

## Estado actual: 80% production-ready

La arquitectura es solida (patron Square POS, RLS multi-tenant, monorepo Turbo).
Las features core funcionan. Los items pendientes son de robustez y seguridad.

---

## Sprint 1: Seguridad y estabilidad (critico)

| # | Tarea | Archivos | Complejidad |
|---|-------|----------|-------------|
| 1 | **RLS safety: tenant middleware transaccional** | `middleware/tenant.ts` | Media |
|   | `set_config(..., false)` persiste en la conexion del pool. Envolver queries sensibles en transacciones con `set_config(..., true)` para evitar RLS leak entre requests. | | |
| 2 | **handleDbError en onboarding y team** | `routes/onboarding.ts`, `routes/team.ts` | Baja |
|   | Constraint violations (slug duplicado, clerk_id duplicado) devuelven 500 con stack trace. Agregar try/catch con handleDbError. | | |
| 3 | **Fix CI: agregar typecheck de @nova/web** | `.github/workflows/ci.yml` | Baja |
|   | El CI solo hace typecheck de shared, db, api. Falta web. | | |
| 4 | **Fix team-roster 401 en primer login** | `composables/useNovaAuth.ts` | Baja |
|   | Despues de Clerk login, refreshRoster() falla con 401. Agregar retry con delay. | | |

**Resultado esperado:** Zero errores 500 por constraints, RLS seguro bajo carga, CI completo, login sin 401.

---

## Sprint 2: RLS en tablas hijas + migracion (critico)

| # | Tarea | Archivos | Complejidad |
|---|-------|----------|-------------|
| 5 | **Agregar business_id a sale_items, sale_payments, expense_items** | `schema.ts`, nueva migracion | Alta |
|   | Estas tablas no tienen business_id ni RLS. Se acceden via JOIN con tablas padre (que si tienen RLS), pero un query directo no estaria filtrado. Requiere: migracion SQL para agregar columna + backfill desde tabla padre + RLS policy. | | |
| 6 | **RLS policies para tablas hijas** | `init.sql` | Media |
|   | Crear policies para sale_items, sale_payments, expense_items. | | |

**Resultado esperado:** Defensa en profundidad completa. Ningun dato accesible sin filtro de tenant.

---

## Sprint 3: UX y observabilidad (alto)

| # | Tarea | Archivos | Complejidad |
|---|-------|----------|-------------|
| 7 | **Sentry error tracking** | `apps/api/src/index.ts`, `apps/web/nuxt.config.ts` | Media |
|   | @sentry/node en API, @sentry/vue en web. Planificar DSN compartido para todos los proyectos. | | |
| 8 | **Investigar exchange-rate 503 loop** | `pages/index.vue`, componentes | Baja |
|   | El 503 se repite 4 veces. El dashboard usa Promise.allSettled (1 call). Buscar re-renders o componentes que re-triggeren el fetch. | | |
| 9 | **Health check en Nuxt SSR** | `apps/web/server/api/health.get.ts` | Baja |
|   | Agregar endpoint /api/health en Nuxt para verificar que SSR funciona. | | |

**Resultado esperado:** Visibilidad de errores en produccion, dashboard sin requests innecesarios.

---

## Sprint 4: Offline y PWA (medio)

| # | Tarea | Archivos | Complejidad |
|---|-------|----------|-------------|
| 10 | **Verificar integracion offline queue en checkout** | `pages/sales/checkout.vue`, `useOfflineQueue.ts` | Media |
|    | Los composables existen pero verificar que checkout.vue usa queueSale() cuando offline. | | |
| 11 | **PWA icons reales** | `public/icon-*.png` | Baja |
|    | Reemplazar placeholders con iconos de Nova. | | |
| 12 | **SEO meta tags en catalogo publico** | `pages/catalogo/[slug].vue` | Baja |
|    | Agregar title, description, og:image para compartir en WhatsApp/Instagram. | | |

---

## Sprint 5: Testing y CI/CD (medio)

| # | Tarea | Archivos | Complejidad |
|---|-------|----------|-------------|
| 13 | **E2E tests: login, venta, inventario** | `e2e/` | Alta |
|    | Expandir los 2 smoke tests a flujos completos con Playwright. | | |
| 14 | **Backups automaticos de DB** | Infra (Hetzner/Coolify) | Media |
|    | Configurar pg_dump cron o verificar backups de Hetzner Cloud. | | |

---

## Backlog (bajo)

| # | Tarea | Notas |
|---|-------|-------|
| 15 | Rate limit en PIN attempts client-side | Mitigado por bcrypt lento |
| 16 | robots.txt con reglas utiles | Actual esta vacio |
| 17 | sitemap.xml para catalogo | SEO |
| 18 | PgBouncer + RLS transaccional | Solo a escala |
| 19 | Service Worker offline verificado | PWA registrada, no verificada |

---

## Variables de entorno (verificar en Coolify)

### API
| Variable | Critica | Estado |
|----------|---------|--------|
| DATABASE_URL | Si | OK |
| CLERK_SECRET_KEY | Si | OK |
| REDIS_URL | Si | OK |
| CORS_ORIGIN | Si | Verificar: debe ser `https://novaincs.com` |
| TENANT_DOMAIN | Si | Verificar: debe ser `novaincs.com` |
| OPENROUTER_API_KEY | No | Opcional (narrativas AI) |
| GROQ_API_KEY | No | Opcional (fallback AI) |

### Web (build args)
| Variable | Critica | Estado |
|----------|---------|--------|
| NUXT_PUBLIC_API_BASE | Si | Recien agregado |
| NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY | Si | Verificar |

---

## Lecciones de la sesion anterior (PRs #79-#101)

- Drizzle query builder: excelente. drizzle-kit CLI: fragil. Usar migrate.mjs propio.
- pdfmake es CJS-only: requiere createRequire(import.meta.url) en bundle ESM.
- xlsx (SheetJS) tiene ESM nativo, sin problemas.
- useState/useRuntimeConfig de Nuxt: NUNCA a nivel de modulo, siempre dentro de composables/setup.
- Coolify se satura con muchos PRs seguidos: mergear en batches de 2-3.
- NUXT_PUBLIC_API_BASE es build-time: requiere rebuild del web service despues de cambiar.
