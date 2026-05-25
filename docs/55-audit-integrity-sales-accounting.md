# Auditoría de Integridad: Flujo Ventas → Contabilidad → Stock

> Fecha: Mayo 2026
> Score del sistema interconectado: **9.0/10**
> Estado: 3 gaps identificados, todos corregibles en ~30min

---

## Resumen del flujo

El sistema tiene un pipeline completo y atómico:

```
Venta → Stock decrement → Movimiento log → Contabilidad → Customer stats → Audit trail
```

Todo dentro de `db.transaction()`. Si cualquier paso falla, todo se revierte.

### Lo que está correcto (producción sólida):

| Aspecto | Implementación | Veredicto |
|---------|---------------|-----------|
| Atomicidad de ventas | `db.transaction()` con sale + items + payments + stock + accounting | Correcto |
| Guard de overselling | `WHERE stock >= qty` en UPDATE (no SELECT+check) | Correcto |
| Snapshot de precios | `sale_items.unitPrice` guarda precio al momento | Correcto |
| Stock audit trail | `qty_after_transaction` en cada movimiento | Correcto |
| Contabilidad doble entrada | Debit cash (1101), credit revenue (4101) | Correcto |
| Reversión de void | Stock restaurado + fiado revertido + stats revertidos | Correcto |
| Partial returns | Items específicos devueltos sin anular la venta | Correcto |
| Order → Sale pipeline | Pedido confirmado crea sale completo con todos los registros | Correcto |
| Price history | Cada cambio de costo/precio registrado con previous/new | Correcto |
| RFM auto-recalculation | Fire-and-forget post-transacción (no bloquea la venta) | Correcto |
| Split payments | Múltiples métodos de pago por venta | Correcto |
| Fiado con límite de crédito | Valida balance + credit_limit antes de aceptar | Correcto |

---

## 3 Gaps de integridad encontrados

### Gap 1: Void de venta NO genera asiento contable de reversión

**Ubicación:** `apps/api/src/routes/sales.ts` — `POST /sales/:id/void` (líneas 855-1001)

**El problema:** Cuando se anula una venta:
- Stock se restaura ✓
- Fiado se revierte ✓
- Customer stats se revierten ✓
- Accounts receivable se cancela ✓
- Activity log se registra ✓
- **Asiento contable de reversión: NO SE GENERA** ✗

**Consecuencia:** La contabilidad muestra un ingreso que ya no existe. Los reportes financieros (margen bruto, flujo de caja) están inflados por el monto de las ventas anuladas.

**Comparación:** `PATCH /orders/:id/cancel` SÍ llama `createReversalEntry()` (línea 514). El void de ventas debería hacer lo mismo.

**Fix:**
```typescript
// Dentro de la transacción de void, después de marcar la venta como voided:
await createReversalEntry(
  tx,
  businessId,
  sale.totalUsd,
  `Anulacion venta #${saleId.slice(0, 8)}: ${reason}`,
  "sale_void",
  saleId,
);
```

**Esfuerzo:** 5 líneas de código + import.

---

### Gap 2: Quick sales NO generan asiento contable

**Ubicación:** `apps/api/src/routes/sales.ts` — `POST /sales/quick` (líneas 763-846)

**El problema:** Las ventas rápidas (por monto, sin producto) crean:
- Sale record ✓
- Payment record ✓
- Activity log ✓
- **Asiento contable: NO SE GENERA** ✗

**Consecuencia:** Si un negocio hace 50% de sus ventas como "ventas rápidas" (servicios, productos no inventariados), la contabilidad solo refleja el otro 50%. Los reportes financieros subreportan ingresos.

**Fix:**
```typescript
// Dentro de la transacción, después del activity log:
await createRevenueEntry(
  tx,
  businessId,
  String(totalUsd),
  `Venta rapida $${totalUsd}`,
  "sale",
  sale.id,
);
```

**Esfuerzo:** 7 líneas de código + import.

---

### Gap 3: Price history se registra FUERA de transacción

**Ubicación:** `apps/api/src/routes/inventory.ts` — `PATCH /products/:id` (líneas 438-460)

**El problema:** El flujo actual es:
```typescript
// 1. Update product (no transaction)
const [updated] = await db.update(products).set(updateValues)...

// 2. Insert price history (separate statement, no transaction)
if (costChanged || priceChanged) {
  await db.insert(priceHistory).values({...});
}
```

Si el paso 2 falla (ej: constraint violation, timeout), el producto tiene el nuevo precio pero no hay registro del cambio. El historial de precios queda incompleto.

**Consecuencia:** Si el dueño revisa "¿cuándo subió el costo de este producto?", puede faltar un registro. No es crítico para la operación diaria, pero rompe la trazabilidad.

**Fix:** Envolver ambos en `db.transaction()`:
```typescript
await db.transaction(async (tx) => {
  const [updated] = await tx.update(products).set(updateValues)...
  if (costChanged || priceChanged) {
    await tx.insert(priceHistory).values({...});
  }
});
```

**Esfuerzo:** 3 líneas de wrapping.

---

## Prioridad de corrección

| Gap | Impacto | Esfuerzo | Prioridad |
|-----|---------|----------|-----------|
| 1 - Void sin asiento | Contabilidad desbalanceada | 5 líneas | Alta |
| 2 - Quick sale sin asiento | Ingresos subreportados | 7 líneas | Alta |
| 3 - Price history sin tx | Historial incompleto | 3 líneas | Media |

**Total: ~15 líneas de código para cerrar los 3 gaps.**

---

## Conclusión

El sistema está diseñado a nivel de producción. Los patrones de atomicidad, guards de concurrencia, y audit trail son correctos. Los 3 gaps son omisiones puntuales (no errores de diseño) que se corrigen con adiciones mínimas al código existente.

Después de corregir estos 3 gaps, el flujo ventas→contabilidad→stock tiene **integridad completa** y el score sube a 9.5/10.
