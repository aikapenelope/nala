# Nova vs ERPNext: Analisis Profundo de Arquitectura

> Analisis patron-por-patron del repositorio ERPNext (github.com/frappe/erpnext, ~2559 archivos Python, ~1113 JSON, ~625 JS) comparado con Nova (87 endpoints, 29 tablas, TypeScript monorepo).
> Objetivo: identificar que patrones probados en produccion ya seguimos, cuales nos faltan, y que podemos adoptar sin migrar a Frappe.

---

## 1. Jerarquia de Controladores

### ERPNext
ERPNext usa una cadena de herencia profunda para sus transacciones:

```
Document (Frappe base)
  └── TransactionBase
        └── AccountsController        (impuestos, moneda, GL entries)
              └── StockController      (stock ledger entries, valuacion)
                    └── SellingController   (ventas, delivery, pricing)
                    └── SubcontractingController
                          └── BuyingController (compras, recepcion)
```

Cada nivel agrega validaciones y side-effects. Una `Sales Invoice` hereda de `SellingController` y al hacer `on_submit()` automaticamente:
1. Valida cantidades vs orden de venta
2. Crea GL Entries (contabilidad)
3. Crea Stock Ledger Entries (inventario)
4. Actualiza status del documento padre
5. Actualiza cuentas por cobrar

### Nova
Nova usa funciones planas en archivos de rutas (`sales.ts`, `inventory.ts`). No hay herencia. Cada endpoint es una funcion independiente con su propia logica de transaccion.

### Veredicto
**Nova esta bien para su escala actual.** La jerarquia de ERPNext existe porque tiene ~700 DocTypes que comparten comportamiento. Con 29 tablas, la herencia seria over-engineering. Sin embargo, hay un patron que vale la pena adoptar:

**Recomendacion: Crear un `withTransaction` helper** que encapsule el patron comun de: validar -> insertar -> actualizar stock -> registrar movimiento. Esto reduciria duplicacion entre `POST /sales`, `POST /sales/:id/void`, y futuros endpoints de devolucion.

---

## 2. Stock Ledger (Libro de Inventario)

### ERPNext
ERPNext mantiene un **Stock Ledger Entry (SLE)** por cada movimiento de stock. Es un log append-only:

```
| item_code | warehouse | actual_qty | valuation_rate | qty_after_transaction | posting_date |
|-----------|-----------|------------|----------------|----------------------|--------------|
| ITEM-001  | Store-1   | +50        | 10.00          | 50                   | 2026-04-01   |
| ITEM-001  | Store-1   | -3         | 10.00          | 47                   | 2026-04-02   |
```

Cada SLE recalcula `qty_after_transaction` y `stock_value_difference`. Esto permite:
- Reconstruir el estado del stock en cualquier fecha
- Detectar transacciones backdated
- Repostear valuaciones cuando cambia un costo retroactivo
- Metodos de valuacion: FIFO, LIFO, Moving Average

Ademas mantiene un **Bin** (cache de stock actual por item+warehouse) que se actualiza con cada SLE.

### Nova
Nova tiene `stock_movements` (log de movimientos) y `products.stock` (campo directo). El stock se decrementa atomicamente con `WHERE stock >= qty`. Los movimientos se registran dentro de la transaccion (fix del sprint 2).

### Que nos falta
1. **`qty_after_transaction` en stock_movements** - Sin este campo, no podemos reconstruir el stock historico. Si alguien pregunta "cuanto stock tenia el 15 de marzo?", no podemos responder.
2. **Valuacion de inventario** - Nova guarda `cost` como campo fijo. ERPNext calcula el costo real usando FIFO/Moving Average basado en el historial de compras. Para un bodeguero esto no importa hoy, pero si algun dia necesitan valorizar inventario para un balance, lo necesitaran.
3. **Bin cache** - Nova lee `products.stock` directamente. ERPNext tiene un `Bin` separado que es un cache desnormalizado. Nova no lo necesita porque Postgres es rapido para leer un campo de una tabla indexada.

**Recomendacion:**
- Agregar `qty_after_transaction` a `stock_movements` (migracion simple, alto valor para reportes historicos)
- Mantener el modelo de costo fijo por ahora. Agregar Moving Average solo si se implementa ciclo de compras

---

## 3. Contabilidad (GL Entries)

