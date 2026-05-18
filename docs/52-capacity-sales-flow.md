# Capacidad del Sistema y Flujo de Ventas

> Mayo 2026. Documentación de capacidad, flujo contable, y fixes aplicados.

---

## 1. Flujo Completo de una Venta

### Transacción atómica (todo o nada)

```
POST /api/sales (POS)  o  PATCH /orders/:id/confirm (Storefront)
  │
  ├─ 1. INSERT sale (sales)
  ├─ 2. INSERT sale_items (sale_items)
  ├─ 3. INSERT sale_payments (sale_payments)
  ├─ 4. UPDATE products SET stock = stock - qty WHERE stock >= qty
  │      └─ Si stock insuficiente → ROLLBACK todo
  ├─ 5. Si fiado → INSERT accounts_receivable
  ├─ 6. INSERT accounting_entries (débito caja, crédito ingresos)
  │      └─ Si cuentas no existen → WARNING log (no bloquea la venta)
  ├─ 7. INSERT stock_movements (audit trail)
  ├─ 8. UPDATE customers (stats: totalPurchases, totalSpent, lastPurchaseAt)
  └─ 9. INSERT activity_log
```

### Asiento contable generado

| Campo | Valor |
|-------|-------|
| Débito | Cuenta 1101 (Caja/Efectivo) |
| Crédito | Cuenta 4101 (Ingresos por ventas) |
| Monto | Total de la venta en USD |
| Referencia | sale.id |

Las cuentas 1101 y 4101 se crean automáticamente durante el onboarding.
Si no existen (negocio creado antes del sistema contable), la venta se
registra normalmente pero sin asiento — el log muestra un WARNING.

---

## 2. Fixes Aplicados

### Fix 1: Pool de conexiones explícito (20 conexiones)

**Antes:** `postgres(url)` — default de 10 conexiones.
**Después:** `postgres(url, { max: 20, idle_timeout: 30, connect_timeout: 10 })`

**Impacto:** Duplica la capacidad de requests concurrentes. Con 10 conexiones,
el sistema se saturaba a ~50 requests simultáneos. Con 20, soporta ~100.

### Fix 2: Warning log cuando faltan cuentas contables

**Antes:** Si las cuentas 4101/1101 no existían, el asiento se omitía silenciosamente.
**Después:** Se emite `console.warn` con el ID de la venta y qué cuenta falta.

**Impacto:** Visibilidad operacional. El comerciante no se ve afectado (la venta
se registra igual), pero el operador puede detectar negocios sin cuentas contables.

---

## 3. Capacidad del Sistema

### Infraestructura real (3 servidores separados)

| Servidor | Tipo | RAM | CPU | Rol |
|----------|------|-----|-----|-----|
| `control-plane` | CX33 | 8GB | 4 vCPU | Coolify (orquestador, CI/CD) |
| `app-plane-a` | CX33 | 8GB | 4 vCPU | Apps: Nova + whabi + docflow + aurora + propi |
| `data-plane` | CX33 | 8GB | 4 vCPU | PostgreSQL 16 + PgBouncer + Redis 7 + MinIO |

Conectados por red privada Hetzner (10.0.1.0/24). Nova accede a DB en 10.0.1.20:5432.

### Configuración del data-plane (compartido entre 5 proyectos)

| Servicio | Config | Detalle |
|----------|--------|---------|
| PostgreSQL | `max_connections=200` | Compartido entre 5 proyectos |
| PostgreSQL | `shared_buffers=2GB` | 25% de RAM (recomendado) |
| PostgreSQL | `effective_cache_size=4GB` | Para query planner |
| PostgreSQL | `work_mem=64MB` | Por operación de sort/hash |
| PgBouncer | `MAX_CLIENT_CONN=500`, pool=40 | Nova NO usa PgBouncer (RLS) |
| Redis | `maxmemory=1GB`, noeviction | DB 4 para Nova |
| MinIO | Sin límite de storage | Disco del servidor |

### Pool de Nova vs otros proyectos

PostgreSQL tiene 200 conexiones. Distribución estimada:

| Proyecto | Pool | Conexiones usadas |
|----------|------|-------------------|
| whabi (via PgBouncer) | 40 pool | ~10-20 reales |
| docflow (via PgBouncer) | 40 pool | ~10-20 reales |
| aurora (via PgBouncer) | 40 pool | ~5-10 reales |
| propi (via PgBouncer) | 40 pool | ~5-10 reales |
| **Nova (directo, sin PgBouncer)** | **20** | **20 máximo** |
| Reserva sistema | — | ~10 |
| **Total máximo** | — | **~75-100 de 200** |

