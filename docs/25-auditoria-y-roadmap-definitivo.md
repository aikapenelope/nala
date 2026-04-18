# Nova: Roadmap y Estado - 15 Abril 2026

> Codebase: ~18,500 lineas | 26 tablas | 45+ endpoints | 30 paginas | 23 tests
> Stack: Nuxt 4.4 + Hono + PostgreSQL 16 + Redis 7 + Clerk + Drizzle ORM
> Produccion: novaincs.com, api.novaincs.com, *.novaincs.com

---

## Completado (PRs #79-#100)

### Roadmap original (doc 25, dias 1-8): COMPLETO

| Dia | Tarea | PRs |
|-----|-------|-----|
| 1 | Subdominios + Clerk en novaincs.com | #73, #77 |
| 2 | Migraciones Drizzle versionadas + seed fix | #79, #82-85 |
| 3-4 | Tests integracion (sales, fiado, void, RLS) | #80 |
| 5 | Export PDF (daily, weekly, financial) | #81, #85 |
| 6 | Export Excel (daily, weekly, sellers) | #86 |
| 7 | Email transaccional (Resend) | #87 |
| 8 | Import batch + ReportLayout period selector | #88 |

### Mejoras post-roadmap: COMPLETO

| Mejora | PRs |
|--------|-----|
| Auth: restore session on reload (fix critico) | #89 |
| Auth: 401 interceptor + banner sesion expirada | #91 |
| Auth: fix SSR crash (useState fuera de contexto) | #100 |
| Auditoria de arquitectura (doc 26) | #90 |
| Split reports.ts en modulos (778 lineas vs 1678) | #92 |
| DB error handling: mensajes en espanol (4 archivos) | #94, #95 |
| Campo accountant_email + settings API + migration 0001 | #96 |
| OCR 503 fallback + payment fields en activity log | #97 |
| Roster refresh reducido a 1 minuto | #98 |
| Roadmap updates | #93, #99 |

### Hotfixes de deploy: RESUELTOS

| Problema | PRs |
|----------|-----|
| Docker builder sin build tools (pdfmake nativo) | #82 |
| drizzle-kit migrate cuelga el proceso (pool abierto) | #82, #84 |
| Migration 0000 falla en DB existente | #83 |
| sh interpreta template literals de Node | #84 |
| pdfmake require() falla en ESM bundle | #85 |
| Web SSR crash: useState fuera de contexto Nuxt | #100 |

---

## Que falta

### Prioridad alta

| # | Tarea | Complejidad | Notas |
|---|-------|-------------|-------|
| 1 | **Sentry error tracking** | Baja | @sentry/node + @sentry/vue. Planificar centralizado para Nova, Aurora, Propi, Whabi. |
| 2 | **Settings UI en frontend** | Baja | Pagina /settings con campos accountant_email y whatsappNumber. API ya existe (GET/PATCH /api/settings, PR #96). |

### Prioridad media

| # | Tarea | Complejidad | Notas |
|---|-------|-------------|-------|
| 3 | **Segmentos de clientes** | Media | calculateCustomerSegments() existe en shared. Falta cron/trigger que lo ejecute y UI que lo muestre. |
| 4 | **Prediccion flujo de caja** | Media | Requiere 30+ dias de datos reales. |
| 5 | **Uptime monitoring** | Baja | Uptime Kuma en Control Plane. |

### Prioridad baja

| # | Tarea | Notas |
|---|-------|-------|
| 6 | Iconos PWA (192x192, 512x512) | Placeholders actuales |
| 7 | PgBouncer + RLS transaccional | Solo necesario a escala |
| 8 | Service Worker offline verificado | PWA registrada, no verificada |
| 9 | CI/CD automatico (push main -> deploy) | Manual via Coolify webhook |
| 10 | E2E tests Playwright | Login, producto, venta, dashboard |
| 11 | Catalogo: no repetir slug en URL de subdominio | Cosmetico |

### Problemas conocidos (no criticos)

| Problema | Mitigacion |
|----------|-----------|
| set_config session-level con pool | Trafico bajo. Transacciones explicitas cuando escale. |
| PIN hashes en localStorage | bcrypt cost 10. Aceptable para POS en tienda. |
| Coolify build queue se satura con muchos PRs seguidos | Mergear en batches de 2-3, esperar deploy. |
