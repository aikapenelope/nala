# Nova: Roadmap de Auditoria - Abril 2026

> Resultado de auditoria exhaustiva del codebase. 15 hallazgos clasificados por severidad.
> Organizados en 4 sprints por prioridad.

---

## Sprint 1: Criticos (datos y dinero)

Estos bugs pueden causar perdida de datos o saldos incorrectos en produccion.

### 1.1 Race condition en stock de ventas
- **Problema:** El check de stock esta FUERA de la transaccion en POST /sales. Dos ventas concurrentes del mismo producto pueden pasar ambas la validacion y decrementar stock a negativo. No hay `WHERE stock >= quantity` ni CHECK constraint.
- **Archivo:** `apps/api/src/routes/sales.ts` lineas 374 (check) vs 455 (tx start) vs 523 (decrement)
- **Fix:** Mover validacion de stock dentro de la transaccion. Cambiar el UPDATE a `UPDATE products SET stock = stock - X WHERE id = Y AND stock >= X RETURNING stock` y verificar que retorne filas. Si no retorna, rollback con error "stock insuficiente".
- **Impacto:** Stock negativo, sobreventa

### 1.2 Void sale no restaura saldo del cliente (fiado)
- **Problema:** Cuando se anula una venta que fue fiado, el stock se restaura pero `customers.balanceUsd` y `accounts_receivable` no se revierten. El cliente queda con deuda fantasma.
- **Archivo:** `apps/api/src/routes/sales.ts` lineas 648-735 (void handler)
- **Fix:** En el void handler, despues de restaurar stock: (1) buscar accounts_receivable con saleId, (2) si existe, restar el monto del balance del cliente, (3) marcar el receivable como "voided".
- **Impacto:** Saldos de clientes incorrectos despues de anulaciones de fiado

---

## Sprint 2: Seguridad

Vulnerabilidades que un atacante podria explotar.

### 2.1 POST /onboarding sin rate limit
- **Problema:** El endpoint de creacion de negocio no tiene rate limiting. Solo `/onboarding/check-slug/*` tiene `publicRateLimit`.
- **Archivo:** `apps/api/src/app.ts` linea 153
- **Fix:** Agregar `app.use("/onboarding", publicRateLimit);` antes de `app.route("/onboarding", onboarding);`

### 2.2 Path params sin validacion UUID
- **Problema:** Los 20 endpoints con `c.req.param("id")` no validan que sea UUID. Un string malformado genera error 500 de Postgres.
- **Archivos:** sales.ts, inventory.ts, customers.ts, team.ts, suppliers.ts, config.ts, reports.ts
- **Fix:** Crear helper `validateUuid(id: string)` que retorne 400 si no es UUID valido. Aplicar en todos los endpoints con path params.

### 2.3 PIN lockout no implementado
- **Problema:** Los campos `pinFailedAttempts` y `pinLockedUntil` existen en DB, las funciones helper existen en `queries.ts`, pero ningun endpoint las llama. POST /verify-owner-pin no tiene proteccion contra brute force.
- **Archivos:** `apps/api/src/routes/auth.ts`, `packages/db/src/queries.ts`
- **Fix:** En POST /verify-owner-pin: (1) verificar si el owner esta locked, (2) si PIN incorrecto, incrementar intentos, (3) si alcanza MAX_PIN_ATTEMPTS, lockear por PIN_LOCKOUT_MINUTES, (4) si correcto, resetear intentos.

### 2.4 Stock movements fuera de la transaccion
- **Problema:** Los `stockMovements` se insertan DESPUES de la transaccion de venta. Si falla, la venta queda sin audit trail.
- **Archivo:** `apps/api/src/routes/sales.ts` lineas 596-617
- **Fix:** Mover el loop de insert stockMovements dentro del `db.transaction()`, antes del `return sale`.

