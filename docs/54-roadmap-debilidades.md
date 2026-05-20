# Roadmap de Debilidades — Auditoría Completa Mayo 2026

> Score actual: **8.5/10** (era 7.8 al inicio)
> Objetivo: 9.0/10
> Última revisión: Mayo 2026
> **Progreso: 20 de 41 items resueltos (49%)**

---

## RESUELTOS

| # | Item | PR | Sprint |
|---|------|-----|--------|
| 2 | Unique constraint SKU por negocio | #369 | 1 |
| 3 | Quick sales envueltas en db.transaction() | #369 | 1 |
| 4 | Validación JSONB fields (store settings hardened) | #373 | 4 |
| 5 | Exchange rates unique index DATE() + UPSERT | #369 | 1 |
| 6 | ON DELETE RESTRICT en saleItems→products | #369 | 1 |
| 8 | CSRF Origin validation en storefront orders | #375 | 6 |
| 11 | productAliases.supplierId → supplierName + UUID FK | #375 | 6 |
| 12 | customer_segments vs RFM documentado (opción B) | #375 | 6 |
| 13 | Payment method validado con Zod enum | #369 | 1 |
| 15 | Dashboard consolidado (12 API calls → 1) | #374 | 5 |
| 16 | Catálogo optimizado 6→3 DB round-trips | #373 | 4 |
| 17 | Rate limit duplicado en catalog orders removido | #369 | 1 |
| 18 | Liveness vs readiness health probes | #373 | 4 |
| 19 | x-forwarded-for validación con TRUSTED_PROXY | #370 | 2 |
| 34 | Error boundary (NuxtErrorBoundary) en storefront | #371 | 3 |
| 35 | bcryptjs removido del frontend (dead dep) | #371 | 3 |
| 36 | Width/height en imágenes de productos (CLS fix) | #371 | 3 |
| 37 | CSS muerto (.storefront-card) eliminado | #369 | 1 |

Adicionalmente, PR #368 resolvió problemas de performance del storefront:
- SSR data fetching con useAsyncData (eliminó waterfall client-side)
- Font non-blocking (preconnect + media swap)
- CDN cache headers (s-maxage en route rules)
- Code splitting (Clerk, chart.js, xlsx en chunks separados)
- Workbox optimizado (runtime caching por tipo de recurso)

---

## PENDIENTES — Prioridad Alta (3 items)

### 1. FORCE ROW LEVEL SECURITY en todas las tablas
- **Categoría:** Seguridad (defensa en profundidad)
- **Riesgo:** Si la app se conecta como table owner, RLS se bypasea.
- **Fix:** `ALTER TABLE <table> FORCE ROW LEVEL SECURITY`
- **Esfuerzo:** 2h
- **Nota:** El sistema ya funciona correctamente sin esto. Es una capa extra de seguridad.

### 7. PgBouncer (connection pooler externo)
- **Categoría:** Escalabilidad
- **Riesgo:** Con 3+ replicas del API, se saturan las conexiones de PostgreSQL.
- **Fix:** PgBouncer en modo transaction entre API y DB.
- **Esfuerzo:** 4h
- **Nota:** Solo necesario cuando se escale a múltiples replicas.

### 10. set_config RLS dentro de transacciones
- **Categoría:** Integridad transaccional (teórico)
- **Riesgo:** Reasignación de conexión del pool entre set_config y transacción.
- **Fix:** Mover set_config dentro de cada db.transaction().
- **Esfuerzo:** 3h
- **Nota:** Probabilidad extremadamente baja. Fix preventivo.

---

## PENDIENTES — Prioridad Media (8 items)

### 9. Circuit breaker para servicios externos
- **Categoría:** Resiliencia
- **Riesgo:** Servicios caídos bloquean requests 25-30s.
- **Esfuerzo:** 4h

### 14. Cursor-based pagination
- **Categoría:** Performance
- **Riesgo:** Endpoints devuelven hasta 500 rows sin paginar.
- **Esfuerzo:** 3-4h (plan documentado en docs/sprint6-cursor-pagination.md)

### 20. Partitioning en sales/stock_movements
- **Categoría:** Escalabilidad (largo plazo)
- **Riesgo:** Con >500K rows, reportes se degradan.
- **Esfuerzo:** 1 día
- **Nota:** No urgente. Los índices actuales cubren hasta 2-5M rows.

