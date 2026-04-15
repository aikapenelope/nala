# Nova: Roadmap y Estado - 15 Abril 2026

> Codebase: ~18,500 lineas | 26 tablas | 45+ endpoints | 30 paginas | 23 tests
> Stack: Nuxt 4.4 + Hono + PostgreSQL 16 + Redis 7 + Clerk + Drizzle ORM
> Produccion: novaincs.com, api.novaincs.com, *.novaincs.com

---

## Completado (PRs #79-#98)

### Roadmap original (doc 25, dias 1-8): TODO HECHO

| Dia | Tarea | PRs |
|-----|-------|-----|
| 1 | Subdominios + Clerk en novaincs.com | #73, #77 |
| 2 | Migraciones Drizzle versionadas + seed fix | #79, #82-85 |
| 3-4 | Tests integracion (sales, fiado, void, RLS) | #80 |
| 5 | Export PDF (daily, weekly, financial) | #81, #85 |
| 6 | Export Excel (daily, weekly, sellers, libro SENIAT) | #86 |
| 7 | Email transaccional (Resend) | #87 |
| 8 | Import batch + ReportLayout period selector | #88 |

### Mejoras post-roadmap

| Mejora | PRs |
|--------|-----|
| Auth: restore session on reload | #89 |
| Auth: 401 interceptor + banner sesion expirada | #91 |
| Auditoria de arquitectura (doc 26) | #90 |
| Split reports.ts en modulos | #92 |
| DB error handling: mensajes en espanol (sales, inventory, customers, accounting) | #94, #95 |
| Campo accountant_email + settings API + migration | #96 |
| OCR 503 fallback + payment fields en activity log | #97 |
| Roster refresh reducido a 1 minuto | #98 |

---

## Que falta

### Prioridad alta

| Tarea | Complejidad | Notas |
|-------|-------------|-------|
| Sentry error tracking | Baja | @sentry/node + @sentry/vue. Planificar para todos los proyectos (Nova, Aurora, Propi, Whabi). |
| Settings UI en frontend | Baja | Pagina /settings con campos accountant_email y whatsappNumber. El API ya existe (GET/PATCH /api/settings). |

### Prioridad media

| Tarea | Complejidad | Notas |
|-------|-------------|-------|
| Segmentos de clientes | Media | Calculo automatico VIP/frecuente/en riesgo/inactivo. Tabla customer_segments existe. Funcion calculateCustomerSegments existe en shared. Falta el cron/trigger que lo ejecute. |
| Prediccion flujo de caja | Media | Proyectar ingresos/gastos. Requiere 30+ dias de datos. |
| Uptime monitoring | Baja | Uptime Kuma en Control Plane para api.novaincs.com/health. |

### Prioridad baja (backlog)

| Tarea | Notas |
|-------|-------|
| Iconos PWA (192x192, 512x512) | Placeholders actuales |
| PgBouncer + RLS transaccional | Solo a escala |
| Service Worker offline | PWA registrada, no verificada offline |
| CI/CD automatico | Deploy manual via Coolify webhook |
| E2E tests Playwright | Login, producto, venta, dashboard |
| Catalogo: no repetir slug en URL de subdominio | Cosmetico |

---

## Problemas conocidos (documentados, no criticos)

| Problema | Mitigacion |
|----------|-----------|
| set_config session-level con pool | Trafico bajo. Transacciones explicitas cuando escale. |
| PIN hashes en localStorage | bcrypt cost 10. Aceptable para POS en tienda. |
| Errores de DB en endpoints sin handleDbError | Solo onboarding y team no tienen el wrapper. Riesgo bajo (pocas constraint violations posibles). |
