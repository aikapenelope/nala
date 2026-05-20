# Roadmap de Debilidades — Auditoría Completa Mayo 2026

> Score actual: 8.2/10 (era 7.8 antes de los sprints)
> Objetivo: 9.0/10
> Última revisión: Mayo 2026
> Progreso: 11 de 41 items resueltos

---

## RESUELTOS

| # | Item | PR | Sprint |
|---|------|-----|--------|
| 2 | Unique constraint SKU por negocio | #369 | 1 |
| 3 | Quick sales envueltas en db.transaction() | #369 | 1 |
| 5 | Exchange rates unique index DATE() + UPSERT | #369 | 1 |
| 6 | ON DELETE RESTRICT en saleItems→products | #369 | 1 |
| 13 | Payment method validado con Zod enum | #369 | 1 |
| 17 | Rate limit duplicado en catalog orders removido | #369 | 1 |
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

## PENDIENTES — Prioridad Alta (bloquean escala o riesgo de datos)

### 1. FORCE ROW LEVEL SECURITY en todas las tablas
- **Categoría:** Seguridad
- **Riesgo:** Si la app se conecta como table owner, RLS se bypasea silenciosamente.
- **Fix:** `ALTER TABLE <table> FORCE ROW LEVEL SECURITY` en todas las tablas.
- **Esfuerzo:** 2h

### 4. Validación de JSONB fields (surcharges, businessHours, paymentMethods)
- **Categoría:** Validación de datos
- **Riesgo:** Campos aceptan cualquier JSON. Datos malformados rompen el frontend.
- **Fix:** Zod schemas para cada JSONB field, validados antes de guardar.
- **Esfuerzo:** 2h

### 7. PgBouncer (connection pooler externo)
- **Categoría:** Escalabilidad
- **Riesgo:** 20 conexiones directas por replica. Con 3+ replicas satura PostgreSQL.
- **Fix:** PgBouncer en modo transaction entre API y PostgreSQL.
- **Esfuerzo:** 4h

### 8. CSRF protection en storefront checkout
- **Categoría:** Seguridad
- **Riesgo:** POST /catalog/:slug/orders sin auth ni CSRF. Sitio malicioso puede forzar pedidos.
- **Fix:** Token CSRF o verificación de Origin header.
- **Esfuerzo:** 2h

---

## PENDIENTES — Prioridad Media (resiliencia y operabilidad)

### 9. Circuit breaker para servicios externos
- **Categoría:** Manejo de errores
- **Riesgo:** Servicios caídos (fal.ai, BCV, Resend) bloquean requests 25-30s.
- **Fix:** Circuit breaker pattern (3 fallos → open 60s → half-open → retry).
- **Esfuerzo:** 4h

### 10. set_config RLS dentro de transacciones
- **Categoría:** Integridad transaccional
- **Riesgo:** Reasignación de conexión del pool entre set_config y transacción.
- **Fix:** Mover set_config dentro de cada db.transaction().
- **Esfuerzo:** 3h

### 11. productAliases.supplierId text → uuid con FK
- **Categoría:** Modelo de datos
- **Riesgo:** Inconsistencia de tipos, sin FK constraint.
- **Fix:** Migración para cambiar tipo + agregar FK.
- **Esfuerzo:** 1h

### 12. customer_segments redundante con RFM
- **Categoría:** Modelo de datos
- **Riesgo:** Dos sistemas de segmentación coexisten sin claridad.
- **Fix:** Deprecar customer_segments o definir roles claros.
- **Esfuerzo:** 2h (decisión de diseño)

### 14. Reports sin paginación
- **Categoría:** Performance
- **Riesgo:** Endpoints devuelven hasta 500 rows sin paginar.
- **Fix:** Paginación con cursor o offset.
- **Esfuerzo:** 3h

### 15. Dashboard 12 API calls → consolidar
- **Categoría:** Performance
- **Riesgo:** 12 calls en paralelo saturan conexiones 3G venezolanas.
- **Fix:** Endpoint /api/dashboard consolidado o two-phase loading.
- **Esfuerzo:** 4h

### 16. Catálogo público 6 round-trips → 3
- **Categoría:** Performance
- **Riesgo:** 6 queries separadas al DB por cada request de catálogo.
- **Fix:** Consolidar con CTEs o window functions.
- **Esfuerzo:** 2h

### 18. Health check: separar liveness de readiness
- **Categoría:** Deployment
- **Riesgo:** Container se reinicia durante migraciones (DB temporalmente inaccesible).
- **Fix:** /health/live (proceso vivo) + /health/ready (DB + Redis ok).
- **Esfuerzo:** 1h

### 20. Partitioning en sales/stock_movements
- **Categoría:** Escalabilidad
- **Riesgo:** Con >1M rows, queries de reportes por fecha se degradan.
- **Fix:** PostgreSQL native partitioning por mes.
- **Esfuerzo:** 1 día

### 21. CDN (Cloudflare)
- **Categoría:** Performance
- **Riesgo:** Sin CDN, los cache headers no tienen efecto. Alta latencia para usuarios.
- **Fix:** Cloudflare free tier delante del dominio.
- **Esfuerzo:** 2h

### 22. Staging environment
- **Categoría:** Deployment
- **Riesgo:** Cambios van directo de dev a prod sin validación intermedia.
- **Fix:** Ambiente staging en Coolify con DB separada.
- **Esfuerzo:** 4h

