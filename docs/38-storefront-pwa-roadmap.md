# Nova Storefront: Roadmap de Implementacion

> Tienda PWA por subdominio con checkout WhatsApp + Pago Movil/Binance.
> Fecha: Mayo 2026. Prioridad: robustez sobre velocidad.

---

## 1. Concepto

Cada vendedor en Nova obtiene una tienda publica en `{slug}.novaincs.com` donde sus clientes pueden:

1. Ver el catalogo de productos (ya existe)
2. Agregar productos a un carrito
3. Ver los datos de pago del vendedor (Pago Movil, Binance, Zinli)
4. Pagar externamente y subir el capture/screenshot
5. Enviar pedido por WhatsApp con resumen pre-armado
6. El vendedor ve el pedido en su dashboard y confirma

**Diferenciador clave:** El inventario del POS y la tienda online son el mismo. Una venta en la tienda descuenta stock igual que una venta en el mostrador.

---

## 2. Como la PWA instalada sabe cual tienda cargar

### Problema
Cuando un cliente instala la PWA desde `bodega.novaincs.com`, y luego la abre desde el home screen, como sabe que debe cargar la tienda de "Bodega Don Pedro" y no otra?

### Solucion: Subdomain = Scope de la PWA

Cada subdominio es una PWA independiente con su propio manifest:

```
bodega.novaincs.com/manifest.json
{
  "name": "Bodega Don Pedro",
  "short_name": "Don Pedro",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#1e40af",
  "icons": [...]
}
```

**Como funciona:**

1. El cliente abre `bodega.novaincs.com` en Chrome/Safari
2. El browser detecta el manifest y ofrece "Agregar a pantalla de inicio"
3. El manifest tiene `start_url: "/"` y `scope: "/"`
4. Cuando el cliente abre la PWA instalada, el browser navega a `bodega.novaincs.com/`
5. El server middleware de Nuxt (`tenant.ts`) detecta el subdominio `bodega`
6. Nuxt renderiza la tienda de ese tenant

**Cada subdominio = una PWA separada.** No hay confusion. Si el cliente instala 3 tiendas, tiene 3 iconos en su home screen, cada uno apuntando a un subdominio diferente.

### Implementacion en Nuxt

El manifest se genera dinamicamente por tenant via un server route:

```typescript
// server/routes/manifest.json.get.ts
export default defineEventHandler((event) => {
  const slug = event.context.tenantSlug;
  if (!slug) return { /* manifest default de novaincs.com */ };

  // Fetch business name from DB or cache
  const business = await getBusinessBySlug(slug);

  return {
    name: business.name,
    short_name: business.name.slice(0, 12),
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: "#1e40af",
    background_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
});
```

El `<link rel="manifest">` en el HTML apunta a este endpoint dinamico.

---

## 3. Arquitectura de routing

```
Peticion HTTP
    │
    ▼
server/middleware/tenant.ts (ya existe)
    │
    ├── tenantSlug = null → App del vendedor (dashboard, POS)
    │   └── Rutas: /, /sales, /inventory, /settings, etc.
    │
    └── tenantSlug = "bodega" → Tienda publica del cliente
        └── Rutas: /, /cart, /checkout, /order/:id
```

### Como separar las rutas

Opcion elegida: **routeRules + layout condicional**

```typescript
// nuxt.config.ts
routeRules: {
  '/tienda/**': { ssr: true },  // Tienda siempre SSR para SEO
}
```

El middleware global de auth detecta si estamos en un subdominio de tenant:
- Si `tenantSlug` existe → no requiere auth, renderiza tienda
- Si `tenantSlug` es null → flujo normal de auth (dashboard)

Las paginas de la tienda viven en `app/pages/tienda/`:
```
app/pages/tienda/
├── index.vue        → Catalogo con carrito
├── cart.vue         → Resumen del carrito
├── checkout.vue     → Datos de pago + upload capture
└── order/[id].vue   → Confirmacion del pedido
```

---

## 4. Schema de base de datos

