# Nova: Auditoria de Codigo y Roadmap Definitivo

> Ultima actualizacion: 15 Abril 2026 (post PRs #79-#92)
> Codebase: ~18,000 lineas, 26 tablas, 40+ endpoints, 30 paginas, 23 tests
> Produccion: novaincs.com (web), api.novaincs.com (API), *.novaincs.com (subdominios tenant)
> Stack: Nuxt 4.4 + Hono + PostgreSQL 16 + Redis 7 + Clerk + Drizzle ORM

---

## Estado actual: que esta hecho

### Infraestructura y dominio

| Item | PR | Estado |
|---|---|---|
| Dominio novaincs.com + DNS Cloudflare | #77 | Hecho |
| Wildcard subdominios *.novaincs.com | #73 | Hecho |
| Clerk migrado a novaincs.com | #77 | Hecho |
| Migraciones Drizzle versionadas | #79, #82-84 | Hecho |
| Deploy API + Web funcionando en Coolify | #85 | Hecho |

### Roadmap del doc 25 (dias 1-8)

| Dia | Tarea | PR(s) | Estado |
|---|---|---|---|
| 1 | Subdominios activos | #73, #77 | Hecho |
| 2 | Migraciones Drizzle + seed fix | #79, #82, #83, #84 | Hecho |
| 3-4 | Tests de integracion (sales, fiado, void, RLS) | #80 | Hecho |
| 5 | Exportacion PDF (daily, weekly, financial) | #81, #85 | Hecho |
| 6 | Exportacion Excel (daily, weekly, sellers, libro SENIAT) | #86 | Hecho |
| 7 | Email transaccional (Resend + modal UI) | #87 | Hecho |
| 8 | Import batch + ReportLayout period selector | #88 | Hecho |

### Mejoras adicionales (post-roadmap)

| Mejora | PR | Estado |
|---|---|---|
| Auth: restore session on reload (fix critico) | #89 | Hecho |
| Auth: 401 interceptor + banner sesion expirada | #91 | Hecho |
| Auditoria de arquitectura (doc 26) | #90 | Hecho |
| Split reports.ts en modulos (mantenibilidad) | #92 | Hecho |

---

## Que falta: pendiente

### Prioridad alta (afecta produccion)

| # | Tarea | Complejidad | Notas |
|---|---|---|---|
| 1 | **Errores de DB traducidos a mensajes utiles** | Baja | POST /sales devuelve 500 generico en unique constraint / FK violation. Capturar errores especificos de Postgres y retornar mensajes claros al usuario. |
| 2 | **Sentry error tracking** | Baja | @sentry/node en API + @sentry/vue en web. Sin esto, los errores en produccion son invisibles. |
| 3 | **Campo email del contador en settings** | Baja | El endpoint send-email existe pero no hay UI para guardar el email del contador en el negocio. Agregar campo `accountant_email` a tabla businesses + UI en settings. |

### Prioridad media (mejora el producto)

| # | Tarea | Complejidad | Notas |
|---|---|---|---|
| 4 | **Segmentos de clientes** | Media | Calculo automatico: VIP (top 20% gasto), frecuente (>4 compras/mes), en riesgo (30+ dias sin compra), inactivo (90+ dias). Tabla customer_segments ya existe. |
| 5 | **Prediccion flujo de caja** | Media | Proyectar ingresos/gastos basado en historico. Alertar deficit. Requiere datos de al menos 30 dias. |
| 6 | **Uptime monitoring** | Baja | Configurar Uptime Kuma en el Control Plane para monitorear api.novaincs.com/health y novaincs.com. |
| 7 | **Reducir roster refresh a 1 min** | Baja | Actualmente 5 min. Si el owner despide un empleado, el PIN viejo funciona 5 min. Reducir a 1 min. |

### Prioridad baja (backlog)

| # | Tarea | Complejidad | Notas |
|---|---|---|---|
| 8 | Iconos PWA (192x192, 512x512) | Baja | Actualmente usa placeholders |
| 9 | PgBouncer + RLS transaccional | Media | Solo necesario a escala. set_config session-level funciona con trafico actual. |
| 10 | Service Worker offline verificado | Media | PWA registrada pero no verificada sin internet |
| 11 | CI/CD automatico (push main -> staging) | Media | Actualmente deploy manual via Coolify webhook |
| 12 | E2E tests Playwright | Alta | Login, producto, venta, dashboard. Requiere setup de Playwright + Clerk test mode. |
| 13 | Catalogo: detectar subdominio y no repetir slug en URL | Baja | bodegadonpedro.novaincs.com/catalogo/bodegadonpedro es redundante |

---

## Problemas conocidos (documentados, no criticos)

| Problema | Riesgo | Mitigacion actual |
|---|---|---|
| `set_config` session-level con pool | Teorico: RLS leak bajo carga concurrente | Trafico actual es bajo. Migrar a transacciones explicitas cuando justifique. |
| PIN hashes en localStorage | Fisico: acceso al dispositivo expone hashes bcrypt | Aceptable para POS en tienda. bcrypt cost 10 hace brute force impractico. |
| Clerk JWT expira silenciosamente | UX: empleado ve errores sin explicacion | Resuelto con 401 interceptor (PR #91). Banner no-blocking. |
| restoreUser no se llamaba | UX: cada F5 forzaba round-trip a /api/me | Resuelto (PR #89). Restore instantaneo desde localStorage. |

---

## Arquitectura de Deploy (actual, funcionando)

```
Cloudflare (DNS + SSL + proxy)
  novaincs.com        -> A 95.216.216.149 (proxied)
  *.novaincs.com      -> A 95.216.216.149 (proxied)
  api.novaincs.com    -> A 95.216.216.149 (proxied)

App Plane A (95.216.216.149)
  Traefik (reverse proxy)
    novaincs.com           -> nova-web:3000
    *.novaincs.com         -> nova-web:3000
    api.novaincs.com       -> nova-api:3001

  nova-web (Nuxt 4 SSR, Docker)
  nova-api (Hono + tsup ESM, Docker)
    -> migrate.mjs (Drizzle migraciones con sql.end())
    -> init.sql (RLS policies)
    -> node apps/api/dist/index.js

Data Plane (10.0.1.20)
  PostgreSQL 16 + pgvector + pg_trgm
  Redis 7
```

---

## Estructura de archivos de la API (post-refactor)

```
apps/api/src/
  routes/
    reports.ts          (778 lineas - data + alerts + monta sub-routers)
    reports-helpers.ts  (74 lineas - parsePeriodRange, periodQuery)
    reports-pdf.ts      (243 lineas - 3 endpoints PDF export)
    reports-xlsx.ts     (138 lineas - 4 endpoints Excel export)
    reports-email.ts    (254 lineas - send-email endpoint)
    sales.ts            (689 lineas - CRUD ventas + cotizaciones)
    inventory.ts        (634 lineas - CRUD productos + batch import)
    onboarding.ts       (328 lineas - crear negocio + owner)
    customers.ts        (~ lineas - CRUD clientes + cuentas)
    accounting.ts       (~ lineas - gastos + OCR)
    catalog.ts          (129 lineas - catalogo publico)
    auth.ts             (83 lineas - verify-owner-pin)
    team.ts             (355 lineas - roster + empleados CRUD)
    health.ts           (~ lineas - healthcheck)
  services/
    pdf-generator.ts    (471 lineas - pdfmake con createRequire)
    excel-generator.ts  (222 lineas - xlsx ESM nativo)
    email.ts            (96 lineas - Resend SDK)
    ai-narrative.ts     (150 lineas - OpenRouter/Groq)
    exchange-rate.ts    (140 lineas - tasa BCV per-tenant)
    ocr-pipeline.ts     (~ lineas - OCR facturas)
  middleware/
    auth.ts             (187 lineas - Clerk JWT + X-Acting-As)
    tenant.ts           (50 lineas - set_config RLS)
    rate-limit.ts       (~ lineas)
    structured-logger.ts(~ lineas)
```
