# Nova: Roadmap Post-Sesion 7 - Visual Upgrade Completado

> Actualizado despues de PR #144 (premium design system en todas las paginas internas).
> Sprints 1-4 del doc 30 ya completados (PRs #125-#143).

---

## Estado actual

- 43 paginas Vue, todas con design system premium (glassmorphism, dark-pill, card-premium, transition-spring)
- Page transitions entre paginas (fade + slide)
- Dashboard, POS, inventario, clientes, reportes, cuentas, settings, proveedores, cotizaciones - todo consistente
- 87 endpoints, 29 tablas, 9 migraciones, 49 tests

---

## Siguiente: Items pendientes por prioridad

### Prioridad 1: POS mejorado (pantalla mas usada)
- [ ] Imagenes de producto en el grid (placeholder con inicial si no hay imagen)
- [ ] Categorias como tabs horizontales para filtrar productos
- [ ] Animacion mas rica al agregar al ticket (bounce/scale feedback)
- **Impacto:** Transforma la experiencia de venta diaria

### Prioridad 2: Charts reales en reportes
- [ ] Migrar barras CSS basicas a libreria de charts (Chart.js o unovis/vue-chartjs)
- [ ] Graficos interactivos con tooltips en: daily, weekly, cash-flow, profitability, monthly-trend
- [ ] Pie chart para payment mix (reemplazar barras de progreso)
- **Impacto:** Credibilidad profesional, reportes que se pueden mostrar a socios/contadores

### Prioridad 3: Produccion (backlog doc 27)
- [ ] Error tracking con Sentry (free tier, API + frontend)
- [ ] PWA icons reales (192x192, 512x512) - actualmente placeholder
- [ ] og:image para compartir links
- [ ] Recibo PDF individual (descargar/imprimir desde historial)
- [ ] Pagina de movimientos de inventario (/inventory/movements)
- [ ] Devolucion rapida (desde historial, sin anular toda la venta)
- [ ] Busqueda global (cmd+k / barra superior)
- [ ] E2E browser tests (Playwright)

### Prioridad 4: Dependencias
- [ ] drizzle-orm upgrade a >=0.45.2 (breaking change, riesgo bajo, SQL injection fix)

---

## Evaluacion pendiente

- [ ] Analisis ERPNext vs Nova custom backend (doc 32)
  - Evaluar si el backend de ERPNext (Frappe) ofrece ventajas sobre Hono+Drizzle+Postgres
  - Considerar: multi-tenant, contabilidad, inventario avanzado, facturacion fiscal
  - Decision: mantener backend propio vs adoptar Frappe como backend

---

## Completado en sesiones anteriores

| Sesion | PRs | Contenido |
|--------|-----|-----------|
| 1-4 | #79-#124 | Producto completo: 87 endpoints, 29 tablas, dashboard, POS, inventario, clientes, reportes IA, OCR, offline, multi-tenant |
| 5 | #125-#134 | Auditoria: race condition fix, seguridad (rate limit, UUID, PIN lockout), indices, paginacion, frontend 14 features, graceful shutdown |
| 6 | #135-#143 | Visual: dashboard redesign, glassmorphism, 15 gaps API-UI cerrados, open/close toggle, quick actions, back buttons |
| 7 | #144 | Design system premium en todas las paginas internas, page transitions, modales glassmorphism |
