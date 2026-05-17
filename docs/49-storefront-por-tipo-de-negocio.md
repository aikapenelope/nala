# Investigacion: Storefront por Tipo de Negocio

> Mayo 2026. Investigacion sobre como Treinta.co, Fina, y competidores adaptan
> la experiencia de venta segun el sector del negocio. Analisis del estado actual
> de Nala y plan para storefronts optimizados por vertical.

---

## 1. Como lo hacen los competidores

### Treinta.co

**Modelo:** Treinta NO tiene storefront publico funcional. Su "catalogo virtual"
esta en reconstruccion segun sus propias reviews. Lo que si hace bien:

- **Segmentacion en onboarding:** 4 verticales (gastronomia, retail, servicios, mercados)
- **Features por vertical:**
  - Gastronomia: recetas con descuento automatico de ingredientes
  - Retail (ropa): variantes por talla/color
  - Servicios: facturacion por hora/contrato
  - Mercados: venta por peso/litro/unidad, fiado
- **Lo que NO adapta:** La UI de ventas es identica para todos. No hay temas
  ni layouts diferentes por tipo de negocio.

**Conclusion:** Treinta adapta el *backend* (categorias, unidades, recetas) pero
no el *frontend* de venta. El POS se ve igual para una bodega que para una peluqueria.

### Fina (finapartner.com)

**Modelo:** Fina tampoco tiene storefront publico. Es un sistema administrativo
interno. Lo que adapta:

- **Segmentacion:** 7 verticales (alimentos, servicios, ropa/cosmeticos,
  restaurantes, electronica, repuestos, ferreteria)
- **Features por vertical:**
  - Restaurantes: control de mesas, recetas con descuento de ingredientes
  - Ropa: inventario por tallas/colores/referencias
  - Alimentos: fechas de vencimiento
  - Ferreteria: inventario por modelos y referencias
- **Marketing:** Tiene modulo de marketing (email, SMS) pero no catalogo publico

**Conclusion:** Fina adapta el inventario y la operacion interna, no la experiencia
de compra del cliente final. No tiene storefront.

### Vercatalogo.com (referencia de catalogo digital)

**Modelo:** Plataforma dedicada a catalogos digitales. Lo relevante:

- **Temas/plantillas:** Multiples plantillas visuales por tipo de negocio
- **Precios multi-moneda:** USD + moneda local con factor de cambio
- **Pedidos por WhatsApp:** El cliente arma carrito y el resumen va a WhatsApp
- **IA integrada:** Chat bot que ayuda a encontrar productos
- **Red de revendedores:** Catalogos derivados con precios personalizados

**Conclusion:** Vercatalogo es el modelo mas cercano a lo que Nala necesita para
el storefront. Pero es solo catalogo — no tiene POS, inventario, ni contabilidad.

---

## 2. Estado actual de Nala

### Lo que YA esta adaptado por tipo de negocio

| Capa | Adaptacion | Donde |
|------|-----------|-------|
| **Onboarding** | 11 tipos de negocio con categorias pre-configuradas | `onboarding.ts` CATEGORIES_BY_TYPE |
| **Schema** | `businesses.type` almacena el tipo | `schema.ts` |
| **Productos** | Variantes (talla/color), servicios (sin stock), unidades de medida | `products`, `product_variants`, `units_of_measure` |
| **Inventario** | Semaforo de stock, prediccion de agotamiento | `calculateStockSemaphore`, `predictStockDepletion` |
| **Ventas** | Venta rapida (sin producto), fiado, recargos, IGTF | `POST /sales`, `POST /sales/quick` |
| **Storefront** | Catalogo publico, checkout, pedidos, push notifications | `/tienda/*`, `/catalog/:slug` |

### Lo que NO esta adaptado por tipo de negocio

| Capa | Que falta | Impacto |
|------|----------|---------|
| **Storefront UI** | Un solo diseño para todos los tipos | Una bodega y una tienda de ropa se ven igual |
| **Catalogo API** | No filtra por disponibilidad inteligente | Bodega: muestra agotados. Ropa: no muestra variantes |
| **Producto cards** | No muestran info relevante por sector | Ropa: deberia mostrar tallas. Bodega: deberia mostrar precio/kg |
| **Checkout** | Mismo flujo para todos | Servicios: no necesita carrito. Bodega: necesita "pedir por WhatsApp" rapido |
| **SEO/Meta** | No hay meta tags por tipo de negocio | Afecta compartir por WhatsApp (preview) |
| **Temas visuales** | No hay temas ni colores de marca | Todos los storefronts se ven identicos |

