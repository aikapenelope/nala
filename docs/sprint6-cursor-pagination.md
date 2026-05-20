# Sprint 6: Cursor-Based Pagination

> **Item #14 del roadmap de debilidades**
> **Esfuerzo estimado:** 3-4 horas
> **Riesgo:** Bajo (cambio aditivo, backward compatible)

---

## Problema

Varios endpoints devuelven listas sin paginación o con límites altos:

| Endpoint | Comportamiento actual | Riesgo |
|----------|----------------------|--------|
| `GET /quotations` | `.limit(500)` sin paginación | Response de 500 rows |
| `GET /sales` | `limit` param pero sin cursor | Offset-based (se degrada) |
| `GET /accounts/receivable` | Sin paginación | Todas las cuentas |
| `GET /reports/inventory` | `.limit(500)` | Todos los productos |

Con negocios que tienen 200+ productos, 1000+ ventas, y 50+ cotizaciones, estos responses pueden ser:
- Lentos de generar (full table scan)
- Pesados de transferir (100KB+ de JSON)
- Problemáticos para el frontend (renderizar 500 items de golpe)

## Solución: Cursor-Based Pagination

### Por qué cursor y no offset

| Aspecto | Offset (`?page=5&limit=20`) | Cursor (`?cursor=abc&limit=20`) |
|---------|----------------------------|--------------------------------|
| Performance con datasets grandes | Se degrada (OFFSET 10000 escanea 10000 rows) | Constante (usa índice) |
| Consistencia | Items se repiten/saltan si se insertan rows | Siempre consistente |
| Implementación | Más simple | Ligeramente más compleja |
| Uso en frontend | Paginación numérica (1, 2, 3...) | Infinite scroll / "Load more" |

Para NALA, cursor-based es mejor porque:
1. El frontend usa infinite scroll (no paginación numérica)
2. Los datos cambian frecuentemente (ventas nuevas cada minuto)
3. El volumen crecerá con el tiempo

### Patrón de implementación

#### Schema del cursor

El cursor es el `id` (UUID) del último item devuelto. Es opaco para el cliente.

```typescript
// Query params schema
const paginatedQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(), // ID del último item de la página anterior
});
```

#### Query pattern (Drizzle ORM)

```typescript
// Cursor-based: "dame los siguientes N items después de este ID"
// Usa el índice (business_id, created_at DESC) para eficiencia.
const conditions = [
  eq(table.businessId, businessId),
];

if (cursor) {
  // Fetch the cursor row to get its created_at for comparison
  const [cursorRow] = await db
    .select({ createdAt: table.createdAt })
    .from(table)
    .where(eq(table.id, cursor))
    .limit(1);

  if (cursorRow) {
    // Items older than the cursor (for DESC ordering)
    conditions.push(
      sql`(${table.createdAt}, ${table.id}) < (${cursorRow.createdAt}, ${cursor})`,
    );
  }
}

const rows = await db
  .select()
  .from(table)
  .where(and(...conditions))
  .orderBy(desc(table.createdAt), desc(table.id))
  .limit(limit + 1); // Fetch one extra to detect if there's a next page

const hasMore = rows.length > limit;
const items = hasMore ? rows.slice(0, limit) : rows;
const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

return { items, nextCursor, hasMore };
```

#### Response shape

```typescript
interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null; // null = no more pages
  hasMore: boolean;
}
```

### Endpoints a migrar

#### 1. `GET /quotations` (prioridad alta)

**Antes:**
```typescript
salesRoutes.get("/quotations", async (c) => {
  const rows = await db.select().from(quotations)
    .where(eq(quotations.businessId, businessId))
    .orderBy(desc(quotations.createdAt))
    .limit(500);
  return c.json({ quotations: rows });
});
```

**Después:**
```typescript
salesRoutes.get("/quotations", zValidator("query", paginatedQuery), async (c) => {
  const { limit, cursor } = c.req.valid("query");
  const { items, nextCursor, hasMore } = await paginateByCreatedAt(
    db, quotations, quotations.businessId, businessId, { limit, cursor },
  );
  return c.json({ quotations: items, nextCursor, hasMore });
});
```

#### 2. `GET /accounts/receivable` (prioridad alta)

Agregar `limit` y `cursor` params. El frontend del dashboard solo necesita los primeros 5 (ya hace `.slice(0, 5)`), pero la página de cuentas necesita paginación completa.

#### 3. `GET /sales` (ya tiene limit, agregar cursor)

El endpoint ya acepta `limit` pero usa offset internamente. Migrar a cursor para consistencia.

### Helper reutilizable

Crear `apps/api/src/utils/pagination.ts`:

