# PostgreSQL RLS Multi-Tenant: Guía de Producción

> Mayo 2026. Investigación completa sobre mejores prácticas, estado actual de Nala,
> problemas comunes, y mantenimiento correcto.

---

## 1. Fundamentos de RLS Multi-Tenant

### Qué es

Row Level Security (RLS) es una feature de PostgreSQL (9.5+) que aplica filtros
automáticos a nivel de fila. Cada query que toca una tabla con RLS habilitado
pasa por una política que decide si la fila es visible/modificable.

```sql
-- Sin RLS: depende del desarrollador agregar WHERE
SELECT * FROM products WHERE business_id = $1;

-- Con RLS: PostgreSQL agrega el filtro automáticamente
SELECT * FROM products;
-- PostgreSQL internamente: WHERE business_id = current_business_id()
```

### Por qué es crítico

Si un desarrollador olvida un `WHERE business_id = ...` en un query, sin RLS
un tenant puede ver datos de otro. Con RLS, la base de datos **siempre** filtra,
incluso si el código tiene bugs.

### Modelos de aislamiento

| Modelo | Descripción | Costo | Aislamiento |
|--------|-------------|-------|-------------|
| **Silo** | 1 DB por tenant | Alto | Máximo |
| **Bridge** | 1 schema por tenant | Medio | Alto |
| **Pool** | 1 tabla compartida + RLS | Bajo | Medio-Alto |

**Nala usa Pool** — todas las tablas compartidas con `business_id` + RLS.
Es el modelo correcto para el target (50-100 negocios en un servidor).

---

## 2. Arquitectura Correcta (Patrón de Producción)

### Componentes necesarios

```
1. Función de contexto: current_business_id()
   ↓ lee de session variable
2. Session variable: app.current_business_id
   ↓ se setea por request
3. Middleware: set_config() al inicio, clear al final
   ↓ por cada request HTTP
4. Políticas: USING (business_id = current_business_id())
   ↓ en cada tabla con datos de tenant
5. Índices: en business_id de cada tabla
   ↓ para que el query planner use el índice
6. Rol de aplicación: sin BYPASSRLS ni SUPERUSER
   ↓ para que RLS se aplique siempre
```

### Función de contexto (STABLE, no VOLATILE)

```sql
CREATE OR REPLACE FUNCTION current_business_id()
RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_business_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;
```

- `STABLE`: le dice al planner que el resultado no cambia dentro de un statement
- `true` en `current_setting`: retorna NULL si la variable no existe (no lanza error)
- `NULLIF`: convierte string vacío a NULL (para el caso de "no hay contexto")

### Middleware per-request

```typescript
// SET al inicio del request
await db.execute(
  sql`SELECT set_config('app.current_business_id', ${businessId}, false)`
);

// CLEAR al final (en finally block)
await db.execute(
  sql`SELECT set_config('app.current_business_id', '', false)`
);
```

- `false` en `set_config`: la variable persiste para toda la conexión (no solo la transacción)
- El clear es **crítico** en connection pooling — sin él, la siguiente request
  que reutilice la conexión hereda el tenant anterior

### Políticas por tabla

```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_tenant_isolation ON products
  USING (business_id = current_business_id());
```

- Una política `FOR ALL` cubre SELECT, INSERT, UPDATE, DELETE
- `USING` filtra filas existentes (SELECT, UPDATE, DELETE)
- `WITH CHECK` valida filas nuevas/modificadas (INSERT, UPDATE)
- Si solo usas `USING`, PostgreSQL lo aplica también como `WITH CHECK`

---

## 3. Estado Actual de Nala

### Lo que está bien hecho

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Función `current_business_id()` | ✅ | STABLE, maneja NULL correctamente |
| Middleware per-request | ✅ | Set al inicio, clear en finally |
| Políticas en todas las tablas | ✅ | 34 tablas con RLS habilitado |
| Auth bypass para lookup | ✅ | `businesses` y `users` permiten SELECT cuando context es NULL |
| Public insert para orders | ✅ | Storefront checkout sin auth |
| Validación de columnas al startup | ✅ | Detecta errores de config antes de queries |
| Índices en business_id | ✅ | Todas las tablas tienen `idx_*_business` |
| Aplicación dinámica al startup | ✅ | `applyRlsPolicies()` en `db.ts` |
| Tests de RLS | ✅ | `rls.test.ts` y `rls-extended.test.ts` |

### Lo que falta o puede mejorar

