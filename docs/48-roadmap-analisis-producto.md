# Nala: Roadmap + Analisis de producto — Mayo 2026

> Fuente unica de verdad. Reemplaza docs 45, 46, 47 y todos los anteriores.
> Actualizado: 18 mayo 2026 post-sesion 2 completa (PRs #316-#332).

---

## Change log — Sesion 2: 17-18 mayo 2026 (PRs #316-#332)

### Resumen ejecutivo

- Corregidos 5 bugs criticos (stock audit, order confirm crash, migration PG16, image loading)
- DB hardening completo (FK, CHECK, indexes, RLS)
- Storefront rediseñado de cero (premium UI, adaptativo, luego simplificado a universal)
- Landing page profesional nueva
- Tipos de negocio simplificados de 11 a 4
- Push notifications implementadas
- Pagina de detalle de producto nueva
- Dark mode en storefront
- WhatsApp integrado en navbar

### PRs en orden cronologico

| PR | Fecha | Tipo | Descripcion |
|----|-------|------|-------------|
| #316 | 17 may | feat+fix | Stock audit trail + push notifications para pedidos storefront |
| #317 | 17 may | fix | DB hardening: RLS, FK constraints, CHECK constraints, indexes |
| #318 | 17 may | feat | Storefront premium UI redesign (layout, catalogo, carrito) |
| #319 | 17 may | feat | Storefront adaptativo por tipo de negocio |
| #320 | 17 may | fix | Migracion 0021 PG16 compat + CI migration verification |
| #321 | 17 may | fix | Order confirm crash (inArray) + pg_trgm + customer-stats |
| #323 | 18 may | refactor | Simplificar tipos de negocio de 11 a 4 |
| #324 | 18 may | docs | Changelog, roadmap, README actualizados |
| #325 | 18 may | feat | Landing page premium (primera version) |
| #326 | 18 may | fix | Landing full-width (quitar bordes) |
| #327 | 18 may | feat | Landing profesional (quitar artefactos decorativos) |
| #328 | 18 may | refactor | Storefront universal (eliminar config-driven cards) |
| #329 | 18 may | feat | Storefront UX: cards mejorados, pagina Info, OG tags |
| #330 | 18 may | feat | Pagina detalle producto, imagenes clickeables, 4-tab navbar |
| #331 | 18 may | feat | WhatsApp center en navbar, dark mode toggle |
| #332 | 18 may | fix | Content-Length en imagenes para iOS Safari (pendiente merge) |

---

### Detalle: Bugs criticos corregidos

**Order confirm crash (#321)**
- `sql` template con `ANY(${array})` no funciona con drizzle-orm
- Fix: reemplazar con `inArray()` (2 instancias en orders.ts)
- Causa: error mio al escribir el query en PR #316

**Migration PG16 (#320)**
- `ADD CONSTRAINT IF NOT EXISTS` es sintaxis PG17+, produccion usa PG16
- Fix: `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object` (PG16 compatible)
- CI ahora ejecuta `migrate.mjs` antes de `drizzle-kit push`
- `migrate.mjs` crea extensiones y funciones antes de migraciones

**Image loading iOS (#332)**
- iOS Safari no renderiza imagenes de streaming responses sin `Content-Length`
- Fix: incluir `ContentLength` de S3 en el header de respuesta
- Tambien fix: 304 response usa `new Response()` en vez de `c.body(null)`

**Stock audit trail (#316)**
- Confirmar pedido no registraba `stock_movements`
- Cancelar pedido confirmado no restauraba stock
- Faltaba `lastSoldAt`, `totalCostUsd`, asientos contables

**DB hardening (#317)**
- RLS faltante en `push_subscriptions`
- FK constraints: sales.customerId, quotations.customerId, dayCloses.openingId
- CHECK constraints: stock >= 0, price >= 0, quantity > 0, discount 0-100
- Indexes: stock_movements ref, accounting_entries ref, activity_log
- UNIQUE: store_settings.businessId, notification_preferences.businessId

---

### Detalle: Storefront (evolucion completa)

1. **PR #318**: Rediseno premium (header, bottom nav, cards 4:5, info banner)
2. **PR #319**: Adaptativo por tipo (3 cards, 4 configs, WhatsApp mode)
3. **PR #323**: Simplificado a 4 tipos (tienda, moda, servicios, otro)
4. **PR #328**: Simplificado a universal (1 card, 1 config, 1 checkout)
5. **PR #329**: UX mejorado (boton grande, descripcion, pagina Info)
6. **PR #330**: Detalle de producto (imagen full, galeria, compartir)
7. **PR #331**: WhatsApp center en navbar + dark mode

**Estado final del storefront:**
- Un solo layout universal para todos los tipos de negocio
- Card con imagen cuadrada, descripcion, boton "Agregar" full-width
- Imagen clickeable -> pagina de detalle con galeria + descripcion completa
- Navbar: Catalogo, Info, WhatsApp (centro elevado verde), Carrito, Pedir
- Dark mode toggle en header
- Pagina Info con ubicacion, horarios, metodos de pago, delivery, contacto
- OG tags para WhatsApp link previews

---

### Detalle: Landing page

- Rediseno completo de la landing (antes era generica, ahora es premium)
- Hero con gradiente animado + circulos CSS flotantes
- 3 value props (POS, inventario, storefront)
- Seccion "La venta genera el dato" con pasos visuales
- Grid de 4 features
- 3 testimoniales (Carlos/bodega, Maria/mini-market, Cafeteria)
- Pricing (Gratis, Pro $9/mes, Enterprise)
- Tabla comparativa (Nala vs Cuaderno vs Excel vs ERP)
- CTA final con gradiente
- Full-width, sin bordes decorativos

---

### Detalle: Tipos de negocio simplificados

**De 11 a 4 tipos:**
- tienda (bodega, mini-market)
- moda (ropa, cosmeticos, accesorios)
- servicios (peluqueria, barberia, profesionales)
- otro (electronica, alimentos, cualquier otro)

**Eliminados como opciones de onboarding:**
- farmacia, ferreteria, libreria, autopartes, distribuidora (miles de SKUs, fuera de scope)

**Backward compatible:** tipos legacy siguen funcionando para negocios existentes.

**El tipo solo afecta:** categorias del POS (tabs de arriba al vender).
**El storefront es identico para todos.**

---

## Estado actual del sistema

| Metrica | Valor |
|---------|-------|
| LOC | ~36,000 |
| Tablas | 35 |
| Migraciones | 22 (0000-0021) |
| Paginas frontend | 38 |
| Componentes | 12 |
| Composables | 17 |
| Tests | 14 archivos |
| CI | GitHub Actions (migrate + typecheck + lint + test + build) |
| PRs totales | #79-#332 |

---

## Que funciona hoy

### Core (lo que el usuario usa todos los dias)
- POS con categorias por tipo, barcode scanner, checkout inline, venta rapida
- Dashboard con KPIs, grafico semanal, pedidos pendientes, cobros
- Inventario con semaforo, prediccion, multi-imagen (5 fotos)
- Storefront PWA universal con detalle de producto, carrito, checkout
- Push notifications para pedidos nuevos
- Pedidos con confirmacion rapida + sonido + push
- Clientes + fiado con cobro por WhatsApp
- Tasa BCV manual + auto-fetch
- Owner lock (PIN para secciones sensibles)
- Dark mode en storefront

### Automatico (funciona sin que el usuario lo vea)
- Asientos contables en cada venta
- Stock movements con qty_after_transaction
- Prediccion de agotamiento
- Deteccion de anomalias
- Auto-cancel pedidos stale (24h)
- RLS multi-tenant completo
- CHECK constraints en DB
- FK constraints con ON DELETE SET NULL

---

## Roadmap: Proximos pasos

### Inmediato (siguiente sesion)

```
Critico (deploy):
  - Mergear PR #332 (image Content-Length) ............. 1 min
  - Verificar que deploy pasa en Coolify ............... 5 min
  - Verificar imagenes en iOS Safari ................... 5 min

UX:
  - Boton "Compartir catalogo" por WhatsApp ............ 2 horas
  - Tutorial interactivo en POS (primer uso) ........... 4 horas
  - Crear imagen OG (1200x630px) para WhatsApp ......... 30 min
```

### Semana siguiente

```
Performance:
  - Image optimization (resize on upload, serve thumbnails) .. 1 dia
  - WebP conversion al subir ................................ 4 horas
  - CDN (Cloudflare) para imagenes .......................... 2 horas

UX:
  - Simplificar onboarding (menos pasos) .................... 1 dia
  - UI de devolucion parcial ................................ 1 dia
  - Recibo compartible por WhatsApp ......................... 2 horas
```

### Mes siguiente

```
Crecimiento:
  - TWA wrapper para Play Store ............................. 2 dias
  - Personalizacion storefront (logo, colores) .............. 2 dias
  - Boton "Compartir recibo" en historial ................... 2 horas

Infraestructura:
  - Service Worker cache para imagenes (offline) ............ 1 dia
  - Blur placeholder (blurhash) al subir imagenes ........... 1 dia
  - Monitoring/alertas (uptime, error rate) ................. 1 dia
```

### Futuro (no priorizado)

```
- WhatsApp Business API (recibir pedidos por chat)
- Facturacion electronica (SENIAT)
- Multi-usuario (Clerk Organizations)
- App nativa Play Store (TWA)
- Integraciones (MercadoPago, Stripe)
```

---

## Notas tecnicas importantes

### Imagen OG para WhatsApp

Para que los links del storefront se vean bien al compartir por WhatsApp:
1. Crear imagen de 1200x630px (PNG o JPG)
2. Colocarla en `apps/web/public/og-storefront.png`
3. El SEO composable ya apunta a esa ruta
4. WhatsApp la mostrara como preview grande

Recomendacion: usar una captura del hero de la landing o una imagen con el logo de Nala + "Tienda en linea".

### PWA y links de WhatsApp

Los links compartidos por WhatsApp siempre abren el navegador, no la PWA instalada. Esto es una limitacion del sistema operativo (Android/iOS). La unica forma de que un link abra la app es publicar como TWA en Play Store con Digital Asset Links verificados.

### Tipos de negocio y categorias

El tipo de negocio se elige en onboarding y NO se puede cambiar despues (no hay UI ni endpoint). Solo afecta las categorias pre-configuradas del POS. El storefront es identico para todos.

---

## Docs del proyecto

| Doc | Contenido |
|-----|-----------|
| Este archivo (48) | Roadmap, changelog, estado del sistema |
| [49 - Storefront](docs/49-storefront-por-tipo-de-negocio.md) | Arquitectura del storefront adaptativo (historico) |
| [43 - Buyer persona](docs/43-product-focus-buyer-persona.md) | Cliente target, posicionamiento |
| [41 - Personalizacion](docs/41-storefront-personalization-roadmap.md) | Roadmap de branding (futuro) |

---

## Change log — Sesion 1: 14 mayo 2026 (PRs #265-#275)

| PR | Tipo | Descripcion |
|----|------|-------------|
| #265 | fix | RLS crash: validar columnas antes de aplicar policies |
| #266 | fix | Image upload: bucket nunca se creaba |
| #267 | fix | Image proxy: mover a ruta publica sin auth |
| #268 | fix | CORP header: secureHeaders() bloqueaba img cross-origin |
| #272 | feat | Multi-imagen backend: tabla product_images, 4 endpoints |
| #273 | feat | Multi-imagen frontend: galeria + carousel |
| #275 | feat | Simplificar ventas: quick sale + POS inline checkout |