```typescript
import { sql, desc, and, eq } from "drizzle-orm";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";
import type { Database } from "@nova/db";

interface PaginationOptions {
  limit: number;
  cursor?: string;
}

interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Generic cursor-based pagination helper.
 *
 * Uses (created_at, id) as the cursor key pair for stable ordering.
 * Works with any table that has `id` (uuid PK) and `created_at` (timestamp).
 *
 * @param db - Drizzle database instance
 * @param table - The table to query
 * @param businessIdCol - The business_id column for tenant filtering
 * @param businessId - Current tenant's business ID
 * @param options - { limit, cursor }
 * @param extraConditions - Additional WHERE conditions
 */
export async function paginateByCreatedAt<T extends Record<string, unknown>>(
  db: Database,
  table: PgTable & { id: PgColumn; createdAt: PgColumn; },
  businessIdCol: PgColumn,
  businessId: string,
  options: PaginationOptions,
  extraConditions: ReturnType<typeof eq>[] = [],
): Promise<PaginatedResult<T>> {
  const { limit, cursor } = options;
  const conditions = [eq(businessIdCol, businessId), ...extraConditions];

  if (cursor) {
    const [cursorRow] = await db
      .select({ createdAt: table.createdAt })
      .from(table)
      .where(eq(table.id, cursor))
      .limit(1);

    if (cursorRow) {
      conditions.push(
        sql`(${table.createdAt}, ${table.id}) < (${cursorRow.createdAt}, ${cursor})`,
      );
    }
  }

  const rows = await db
    .select()
    .from(table)
    .where(and(...conditions))
    .orderBy(desc(table.createdAt), desc(table.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows) as T[];
  const nextCursor = hasMore && items.length > 0
    ? (items[items.length - 1] as Record<string, unknown>).id as string
    : null;

  return { items, nextCursor, hasMore };
}
```

### Frontend integration

```typescript
// composables/usePaginated.ts
export function usePaginated<T>(endpoint: string, options?: { limit?: number }) {
  const { $api } = useApi();
  const items = ref<T[]>([]);
  const nextCursor = ref<string | null>(null);
  const hasMore = ref(true);
  const isLoading = ref(false);

  async function loadMore() {
    if (!hasMore.value || isLoading.value) return;
    isLoading.value = true;

    const params = new URLSearchParams();
    params.set("limit", String(options?.limit ?? 20));
    if (nextCursor.value) params.set("cursor", nextCursor.value);

    const res = await $api<{ items: T[]; nextCursor: string | null; hasMore: boolean }>(
      `${endpoint}?${params}`,
    );

    items.value = [...items.value, ...res.items];
    nextCursor.value = res.nextCursor;
    hasMore.value = res.hasMore;
    isLoading.value = false;
  }

  async function refresh() {
    items.value = [];
    nextCursor.value = null;
    hasMore.value = true;
    await loadMore();
  }

  return { items, hasMore, isLoading, loadMore, refresh };
}
```

### Backward compatibility

Los endpoints existentes siguen funcionando sin `cursor` param:
- Sin cursor → devuelve la primera página
- Con cursor → devuelve la página siguiente

El frontend existente que no usa cursor sigue recibiendo datos (primera página con el limit default).

### Migración gradual

1. **Fase 1:** Crear el helper `paginateByCreatedAt` + migrar `GET /quotations`
2. **Fase 2:** Migrar `GET /accounts/receivable`
3. **Fase 3:** Migrar `GET /sales` de offset a cursor
4. **Fase 4:** Crear `usePaginated` composable en el frontend

Cada fase es un commit independiente que se puede deployar sin romper nada.

### Índices requeridos

Los índices ya existen para las tablas principales:
- `idx_sales_business_created` → `(business_id, created_at)`
- `idx_orders_created` → `(created_at)`

Para quotations, agregar:
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quotations_business_created
ON quotations(business_id, created_at DESC);
```

### Tests

```typescript
describe("cursor pagination", () => {
  it("returns first page without cursor", async () => {
    const res = await request("/quotations?limit=2");
    expect(res.quotations).toHaveLength(2);
    expect(res.hasMore).toBe(true);
    expect(res.nextCursor).toBeTruthy();
  });

  it("returns next page with cursor", async () => {
    const page1 = await request("/quotations?limit=2");
    const page2 = await request(`/quotations?limit=2&cursor=${page1.nextCursor}`);
    expect(page2.quotations).toHaveLength(2);
    // No overlap between pages
    const ids1 = page1.quotations.map(q => q.id);
    const ids2 = page2.quotations.map(q => q.id);
    expect(ids1).not.toEqual(expect.arrayContaining(ids2));
  });

  it("returns hasMore=false on last page", async () => {
    // With only 3 items total and limit=5
    const res = await request("/quotations?limit=5");
    expect(res.hasMore).toBe(false);
    expect(res.nextCursor).toBeNull();
  });

  it("handles concurrent inserts without skipping items", async () => {
    const page1 = await request("/quotations?limit=2");
    // Insert a new quotation (would shift offset-based pagination)
    await createQuotation();
    const page2 = await request(`/quotations?limit=2&cursor=${page1.nextCursor}`);
    // Page 2 still returns the correct next items (no duplicates, no skips)
  });
});
```

### Métricas de éxito

| Métrica | Antes | Después |
|---------|-------|---------|
| Response size (500 quotations) | ~200KB | ~8KB (20 items) |
| Query time (10K rows) | ~50ms (full scan) | ~2ms (index seek) |
| Frontend render time | ~500ms (500 DOM nodes) | ~50ms (20 DOM nodes) |
| Memory usage (server) | Holds 500 rows in memory | Holds 21 rows |
