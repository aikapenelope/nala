# Auditoría Exhaustiva de Código — Nala

> Mayo 2026. Auditoría de producción basada en las 12 categorías de fallo
> más comunes en código generado por IA (2025-2026).

---

## Resumen Ejecutivo

| Severidad | Hallazgos |
|-----------|-----------|
| Crítica | 0 |
| Alta | 2 |
| Media | 5 |
| Baja | 8 |

**No hay vulnerabilidades críticas que bloqueen lanzamiento.**
Los 2 hallazgos de severidad alta son mejoras de hardening, no exploits activos.

---

## CATEGORÍA 1: Fallos Lógicos Silenciosos

### [1-1] Off-by-one en paginación del catálogo

| Campo | Valor |
|-------|-------|
| **Severidad** | Baja |
| **Archivo** | `apps/api/src/routes/catalog.ts:238` |
| **Impacto** | Si `offset + products.length === total`, `hasMore` es false pero podría haber exactamente 1 producto más |
| **Evidencia** | `hasMore: offset + productRows.length < totalProducts` |
| **Fix** | Correcto como está. `<` es la comparación correcta para "hay más después de este batch". No es un bug. |

### [1-2] Cart price stale después de cambio de precios

| Campo | Valor |
|-------|-------|
| **Severidad** | Baja |
| **Archivo** | `apps/web/app/composables/useCart.ts` |
| **Impacto** | Cliente ve precio viejo en carrito si el comerciante cambió el precio. El backend rechaza con error claro al hacer checkout. |
| **Fix** | Aceptable. El backend valida precios server-side (catalog.ts:445-449). No hay riesgo de cobro incorrecto. |

---

## CATEGORÍA 2: Seguridad — Inyección y Validación

### [2-1] file.type del upload es client-supplied (spoofable)

| Campo | Valor |
|-------|-------|
| **Severidad** | Baja |
| **Archivo** | `apps/api/src/routes/inventory.ts:882` |
| **Impacto** | Un atacante podría enviar un archivo malicioso con Content-Type `image/jpeg`. Sin embargo, `sharp` (image-processing.ts) valida el contenido binario real y rechaza archivos no-imagen. |
| **Fix** | Defensa en profundidad ya implementada via sharp. Opcional: agregar validación de magic bytes antes de sharp. |

### [2-2] sql.raw con constantes (no user input)

| Campo | Valor |
|-------|-------|
| **Severidad** | Info (no es bug) |
| **Archivo** | `apps/api/src/routes/reports.ts:405,818,849,882,917` |
| **Impacto** | Ninguno. `sql.raw(String(DEAD_STOCK_DAYS))` usa constantes del código, no input de usuario. |
| **Fix** | No necesario. Documentar que estas constantes NUNCA deben derivarse de user input. |

---

## CATEGORÍA 3: Autenticación y Autorización

### [3-1] RLS bypass potencial: rol owner sin FORCE

| Campo | Valor |
|-------|-------|
| **Severidad** | Alta |
| **Archivo** | `apps/api/src/db.ts` (applyRlsPolicies) |
| **Impacto** | Si la app se conecta como table owner (rol `platform`), RLS se bypasea silenciosamente. Actualmente mitigado porque el middleware SIEMPRE setea `set_config` antes de queries. |
| **Fix** | Agregar `FORCE ROW LEVEL SECURITY` a todas las tablas. Riesgo: puede romper migraciones si no se maneja. Ver docs/50 para análisis completo. |
| **CWE** | CWE-863 (Incorrect Authorization) |

### [3-2] Auth lookup policy permite SELECT sin restricción cuando context es NULL

| Campo | Valor |
|-------|-------|
| **Severidad** | Media |
| **Archivo** | `packages/db/init.sql:36-38, 52-54` |
| **Impacto** | La policy `businesses_auth_lookup` permite `SELECT` en `businesses` y `users` cuando `current_business_id() IS NULL`. Esto es necesario para el auth flow, pero si un endpoint olvida setear el context, puede leer TODOS los businesses/users. |
| **Fix** | Aceptable por diseño. El middleware siempre setea context. Agregar test que verifica que ningún endpoint protegido ejecuta queries sin context. |

---

## CATEGORÍA 4: Manejo de Errores y Resiliencia

### [4-1] Catch vacíos en rutas de ventas

