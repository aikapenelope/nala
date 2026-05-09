# Nova Storefront: Sprints de Implementacion

> Division detallada del roadmap (doc 38) en sprints ejecutables.
> Cada sprint = 1 PR. Cada tarea es atomica y testeable.
> Prioridad: robustez. Nada se rompe entre sprints.

---

## Sprint 1: Fundacion (Schema + API backend)

**Objetivo:** Tablas en DB + endpoints funcionales. Sin UI.
**Estimado:** 1 dia.
**Riesgo:** Bajo. Solo agrega, no modifica nada existente.

### Tareas

1. **Migracion 0014:** Crear tablas `orders` y `store_settings` con indices y RLS
2. **Drizzle schema:** Agregar `orders` y `storeSettings` al schema.ts
3. **API publica:** `GET /catalog/:slug/store-info` (metodos de pago del vendedor)
4. **API publica:** `POST /catalog/:slug/orders` (crear pedido, validar stock, rate limit)
5. **API protegida:** `GET /api/orders` (listar pedidos con filtros status/fecha)
6. **API protegida:** `GET /api/orders/:id` (detalle de pedido)
7. **API protegida:** `PATCH /api/orders/:id/confirm` (confirmar + descontar stock)
8. **API protegida:** `PATCH /api/orders/:id/deliver` (marcar entregado)
9. **API protegida:** `PATCH /api/orders/:id/cancel` (cancelar con motivo)
10. **API protegida:** `GET /api/store-settings` + `PATCH /api/store-settings`
11. **Seed:** Crear store_settings de ejemplo para el negocio de prueba
12. **Typecheck + lint**

### Criterio de completado
- `POST /catalog/bodega-don-pedro/orders` crea un pedido en DB
- `GET /api/orders` devuelve pedidos del tenant
- `PATCH /api/orders/:id/confirm` descuenta stock correctamente
- Typecheck y lint pasan

---

## Sprint 2: Tienda PWA del cliente (frontend publico)

**Objetivo:** El cliente puede ver catalogo, armar carrito, y hacer checkout.
**Estimado:** 2-3 dias.
**Riesgo:** Medio. Nuevo routing por subdominio, layout nuevo.

### Tareas

1. **Layout `storefront`:** Layout standalone para la tienda (sin sidebar/header de Nova)
2. **Middleware update:** `auth.global.ts` detecta tenantSlug y bypasea auth
3. **Redirect por subdominio:** Si hay tenantSlug, redirigir `/` a `/tienda`
4. **Composable `useCart`:** Carrito en localStorage (add, remove, clear, total)
5. **Composable `useStorefront`:** Fetch catalog + store-info, estado del tenant
6. **Pagina `/tienda/index.vue`:** Catalogo con boton "Agregar al carrito" por producto
7. **Pagina `/tienda/cart.vue`:** Resumen del carrito, editar cantidades, boton "Pagar"
8. **Pagina `/tienda/checkout.vue`:** Formulario (nombre, telefono), datos de pago del vendedor, boton "Confirmar pedido"
9. **Logica de checkout:** POST al API, generar wa.me link con resumen, redirigir a WhatsApp
10. **Pagina `/tienda/order/[id].vue`:** Confirmacion post-pedido ("Pedido enviado, contacta al vendedor")
11. **Manifest dinamico:** `server/routes/manifest.json.get.ts` genera manifest por tenant
12. **SEO:** Meta tags, og:image, titulo dinamico por tienda
13. **Typecheck + lint + verificar en browser**

### Criterio de completado
- `bodega.novaincs.com` (o localhost con subdominio simulado) muestra la tienda
- Se puede agregar productos al carrito
- Checkout muestra datos de pago y envia pedido
- WhatsApp se abre con resumen pre-armado
- La pagina es installable como PWA

---

## Sprint 3: Dashboard del vendedor (gestion de pedidos)

**Objetivo:** El vendedor ve, confirma, y gestiona pedidos desde Nova.
**Estimado:** 1-2 dias.
**Riesgo:** Bajo. Solo paginas nuevas en el dashboard existente.

### Tareas

1. **Pagina `/orders/index.vue`:** Lista de pedidos con tabs (pendientes, confirmados, entregados, cancelados)
2. **Pagina `/orders/[id].vue`:** Detalle del pedido (items, cliente, metodo de pago, capture si existe)
3. **Acciones en detalle:** Botones confirmar/entregar/cancelar con confirmacion
4. **Pagina `/settings/store.vue`:** Formulario para configurar metodos de pago (Pago Movil, Binance, Zinli)
5. **Settings store:** Toggle activar/desactivar tienda, delivery fee, mensaje de bienvenida
6. **Sidebar:** Agregar "Pedidos" al nav con badge de pendientes
7. **Dashboard alert:** Mostrar alerta cuando hay pedidos pendientes sin confirmar
8. **Integracion con ventas:** Al confirmar pedido, crear registro en `sales` (canal: storefront)
9. **Typecheck + lint**

### Criterio de completado
- `/orders` muestra pedidos creados desde la tienda
- Confirmar pedido descuenta stock y crea venta
- `/settings/store` permite configurar datos de Pago Movil/Binance
- Badge en sidebar muestra conteo de pedidos pendientes

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
Sprint 1 ──► Sprint 2 ──► Sprint 3 ──► Sprint 4 ──► Sprint 5
 (DB+API)    (Tienda)    (Dashboard)   (Upload)    (Pulido)
  1 dia       2-3 dias    1-2 dias      1 dia       1 dia
```

**Total: 6-8 dias de trabajo.**

Cada sprint es un PR independiente que se puede mergear y deployar sin romper nada. El sistema existente (POS, inventario, reportes) sigue funcionando identico durante toda la implementacion.

---

## Notas tecnicas importantes

### Routing por subdominio (como funciona sin romper nada)

El `auth.global.ts` actual protege todas las rutas excepto las publicas. Para la tienda:

```typescript
// En auth.global.ts, agregar al inicio:
const tenantSlug = useState("tenant-slug");
if (tenantSlug.value) {
  // Estamos en un subdominio de tienda, no requiere auth
  return;
}
```

Las paginas de `/tienda/*` usan un layout diferente (`storefront`) que no tiene sidebar, header de Nova, ni nada del dashboard. Es una experiencia completamente separada visualmente.

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
