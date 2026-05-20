# Roadmap de Debilidades — Auditoría Backend Mayo 2026

> Score actual: 8.2/10
> Objetivo: 9.0/10
> Última revisión: Mayo 2026

---

## Prioridad Alta (bloquean escala o tienen riesgo de datos)

### 1. FORCE ROW LEVEL SECURITY en todas las tablas
- **Categoría:** Seguridad
- **Riesgo:** Si la app se conecta como table owner (rol `platform`), RLS se bypasea silenciosamente. El middleware siempre setea `set_config` pero no hay defensa si un bug lo omite.
- **Fix:** `ALTER TABLE <table> FORCE ROW LEVEL SECURITY` en todas las tablas con RLS.
- **Impacto:** Previene data leaks si un endpoint olvida pasar por tenant middleware.
- **Esfuerzo:** 2h (migración + test de que migraciones siguen funcionando con FORCE).

### 2. Unique constraint en (business_id, sku) para productos
- **Categoría:** Modelo de datos
- **Riesgo:** Dos productos del mismo negocio pueden tener el mismo SKU. El import de Excel no detecta duplicados correctamente si no hay constraint en DB.
- **Fix:** `CREATE UNIQUE INDEX idx_products_business_sku ON products(business_id, sku) WHERE sku IS NOT NULL`
- **Impacto:** Previene datos corruptos en inventario.
- **Esfuerzo:** 30min (migración + verificar que no hay duplicados existentes).

### 3. Quick sales sin transacción atómica
- **Categoría:** Integridad transaccional
- **Riesgo:** `POST /sales/quick` inserta la venta y luego el pago en statements separados. Si el insert de payment falla, queda una venta sin pago registrado.
- **Fix:** Envolver en `db.transaction()`.
- **Impacto:** Previene ventas huérfanas sin pago.
- **Esfuerzo:** 30min.

### 4. Validación de JSONB fields (surcharges, businessHours, paymentMethods)
- **Categoría:** Validación de datos
- **Riesgo:** Estos campos aceptan cualquier JSON. Un cliente malicioso o un bug en el frontend puede guardar datos malformados que rompen el rendering.
- **Fix:** Zod schemas para cada JSONB field, validados en el endpoint antes de guardar.
- **Impacto:** Previene datos corruptos que causan crashes en el frontend.
- **Esfuerzo:** 2h.

### 5. exchange_rates unique index usa timestamp en vez de date
- **Categoría:** Modelo de datos
- **Riesgo:** El unique index es `(business_id, date)` pero `date` es `timestamp with time zone`. Dos rates el mismo día con diferente hora (ej: 8am y 2pm) crearían dos registros. El query `ORDER BY date DESC LIMIT 1` devuelve el último, pero la intención es una rate por día.
- **Fix:** Cambiar el tipo de `date` a `date` (sin timezone) o usar `DATE(date)` en el unique index.
- **Impacto:** Previene rates duplicados por día.
- **Esfuerzo:** 1h (migración + ajustar queries).

---

## Prioridad Media (mejoran resiliencia y operabilidad)

### 6. Circuit breaker para servicios externos
- **Categoría:** Manejo de errores
- **Riesgo:** Si fal.ai, BCV scraper, o Resend están caídos, cada request que los usa espera hasta timeout (25-30s). No hay backoff ni circuit breaker.
- **Fix:** Implementar circuit breaker pattern (3 fallos consecutivos → open → skip por 60s → half-open → retry).
- **Impacto:** Requests no se bloquean esperando servicios caídos.
- **Esfuerzo:** 4h.

### 7. set_config RLS fuera de transacción de venta
- **Categoría:** Integridad transaccional
- **Riesgo:** El tenant middleware hace `set_config` y luego `await next()`. Si postgres.js reasigna la conexión del pool entre el set_config y la transacción de venta (teóricamente posible bajo alta carga), el RLS context podría ser incorrecto.
- **Fix:** Mover el `set_config` dentro de cada transacción que lo necesita, o usar `set_config(..., true)` (transaction-local) dentro del `db.transaction()`.
- **Impacto:** Elimina un vector teórico de data leak bajo carga extrema.
- **Esfuerzo:** 3h (refactor del tenant middleware).