| Campo | Valor |
|-------|-------|
| **Severidad** | Baja |
| **Archivo** | `apps/api/src/routes/sales.ts:182,803` |
| **Impacto** | Errores de Redis cache se swallowean silenciosamente. Correcto por diseño (cache es non-critical), pero sin log no hay visibilidad de fallos de Redis. |
| **Fix** | Agregar `console.debug` en catches de cache para visibilidad en logs sin afectar el flujo. |

### [4-2] Timeout global de 30s puede ser insuficiente para image enhancement

| Campo | Valor |
|-------|-------|
| **Severidad** | Media |
| **Archivo** | `apps/api/src/app.ts:157` + `apps/api/src/services/image-enhance.ts` |
| **Impacto** | fal.ai puede tardar 5-10s. Si hay cola, podría tardar >30s. El timeout global mata el request y el usuario ve un error genérico. |
| **Fix** | Agregar timeout específico en el `fal.subscribe` call (ej: 25s) con error claro antes de que el timeout global lo mate. |

---

## CATEGORÍA 5: Concurrencia y Race Conditions

### [5-1] Stock decrement es atómico (correcto)

| Campo | Valor |
|-------|-------|
| **Severidad** | Info (no es bug) |
| **Archivo** | `apps/api/src/routes/sales.ts:635-642` |
| **Impacto** | `UPDATE products SET stock = stock - qty WHERE stock >= qty` es atómico en PostgreSQL. Si dos requests concurrentes intentan comprar el último item, solo uno gana. Correcto. |

### [5-2] Order creation sin reserva de stock

| Campo | Valor |
|-------|-------|
| **Severidad** | Media |
| **Archivo** | `apps/api/src/routes/catalog.ts:490` |
| **Impacto** | El storefront crea el pedido sin reservar stock. Si 5 clientes piden el último item, los 5 pedidos se crean exitosamente. Solo al confirmar se valida stock. El comerciante debe rechazar manualmente los que no puede cumplir. |
| **Fix** | Aceptable para el modelo de negocio (bodega venezolana, confirmación manual). Para escala mayor, implementar reserva temporal (15 min TTL). |

---

## CATEGORÍA 6: Dependencias y Supply Chain

### [6-1] Todas las dependencias son paquetes reales verificados

| Campo | Valor |
|-------|-------|
| **Severidad** | Info |
| **Impacto** | No se encontraron paquetes inventados (slopsquatting). Todas las dependencias existen en npm y son mantenidas activamente. |

---

## CATEGORÍA 7: Secrets y Configuración

### [7-1] No hay secrets hardcodeados

| Campo | Valor |
|-------|-------|
| **Severidad** | Info |
| **Impacto** | Todos los secrets vienen de env vars. No se encontraron API keys, passwords, ni tokens en el código fuente. |

---

## CATEGORÍA 8: Performance y Escalabilidad

### [8-1] Queries N+1 en stock movements dentro de transacción

| Campo | Valor |
|-------|-------|
| **Severidad** | Baja |
| **Archivo** | `apps/api/src/routes/sales.ts:740-755` |
| **Impacto** | Dentro de la transacción de venta, se hace un INSERT de stock_movement por cada item. Con 20 items, son 20 INSERTs individuales. Podría ser un batch INSERT. |
| **Fix** | Usar `tx.insert(stockMovements).values([...allMovements])` en un solo statement. Mejora ~5ms por venta con muchos items. No urgente. |

### [8-2] Reports endpoint sin cache

| Campo | Valor |
|-------|-------|
| **Severidad** | Media |
| **Archivo** | `apps/api/src/routes/reports.ts` |
| **Impacto** | Los reportes (daily, weekly, inventory, alerts) hacen queries pesadas sin cache. Si el comerciante recarga el dashboard repetidamente, cada recarga ejecuta ~10 queries. |
| **Fix** | Agregar cache Redis de 60s para reportes. El dashboard ya hace `Promise.allSettled` con todos los reportes en paralelo, así que el impacto es en el data-plane, no en latencia percibida. |

---

## CATEGORÍA 9: Consistencia y Mantenibilidad

### [9-1] Patrón de accounting entries duplicado en 2 archivos

| Campo | Valor |
|-------|-------|
| **Severidad** | Baja |
| **Archivo** | `apps/api/src/routes/sales.ts:695-732` y `apps/api/src/routes/orders.ts:351-388` |
| **Impacto** | La misma lógica de "buscar cuentas 4101/1101 + insertar asiento" está duplicada. Si se cambia en uno y no en el otro, divergen. |
| **Fix** | Extraer a función compartida `createRevenueEntry(tx, businessId, amount, description, referenceId)`. |

