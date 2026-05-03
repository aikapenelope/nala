# Nova: Roadmap Consolidado - Abril 2026

> Fuente unica de verdad para prioridades. Actualizado post-sesion 8.
> Incorpora: auditoria produccion (doc 34), analisis ERPNext (doc 32),
> comparacion Fina (doc 35), backlog de sesiones anteriores, y sesion 8
> (auth cleanup, Fase 1-3 completadas).

---

## Completado en Sesion 8 (PR #189)

### Auth: Limpieza total
- [x] Reparar login Clerk (props deprecados, token acquisition, redirect loops)
- [x] Simplificar a flujo single-admin (sin Organizations, sin PIN)
- [x] Limpiar codigo muerto: Organizations, PIN, createClerkClient
- [x] Reescribir team.ts a DB-only (sin Clerk Organizations API)
- [x] Documentar estado actual (AUTH-CURRENT-STATE.md)
- [x] Boton "Cerrar sesion" en /auth/resolve cuando backend falla

### Fase 1: Production-Ready
- [x] `npm audit fix` -- drizzle-orm upgrade a 0.45.2 (SQL injection fix)
- [x] Verificar build Docker con cambios de auth (API: 505KB bundle OK)
- [x] Body size limit (1MB) y request timeout (30s) -- ya estaban implementados
- [ ] Generar PWA icons (192x192, 512x512) y agregarlos a public/

### Fase 2 (parcial)
- [x] Recibo PDF individual -- GET /api/sales/:id/receipt (pdfmake)
- [x] drizzle-orm upgrade a >=0.45.2

### Fase 3: Competir con Fina
- [x] Charts reales en reportes (vue-chartjs / Chart.js) -- dashboard, weekly, cash-flow, monthly-trend
- [x] POS con categorias como tabs horizontales
- [x] POS con imagenes de producto (muestra imageUrl si existe)
- [x] Animacion mejorada al agregar producto al ticket (pulse + ring)
- [x] Tutoriales in-app (ContextualTip en 5 paginas: dashboard, POS, inventario, clientes, reportes)
- [x] Busqueda global (Cmd+K modal con productos, clientes, paginas)

---

## Pendiente: Fase 2 (resto)

**Objetivo:** Monitoreo, backups, y UX para primeros usuarios.
**Estimado:** 3-4 horas.

- [ ] Sentry setup (API + frontend, free tier)
- [ ] og:image + meta tags para compartir en WhatsApp
- [ ] Backup cron PostgreSQL -> MinIO (pg_dump diario)
- [ ] Configurar Uptime Kuma para API y Web health checks
- [ ] PWA icons (192x192, 512x512)

---

## Pendiente: Fase 3.5 - Product Image Upload

**Objetivo:** Completar el flujo de imagenes de producto (el POS ya las muestra).
**Estimado:** 3-4 horas.

- [ ] Configurar cliente MinIO en el API (S3-compatible)
- [ ] Endpoint POST /api/products/:id/image -- upload imagen, guarda en MinIO, actualiza imageUrl en DB
- [ ] Endpoint DELETE /api/products/:id/image -- elimina imagen de MinIO, limpia imageUrl
- [ ] UI de upload en formulario de producto (/inventory/new y /inventory/:id/edit)
- [ ] Preview de imagen en el formulario antes de guardar
- [ ] Validacion: max 2MB, solo JPEG/PNG/WebP

---

## Pendiente: Fase 4 - Diferenciadores

**Objetivo:** Features que Fina no puede copiar facilmente.
**Estimado:** 2-3 dias.

- [ ] Devolucion parcial (POST /sales/:id/return con items parciales)
- [ ] Pagina de movimientos de inventario (/inventory/movements)
- [ ] Consolidacion de turno (resumen diario al cerrar caja)
- [ ] E2E browser tests (Playwright, flujos criticos)
- [ ] Verificar Resend con dominio propio (novaincs.com)

---

## Pendiente: Fase 5 - Multi-usuario (Clerk Organizations)

**Objetivo:** Empleados con cuentas propias via Clerk Organizations.
**Estimado:** 2-3 dias.
**Prerequisito:** Leer AUTH-CURRENT-STATE.md seccion 7.

- [ ] Clerk Dashboard: habilitar Organizations con "Membership optional"
- [ ] Onboarding: crear Clerk Organization al crear negocio
- [ ] setActive({ organization }) + getToken({ skipCache: true }) post-onboarding
- [ ] Auth middleware dual: si hay orgId -> buscar por clerkOrgId, si no -> buscar por clerkId
- [ ] Team: invitar empleados via Clerk Organization invitations
- [ ] Team: listar miembros desde Clerk API + DB fallback
- [ ] Frontend: OrganizationSwitcher en header (si aplica)

---

## Fase 5b: Patrones ERPNext (PR #146, pendiente merge)

**Objetivo:** Robustez operacional inspirada en ERPNext.
**Estado:** Implementado, pendiente merge.

- [x] `qty_after_transaction` en stock_movements
- [x] Indice compuesto en sales para reportes
- [x] `logActivity` en todos los endpoints de mutacion
- [x] Stock movement logging en void (faltaba)
- [x] Helpers `decrementStock`/`incrementStock`/`logStockMovements`
- [x] Tests RLS extendidos (5 tests, CI)
- [x] Tests side-effects de ventas (7 tests, CI)

---

## Fase 6: Futuro (solo si el mercado lo pide)

| Feature | Trigger | Complejidad |
|---------|---------|-------------|
| Recetas (ingredientes) | Demanda de restaurantes | Media |
| Gestion de mesas | Demanda de restaurantes | Media |
| Seguimiento de repartidores | Demanda de delivery | Baja |
| Multi-almacen | Negocios con 2+ sucursales | Alta |
| WhatsApp Business API | Escala de mensajeria | Alta |
| Moving Average valuation | Negocios formales | Media |
| GL Entries doble entrada | Contabilidad formal | Alta |
| Chart of Accounts completo | Contabilidad formal | Alta |
| Cache de productos en Redis | Performance a escala | Baja |
| POS Profiles (multi-caja) | Negocios con 2+ cajas | Media |

---

## Completado (historico)

| Sesion | PRs | Contenido |
|--------|-----|-----------|
| 1-4 | #79-#124 | Producto completo: 87 endpoints, 29 tablas, dashboard, POS, inventario, clientes, reportes IA, OCR, offline, multi-tenant |
| 5 | #125-#134 | Auditoria: race condition fix, seguridad (rate limit, UUID, PIN lockout), indices, paginacion, frontend 14 features, graceful shutdown |
| 6 | #135-#143 | Visual: dashboard redesign, glassmorphism, 15 gaps API-UI cerrados, open/close toggle, quick actions, back buttons |
| 7 | #144-#147 | Design system premium en todas las paginas, analisis ERPNext, adopcion de patrones, documentacion completa |
| 8 | #189 | Auth cleanup (Clerk simple), Fase 1 (audit fix, Docker), Fase 2 parcial (receipt PDF), Fase 3 completa (charts, POS tabs, cmd+k, tips, animaciones) |

---

## Metricas actuales

| Metrica | Valor |
|---------|-------|
| LOC | ~27,500 |
| Tablas | 30 |
| Endpoints | 88 (+1: receipt PDF) |
| Paginas | 43 |
| Componentes nuevos | 4 (BarChart, DonutChart, CommandPalette, ContextualTip activo) |
| Tests | 10 archivos (~132 cases) |
| Migraciones | 12 |
| PRs | #79-#189 |
| Sesiones | 8 |