### 8. productAliases.supplierId es text en vez de uuid
- **Categoría:** Modelo de datos
- **Riesgo:** Inconsistencia de tipos. No hay FK constraint, permite valores inválidos.
- **Fix:** Migración para cambiar a `uuid` con FK a `suppliers.id`.
- **Impacto:** Integridad referencial.
- **Esfuerzo:** 1h.

### 9. customer_segments tabla redundante con RFM
- **Categoría:** Modelo de datos
- **Riesgo:** Dos sistemas de segmentación coexisten: `customer_segments` (tabla N:M con labels simples) y `customers.rfm_segment` (columna con scoring real). El frontend usa ambos en diferentes lugares.
- **Fix:** Deprecar `customer_segments` y migrar todo a `rfm_segment`. O mantener ambos con roles claros (RFM = scoring automático, segments = tags manuales del usuario).
- **Impacto:** Reduce confusión y queries innecesarios.
- **Esfuerzo:** 2h (decidir estrategia + migrar frontend).

### 10. paymentMethod sin validación de enum
- **Categoría:** Validación de datos
- **Riesgo:** El campo `method` en sale_payments y `paymentMethod` en orders acepta cualquier string. Un typo ("pago_moivl") crea un método fantasma que aparece en reportes.
- **Fix:** Zod enum con los métodos válidos: `z.enum(["efectivo", "pago_movil", "zelle", "binance", "zinli", "transferencia", "fiado", "efectivo_usd"])`.
- **Impacto:** Datos limpios en reportes de métodos de pago.
- **Esfuerzo:** 1h.

### 11. Reports sin paginación
- **Categoría:** Performance
- **Riesgo:** `GET /quotations` devuelve hasta 500 rows. Reportes de inventario devuelven todos los productos. Con 1,000 negocios y 200+ productos cada uno, estos responses pueden ser grandes.
- **Fix:** Agregar paginación con cursor o offset a endpoints que devuelven listas largas.
- **Impacto:** Reduce memoria del servidor y tiempo de respuesta.
- **Esfuerzo:** 3h.

### 12. Dashboard hace 12 API calls en paralelo
- **Categoría:** Performance
- **Riesgo:** En conexión 3G venezolana (300-500ms RTT), 12 calls en paralelo saturan el ancho de banda. El skeleton se muestra 3-5 segundos.
- **Fix:** Dividir en 2 fases: critical (4 calls) → render → deferred (8 calls). O crear un endpoint `/api/dashboard` que devuelve todo en una sola respuesta.
- **Impacto:** First paint 2-3x más rápido.
- **Esfuerzo:** 4h (endpoint consolidado) o 2h (two-phase loading).

---

## Prioridad Baja (hardening, nice-to-have)

### 13. No hay tests de concurrencia
- **Categoría:** Testing
- **Riesgo:** No se verifica que dos ventas simultáneas del último item no creen overselling. El código usa `WHERE stock >= qty` que es correcto, pero no hay test que lo demuestre.
- **Fix:** Test que lanza 10 ventas concurrentes del mismo producto con stock=1 y verifica que solo 1 tiene éxito.
- **Impacto:** Confianza en el sistema bajo carga.
- **Esfuerzo:** 3h.

### 14. No hay tests para void/return flows
- **Categoría:** Testing
- **Riesgo:** El flujo de void (restaurar stock, revertir fiado, revertir stats) y return (parcial) no tienen tests de integración. Un cambio en el código podría romper la reversión sin que nadie se entere.
- **Fix:** Tests e2e: crear venta → void → verificar stock restaurado + customer stats revertidos.
- **Impacto:** Previene regresiones en flujos críticos.
- **Esfuerzo:** 4h.

### 15. No hay tests para RFM scoring
- **Categoría:** Testing
- **Riesgo:** El servicio de RFM calcula quintiles y asigna segmentos. Si la lógica tiene un bug (ej: todos los clientes quedan como "lost"), no hay test que lo detecte.
- **Fix:** Unit tests con datos sintéticos: 10 clientes con diferentes patrones → verificar que los segmentos son correctos.
- **Impacto:** Confianza en la segmentación.
- **Esfuerzo:** 2h.