### 21. CDN (Cloudflare)
- **Categoría:** Performance
- **Riesgo:** Cache headers no tienen efecto sin CDN.
- **Esfuerzo:** 2h (configuración de infra, no código)

### 22. Staging environment
- **Categoría:** Deployment
- **Riesgo:** Cambios van directo a producción.
- **Esfuerzo:** 4h

### 33. /metrics auth (bearer token)
- **Categoría:** Seguridad
- **Riesgo:** Métricas expuestas sin auth.
- **Esfuerzo:** 30min

### 40. Dockerfile optimizado (node_modules)
- **Categoría:** Build/Deploy
- **Riesgo:** Imagen de 500MB+, deploys lentos.
- **Esfuerzo:** 2h

### 41. Test coverage medido en CI
- **Categoría:** Testing
- **Riesgo:** No se sabe qué está cubierto.
- **Esfuerzo:** 1h

---

## PENDIENTES — Prioridad Baja (10 items)

### 23. Tests E2E frontend (Playwright)
- **Esfuerzo:** 1 día

### 24. Tests de concurrencia
- **Esfuerzo:** 3h

### 25. Tests de void/return flows
- **Esfuerzo:** 4h

### 26. Tests de RFM scoring
- **Esfuerzo:** 2h

### 27. Load testing (k6)
- **Esfuerzo:** 4h

### 28. Contract testing API↔Frontend
- **Esfuerzo:** 4h

### 29. OpenTelemetry (distributed tracing)
- **Esfuerzo:** 1 día

### 31. Rollback automático de migraciones
- **Esfuerzo:** 4h

### 38. Backup strategy documentada
- **Esfuerzo:** 4h

### 39. Secrets rotation
- **Esfuerzo:** 1 día

---

## Métricas de progreso

| Área | Inicio | Ahora | Objetivo | Estado |
|------|--------|-------|----------|--------|
| Base de datos | 8.5 | 9.2 | 9.5 | Casi listo |
| Comunicación API↔DB | 8.0 | 9.0 | 9.0 | Logrado |
| Backend API | 8.0 | 8.8 | 9.0 | Casi listo |
| Frontend | 7.5 | 8.8 | 9.0 | Casi listo |
| Seguridad | 8.0 | 8.8 | 9.0 | Casi listo |
| Infraestructura | 7.0 | 7.5 | 8.5 | Pendiente (CDN, staging, Docker) |
| Testing | 6.5 | 6.5 | 8.0 | Pendiente (E2E, coverage) |
| **TOTAL** | **7.8** | **8.5** | **9.0** |  |

---

## Qué falta para 9.0

Para subir de 8.5 a 9.0, los items con mayor impacto son:

1. **CDN** (#21) — 2h de configuración, impacto inmediato en latencia
2. **Test coverage en CI** (#41) — 1h, visibilidad de calidad
3. **Cursor pagination** (#14) — 3-4h, plan ya documentado
4. **/metrics auth** (#33) — 30min, cierra info disclosure
5. **Dockerfile optimizado** (#40) — 2h, deploys 3x más rápidos

Total: ~10h de trabajo para llegar a 9.0.

Los items de testing (#23-#28) subirían el score a 9.0+ pero requieren ~3 días de trabajo dedicado.

---

## Historial de sprints

| Sprint | PR | Fecha | Items |
|--------|-----|-------|-------|
| Performance | #368 | Mayo 2026 | SSR, fonts, cache, code splitting, workbox |
| 1 - Data Integrity | #369 | Mayo 2026 | SKU unique, atomic sales, rate upsert, payment enum, rate limit, CSS |
| 2 - Security | #370 | Mayo 2026 | TRUSTED_PROXY IP validation |
| 3 - Frontend | #371 | Mayo 2026 | Error boundary, CLS, bcryptjs |
| 4 - Validation+Perf | #373 | Mayo 2026 | JSONB validation, catalog 6→3, health probes |
| 5 - Dashboard | #374 | Mayo 2026 | Consolidated endpoint (12→1 calls) |
| 6 - Hardening | #375 | Mayo 2026 | CSRF, productAliases FK, segments docs |