### ERPNext
Cada transaccion financiera genera **General Ledger Entries** de doble entrada:

```
Venta de $100:
  Debit:  Accounts Receivable  $100
  Credit: Sales Revenue         $100

Cobro:
  Debit:  Cash/Bank            $100
  Credit: Accounts Receivable  $100
```

ERPNext tiene un `Chart of Accounts` (arbol de cuentas), `Fiscal Year`, `Cost Center`, y `Accounting Dimensions`. Esto permite generar Balance General, Estado de Resultados, y cumplir con normas contables.

### Nova
Nova tiene `accounting_accounts` y `accounting_entries` en el schema, pero los endpoints de contabilidad son basicos. Los reportes financieros (`/reports/financial`) calculan P&L desde las ventas y gastos directamente, no desde un libro mayor.

### Veredicto
**Nova no necesita contabilidad de doble entrada para comercio informal.** Un bodeguero en Venezuela no presenta balance general. Sin embargo, el schema ya tiene las tablas preparadas. Si algun dia se necesita:

**Recomendacion:** El patron de ERPNext de "cada transaccion genera GL entries automaticamente" es el correcto. Si se implementa, hacerlo como un hook post-transaccion, no como herencia de controlador. Ejemplo: `afterSaleCreated(sale) => createGLEntries(sale)`.

---

## 4. Document Lifecycle (Estado de Documentos)

### ERPNext
Cada documento tiene un `docstatus`:
- `0` = Draft (borrador, editable)
- `1` = Submitted (confirmado, genera efectos contables/stock)
- `2` = Cancelled (anulado, revierte efectos)

Las transiciones son estrictas: Draft -> Submitted -> Cancelled. No se puede editar un documento submitted. Para corregir, se cancela y se crea uno nuevo. Esto garantiza un audit trail perfecto.

Ademas tiene `StatusUpdater` que propaga estados entre documentos vinculados (ej: cuando se entrega todo un Sales Order, su status cambia a "Completed").

### Nova
Nova usa `status: "completed" | "voided"` en ventas. No hay concepto de draft. Las ventas se crean directamente como completed. El void revierte stock y (desde el fix del sprint 1) revierte cuentas por cobrar.

### Que nos falta
1. **Audit trail inmutable** - ERPNext nunca modifica un documento submitted. Nova permite editar productos, clientes, etc. sin registro del cambio. La tabla `activity_log` existe pero no se usa consistentemente.
2. **Draft state** - Para cotizaciones que se convierten en ventas, el patron Draft -> Submitted es util. Nova ya tiene esto parcialmente en quotations (`draft` -> `converted`).

**Recomendacion:**
- Usar `activity_log` consistentemente en todos los endpoints de mutacion (PATCH, DELETE). Registrar el estado anterior y el nuevo.
- No implementar el sistema completo de docstatus. Es overkill para POS. Pero si asegurar que las ventas completadas sean inmutables (solo se pueden void, no editar).

---

## 5. Multi-Tenancy

### ERPNext
ERPNext usa **database-per-tenant** (silo). Cada "site" es una base de datos MariaDB separada. El `bench` CLI maneja la creacion y migracion de sitios.

Ventajas: aislamiento total, backup/restore por tenant.
Desventajas: no escala a miles de tenants, migraciones deben correr N veces, mas RAM.

### Nova
Nova usa **shared-schema con RLS** (pool). Una sola base de datos Postgres con `business_id` en cada tabla y Row Level Security policies.

```sql
CREATE POLICY tenant_isolation ON products
  USING (business_id = current_business_id());
```

### Veredicto
**Nova tiene el patron correcto para SaaS multi-tenant.** El modelo de ERPNext no escala para un SaaS con miles de negocios. El modelo RLS de Nova es el recomendado por la industria para B2B SMB SaaS (ver Citus, Neon, Supabase - todos usan RLS).

**Recomendacion:** Agregar tests automatizados que verifiquen que RLS no tiene leaks. ERPNext no necesita esto porque cada tenant tiene su propia DB. Nova si lo necesita.

---

## 6. POS (Point of Sale)

### ERPNext
- POS Invoice es un DocType separado de Sales Invoice
- Al cerrar turno, los POS Invoices se consolidan en Sales Invoices
- Soporta POS Profiles (configuracion por sucursal/caja)
- Offline: cache en browser, sync al reconectar
- Validacion de stock en el momento de submit
- Shift opening/closing con reconciliacion de efectivo