### Nueva tabla: `orders`

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),

  -- Cliente (sin cuenta, datos minimos)
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_notes TEXT,

  -- Pedido
  items JSONB NOT NULL DEFAULT '[]',
  -- items: [{ productId, name, price, quantity, lineTotal }]

  subtotal NUMERIC(12,2) NOT NULL,
  delivery_fee NUMERIC(12,2) DEFAULT '0',
  total NUMERIC(12,2) NOT NULL,

  -- Pago
  payment_method TEXT NOT NULL, -- 'pago_movil', 'binance', 'zinli', 'efectivo'
  payment_proof_url TEXT,       -- URL del capture en MinIO
  payment_reference TEXT,       -- Referencia manual (nro transferencia)

  -- Estado
  status TEXT NOT NULL DEFAULT 'pending',
  -- pending -> confirmed -> delivered | cancelled

  -- Metadata
  exchange_rate NUMERIC(12,4),  -- Tasa BCV al momento del pedido
  total_bs NUMERIC(12,2),       -- Total en Bs
  channel TEXT NOT NULL DEFAULT 'storefront',

  confirmed_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancel_reason TEXT,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_business ON orders(business_id);
CREATE INDEX idx_orders_status ON orders(business_id, status);
CREATE INDEX idx_orders_created ON orders(created_at);
```

### Nueva tabla: `store_settings`

```sql
CREATE TABLE store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES businesses(id),

  -- Activacion
  store_enabled BOOLEAN NOT NULL DEFAULT false,

  -- Metodos de pago (JSON array)
  -- [{ method: "pago_movil", label: "Pago Movil", details: { bank: "Banesco", phone: "0412...", ci: "V-12345" } }]
  payment_methods JSONB NOT NULL DEFAULT '[]',

  -- Delivery
  delivery_enabled BOOLEAN NOT NULL DEFAULT false,
  delivery_fee NUMERIC(12,2) DEFAULT '0',
  delivery_zones TEXT,  -- Descripcion de zonas de delivery

  -- Personalizacion
  welcome_message TEXT,
  min_order_amount NUMERIC(12,2) DEFAULT '0',

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

### RLS

Ambas tablas necesitan RLS policy identica a las demas:
```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_tenant ON orders
  USING (business_id = current_setting('app.current_business_id')::uuid);

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_settings_tenant ON store_settings
  USING (business_id = current_setting('app.current_business_id')::uuid);
```

---

## 5. API Endpoints

### Publicos (sin auth, con rate limit)

| Metodo | Ruta | Funcion |
|--------|------|---------|
| GET | /catalog/:slug | Catalogo existente (ya funciona) |
| GET | /catalog/:slug/store-info | Metodos de pago + config delivery |
| POST | /catalog/:slug/orders | Crear pedido (valida stock, guarda items) |
| POST | /catalog/:slug/orders/:id/proof | Upload capture de pago |

### Protegidos (auth + tenant)

| Metodo | Ruta | Funcion |
|--------|------|---------|
| GET | /api/orders | Listar pedidos (filtros: status, fecha) |
| GET | /api/orders/:id | Detalle de pedido |
| PATCH | /api/orders/:id/confirm | Confirmar pago (descuenta stock) |
| PATCH | /api/orders/:id/deliver | Marcar como entregado |
| PATCH | /api/orders/:id/cancel | Cancelar pedido |
| GET | /api/store-settings | Obtener config de tienda |
| PATCH | /api/store-settings | Actualizar config de tienda |

---

## 6. Flujo detallado del checkout

```
CLIENTE                          SERVIDOR                         VENDEDOR
  │                                │                                │
  │ 1. Agrega productos           │                                │
  │    (localStorage)             │                                │
  │                                │                                │
  │ 2. GET /catalog/slug/store-info│                                │
  │ ◄──────────────────────────────│                                │
  │    { paymentMethods, delivery }│                                │
  │                                │                                │
  │ 3. Muestra datos de pago      │                                │
  │    (CI, telefono, banco)      │                                │
  │                                │                                │
  │ 4. Cliente paga externamente  │                                │
  │    (abre app banco/Binance)   │                                │
  │                                │                                │
  │ 5. POST /catalog/slug/orders  │                                │
  │ ──────────────────────────────►│                                │
  │    { items, name, phone,      │                                │
  │      paymentMethod }          │                                │
  │ ◄──────────────────────────────│                                │
  │    { orderId, waLink }        │ 6. Pedido guardado (pending)   │
  │                                │ ──────────────────────────────►│
  │ 7. POST .../orders/:id/proof  │    Alerta en dashboard         │
  │ ──────────────────────────────►│                                │
  │    (multipart: imagen)        │                                │
  │                                │                                │
  │ 8. Abre WhatsApp con resumen  │                                │
  │    (wa.me link pre-armado)    │                                │
  │                                │                                │
  │                                │ 9. Vendedor ve pedido          │
  │                                │    + capture en /orders/:id    │
  │                                │                                │
  │                                │ 10. PATCH /orders/:id/confirm  │
  │                                │     (descuenta stock)          │
  │                                │                                │
  │                                │ 11. PATCH /orders/:id/deliver  │
  │                                │     (marca entregado)          │
```