### El `business.type` esta disponible pero no se usa

El campo `business.type` se guarda en onboarding y se devuelve en el API del
catalogo (`GET /catalog/:slug` -> `business.type`), pero el storefront frontend
**nunca lo lee ni lo usa** para adaptar la UI. El composable `useStorefront()`
ya tiene `business.type` en `StorefrontBusiness.type` pero ningun componente
lo consume.

---

## 3. Modelo propuesto: Storefront adaptativo por vertical

### Filosofia

No necesitamos N storefronts completamente diferentes. Necesitamos **un storefront
con variaciones controladas** segun el tipo de negocio. Las variaciones son:

1. **Layout de producto card** — que info se muestra y como
2. **Orden de categorias** — cuales van primero
3. **Checkout flow** — simplificado vs completo
4. **Texto/copy** — "Agregar al carrito" vs "Pedir" vs "Reservar"
5. **Color de marca** — ya planificado en doc 41

### Verticales y sus necesidades de storefront

| Vertical | Card layout | Info clave | CTA | Checkout |
|----------|------------|-----------|-----|----------|
| **bodega** | Compacto, lista | Precio/unidad, disponibilidad | "Pedir" | Rapido (WhatsApp) |
| **ropa** | Visual, galeria grande | Tallas, colores, carousel | "Agregar al carrito" | Carrito completo |
| **ferreteria** | Tecnico, SKU visible | SKU, marca, ubicacion | "Consultar" | WhatsApp directo |
| **peluqueria** | Servicios, sin imagen | Duracion, precio | "Reservar" | Formulario simple |
| **farmacia** | Lista compacta | Presentacion, laboratorio | "Pedir" | Rapido |
| **electronica** | Visual, specs | Marca, modelo, garantia | "Agregar al carrito" | Carrito completo |
| **cosmeticos** | Visual, galeria | Marca, tipo de piel | "Agregar al carrito" | Carrito completo |
| **distribuidora** | Mayorista, precios escalonados | Precio/unidad, precio/caja | "Cotizar" | Formulario mayorista |
| **otro** | Default (actual) | Nombre, precio | "Agregar al carrito" | Carrito completo |

### Implementacion tecnica sugerida

#### Fase 1: Configuracion por tipo (sin cambios de UI)

Crear un mapa de configuracion por `business.type` que defina:

```typescript
interface StorefrontConfig {
  /** Layout variant for product cards */
  cardLayout: "visual" | "compact" | "list";
  /** Whether to show image carousel or single image */
  showCarousel: boolean;
  /** Whether to show SKU in the card */
  showSku: boolean;
  /** Whether to show brand in the card */
  showBrand: boolean;
  /** CTA button text */
  ctaText: string;
  /** Whether to show variant selector (tallas/colores) */
  showVariants: boolean;
  /** Whether to show unit price (precio/kg, precio/litro) */
  showUnitPrice: boolean;
  /** Checkout mode */
  checkoutMode: "cart" | "whatsapp" | "form";
  /** Whether to show "out of stock" products */
  showOutOfStock: boolean;
  /** Default sort: by name, by price, by category */
  defaultSort: "name" | "price" | "category" | "updated";
}
```

Mapa de defaults:

```typescript
const STOREFRONT_CONFIG: Record<string, Partial<StorefrontConfig>> = {
  bodega: {
    cardLayout: "compact",
    showCarousel: false,
    ctaText: "Pedir",
    checkoutMode: "whatsapp",
    showOutOfStock: false,
  },
  ropa: {
    cardLayout: "visual",
    showCarousel: true,
    showVariants: true,
    ctaText: "Agregar",
    checkoutMode: "cart",
  },
  ferreteria: {
    cardLayout: "compact",
    showSku: true,
    showBrand: true,
    ctaText: "Consultar",
    checkoutMode: "whatsapp",
  },
  peluqueria: {
    cardLayout: "list",
    showCarousel: false,
    ctaText: "Reservar",
    checkoutMode: "form",
    showOutOfStock: false,
  },
  // ... etc
};
```

#### Fase 2: Componentes de card por layout

Tres variantes de `ProductCard`:

1. **`ProductCardVisual`** — Imagen grande (4:5), carousel, nombre, precio, CTA overlay.
   Para: ropa, cosmeticos, electronica.

2. **`ProductCardCompact`** — Imagen pequeña (1:1), nombre, precio, SKU, CTA inline.
   Para: bodega, farmacia, ferreteria.