### 16. No hay distributed tracing (OpenTelemetry)
- **Categoría:** Observabilidad
- **Riesgo:** Cuando un request es lento, no se puede ver qué parte del pipeline (auth, RLS, query, external service) es la culpable.
- **Fix:** Integrar OpenTelemetry SDK con spans para: auth, tenant, DB queries, Redis, external APIs.
- **Impacto:** Debugging de latencia en producción.
- **Esfuerzo:** 1 día.

### 17. No hay readiness probe separada del liveness probe
- **Categoría:** Deployment
- **Riesgo:** El health check actual verifica DB + Redis. Si la DB está caída, el container se marca como unhealthy y se reinicia. Pero durante migraciones, la DB puede estar temporalmente inaccesible — el container no debería reiniciarse, solo dejar de recibir tráfico.
- **Fix:** Separar en `/health/live` (proceso vivo) y `/health/ready` (DB + Redis accesibles).
- **Impacto:** Deploys más estables.
- **Esfuerzo:** 1h.

### 18. No hay rollback automático de migraciones
- **Categoría:** Deployment
- **Riesgo:** Si una migración falla a mitad (ej: ALTER TABLE en tabla grande timeout), la DB queda en estado inconsistente. No hay forma automática de revertir.
- **Fix:** Cada migración debería tener un archivo `down` correspondiente. O usar migraciones idempotentes (IF NOT EXISTS, IF EXISTS).
- **Impacto:** Recovery más rápido de deploys fallidos.
- **Esfuerzo:** 4h (escribir downs para las 22 migraciones existentes).

### 19. orders.items como JSONB pierde integridad referencial
- **Categoría:** Modelo de datos
- **Riesgo:** Si un producto se elimina, el snapshot en `orders.items` mantiene el `productId` pero no se puede hacer JOIN para obtener datos actualizados. Esto es intencional (snapshot del momento de la orden) pero dificulta reportes que cruzan órdenes con productos.
- **Fix:** Aceptable como está (es un snapshot por diseño). Documentar que `orders.items` es inmutable y no debe joinarse con `products`.
- **Impacto:** Ninguno funcional — solo claridad de diseño.
- **Esfuerzo:** 0 (documentación).

### 20. /metrics endpoint sin auth en red privada
- **Categoría:** Seguridad
- **Riesgo:** Si la red privada se compromete, un atacante puede ver métricas operacionales (request rates, error rates, memory usage). No datos de negocio, pero sí información útil para reconocimiento.
- **Fix:** Agregar basic auth o IP whitelist al endpoint `/metrics`.
- **Impacto:** Defensa en profundidad.
- **Esfuerzo:** 30min.

---

## Resumen por esfuerzo

| Esfuerzo | Items | IDs |
|----------|-------|-----|
| < 1 hora | 5 | #2, #3, #10, #17, #20 |
| 1-2 horas | 5 | #1, #4, #5, #8, #15 |
| 3-4 horas | 5 | #6, #7, #11, #13, #14 |
| 1 día | 3 | #12, #16, #18 |
| Decisión de diseño | 2 | #9, #19 |

---

## Orden recomendado de implementación

### Sprint A (1 día): Integridad de datos
- #2 Unique constraint SKU
- #3 Quick sales transacción
- #5 Exchange rates date type
- #10 Payment method enum

### Sprint B (1 día): Seguridad
- #1 FORCE ROW LEVEL SECURITY
- #4 Validación JSONB fields
- #20 Auth en /metrics

### Sprint C (1 día): Performance
- #12 Dashboard endpoint consolidado o two-phase
- #11 Paginación en reports

### Sprint D (1 día): Testing
- #13 Tests de concurrencia
- #14 Tests de void/return
- #15 Tests de RFM

### Sprint E (1 día): Resiliencia
- #6 Circuit breaker
- #7 set_config dentro de transacciones
- #17 Readiness probe