| Problema | Riesgo | Solución |
|----------|--------|----------|
| **No usa `FORCE ROW LEVEL SECURITY`** | Si la app se conecta como table owner, RLS se bypasea | Agregar `FORCE` a todas las tablas |
| **Rol único `nova` (owner de tablas)** | El owner bypasea RLS por defecto | Crear rol `nova_app` sin ownership |
| **No hay `WITH CHECK` explícito en INSERT** | Un tenant podría insertar con `business_id` de otro | Agregar `WITH CHECK` a las políticas |
| **`set_config(..., false)` vs transacciones** | En transacciones largas, el context persiste correctamente, pero si hay error mid-transaction el clear puede no ejecutarse | Usar `true` (transaction-scoped) dentro de `db.transaction()` |
| **Sin auditoría de accesos RLS** | No hay log de intentos de acceso cross-tenant | Agregar logging en la función de contexto |
| **Tablas sin `business_id` directo** | `sale_return_items` depende de FK a `sale_returns` | Documentado, pero no tiene RLS propio |

---

## 4. Problemas Comunes y Cómo Evitarlos

### 4.1 BYPASSRLS del Table Owner

**Problema:** PostgreSQL permite al owner de una tabla bypasear RLS por defecto.
Si la aplicación se conecta con el mismo usuario que creó las tablas, RLS no se aplica.

**Detección:**
```sql
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'nova';
-- Si rolbypassrls = true, RLS no se aplica
```

**Solución (patrón de producción):**
```sql
-- Crear rol de aplicación sin privilegios de owner
CREATE ROLE nova_app LOGIN PASSWORD 'xxx' NOINHERIT;
GRANT USAGE ON SCHEMA public TO nova_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nova_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nova_app;

-- Forzar RLS incluso para el owner (defense in depth)
ALTER TABLE products FORCE ROW LEVEL SECURITY;
```

**Para Nala:** Actualmente usa el rol `nova` que es owner de las tablas.
Agregar `FORCE ROW LEVEL SECURITY` a todas las tablas es el fix más simple
sin cambiar la arquitectura de conexión.

### 4.2 Connection Pooling y Context Leak

**Problema:** En un pool de conexiones (pg pool, pgBouncer), una conexión
se reutiliza entre requests. Si el clear del context falla, el siguiente
request hereda el tenant anterior.

**Detección:** Logs de "wrong business_id" en queries, datos de otro tenant
apareciendo esporádicamente.

**Solución:**
1. **Always clear in finally** (Nala ya lo hace ✅)
2. **Always set before use** (Nala ya lo hace ✅)
3. **Considerar `set_config(..., true)`** para transaction-scoped (más seguro)
4. **Validar en middleware** que el context se setea correctamente

### 4.3 Performance: Full Table Scans

**Problema:** Si la columna usada en la política no tiene índice, PostgreSQL
hace sequential scan en cada query.

**Detección:**
```sql
EXPLAIN ANALYZE SELECT * FROM products;
-- Si ves "Seq Scan" en una tabla grande, falta índice
```

**Solución:**
```sql
CREATE INDEX idx_products_business ON products(business_id);
-- Para queries frecuentes, índice compuesto:
CREATE INDEX idx_products_business_active ON products(business_id, is_active);
```

**Para Nala:** Los índices ya existen en todas las tablas. ✅

### 4.4 Subqueries en Políticas

**Problema:** Políticas con subqueries se ejecutan por cada fila, multiplicando
el costo exponencialmente.

**Ejemplo malo:**
```sql
CREATE POLICY complex ON orders
  USING (EXISTS (SELECT 1 FROM user_permissions WHERE ...));
```

**Para Nala:** Las políticas son simples (`business_id = current_business_id()`).
No hay subqueries. ✅

### 4.5 SECURITY DEFINER Views

**Problema:** Las views en PostgreSQL son `SECURITY DEFINER` por defecto (pre-PG15),
lo que significa que se ejecutan con los privilegios del creador, bypasseando RLS.

**Solución (PG16+):**
```sql
CREATE VIEW my_view WITH (security_invoker = true) AS ...;
```

**Para Nala:** No usa views. ✅

### 4.6 Migraciones y RLS

**Problema:** `drizzle-kit push` y migraciones se ejecutan como superuser/owner,
lo que bypasea RLS. Si una migración inserta datos de seed, no se valida el
`business_id`.

