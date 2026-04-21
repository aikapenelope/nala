# Nova: Roadmap Consolidado - Abril 2026

> Fuente unica de verdad para prioridades. Actualizado post-sesion 7.
> Incorpora: auditoria produccion (doc 34), analisis ERPNext (doc 32),
> comparacion Fina (doc 35), y backlog de sesiones anteriores.

---

## Fase 1: Production-Ready (bloqueantes)

**Objetivo:** Poder dar acceso a usuarios reales sin riesgo.
**Estimado:** 1 dia (2-3 horas).

- [ ] Generar PWA icons (192x192, 512x512) y agregarlos a public/
- [ ] `npm audit fix` (clerk critical + drizzle high)
- [ ] Agregar body size limit (1MB) y request timeout (30s) en Hono
- [ ] Verificar build Docker con los cambios

---

## Fase 2: Lanzamiento Solido

**Objetivo:** Monitoreo, backups, y UX minima para primeros usuarios.
**Estimado:** 1 dia (3-4 horas).

- [ ] Sentry setup (API + frontend, free tier)
- [ ] og:image + meta tags para compartir en WhatsApp
- [ ] Backup cron PostgreSQL -> MinIO (pg_dump diario)
- [ ] Configurar Uptime Kuma para API y Web health checks
- [ ] Recibo PDF individual (pdfmake ya instalado)
- [ ] drizzle-orm upgrade a >=0.45.2

---

## Fase 3: Competir con Fina

**Objetivo:** Cerrar los gaps vs Fina que importan.
**Estimado:** 2-3 dias.

- [ ] Charts reales en reportes (Chart.js o vue-chartjs)
- [ ] POS con categorias como tabs horizontales
- [ ] POS con imagenes de producto (upload a MinIO)
- [ ] Animacion al agregar producto al ticket
- [ ] Tutoriales in-app (tooltips en primer uso) o videos cortos
- [ ] Busqueda global (cmd+k modal)

---

## Fase 4: Diferenciadores

**Objetivo:** Features que Fina no puede copiar facilmente.
**Estimado:** 2-3 dias.

- [ ] Devolucion parcial (POST /sales/:id/return con items parciales)
- [ ] Pagina de movimientos de inventario (/inventory/movements)
- [ ] Consolidacion de turno (resumen diario al cerrar caja)
- [ ] E2E browser tests (Playwright, flujos criticos)
- [ ] Verificar Resend con dominio propio (novaincs.com)

---

## Fase 5: Patrones ERPNext (PR #146, pendiente merge)

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

## Completado

| Sesion | PRs | Contenido |
|--------|-----|-----------|
| 1-4 | #79-#124 | Producto completo: 87 endpoints, 29 tablas, dashboard, POS, inventario, clientes, reportes IA, OCR, offline, multi-tenant |
| 5 | #125-#134 | Auditoria: race condition fix, seguridad (rate limit, UUID, PIN lockout), indices, paginacion, frontend 14 features, graceful shutdown |
| 6 | #135-#143 | Visual: dashboard redesign, glassmorphism, 15 gaps API-UI cerrados, open/close toggle, quick actions, back buttons |
| 7 | #144-#147 | Design system premium en todas las paginas, analisis ERPNext, adopcion de patrones, documentacion completa |

---

## Metricas actuales

| Metrica | Valor |
|---------|-------|
| LOC | ~26,200 |
| Tablas | 30 |
| Endpoints | 87 |
| Paginas | 43 |
| Tests | 10 archivos (~132 cases) |
| Migraciones | 9 |
| PRs | #79-#147 (69 PRs) |
| Sesiones | 7 |