**El pool de 20 para Nova es seguro.** Hay ~100 conexiones libres.
Nova usa conexión directa (no PgBouncer) porque `set_config()` para RLS
requiere persistencia a nivel de sesión, que PgBouncer en modo transaction
no garantiza.

### Capacidad por componente

| Recurso | Límite | Cuello de botella |
|---------|--------|-------------------|
| Pool DB Nova | 20 conexiones directas | ~100 requests concurrentes |
| PostgreSQL total | 200 conexiones | Compartido con 4 proyectos más |
| Redis (DB 4) | ~200MB de 1GB | ~500 catálogos cacheados |
| App-plane RAM | 8GB compartido | Nova + 4 proyectos |
| App-plane CPU | 4 vCPU compartido | Nova + 4 proyectos |
| Data-plane RAM | 8GB (PG 2GB + Redis 1GB + OS) | ~5GB libre para cache OS |

### Estimación de usuarios

#### Negocios (comerciantes con dashboard)

| Escenario | Negocios | Justificación |
|-----------|----------|---------------|
| **Cómodo** | 100-150 | Pool 20, PG con 2GB shared_buffers, data-plane dedicado |
| **Límite** | 200-250 | Requiere monitoreo, posible contención en app-plane |
| **Saturación** | 300+ | Necesita app-plane-b o upgrade a CX42 |

#### Clientes del storefront (compradores)

| Escenario | Usuarios simultáneos | Justificación |
|-----------|---------------------|---------------|
| **Cómodo** | 400-600 | Redis cache 1 min, requests ligeros, data-plane separado |
| **Límite** | 800-1000 | App-plane CPU compartido con otros proyectos |
| **Saturación** | 1500+ | Necesita CDN o segundo app-plane |

#### Pedidos por hora

| Escenario | Pedidos/hora | Justificación |
|-----------|-------------|---------------|
| **Normal** | 100-200 | Transacciones ~50ms, pool de 20 |
| **Pico** | 300-500 | PG max_connections=200 da margen |
| **Máximo teórico** | 700+ | Limitado por locks de stock |

### Perfil típico de uso

Para el target de Nala (comerciante venezolano, 20-200 productos):

```
1 negocio típico genera:
  - 20-50 ventas/día (POS)
  - 5-15 pedidos/día (storefront)
  - 100-300 visitas/día al storefront
  - 1-5 uploads de imagen/semana
  - 1 usuario dashboard activo

100 negocios generan:
  - 2,000-5,000 ventas/día
  - 500-1,500 pedidos/día
  - 10,000-30,000 visitas storefront/día
  - ~50 requests/segundo promedio
  - ~150 requests/segundo en pico (mediodía)
```

**Con la infraestructura actual (CX32 + pool 20), el sistema soporta
cómodamente 80-100 negocios con sus clientes.**

---

## 4. Señales de que necesitas escalar

| Señal | Métrica | Acción |
|-------|---------|--------|
| Latencia > 500ms en queries | `pg_stat_statements` | Aumentar pool o RAM |
| Pool exhaustion (connection wait) | Logs de postgres.js | Aumentar `max` a 30 |
| CPU > 80% sostenido | `htop` | Mover a CX42 (8 vCPU) |
| RAM > 7GB | `free -m` | Mover PostgreSQL a servidor dedicado |
| Disco > 60GB | `df -h` | Limpiar imágenes antiguas o expandir disco |
| Redis evictions | `redis-cli info memory` | Aumentar maxmemory |

---

## 5. Plan de Escalamiento (cuando sea necesario)

### Fase 1: Vertical (sin cambios de arquitectura)

- Upgrade app-plane-a a CX42 (8 vCPU, 16GB RAM): ~$30/mes
- Upgrade data-plane a CX42 si PG necesita más RAM
- Pool Nova a 30 conexiones (aún dentro de max_connections=200)

### Fase 2: Separación horizontal de apps

- Activar `app-plane-b` (ya previsto en la infra con `appPlaneBEnabled`)
- Mover Nova a app-plane-b dedicado (sin compartir con otros proyectos)
- CDN (Cloudflare) para imágenes y assets estáticos del storefront

### Fase 3: Escalar data-plane

- Upgrade data-plane a CX52 (16 vCPU, 32GB RAM)
- PostgreSQL shared_buffers a 8GB
- max_connections a 400
- Considerar read replicas para reportes pesados