**Solución:** Las migraciones deben ejecutarse con un rol privilegiado (correcto),
pero los datos de seed deben validarse manualmente.

**Para Nala:** Las migraciones se ejecutan antes de aplicar RLS (`migrate.mjs`
corre antes de `applyRlsPolicies()`). Correcto. ✅

---

## 5. Mantenimiento Correcto

### 5.1 Checklist de Deploy

Cada deploy debe verificar:

1. ✅ `applyRlsPolicies()` ejecuta sin errores al startup
2. ✅ Todas las tablas nuevas están en la lista `tenantPolicies`
3. ✅ Columnas de aislamiento existen (validación automática)
4. ⚠️ Verificar que no hay tablas nuevas sin `business_id`

### 5.2 Checklist de Nueva Tabla

Al crear una nueva tabla:

1. Agregar columna `business_id UUID NOT NULL REFERENCES businesses(id)`
2. Crear índice: `CREATE INDEX idx_<table>_business ON <table>(business_id)`
3. Agregar entrada en `tenantPolicies` array en `db.ts`
4. Verificar que el startup log no muestra warnings

### 5.3 Testing de RLS

```typescript
// Test pattern: verificar que tenant A no ve datos de tenant B
it('should isolate tenant data', async () => {
  // Set context to tenant A
  await db.execute(sql`SELECT set_config('app.current_business_id', ${tenantA}, false)`);
  const results = await db.select().from(products);
  
  // Verify no products from tenant B
  for (const product of results) {
    expect(product.businessId).toBe(tenantA);
  }
});
```

### 5.4 Monitoreo

Queries útiles para verificar el estado de RLS:

```sql
-- Ver todas las tablas con RLS habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;

-- Ver todas las políticas activas
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';

-- Verificar que el rol de la app no tiene BYPASSRLS
SELECT rolname, rolbypassrls, rolsuper
FROM pg_roles
WHERE rolname = 'nova';
```

### 5.5 Backup y Restore

- `pg_dump` con superuser incluye todas las políticas
- `pg_restore` recrea las políticas automáticamente
- **Pero:** `applyRlsPolicies()` las recrea al startup de todos modos (idempotente)
- Los backups de datos incluyen `business_id` en cada fila (restore es seguro)

---

## 6. Mejoras Recomendadas para Nala

### Prioridad Alta

| # | Mejora | Esfuerzo | Impacto |
|---|--------|----------|---------|
| 1 | Agregar `FORCE ROW LEVEL SECURITY` a todas las tablas | 30 min | Previene bypass si el rol es owner |
| 2 | Agregar `WITH CHECK` explícito en INSERT policies | 30 min | Previene inserción con business_id ajeno |

### Prioridad Media

| # | Mejora | Esfuerzo | Impacto |
|---|--------|----------|---------|
| 3 | Crear rol `nova_app` separado del owner | 2h | Separación de privilegios correcta |
| 4 | Usar `set_config(..., true)` dentro de transacciones | 1h | Context scoped a la transacción |
| 5 | Agregar RLS a `sale_return_items` (agregar `business_id`) | 1h | Elimina dependencia de FK para aislamiento |

### Prioridad Baja

| # | Mejora | Esfuerzo | Impacto |
|---|--------|----------|---------|
| 6 | Logging de intentos cross-tenant | 2h | Auditoría de seguridad |
| 7 | Test automatizado que verifica todas las tablas tienen RLS | 1h | Previene regresiones |
| 8 | pg_stat_statements para monitorear queries lentos por RLS | 30 min | Performance visibility |

---

## 7. Referencias

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/16/ddl-rowsecurity.html)
- [AWS: Multi-tenant data isolation with RLS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [Bytebase: RLS Footguns (Sep 2025)](https://www.bytebase.com/blog/postgres-row-level-security-footguns/)
- [Bytebase: RLS Limitations and Alternatives (May 2025)](https://www.bytebase.com/blog/postgres-row-level-security-limitations-and-alternatives/)
- [Permit.io: RLS Implementation Guide](https://www.permit.io/blog/postgres-rls-implementation-guide)
- [OneUptime: RLS for Multi-Tenant (Jan 2026)](https://oneuptime.com/blog/post/2026-01-25-row-level-security-postgresql/view)
- [Drizzle ORM: RLS Support](https://orm.drizzle.team/docs/rls)
- [Logto: Multi-tenancy with PostgreSQL (Dec 2024)](https://blog.logto.io/implement-multi-tenancy)