3. **`ProductCardList`** — Sin imagen o icono, nombre, descripcion, precio, CTA.
   Para: peluqueria (servicios), distribuidora.

El catalogo renderiza el componente correcto segun `storefrontConfig.cardLayout`.

#### Fase 3: Checkout adaptativo

- **`cart` mode** (default): Carrito completo con cantidades, subtotal, checkout form.
  Para: ropa, electronica, cosmeticos.

- **`whatsapp` mode**: Sin carrito. Cada producto tiene "Pedir por WhatsApp" que
  abre wa.me con el producto pre-llenado. Para: bodega, ferreteria, farmacia.

- **`form` mode**: Formulario simple de contacto/reserva sin carrito.
  Para: peluqueria, servicios.

#### Fase 4: Override manual por negocio

Permitir que el dueno sobreescriba la configuracion automatica desde `/store`:

```sql
ALTER TABLE store_settings ADD COLUMN storefront_config jsonb;
```

Si `storefront_config` es null, se usa el default del `business.type`.
Si tiene valores, se mergean con el default (override parcial).

---

## 4. Que existe hoy vs que falta

### Ya implementado

- [x] `business.type` se guarda y se devuelve en el API
- [x] Categorias pre-configuradas por tipo de negocio
- [x] Variantes de producto (talla/color) en schema y API
- [x] Unidades de medida en schema
- [x] Servicios (is_service) sin tracking de stock
- [x] Storefront PWA con catalogo, carrito, checkout, pedidos
- [x] Push notifications para pedidos nuevos
- [x] Roadmap de personalizacion visual (doc 41: colores, logo, temas)
- [x] Carousel de imagenes multi-producto

### No implementado (necesario para storefront adaptativo)

- [ ] Composable `useStorefrontConfig()` que lee `business.type` y devuelve config
- [ ] Componentes de card por layout (visual/compact/list)
- [ ] Checkout adaptativo (cart/whatsapp/form)
- [ ] Selector de variantes en el storefront (tallas/colores)
- [ ] Precio por unidad de medida en el storefront
- [ ] Override manual de config en store_settings
- [ ] Textos/copy adaptativos por tipo de negocio

### No implementado (nice to have, futuro)

- [ ] Temas visuales (doc 41, Sprint Brand-4)
- [ ] Color de marca (doc 41, Sprint Brand-1)
- [ ] Logo y banner (doc 41, Sprint Brand-2)
- [ ] Dominio custom (doc 41, Sprint Brand-3)

---

## 5. Orden de ejecucion recomendado

```
Sprint Storefront-1: Config por tipo (1 dia)
  - Crear STOREFRONT_DEFAULTS en shared/
  - Crear composable useStorefrontConfig()
  - Leer business.type del API y aplicar config
  - Adaptar textos del CTA segun config

Sprint Storefront-2: Card layouts (2 dias)
  - ProductCardVisual (ropa, cosmeticos, electronica)
  - ProductCardCompact (bodega, farmacia, ferreteria)
  - ProductCardList (peluqueria, servicios)
  - Catalogo renderiza el correcto segun config

Sprint Storefront-3: Checkout adaptativo (1 dia)
  - Modo WhatsApp directo (sin carrito)
  - Modo formulario simple (servicios)
  - Mantener modo carrito como default

Sprint Storefront-4: Variantes en storefront (1 dia)
  - Selector de talla/color en el card o en modal
  - API ya soporta variantes, falta UI en storefront

Sprint Storefront-5: Override manual (medio dia)
  - Campo storefront_config en store_settings
  - UI en /store para sobreescribir defaults
  - Merge de config: default + override
```

---

## 6. Conclusion

Nala ya tiene la **infraestructura backend** para soportar diferentes tipos de
negocio (tipos, categorias, variantes, servicios, unidades). Lo que falta es
que el **storefront frontend** use esa informacion para adaptar la experiencia
de compra.

Ni Treinta ni Fina tienen storefront publico funcional. Nala ya lo tiene.
La oportunidad es hacer que ese storefront sea **inteligente** — que una bodega
se vea como bodega (compacto, rapido, WhatsApp) y una tienda de ropa se vea
como tienda de ropa (visual, galeria, carrito).

No se necesitan N storefronts separados. Se necesita **un storefront con
variaciones controladas** por tipo de negocio, con la posibilidad de que el
dueno sobreescriba los defaults desde la configuracion.