### 33. /metrics auth (bearer token)
- **Categoría:** Seguridad
- **Riesgo:** Métricas operacionales expuestas sin autenticación.
- **Fix:** Bearer token via METRICS_TOKEN env var.
- **Esfuerzo:** 30min

---

## PENDIENTES — Prioridad Baja (hardening, testing)

### 23. Tests E2E frontend (Playwright)
- **Categoría:** Testing
- **Riesgo:** No hay tests automatizados del flujo de compra del storefront.
- **Fix:** Playwright con 3-5 tests E2E del flujo completo.
- **Esfuerzo:** 1 día

### 24. Tests de concurrencia
- **Categoría:** Testing
- **Riesgo:** No se verifica que ventas simultáneas no creen overselling.
- **Fix:** Test con 10 ventas concurrentes del mismo producto (stock=1).
- **Esfuerzo:** 3h

### 25. Tests de void/return flows
- **Categoría:** Testing
- **Riesgo:** Flujos de void y return parcial sin tests de integración.
- **Fix:** Tests e2e: venta → void → verificar stock + stats revertidos.
- **Esfuerzo:** 4h

### 26. Tests de RFM scoring
- **Categoría:** Testing
- **Riesgo:** Lógica de quintiles y segmentos sin tests.
- **Fix:** Unit tests con datos sintéticos.
- **Esfuerzo:** 2h

### 27. Load testing (k6)
- **Categoría:** Testing
- **Riesgo:** No se conoce el punto de quiebre del sistema.
- **Fix:** Script k6 con 100 usuarios concurrentes.
- **Esfuerzo:** 4h

### 28. Contract testing API↔Frontend
- **Categoría:** Testing
- **Riesgo:** Cambios en API responses rompen frontend en runtime.
- **Fix:** Tipos generados del schema o Zod compartidos.
- **Esfuerzo:** 4h

### 29. OpenTelemetry (distributed tracing)
- **Categoría:** Observabilidad
- **Riesgo:** No se puede diagnosticar qué parte del pipeline es lenta.
- **Fix:** OpenTelemetry SDK con spans por capa.
- **Esfuerzo:** 1 día

### 30. Readiness probe separada
- **Categoría:** Deployment
- **Riesgo:** Container se reinicia innecesariamente durante migraciones.
- **Fix:** /health/live + /health/ready separados.
- **Esfuerzo:** 1h

### 31. Rollback automático de migraciones
- **Categoría:** Deployment
- **Riesgo:** Migraciones fallidas dejan DB inconsistente.
- **Fix:** Archivos down para cada migración.
- **Esfuerzo:** 4h

### 32. orders.items JSONB — documentar diseño
- **Categoría:** Modelo de datos
- **Riesgo:** Ninguno funcional (es snapshot por diseño).
- **Fix:** Documentar que es inmutable.
- **Esfuerzo:** 0

### 38. Backup strategy documentada
- **Categoría:** Operaciones
- **Riesgo:** Sin procedimiento de backup/restore documentado.
- **Fix:** pg_dump diario + retención 30 días + procedimiento de restore.
- **Esfuerzo:** 4h

### 39. Secrets rotation
- **Categoría:** Seguridad
- **Riesgo:** Credenciales estáticas sin mecanismo de rotación.
- **Fix:** Secrets manager con rotation policy.
- **Esfuerzo:** 1 día

### 40. Dockerfile optimizado (node_modules)
- **Categoría:** Build
- **Riesgo:** Imagen API copia todo node_modules (~500MB).
- **Fix:** npm ci --omit=dev o copiar solo externals de tsup.
- **Esfuerzo:** 2h

### 41. Test coverage medido en CI
- **Categoría:** Testing
- **Riesgo:** No se sabe qué porcentaje del código está cubierto.
- **Fix:** --coverage en vitest + threshold mínimo.
- **Esfuerzo:** 1h

---

## Próximos sprints recomendados

### Sprint 4 (1 día): Seguridad + Validación
- #1 FORCE ROW LEVEL SECURITY
- #4 Validación JSONB fields
- #33 /metrics auth
- #8 CSRF protection

### Sprint 5 (1 día): Performance backend
- #15 Dashboard consolidado
- #16 Catálogo 6→3 round-trips
- #14 Paginación en reports

### Sprint 6 (1 día): Infraestructura
- #21 CDN (Cloudflare)
- #18 Liveness vs readiness probe
- #40 Dockerfile optimizado
- #41 Test coverage en CI

### Sprint 7 (1 día): Testing
- #24 Tests de concurrencia
- #25 Tests de void/return
- #26 Tests de RFM

### Sprint 8 (1 día): Escalabilidad
- #7 PgBouncer
- #9 Circuit breaker
- #22 Staging environment

---

## Métricas de progreso

| Área | Antes | Ahora | Objetivo |
|------|-------|-------|----------|
| Base de datos | 8.5 | 9.0 | 9.5 |
| Comunicación API↔DB | 8.0 | 8.5 | 9.0 |
| Backend API | 8.0 | 8.5 | 9.0 |
| Frontend | 7.5 | 8.5 | 9.0 |
| Seguridad | 8.0 | 8.5 | 9.0 |
| Infraestructura | 7.0 | 7.5 | 8.5 |
| Testing | 6.5 | 6.5 | 8.0 |
| **TOTAL** | **7.8** | **8.2** | **9.0** |
