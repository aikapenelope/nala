# Storefront Personalization Roadmap

> Plan para personalizacion visual del storefront por negocio.
> Fecha: Mayo 2026. Estado: Planificado (no iniciado).
> Prerequisito: UI Roadmap v1 completado (PRs #217-#221).

---

## Modelo de tiers

| Tier | Que incluye | Referencia |
|------|------------|------------|
| **Free** | Storefront estandar, mismo diseño para todos, contenido del negocio | Lo que existe hoy |
| **Pro** | Color de marca, logo, banner hero, dominio custom | Shopify Basic, Square Online |
| **Premium** | Temas predefinidos (4 estilos visuales) | Shopify themes, Wix templates |
| Enterprise | App nativa a medida (fuera de scope, proyecto custom) | — |

---

## Tier Pro: Color + Logo + Dominio custom

### 1. DB: Campos nuevos en `store_settings`

```sql
ALTER TABLE store_settings ADD COLUMN brand_color text;        -- hex, ej: "#E11D48"
ALTER TABLE store_settings ADD COLUMN logo_url text;           -- key MinIO
ALTER TABLE store_settings ADD COLUMN banner_url text;         -- key MinIO
ALTER TABLE store_settings ADD COLUMN custom_domain text;      -- ej: "tienda.mipanaderiacarlos.com"
```

Todos opcionales. Si no estan configurados, el storefront se ve igual que hoy.

### 2. API: Extender endpoints existentes

- `PATCH /store-settings` acepta `brandColor`, `logoUrl`, `bannerUrl`, `customDomain`
- `GET /catalog/:slug/store-info` devuelve los campos de branding
- Nuevo: `POST /store-settings/upload-logo` (multipart, max 2MB, JPEG/PNG/WebP/SVG)
- Nuevo: `POST /store-settings/upload-banner` (multipart, max 5MB, JPEG/PNG/WebP)
- Reutilizar pipeline de MinIO existente (`services/storage.ts`), bucket: `store-branding`

### 3. Dashboard `/store`: Seccion "Apariencia"

Nueva card en la pagina `/store/index.vue` entre el status card y los metodos de pago:

- **Color de marca:** Input `type="color"` + 8 presets populares (rojo, azul, verde, morado, naranja, rosa, teal, negro)
- **Logo:** Upload con preview (reutilizar patron de proof upload). Recomendacion: 200x200px, fondo transparente
- **Banner:** Upload con preview. Recomendacion: 1200x400px
- **Dominio custom:** Input de texto (solo informativo, la config DNS es manual del usuario)

### 4. Storefront: Aplicar branding

**Color de marca:**
- `store-info` endpoint devuelve `brandColor`
- `useStorefront()` expone `brandColor`
- `storefront.vue` inyecta `--store-accent: {brandColor}` como CSS custom property en el root div
- Reemplazar `bg-gray-900` por `bg-[var(--store-accent)]` en:
  - Botones "Agregar al carrito"
  - Floating cart button
  - Checkout submit button
  - Category pill activa
  - Cart badge en header
- Fallback: si no hay `brandColor`, usar `#111827` (gray-900, el actual)

**Logo:**
- Si `logoUrl` existe, el header muestra `<img>` en vez del texto del nombre
- Max height: 32px, auto width
- Fallback: texto del nombre del negocio (comportamiento actual)

**Banner hero:**
- Si `bannerUrl` existe, mostrar imagen full-width arriba del catalogo
- Aspect ratio: 3:1, rounded corners, object-cover
- Fallback: no mostrar nada (comportamiento actual)

**Manifest PWA:**
- `manifest.json.get.ts` usa `brandColor` como `theme_color` si esta disponible
- Requiere fetch a DB desde el server route (hoy solo usa el slug)

### 5. Dominio custom

**Resolucion de tenant:**
- Extender `useTenant.ts` y `server/middleware/tenant.ts` para buscar slug por dominio custom
- Lookup: si el hostname no es `*.novaincs.com`, buscar en `store_settings.custom_domain`
- Cache en Redis (5 min) para evitar query en cada request

**CORS:**
- Extender config de CORS en `apps/api/src/app.ts` para aceptar origenes de dominios custom
- Opcion: wildcard con validacion, o lookup dinamico

**DNS (manual del usuario):**
- El usuario configura un CNAME: `tienda.sunegocio.com → novaincs.com`
- Documentar en la UI de `/store` como hacerlo
- SSL: Cloudflare proxy o Let's Encrypt automatico en Coolify

---

## Tier Premium: Temas predefinidos

### 6. DB: Campo de tema

```sql
ALTER TABLE store_settings ADD COLUMN theme text DEFAULT 'default';
```

Valores: `default`, `minimal`, `bold`, `elegant`

### 7. Definicion de temas

Cada tema es un set de CSS custom properties + clases condicionales. No son layouts separados (demasiado mantenimiento).

| Tema | Estilo | Cards | Tipografia | Espaciado |
|------|--------|-------|-----------|-----------|
| `default` | Lo actual | Rounded-2xl, border, shadow-sm | Sans (Jakarta) | Compacto |
| `minimal` | Limpio, sin bordes | Sin borde, sin sombra, separadores sutiles | Serif (opcional) | Amplio |
| `bold` | Impactante | Sombras fuertes, bordes gruesos | Extra bold, tracking tight | Normal |
| `elegant` | Sofisticado | Rounded-3xl, sombra suave, pastel | Light weight, letter-spacing | Muy amplio |

**Implementacion tecnica:**
- Composable `useStoreTheme()` que devuelve las clases CSS segun el tema
- CSS custom properties por tema (ej: `--store-card-radius`, `--store-card-shadow`, `--store-spacing`)
- El layout y las pages usan las variables en vez de clases hardcodeadas
- Alternativa mas simple: clases condicionales con `:class="themeClasses.card"` en cada componente

### 8. Dashboard: Selector de tema

En `/store/index.vue`, nueva card "Tema de la tienda":
- 4 thumbnails con preview visual de cada tema
- Click para seleccionar, se guarda con el resto de settings
- Preview en vivo: el boton "Ver como se ve tu tienda" abre con el tema seleccionado

### 9. Storefront: Renderizar tema

- `store-info` endpoint devuelve `theme`
- `useStorefront()` expone `theme`
- `storefront.vue` aplica clase CSS del tema al root div (ej: `storefront-theme-bold`)
- Cada tema define sus overrides via CSS scoping

---

## Orden de ejecucion sugerido

### Sprint Brand-1: Color de marca (items 1-2 parcial, 4 parcial)
- Campos DB: `brand_color`
- API: extender store-settings
- Storefront: CSS custom property + aplicar a botones/badges
- Manifest: theme_color dinamico

### Sprint Brand-2: Logo + Banner (items 2-3, 4 parcial)
- Campos DB: `logo_url`, `banner_url`
- API: upload endpoints (logo + banner)
- Dashboard: seccion "Apariencia" con uploads
- Storefront: logo en header, banner en catalogo

### Sprint Brand-3: Dominio custom (item 5)
- Campo DB: `custom_domain`
- Tenant resolution por dominio custom
- CORS dinamico
- Dashboard: input dominio + instrucciones DNS

### Sprint Brand-4: Temas (items 6-9)
- Campo DB: `theme`
- 4 temas CSS
- Dashboard: selector con previews
- Storefront: renderizado condicional

---

## Notas tecnicas

### MinIO buckets
- `order-proofs` -- ya existe, para comprobantes de pago
- `store-branding` -- nuevo, para logos y banners

### Tamaños recomendados
- Logo: 200x200px, max 2MB, JPEG/PNG/WebP/SVG
- Banner: 1200x400px, max 5MB, JPEG/PNG/WebP

### Compatibilidad
- Los campos nuevos son todos opcionales con defaults null
- Storefronts existentes no se ven afectados (fallback al diseño actual)
- La API publica sigue siendo la misma, solo devuelve mas campos
- No hay breaking changes
