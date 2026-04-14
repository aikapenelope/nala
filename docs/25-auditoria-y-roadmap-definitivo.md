# Nova: Auditoria de Codigo y Roadmap Definitivo

> Ultima actualizacion: Abril 2026 (post PRs #66-#77, dominio novaincs.com activo)
> Codebase: 15,830 lineas, 26 tablas, 40+ endpoints, 27 paginas, 17 tests
> Produccion: novaincs.com (web), api.novaincs.com (API), *.novaincs.com (subdominios tenant)

---

## Auditoria de Codigo

### Lo que esta bien

- **Arquitectura**: Nuxt 4 + Hono + PostgreSQL + Redis + Clerk. Monorepo Turborepo. Stack de produccion probado.
- **Multi-tenancy**: RLS en PostgreSQL con set_config por request. 26 tablas con policies. Exchange rates scopeadas por tenant. Patron de Slack/Shopify.
- **Auth**: Clerk + PIN local (bcrypt en browser). Patron de Square POS. No hay endpoints publicos de auth.
- **Flujo de ventas**: POST /api/sales con transaccion atomica de 7 pasos (sale + items + payments + stock + fiado + accounting + log).
- **Seguridad**: scanner blocking, secure headers, CORS wildcard para subdominios, rate limiting, structured JSON logging, slugs reservados.
- **Subdominios**: tenant detection via Nitro middleware + HostRegexp en Traefik. Frontend-only, backend no cambia.

### Problemas pendientes

1. **`drizzle-kit push --force` en cada deploy** — puede perder datos si se renombra una columna
2. **`set_config` session-level** — riesgo teorico a escala con requests concurrentes (no ahora)
3. **Tests superficiales** — 17 tests de ruta, 0 de integracion con DB
4. **Seed sin slug** — catalogo no funciona en dev local
5. **Errores de DB** — cliente recibe 500 generico en vez de mensaje util

---

## Completado

### Infraestructura y dominio

| Item | Estado |
|---|---|
| Comprar dominio novaincs.com | Hecho |
| DNS en Cloudflare (A records: @, *, api -> 95.216.216.149) | Hecho |
| Traefik HostRegexp para wildcard subdominios | Hecho |
| Coolify: dominios + env vars (TENANT_DOMAIN, NUXT_PUBLIC_TENANT_DOMAIN) | Hecho |
| Verificar: novaincs.com, api.novaincs.com, *.novaincs.com | Hecho y funcionando |

### Codigo (PRs #66-#77)

| PR | Que |
|---|---|
| #66 | Roadmap + analisis WhatsApp compliance |
| #67 | Eliminar WhatsApp API, catalogo publico, rate limiting, error boundary |
| #69 | Eliminar gamificacion, structured logging, tests, config validation |
| #70 | Actualizar roadmap con status |
| #71 | Analisis subdomain-per-tenant |
| #72 | Fix aislamiento exchange_rates (business_id + RLS + Redis scoped) |
| #73 | Subdomain-per-tenant (Nitro middleware, useTenant, slug onboarding, CORS wildcard, slugs reservados) |
| #74 | Actualizar README, roadmap, env.example |
| #75 | Guia paso a paso subdominios |
| #76 | Auditoria de codigo + roadmap definitivo |
| #77 | Set tenant domain a novaincs.com |

---

## Pendiente: Clerk en novaincs.com

Clerk sigue configurado en `nova.aikalabs.cc`. El login funciona porque el frontend todavia usa las keys de Clerk de aikalabs.cc. Para completar la migracion:

| Paso | Que hacer |
|---|---|
| 1 | Clerk Dashboard -> Domains -> Change domain a `novaincs.com` |
| 2 | Agregar registros DNS de Clerk en Cloudflare (CNAME accounts -> accounts.clerk.services) |
| 3 | Copiar nueva Publishable Key |
| 4 | Actualizar NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY en Coolify nova-web |
| 5 | Actualizar CLERK_SECRET_KEY en Coolify nova-api (si cambio) |
| 6 | Redeploy ambos servicios |

---

## Roadmap: que sigue

### Dia 1 (siguiente): Clerk + migraciones Drizzle

**Clerk migration:**
- Cambiar dominio en Clerk a novaincs.com
- Actualizar keys en Coolify
- Verificar login

**Migraciones Drizzle versionadas:**
- Reemplazar `drizzle-kit push --force` en entrypoint-api.sh
- Generar migracion inicial con `drizzle-kit generate`
- Cambiar entrypoint a `drizzle-kit migrate`

### Dia 2-3: Tests de integracion

| Test | Que verifica |
|---|---|
| Onboarding completo | Crear negocio + owner + categorias + accounts |
| Flujo de venta | Producto -> venta -> stock decrementado |
| Venta con fiado | Crea accounts_receivable, actualiza balance |
| Anulacion de venta | Void restaura stock |
| RLS aislamiento | Negocio A no ve datos de B |
| Catalogo publico | GET /catalog/:slug correcto, 404 para inexistente |

### Dia 4: Exportacion PDF

| Tarea | Archivo |
|---|---|
| Instalar pdfmake | apps/api/package.json |
| Servicio de generacion PDF | services/pdf-generator.ts |
| Endpoints export PDF | routes/reports.ts |
| Boton "Descargar PDF" en reportes | reports/*.vue |

### Dia 5: Exportacion Excel

| Tarea | Archivo |
|---|---|
| Endpoints export xlsx | routes/reports.ts |
| Libro de ventas formato SENIAT | routes/reports.ts |
| Boton "Descargar Excel" en reportes | reports/*.vue |

### Dia 6: Email transaccional

| Tarea | Archivo |
|---|---|
| Integrar Resend | apps/api/package.json |
| Servicio de email | services/email.ts |
| Boton "Enviar por email" en reportes | reports/*.vue |
| Campo email del contador en settings | settings/index.vue |
| Boton "Enviar al contador" | reports/*.vue |

### Dia 7: Import Excel + period selector + seed

| Tarea | Archivo |
|---|---|
| Conectar import a POST /api/products batch | pages/inventory/import.vue, routes/inventory.ts |
| Conectar selector de periodo en reportes | components/shared/ReportLayout.vue, reports/*.vue |
| Agregar slug y whatsappNumber al seed | packages/db/src/seed.ts |

---

## Despues del dia 7

| Item | Prioridad |
|---|---|
| Segmentos de clientes (calculo automatico) | Media |
| Sentry error tracking | Media |
| Uptime monitoring (Uptime Kuma) | Media |
| Prediccion de flujo de caja | Media |
| Iconos PWA | Baja |
| PgBouncer + RLS | Baja |
| Service Worker offline verificado | Baja |
| CI/CD automatico | Baja |
| E2E tests Playwright | Baja |

---

## Arquitectura de Deploy (actual)

```
Cloudflare (DNS + SSL + proxy)
  novaincs.com        -> A 95.216.216.149 (proxied)
  *.novaincs.com      -> A 95.216.216.149 (proxied)
  api.novaincs.com    -> A 95.216.216.149 (proxied)
  accounts.novaincs.com -> CNAME accounts.clerk.services (pendiente Clerk migration)

App Plane A (95.216.216.149)
  Traefik (reverse proxy)
    novaincs.com           -> nova-web:3000 (Host rule)
    *.novaincs.com         -> nova-web:3000 (HostRegexp rule)
    api.novaincs.com       -> nova-api:3001 (Host rule)

  nova-web (Docker, puerto 3000)
    NUXT_PUBLIC_API_BASE=https://api.novaincs.com
    NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
    NUXT_PUBLIC_TENANT_DOMAIN=novaincs.com

  nova-api (Docker, puerto 3001)
    DATABASE_URL -> 10.0.1.20:5432/nova
    REDIS_URL -> 10.0.1.20:6379/4
    CLERK_SECRET_KEY=sk_live_...
    CORS_ORIGIN=https://novaincs.com
    TENANT_DOMAIN=novaincs.com
```
