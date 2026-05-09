# Nova Storefront: Sprints de Implementacion

> Division detallada del roadmap (doc 38) en sprints ejecutables.
> Cada sprint = 1 PR. Cada tarea es atomica y testeable.
> Prioridad: robustez. Nada se rompe entre sprints.
>
> **ESTADO: FEATURE COMPLETO** - Todos los sprints implementados y mergeados (Mayo 2026).

---

## Sprint 1: Fundacion (Schema + API backend) ✅ COMPLETADO (PR #206)

**Objetivo:** Tablas en DB + endpoints funcionales. Sin UI.

### Entregado

- Migracion 0014: tablas `orders` y `store_settings` con indices y RLS
- Drizzle schema actualizado
- API publica: `GET /catalog/:slug/store-info`, `POST /catalog/:slug/orders`
- API protegida: orders CRUD (list, detail, confirm, deliver, cancel) + store-settings
- Stock validation atomica en confirm
- WhatsApp link auto-generado en POST orders

---

## Sprint 2: Tienda PWA del cliente (frontend publico) ✅ COMPLETADO (PR #207)

**Objetivo:** El cliente puede ver catalogo, armar carrito, y hacer checkout.

### Entregado

- Layout `storefront` standalone (sin sidebar/header de Nova)
- Middleware: auth bypass para subdominios + redirect `/` → `/tienda`
- Composable `useCart` (localStorage: add, remove, clear, total)
- Composable `useStorefront` (fetch catalog + store-info + exchangeRate)
- Composable `useStorefrontSeo` (meta tags dinamicos por tenant)
- Paginas: `/tienda/index`, `/tienda/cart`, `/tienda/checkout`, `/tienda/order/[id]`
- Manifest PWA dinamico por tenant (`server/routes/manifest.json.get.ts`)
- SEO: Open Graph, Twitter cards, canonical URL por subdominio
- routeRules SSR para `/tienda/**`

---

## Sprint 3: Dashboard del vendedor (gestion de pedidos) ✅ COMPLETADO (PR #208)

**Objetivo:** El vendedor ve, confirma, y gestiona pedidos desde Nova.

### Entregado

- `/settings/store`: config completa (toggle, metodos de pago, delivery, personalizacion, preview link)
- `/orders`: lista con tabs por estado (pendientes/confirmados/entregados/cancelados) + polling 30s
- `/orders/[id]`: detalle con timeline + acciones (confirmar/entregar/cancelar con modal)
- Sidebar + BottomTabs: "Pedidos" con badge numerico de pendientes
- Composable `useOrdersBadge` para conteo reactivo
- API: `PATCH /orders/:id/confirm` crea sale + sale_items + sale_payments atomicamente
- API: busca o crea customer por telefono al confirmar
- Settings hub: seccion "Tienda online" agregada

---

## Sprint 4: Upload de captures (MinIO) ✅ COMPLETADO (PR #209)

**Objetivo:** El cliente puede subir comprobante de pago. El vendedor lo ve.

### Entregado

- `services/storage.ts`: cliente S3 para MinIO, auto-creacion de bucket
- `POST /catalog/:slug/orders/:id/proof`: upload publico (5MB max, JPEG/PNG/WebP)
- `GET /api/orders/:id/proof-url`: presigned URL protegida (expira 1h)
- `/tienda/order/[id].vue`: UI de upload con preview + progreso + confirmacion
- `/orders/[id].vue`: thumbnail del comprobante + modal fullscreen
- Indicador visual cuando no hay comprobante en pedidos pendientes
- Rate limit: 3 uploads/min por IP

---

## Sprint 5A: Performance y robustez backend ✅ COMPLETADO (PR #210)

**Objetivo:** Resolver problemas criticos de concurrencia y performance.

### Entregado

- Cache Redis: catalog (1min TTL) + store-info (5min TTL)
- Stock check atomico: `SELECT ... FOR UPDATE` en transaccion (previene race conditions)
- Idempotency key: previene pedidos duplicados por doble-click (Redis, 10min TTL)
- Activity log: `order_created` en endpoint publico
- Rate limit: 3/min por IP en upload de comprobantes

---