---

## CATEGORÍA 10: Testing

### [10-1] Tests de RLS existen y son correctos

| Campo | Valor |
|-------|-------|
| **Severidad** | Info |
| **Archivo** | `apps/api/src/__tests__/rls.test.ts`, `rls-extended.test.ts` |
| **Impacto** | Los tests verifican aislamiento cross-tenant. Correcto. |

### [10-2] No hay tests para el flujo de checkout del storefront

| Campo | Valor |
|-------|-------|
| **Severidad** | Alta |
| **Archivo** | N/A (no existe) |
| **Impacto** | El flujo más crítico (cliente hace pedido → validación de precios → creación de orden) no tiene test de integración. Un cambio en catalog.ts podría romper el checkout sin que nadie se entere hasta producción. |
| **Fix** | Crear test e2e que simula: crear producto → hacer pedido via API pública → verificar que se creó correctamente → confirmar → verificar stock decrementado. |

---

## CATEGORÍA 11: Observabilidad

### [11-1] No hay request ID / correlation ID

| Campo | Valor |
|-------|-------|
| **Severidad** | Media |
| **Archivo** | `apps/api/src/app.ts` |
| **Impacto** | Si un error ocurre, no hay forma de correlacionar el log del error con el request específico que lo causó. Dificulta debugging en producción. |
| **Fix** | Agregar middleware que genera `X-Request-Id` (UUID) y lo incluye en todos los logs. |

---

## CATEGORÍA 12: Configuración de Infraestructura

### [12-1] Containers no corren como non-root (parcial)

| Campo | Valor |
|-------|-------|
| **Severidad** | Baja |
| **Archivo** | `Dockerfile:100` |
| **Impacto** | El API container usa `USER node` (correcto). PostgreSQL y Redis en el data-plane corren como root dentro de Docker (default de las imágenes oficiales). Riesgo bajo porque están en red privada sin acceso público. |

### [12-2] Health check no verifica dependencias

| Campo | Valor |
|-------|-------|
| **Severidad** | Baja |
| **Archivo** | `apps/api/src/routes/health.ts` |
| **Impacto** | El health check retorna 200 si el proceso Node está vivo, pero no verifica que PostgreSQL y Redis estén accesibles. Coolify podría considerar el servicio healthy cuando la DB está caída. |
| **Fix** | Agregar ping a DB y Redis en el health check (con timeout de 2s). |

---

## Roadmap de Fixes (Priorizado)

### Sprint A: Antes de 100 usuarios (Alta prioridad)

| # | Fix | Esfuerzo | Archivo |
|---|-----|----------|---------|
| A1 | Test e2e del flujo de checkout storefront | 4h | Nuevo test file |
| A2 | Timeout específico en image enhancement (25s) | 30min | image-enhance.ts |
| A3 | Extraer función compartida de accounting entries | 1h | sales.ts + orders.ts |

### Sprint B: Antes de 500 usuarios (Media prioridad)

| # | Fix | Esfuerzo | Archivo |
|---|-----|----------|---------|
| B1 | Request ID middleware (correlation) | 1h | app.ts |
| B2 | Cache Redis para reportes (60s TTL) | 2h | reports.ts |
| B3 | Health check con ping a DB + Redis | 30min | health.ts |
| B4 | Batch INSERT para stock_movements | 1h | sales.ts |

### Sprint C: Hardening (Baja prioridad)

| # | Fix | Esfuerzo | Archivo |
|---|-----|----------|---------|
| C1 | FORCE ROW LEVEL SECURITY (evaluar impacto) | 2h | db.ts |
| C2 | Magic bytes validation en uploads | 1h | inventory.ts |
| C3 | console.debug en catches de cache | 30min | Varios |
| C4 | Reserva temporal de stock en checkout (futuro) | 1 día | catalog.ts |

---

## Conclusión

El codebase está en buen estado para producción con 100-150 negocios.
No hay vulnerabilidades críticas explotables. Los hallazgos de severidad
alta son mejoras de hardening y testing, no exploits activos.

La arquitectura de seguridad (RLS + auth middleware + tenant middleware +
validación server-side de precios/stock) proporciona múltiples capas de
defensa. Un fallo en una capa es cubierto por las otras.

**Veredicto: Listo para producción con los fixes del Sprint A.**