### Nova
- Venta directa sin concepto de POS Invoice separado
- Cash opening/closing implementado
- Offline queue con IndexedDB
- Stock validado atomicamente con `WHERE stock >= qty`
- No hay POS Profiles (un solo perfil por negocio)

### Que hacemos mejor
- **Velocidad**: 3-4 taps vs 5-7 pasos en ERPNext
- **Atomicidad de stock**: `WHERE stock >= qty` en la misma transaccion es mas seguro que la validacion pre-submit de ERPNext (que tiene bugs reportados en foros de Frappe)
- **UX mobile**: ERPNext POS es desktop-first, Nova es mobile-first

### Que podemos adoptar
1. **Consolidacion de turno** - ERPNext consolida POS Invoices en una sola Sales Invoice al cerrar turno. Esto optimiza el ledger. Nova podria hacer algo similar: al cerrar dia, generar un resumen consolidado para contabilidad.
2. **POS Profile** - Si Nova escala a negocios con multiples cajas/sucursales, necesitara configuracion por punto de venta (warehouse, metodos de pago permitidos, usuario asignado).

---

## 7. Metodos de Pago

### ERPNext
- `Mode of Payment` DocType con cuenta contable asociada
- Soporta: Cash, Bank, Credit Card
- Split payments nativos
- Cambio automatico calculado
- No tiene: Pago Movil, Binance, Zinli, Zelle, Fiado

### Nova
- 7 metodos: efectivo, pago_movil, binance, zinli, transferencia, zelle, fiado
- Split payments
- Fiado genera accounts_receivable automaticamente
- Tasa BCV manual con conversion USD/Bs

### Veredicto
**Nova gana decisivamente aqui.** Los metodos de pago venezolanos no existen en ERPNext y serian custom DocTypes. El sistema de fiado con cuentas por cobrar automaticas es un diferenciador real.

---

## 8. Indices y Performance

### ERPNext
ERPNext agrega indices programaticamente en `on_doctype_update()`:
```python
frappe.db.add_index("Stock Ledger Entry", ["item_code", "warehouse", "posting_datetime", "creation"])
frappe.db.add_index("Stock Ledger Entry", ["voucher_no", "voucher_type"])
```

Tambien usa `frappe.get_cached_value()` extensivamente para evitar queries repetidas.

### Nova
Nova tiene indices en el schema de Drizzle:
```typescript
index("idx_products_business").on(table.businessId),
index("idx_products_barcode").on(table.barcode),
index("idx_products_name_trgm").using("gin", sql`${table.name} gin_trgm_ops`),
```

### Que nos falta
1. **Indices compuestos en ventas** - ERPNext indexa `(item_code, warehouse, posting_datetime)`. Nova deberia tener `(business_id, created_at)` en sales para queries de reportes.
2. **Cache layer** - ERPNext cachea valores frecuentes. Nova no tiene cache. Para un POS con muchos productos, cachear la lista de productos en Redis reduciria latencia.

**Recomendacion:**
- Agregar indice compuesto `(business_id, created_at DESC)` en `sales`
- Evaluar cache de productos en Redis (ya disponible en el data plane)

---

## 9. Valuacion de Stock

### ERPNext
Implementa 3 metodos en `stock/valuation.py`:
- **FIFO** (First In First Out) - default
- **LIFO** (Last In First Out)
- **Moving Average**

Cada metodo mantiene un "bin" (cola de lotes con qty+rate) y calcula el costo de salida segun el metodo elegido. Usa una clase abstracta `BinWiseValuation` con implementaciones concretas.

### Nova
Costo fijo por producto. No hay valuacion dinamica.

### Veredicto
**Para comercio informal, costo fijo es suficiente.** El bodeguero sabe cuanto le costo la mercancia y pone su precio. No necesita FIFO. Sin embargo, si Nova escala a negocios mas formales (ferreterias, distribuidoras), Moving Average seria util.

**Recomendacion:** No implementar ahora. Documentar como feature futuro. Si se implementa, el patron de ERPNext (clase abstracta con implementaciones por metodo) es elegante y vale la pena copiar.

---

## 10. Testing