## Sprint 5B: UX polish ✅ COMPLETADO (PR #211)

**Objetivo:** Mejorar la experiencia del cliente en la tienda publica.

### Entregado

- Tasa BCV: catalog API incluye `exchangeRate` del vendedor, tienda muestra `$5.00 / Bs. 432.40`
- Empty state: tienda desactivada (icono + mensaje claro)
- Empty state: sin productos (icono + mensaje)
- Empty state: sin metodos de pago en checkout (aviso + sugerencia WhatsApp)
- Filtro sin resultados: "No hay productos en esta categoria" + boton "Ver todos"

---

## Sprint 5C: Tests + auto-cancelacion ✅ COMPLETADO (PR #212)

**Objetivo:** Proteccion contra pedidos abandonados + tests de integracion.

### Entregado

- `utils/auto-cancel.ts`: cancela pedidos `pending` con >24h automaticamente
- `POST /api/orders/auto-cancel`: endpoint para trigger manual o cron
- `storefront-e2e.test.ts`: test E2E completo (crear orden → confirmar → stock → sale → auto-cancel)

---

## Orden de ejecucion (COMPLETADO)

```
Sprint 1 ✅ ──► Sprint 2 ✅ ──► Sprint 3 ✅ ──► Sprint 4 ✅ ──► Sprint 5A ✅ ──► Sprint 5B ✅ ──► Sprint 5C ✅
 (DB+API)       (Tienda)       (Dashboard)    (Upload)     (Hardening)    (UX)         (Tests)
  PR #206        PR #207        PR #208        PR #209      PR #210        PR #211      PR #212
```

**FEATURE COMPLETO. 7 PRs mergeados. 0 pendientes.**

---

## Notas tecnicas importantes

### Routing por subdominio

El `auth.global.ts` detecta el tenant via `useTenant()` y bypasea auth:

```typescript
const { hasTenant } = useTenant();
if (hasTenant.value) {
  return; // Storefront, no requiere auth
}
```

El middleware `storefront-redirect.global.ts` redirige `/` → `/tienda` en subdominios
y bloquea acceso a rutas del dashboard desde subdominios de tenant.

### Stock: cuando se descuenta

- **POS (venta directa):** Stock se descuenta al crear la venta (inmediato)
- **Storefront (pedido online):** Stock se descuenta al CONFIRMAR el pedido (no al crearlo)

Razon: Un pedido online es una intencion de compra. El pago no es instantaneo. Si descontamos stock al crear el pedido, un cliente podria "reservar" todo el inventario sin pagar. Pedidos sin confirmar se auto-cancelan a las 24h.

### Concurrencia y atomicidad

- Stock check usa `SELECT ... FOR UPDATE` dentro de transaccion (previene race conditions)
- Idempotency key previene pedidos duplicados (Redis, 10min TTL)
- Confirmar pedido es atomico: stock + order status + sale + items + payments en una transaccion

### Relacion orders → sales

Cuando el vendedor confirma un pedido:
1. Se descuenta stock (atomico, con lock)
2. Se busca o crea customer por telefono
3. Se crea registro en `sales` con `channel: "storefront"`
4. Se crean `sale_items` y `sale_payments`

Esto hace que reportes, contabilidad, y estadisticas incluyan automaticamente las ventas online.

### Tasa de cambio

- El vendedor configura su tasa en `/settings/exchange-rate`
- La tienda muestra precios en Bs usando esa tasa (`$5.00 / Bs. 432.40`)
- La tasa se cachea junto con el catalogo (1min TTL en Redis)
- Si no hay tasa configurada, solo se muestra USD

### Auto-cancelacion

- Pedidos `pending` con >24h se cancelan automaticamente
- Trigger: `POST /api/orders/auto-cancel` (cron o manual)
- Motivo: "Auto-cancelado: sin confirmacion en 24 horas"

### Variables de entorno requeridas (storefront)

```
MINIO_ENDPOINT=http://10.0.1.20:9000
MINIO_ACCESS_KEY=<access-key>
MINIO_SECRET_KEY=<secret-key>
MINIO_BUCKET=order-proofs
REDIS_URL=redis://10.0.1.20:6379
```
