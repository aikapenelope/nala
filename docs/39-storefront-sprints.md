# Nova Storefront: Sprints de Implementacion

> Division detallada del roadmap (doc 38) en sprints ejecutables.
> Cada sprint = 1 PR. Cada tarea es atomica y testeable.
> Prioridad: robustez. Nada se rompe entre sprints.

---

## Sprint 1: Fundacion (Schema + API backend) ✅ COMPLETADO (PR #206)

**Objetivo:** Tablas en DB + endpoints funcionales. Sin UI.
**Completado:** Mayo 2026.

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
**Completado:** Mayo 2026.

### Entregado

- Layout `storefront` standalone (sin sidebar/header de Nova)
- Middleware: auth bypass para subdominios + redirect `/` → `/tienda`
- Composable `useCart` (localStorage: add, remove, clear, total)
- Composable `useStorefront` (fetch catalog + store-info)
- Composable `useStorefrontSeo` (meta tags dinamicos por tenant)
- Paginas: `/tienda/index`, `/tienda/cart`, `/tienda/checkout`, `/tienda/order/[id]`
- Manifest PWA dinamico por tenant (`server/routes/manifest.json.get.ts`)
- SEO: Open Graph, Twitter cards, canonical URL por subdominio
- routeRules SSR para `/tienda/**`

---

## Sprint 3: Dashboard del vendedor (gestion de pedidos)

**Objetivo:** El vendedor ve, confirma, y gestiona pedidos desde Nova.
**Estimado:** 2 dias.
**Riesgo:** Medio. Modifica sidebar/dashboard existentes + agrega logica backend (sales integration).

### Tareas

1. **Pagina `/settings/store.vue`:** Formulario completo para configurar la tienda online
   - Toggle activar/desactivar tienda
   - Metodos de pago: agregar/editar/eliminar (Pago Movil, Binance, Zinli, efectivo)
   - Delivery: toggle + fee + zonas
   - Mensaje de bienvenida y monto minimo
   - Preview del link de la tienda (`{slug}.novaincs.com`)
2. **Settings hub:** Agregar seccion "Tienda online" en `/settings/index.vue`
3. **Pagina `/orders/index.vue`:** Lista de pedidos con tabs por estado
   - Tabs: Pendientes | Confirmados | Entregados | Cancelados
   - Cada fila: nombre cliente, total, metodo pago, fecha, estado
   - Badge con conteo de pendientes en tab activo
   - Polling cada 30s para nuevos pedidos (sin WebSockets)
4. **Pagina `/orders/[id].vue`:** Detalle completo del pedido
   - Info del cliente (nombre, telefono, notas)
   - Items con cantidades y precios
   - Metodo de pago seleccionado + referencia
   - Timeline de estados (creado → confirmado → entregado)
   - Botones de accion: Confirmar / Entregar / Cancelar (con modal de confirmacion)
5. **Sidebar + BottomTabs:** Agregar "Pedidos" al nav con badge de pendientes
6. **Dashboard alert:** Composable `useOrdersBadge` que expone `pendingCount`
   - Polling al cargar dashboard (no en tiempo real)
   - Badge numerico en sidebar y bottom tabs
7. **API: Integracion orders → sales:** Al confirmar pedido, crear registro en `sales`
   - Modificar `PATCH /orders/:id/confirm` en el API
   - Crear sale con `channel: "storefront"`, items, payment
   - Buscar o crear customer por telefono
   - Registrar en activity log
8. **Typecheck + lint**

### Criterio de completado
- `/orders` muestra pedidos creados desde la tienda con tabs funcionales
- Confirmar pedido descuenta stock Y crea venta en `sales` (canal: storefront)
- La venta aparece en reportes y contabilidad automaticamente
- `/settings/store` permite configurar datos de Pago Movil/Binance/Zinli
- Badge en sidebar muestra conteo de pedidos pendientes
- Cancelar pedido pide motivo y actualiza estado

### Notas de implementacion

**Orden de ejecucion recomendado:**
1. Settings store (para que el vendedor pueda activar su tienda)
2. Orders list + detail (UI de gestion)
3. Sidebar/badge (navegacion)
4. API integration orders → sales (backend, mas riesgo)

**Riesgo principal:** La integracion con `sales` modifica el endpoint `PATCH /orders/:id/confirm`.
Debe crear un registro en `sales` + `sale_items` + `sale_payments` dentro de la misma transaccion
que descuenta stock. Si falla la creacion de la venta, el pedido no se confirma (atomicidad).