---

## 7. Seguridad y rate limiting

| Endpoint | Rate limit | Validacion |
|----------|-----------|------------|
| POST /catalog/:slug/orders | 5/min por IP | Valida stock disponible, max 20 items, total > 0 |
| POST .../orders/:id/proof | 3/min por IP | Max 5MB, solo JPEG/PNG/WebP |
| GET /catalog/:slug | 60/min por IP | Cache 1 min en Redis |
| GET /catalog/:slug/store-info | 60/min por IP | Cache 5 min en Redis |

### Proteccion contra pedidos falsos

- El pedido se crea como `pending` (no descuenta stock)
- Solo el vendedor puede confirmar (requiere auth)
- Pedidos sin confirmar por 24h se auto-cancelan (cron job futuro)
- El capture es opcional (el vendedor puede confirmar sin el)

---

## 8. PRs de implementacion (orden estricto)

### PR 1: Schema + migracion (solo DB)
- Tabla `orders` + indices + RLS
- Tabla `store_settings` + RLS
- Drizzle schema actualizado
- Seed con store_settings de ejemplo
- **No rompe nada.** Solo agrega tablas.

### PR 2: API de pedidos + store settings
- Endpoints publicos: GET store-info, POST orders
- Endpoints protegidos: GET/PATCH orders, GET/PATCH store-settings
- Validacion Zod para todos los inputs
- Rate limiting en endpoints publicos
- Tests unitarios para flujo de pedido
- **No rompe nada.** Solo agrega rutas.

### PR 3: Tienda PWA del cliente
- Composable `useCart` (localStorage)
- Composable `useStorefront` (fetch catalog + store-info)
- Paginas: /tienda/index, /tienda/cart, /tienda/checkout
- Manifest dinamico por tenant
- Middleware: si hay tenantSlug, redirigir a /tienda
- Layout standalone para tienda (sin sidebar/header de Nova)
- **No rompe nada.** Rutas nuevas, layout nuevo.

### PR 4: Dashboard del vendedor (pedidos)
- Pagina /orders con lista filtrable
- Pagina /orders/:id con detalle + acciones
- Pagina /settings/store para configurar metodos de pago
- Badge/alerta de pedidos pendientes en sidebar
- Al confirmar pedido: descuenta stock + crea venta en el sistema
- **No rompe nada.** Paginas nuevas.

### PR 5: Upload de captures (MinIO)
- Endpoint POST /catalog/:slug/orders/:id/proof
- Cliente MinIO en el API (S3-compatible)
- Bucket `order-proofs` con politica de acceso
- Visualizacion del capture en /orders/:id
- **Requiere MinIO configurado en el data plane.**

---

## 9. Dependencias y prerequisitos

| Prerequisito | Estado | Notas |
|-------------|--------|-------|
| Subdominio wildcard DNS | Configurado | `*.novaincs.com` → Traefik |
| Tenant middleware | Implementado | `server/middleware/tenant.ts` |
| Catalogo publico API | Implementado | `GET /catalog/:slug` |
| MinIO en data plane | Disponible | Bucket `order-proofs` por crear |
| Productos con imageUrl | Parcial | Upload de imagenes es Fase 3.5 del roadmap anterior |

---

## 10. Metricas de exito

| Metrica | Target |
|---------|--------|
| Tiempo de carga tienda (3G) | < 3s |
| Pasos para completar pedido | 4 (catalogo → carrito → checkout → WhatsApp) |
| Pedidos falsos/spam | < 5% del total |
| Stock sync correcto | 100% (pedido confirmado = stock descontado) |

---

## 11. Futuro (post-v1 de storefront)

- Notificaciones push al vendedor (nuevo pedido)
- Historial de pedidos para el cliente (por telefono, sin cuenta)
- Catalogo con busqueda y filtros avanzados
- Temas/colores personalizables por tienda
- Dominio custom (mitienda.com → CNAME a novaincs.com)
- Pagos integrados (cuando existan pasarelas VE viables)
- QR code para compartir la tienda