### 2.5 Actualizar dependencias criticas
- **`@clerk/nuxt`**: Actualizar a >=2.2.2 (bypass de proteccion de rutas). `npm audit fix` lo resuelve.
- **`hono`**: Actualizar a >=4.12.14 (HTML injection en JSX SSR). `npm audit fix` lo resuelve.
- **`drizzle-orm`**: Evaluar upgrade a >=0.45.2 (SQL injection via identificadores). Es breaking change, requiere testing.
- **`xlsx`**: Sin fix disponible. Riesgo bajo porque Nova solo genera Excel, no parsea en el servidor. Dejar como esta.

---

## Sprint 3: Calidad de datos

Mejoras que previenen degradacion de performance y datos inconsistentes.

### 3.1 Paginacion en 6 endpoints sin limit
- **Endpoints:** GET /suppliers, /surcharge-types, /quotations, /categories, /accounts/receivable, /accounts/payable
- **Fix:** Agregar `.limit(500)` como safety net en cada uno. Opcionalmente agregar paginacion completa (page/limit query params).

### 3.2 Indices faltantes
- **`sales.customerId`**: Se usa en filtro GET /sales?customerId= y en reports/customer-stats. Sin indice.
- **`sales.channel`**: Se usa en filtro GET /sales?channel=. Sin indice.
- **Fix:** Agregar en migracion 0008:
  ```sql
  CREATE INDEX IF NOT EXISTS "idx_sales_customer" ON "sales"("customer_id");
  CREATE INDEX IF NOT EXISTS "idx_sales_channel" ON "sales"("channel");
  ```

### 3.3 Health check con write test
- **Problema:** GET /health solo hace `SELECT 1`. Si el disco esta lleno, pasa pero las escrituras fallan.
- **Fix:** Agregar un write test opcional: `INSERT INTO ... ON CONFLICT DO NOTHING` en una tabla de health check, o simplemente documentar la limitacion.

### 3.4 Documentar requisito RLS session-level
- **Problema:** `set_config(..., false)` usa session-level. Seguro con postgres.js (conexion por query), pero si se cambia a PgBouncer transaction mode, habria leak entre tenants.
- **Fix:** Agregar nota en doc 26 (arquitectura) y en el README de packages/db explicando que PgBouncer debe usarse en session mode, no transaction mode.

---

## Sprint 4: Frontend de features nuevas

Los 14 features del PR #122 solo existen como endpoints API. Necesitan UI.

### Prioridad alta (afectan el flujo de venta)
- Cargos adicionales (surcharges) en checkout
- Productos tipo servicio en inventario (toggle isService)
- Canales de venta en checkout (selector de canal)
- Utilidad por venta en historial de ventas (mostrar margen)

### Prioridad media (mejoran reportes y gestion)
- Precio al mayor en formulario de producto
- Marca y ubicacion en formulario de producto
- Gastos fijos/variables en formulario de gastos
- Tendencia mensual (nueva pagina /reports/monthly-trend)
- Stats por cliente (nueva seccion en /clients/:id)

### Prioridad baja (configuracion)
- CRUD surcharge types en /settings
- CRUD bank accounts en /settings
- Notification preferences en /settings
- Estado de cuenta proveedor en /suppliers/:id

---

## Resumen

| Sprint | Items | Esfuerzo estimado | Prioridad |
|--------|-------|-------------------|-----------|
| 1. Criticos | 2 bugs (stock race, void fiado) | 2-3 horas | Hacer antes de mas usuarios |
| 2. Seguridad | 5 items (rate limit, UUID, PIN lockout, stock movements, deps) | 3-4 horas | Hacer antes de marketing |
| 3. Calidad | 4 items (paginacion, indices, health, docs) | 2 horas | Hacer cuando convenga |
| 4. Frontend | 13 UIs nuevas | 2-3 dias | Hacer por prioridad |

---

## Roadmap futuro (fuera de estos sprints)

| Feature | Complejidad | Notas |
|---------|-------------|-------|
| Error tracking (Sentry) | Baja | Free tier, agregar al API y al frontend |
| Backup automatizado | Baja | Cron pg_dump diario a MinIO en data plane |
| Multi-almacen | Alta | Requiere reestructurar modelo de stock |
| Mensajeria masiva WhatsApp | Alta | Requiere WhatsApp Business API + templates Meta |
