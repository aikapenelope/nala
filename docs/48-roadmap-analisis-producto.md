# Nala: Roadmap + Analisis de producto — Mayo 2026

> Fuente unica de verdad. Reemplaza docs 45, 46, 47 y todos los anteriores.
> Actualizado: 18 mayo 2026 post-sesion completa (PRs #316-#323).

---

## Change log — Sesion 18 mayo 2026 (PRs #316-#323)

| PR | Tipo | Descripcion |
|----|------|-------------|
| #316 | feat+fix | Stock audit trail para pedidos storefront + push notifications |
| #317 | fix | DB hardening: RLS push_subscriptions, FK constraints, CHECK constraints, indexes |
| #318 | feat | Storefront premium UI redesign (layout, catalogo, carrito) |
| #319 | feat | Storefront adaptativo por tipo de negocio (cards, WhatsApp checkout) |
| #320 | fix | Migracion 0021 compatibilidad PG16 + CI migration verification |
| #321 | fix | Order confirm/cancel crash (inArray), pg_trgm extension, customer-stats error handling |
| #323 | refactor | Simplificar tipos de negocio de 11 a 4 (tienda, moda, servicios, otro) |

### Detalle: Stock audit trail + push notifications (#316)

Bugs corregidos en el flujo storefront -> confirmar pedido:
- `PATCH /orders/:id/confirm` no registraba `stock_movements` (auditoria rota)
- Cancelar pedido confirmado no restauraba stock
- Faltaba `lastSoldAt`, `totalCostUsd`, asientos contables en confirm

Push notifications:
- Tabla `push_subscriptions` (migracion 0020)
- Servicio `web-push` con VAPID
- Trigger fire-and-forget al crear pedido en storefront
- Service worker handler + composable `usePushNotifications`
- Toggle en pagina de pedidos

### Detalle: DB hardening (#317)

Auditoria profunda de la base de datos. Hallazgos y fixes:
- RLS faltante en `push_subscriptions`
- FK constraints faltantes: `sales.customerId`, `quotations.customerId`, `dayCloses.openingId`, `accountingAccounts.parentId`
- CHECK constraints: stock >= 0, price >= 0, quantity > 0, discount 0-100
- Indexes: `stock_movements(ref_type, ref_id)`, `accounting_entries(ref_type, ref_id)`, etc.
- UNIQUE constraints en `store_settings.businessId`, `notification_preferences.businessId`
- Fix exchange-rate RLS bypass en catalogo publico (transaccion para pinear conexion)

### Detalle: Storefront premium UI (#318)

Rediseno completo del storefront publico:
- Header: nombre del negocio + indicador online + WhatsApp + carrito
- Bottom nav fijo: Catalogo, Carrito (elevado), Pedir
- Catalogo: busqueda, category chips sticky, info banner, grid 4:5
- Carrito: thumbnails grandes, controles +/-, resumen limpio
- CSS: utilidad `no-scrollbar` para pills horizontales

### Detalle: Storefront adaptativo (#319 + #323)

El storefront adapta su UI segun el tipo de negocio:

**4 tipos simplificados (antes eran 11):**

| Tipo | Target | Storefront | POS categories |
|------|--------|-----------|---------------|
| tienda | Bodega, mini-market | Compact, WhatsApp | Abarrotes, Lacteos, Bebidas, Limpieza, Snacks |
| moda | Ropa, cosmeticos | Visual, carousel, carrito | Ropa mujer/hombre, Calzado, Accesorios, Cosmeticos |
| servicios | Peluqueria, barberia | Compact 1-col, WhatsApp | Cortes, Coloracion, Tratamientos, Unas, Maquillaje |
| otro | Todo lo demas | Visual, carrito | General |

Arquitectura:
- `StorefrontConfig` en `@nova/shared` con 4 perfiles nombrados
- `useStorefrontConfig()` composable que lee `business.type`
- 2 componentes de card: `ProductCardVisual` + `ProductCardCompact`
- Modo WhatsApp: CTA abre wa.me con producto pre-llenado
- Legacy types (bodega, ropa, peluqueria, etc.) mapeados al perfil mas cercano

**Lo que NO cambia por tipo (igual para todos, como Treinta.co):**
- POS (interfaz de vender) — excepto los tabs de categorias
- Dashboard
- Inventario
- Reportes
- Configuracion

### Detalle: Fixes de deploy (#320, #321)

Migracion 0021 fallaba en produccion (PG16):
- `ADD CONSTRAINT IF NOT EXISTS` es sintaxis PG17+
- Fix: `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object` (PG16 compatible)
- CI: `migrate.mjs` ahora corre ANTES de `drizzle-kit push` (valida SQL real)
- `migrate.mjs` crea extensiones (`pg_trgm`, `uuid-ossp`) y funcion `current_business_id()` antes de migraciones

Order confirm crasheaba con "Internal Server Error":
- Bug: `sql` template con `ANY(${array})` no funciona con drizzle-orm
- Fix: reemplazar con `inArray()` de drizzle-orm (2 instancias en orders.ts)

---

## Change log — Sesion anterior (PRs #265-#275)

| PR | Tipo | Descripcion |
|----|------|-------------|
| #265 | fix | RLS crash: validar columnas antes de aplicar policies |
| #266 | fix | Image upload: bucket nunca se creaba, agregar initStorage() |
| #267 | fix | Image proxy: mover a ruta publica sin auth |
| #268 | fix | CORP header: secureHeaders() bloqueaba img cross-origin |
| #272 | feat | Multi-imagen backend: tabla product_images, 4 endpoints, proxy por ID |
| #273 | feat | Multi-imagen frontend: galeria en inventario + carousel en storefront |
| #274 | merge | Merge de #272 (backend multi-imagen) |
| #275 | feat | Simplificar ventas: quick sale endpoint + POS inline checkout |

---

## Estado actual del sistema

| Metrica | Valor |
|---------|-------|
| LOC | ~35,000 |
| Tablas | 35 |
| Migraciones | 22 (0000-0021) |
| Paginas frontend | 35 |
| Componentes | 13 |
| Composables | 17 |
| Tests | 14 archivos |
| CI | GitHub Actions (migrate + typecheck + lint + test + build) |
| PRs | #79-#323 |

### Que funciona

- POS con categorias por tipo de negocio, barcode scanner, checkout inline, venta rapida
- Dashboard con 10 API calls en paralelo, pull-to-refresh, skeleton loading
- Inventario con semaforo, prediccion de agotamiento, multi-imagen (5 fotos)
- Storefront PWA adaptativo por tipo de negocio (visual/compact, cart/WhatsApp)
- Push notifications para pedidos nuevos
- OCR de facturas (GPT-4o-mini vision)
- Cierre/apertura de caja
- Cuentas por cobrar con cobro por WhatsApp
- Reportes en 3 tabs + export Excel
- Tasa BCV manual + auto-fetch
- Pedidos online con confirmacion rapida + sonido + push
- Owner lock (PIN para secciones sensibles)
- DB hardening: FK constraints, CHECK constraints, indexes, RLS completo

---

## Tipos de negocio

### Modelo (inspirado en Treinta.co)

Un producto universal con 4 tipos que afectan solo:
1. Categorias pre-configuradas en onboarding (tabs del POS)
2. Layout del storefront (visual vs compact)
3. Modo de checkout del storefront (carrito vs WhatsApp directo)

### Los 4 tipos

**Tienda** — Bodega, mini-market, tienda de barrio
- POS: Abarrotes, Lacteos, Bebidas, Limpieza, Cuidado personal, Snacks
- Storefront: cards compactos, WhatsApp directo, oculta agotados

**Moda** — Ropa, cosmeticos, accesorios, calzado
- POS: Ropa mujer/hombre, Calzado, Accesorios, Cosmeticos
- Storefront: cards visuales 4:5, carousel de fotos, carrito completo

**Servicios** — Peluqueria, barberia, profesionales
- POS: Cortes, Coloracion, Tratamientos, Unas, Maquillaje
- Storefront: cards compactos 1 columna, WhatsApp directo, oculta agotados

**Otro** — Electronica, alimentos, cualquier otro
- POS: General, Otros
- Storefront: cards visuales, carrito completo

### Fuera de scope

Farmacias, ferreterias, librerias, autopartes, distribuidoras — tienen miles de SKUs y necesitan features especializados (lotes, vencimientos, multi-almacen). Esos clientes necesitan Fina o Profit Plus.

---

## Como funcionan las ventas hoy

### Modo 1: Venta con producto (POS)

```
Tab "Vender" → Grilla de productos (filtrada por categoria) → Toca producto
→ Se agrega al ticket → Selecciona metodo de pago → "Confirmar venta"
```

**3 taps.** Las categorias (tabs arriba) cambian segun el tipo de negocio elegido en onboarding.

### Modo 2: Venta rapida (sin producto)

```
Boton verde "$ Rapida" → Modal: monto + descripcion + metodo de pago → "Registrar"
```

### Modo 3: Tienda online (storefront)

```
Cliente abre tu-negocio.novaincs.com → Catalogo adaptado al tipo de negocio
→ Agrega al carrito (moda) o toca "Pedir" por WhatsApp (tienda)
→ Pedido llega al dashboard del vendedor
```

---

## Posicionamiento vs competencia

| Producto | Target | Precio | Nala compite? |
|----------|--------|--------|---------------|
| Cuaderno / Excel | Todos | $0 | Si — Nala es el upgrade |
| WhatsApp Business | Todos | $0 | Si — Nala agrega POS + inventario |
| Treinta | Pequeno-mediano | $40-80k COP/mes | Si — mismo target, Nala tiene storefront real |
| Fina | Mediano-grande | $50-100/mes | No — Fina va a facturacion fiscal |
| Profit Plus | Grande | $100-300/mes | No — ERP completo |

---

## Orden de ejecucion recomendado (siguiente sesion)

```
Inmediato:
  - Boton "Compartir catalogo" por WhatsApp ......... 2 horas
  - Tutorial interactivo en POS (primer uso) ........ 4 horas
  - UI de devolucion parcial ........................ 1 dia

Siguiente semana:
  - Simplificar onboarding (menos pasos) ............ 1 dia
  - Consistencia visual en paginas secundarias ....... 3 horas
  - Personalizacion storefront (logo, colores) ...... 2 dias

Futuro:
  - TWA wrapper para Play Store ..................... 2 dias
  - WhatsApp Business API ........................... 2 semanas
```

---

## Docs deprecados

Todos los docs anteriores (01-47, PRODUCTION-ROADMAP, AUTH-*) son historicos.

**Fuente de verdad: este archivo (docs/48-roadmap-analisis-producto.md).**