**Polling vs WebSockets:** Se usa polling simple (fetch cada 30s en la pagina de orders)
porque no hay infraestructura de WebSockets. Suficiente para el volumen actual.
En el futuro se puede migrar a Server-Sent Events o WebSockets.

---

## Sprint 4: Upload de captures (MinIO)

**Objetivo:** El cliente puede subir comprobante de pago. El vendedor lo ve.
**Estimado:** 1 dia.
**Riesgo:** Medio. Requiere MinIO configurado.

### Tareas

1. **Config MinIO:** Cliente S3 en el API (endpoint, access key, secret key via env vars)
2. **Endpoint publico:** `POST /catalog/:slug/orders/:id/proof` (multipart upload, max 5MB, JPEG/PNG/WebP)
3. **Almacenamiento:** Guardar en bucket `order-proofs/{businessId}/{orderId}.{ext}`
4. **Actualizar order:** Setear `payment_proof_url` en la tabla orders
5. **UI checkout:** Agregar campo de upload en `/tienda/checkout.vue` (despues de pagar)
6. **UI dashboard:** Mostrar imagen del capture en `/orders/[id].vue`
7. **Rate limit:** 3 uploads/min por IP
8. **Typecheck + lint**

### Criterio de completado
- Cliente puede subir imagen en el checkout
- Vendedor ve la imagen en el detalle del pedido
- Archivos se guardan en MinIO correctamente

---

## Sprint 5: Pulido y hardening

**Objetivo:** Produccion-ready. Edge cases, UX, performance.
**Estimado:** 1 dia.
**Riesgo:** Bajo. Solo mejoras sobre lo existente.

### Tareas

1. **Cache Redis:** Cachear catalog y store-info (1-5 min TTL)
2. **Validacion robusta:** Stock check atomico en POST orders (dentro de transaccion)
3. **Empty states:** Tienda sin productos, tienda desactivada, sin metodos de pago
4. **Error handling:** Mensajes claros en cada paso del checkout
5. **Mobile UX:** Verificar flujo completo en movil (3G simulado)
6. **Tasa BCV:** Mostrar precios en Bs en la tienda (usando tasa del vendedor)
7. **Pedido duplicado:** Prevenir doble-submit con debounce + idempotency key
8. **Activity log:** Registrar acciones de pedidos (created, confirmed, delivered, cancelled)
9. **Tests E2E:** Flujo completo: crear pedido publico → confirmar en dashboard → stock descontado

### Criterio de completado
- Flujo completo funciona sin errores en movil
- No hay race conditions en stock
- Performance < 3s en 3G
- Tests pasan

---

## Orden de ejecucion

```
Sprint 1 ✅ ──► Sprint 2 ✅ ──► Sprint 3 ──► Sprint 4 ──► Sprint 5
 (DB+API)       (Tienda)       (Dashboard)   (Upload)    (Pulido)
  DONE           DONE           2 dias        1 dia       1 dia
```

**Restante: 4 dias de trabajo.**

Cada sprint es un PR independiente que se puede mergear y deployar sin romper nada. El sistema existente (POS, inventario, reportes) sigue funcionando identico durante toda la implementacion.

---

## Notas tecnicas importantes

### Routing por subdominio (implementado en Sprint 2)

El `auth.global.ts` detecta el tenant via `useTenant()` y bypasea auth:

```typescript
// En auth.global.ts:
const { hasTenant } = useTenant();
if (hasTenant.value) {
  return; // Storefront, no requiere auth
}
```

El middleware `storefront-redirect.global.ts` redirige `/` → `/tienda` en subdominios
y bloquea acceso a rutas del dashboard desde subdominios de tenant.

Las paginas de `/tienda/*` usan el layout `storefront` que no tiene sidebar, header de Nova, ni nada del dashboard. Es una experiencia completamente separada visualmente.

### Stock: cuando se descuenta

- **POS (venta directa):** Stock se descuenta al crear la venta (inmediato)
- **Storefront (pedido online):** Stock se descuenta al CONFIRMAR el pedido (no al crearlo)

Razon: Un pedido online es una intencion de compra. El pago no es instantaneo (el cliente tiene que hacer transferencia/pago movil). Si descontamos stock al crear el pedido, un cliente podria "reservar" todo el inventario sin pagar.

### Relacion orders ↔ sales

Cuando el vendedor confirma un pedido, se crea un registro en `sales` con:
- `channel: "storefront"`
- `customerId`: se busca o crea por telefono
- Items y pagos normales

Esto hace que los reportes, contabilidad, y estadisticas incluyan automaticamente las ventas online sin codigo adicional.