### ERPNext
- 363 archivos de test
- Tests de integracion que crean documentos completos y verifican side-effects
- Fixtures con datos de prueba (`test_records`)
- Tests de regresion para bugs especificos

### Nova
- ~49 archivos de test, ~132 test cases
- Tests unitarios para shared utilities
- Tests de integracion para endpoints API
- Vitest como runner

### Que nos falta
1. **Tests de side-effects** - ERPNext verifica que al crear una venta, el stock baje, el GL entry se cree, y el status del SO cambie. Nova deberia tener tests que verifiquen: venta -> stock decrementado -> stock_movement creado -> accounts_receivable creado (si fiado).
2. **Tests de RLS** - Verificar que un tenant no puede ver datos de otro. ERPNext no necesita esto (DB separadas), Nova si.
3. **Tests de concurrencia** - Verificar que dos ventas simultaneas del mismo producto no causan stock negativo.

**Recomendacion:** Priorizar tests de side-effects y RLS. Son los que previenen bugs criticos en produccion.

---

## 11. Resumen: Scorecard

| Patron | ERPNext | Nova | Accion |
|--------|---------|------|--------|
| Controller hierarchy | Herencia profunda (6 niveles) | Funciones planas | Mantener plano, agregar `withTransaction` helper |
| Stock Ledger | Append-only SLE + Bin cache | stock_movements + campo directo | Agregar `qty_after_transaction` |
| Contabilidad | GL Entries doble entrada completo | Basico, tablas preparadas | No priorizar, hook post-transaccion si se necesita |
| Document lifecycle | Draft/Submitted/Cancelled estricto | completed/voided simple | Asegurar inmutabilidad de ventas, usar activity_log |
| Multi-tenancy | Database-per-tenant (no escala) | RLS shared-schema (escala) | Agregar tests de aislamiento RLS |
| POS | Generico, desktop-first | Optimizado, mobile-first | Adoptar consolidacion de turno |
| Metodos de pago | Genericos (cash/card/bank) | Venezuela-especificos (7 metodos) | Ya ganamos |
| Indices | Programaticos, compuestos | Schema-level, buenos | Agregar compuestos en sales |
| Valuacion stock | FIFO/LIFO/Moving Average | Costo fijo | No priorizar, documentar para futuro |
| Testing | 363 archivos, side-effects | ~49 archivos, unitarios | Agregar tests side-effects y RLS |
| Offline | POS cache, bugs reportados | IndexedDB queue, funcional | Ya ganamos |
| UI/UX | Admin panel (Desk), desktop | Glassmorphism PWA, mobile-first | Ya ganamos |

---

## 12. Plan de Accion (ordenado por impacto)

### Inmediato (proximo sprint)
1. Agregar `qty_after_transaction` a `stock_movements` (migracion 0010)
2. Agregar indice compuesto `(business_id, created_at DESC)` en `sales`
3. Usar `activity_log` en todos los endpoints de mutacion

### Corto plazo (1-2 sprints)
4. Crear `withTransaction` helper para encapsular patron venta/void/devolucion
5. Tests de aislamiento RLS (verificar que tenant A no ve datos de tenant B)
6. Tests de side-effects (venta -> stock -> movimiento -> receivable)

### Medio plazo (cuando se necesite)
7. Consolidacion de turno (resumen diario para contabilidad)
8. Cache de productos en Redis
9. POS Profiles (multi-caja/sucursal)

### Largo plazo (solo si el mercado lo pide)
10. Moving Average valuation
11. GL Entries de doble entrada
12. Chart of Accounts

---

## Conclusion

Nova sigue patrones probados en el mundo real para su caso de uso. El modelo de multi-tenancy (RLS), la atomicidad de stock (`WHERE stock >= qty`), el offline queue, y los metodos de pago venezolanos son superiores a lo que ERPNext ofrece para este mercado.

Los gaps principales son operacionales, no arquitecturales: `qty_after_transaction` para historia de stock, `activity_log` consistente para auditoria, y tests de aislamiento RLS. Ninguno requiere cambios fundamentales en la arquitectura.

ERPNext es un ERP enterprise con 18 anos de desarrollo. Nova es un POS SaaS vertical con 7 sesiones de desarrollo. La comparacion no es justa en escala, pero en adecuacion al mercado objetivo (comercio informal venezolano), Nova gana.
