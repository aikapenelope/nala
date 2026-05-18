# Storefront por Tipo de Negocio

> Mayo 2026. Implementado en PRs #319 y #323.
> Simplificado de 11 tipos a 4 siguiendo el modelo de Treinta.co.

---

## Modelo implementado

Un storefront, variaciones controladas por `business.type`.

### Los 4 tipos

| Tipo | Target | Card layout | CTA | Checkout | Grid |
|------|--------|------------|-----|----------|------|
| **tienda** | Bodega, mini-market | Compact (imagen 1:1 + info) | "Pedir" | WhatsApp directo | 2 columnas |
| **moda** | Ropa, cosmeticos, accesorios | Visual (imagen 4:5 + carousel) | "Agregar" | Carrito completo | 2 columnas |
| **servicios** | Peluqueria, barberia | Compact (con descripcion) | "Reservar" | WhatsApp directo | 1 columna |
| **otro** | Electronica, general | Visual (imagen 4:5) | "Agregar" | Carrito completo | 2 columnas |

### Arquitectura

```
business.type (DB, elegido en onboarding)
  → GET /catalog/:slug (API devuelve type)
    → useStorefrontConfig() (composable, lee type)
      → getStorefrontConfig() (shared, retorna perfil)
        → ProductCardVisual o ProductCardCompact (componente)
```

### Archivos clave

| Archivo | Que hace |
|---------|---------|
| `packages/shared/src/storefront-config.ts` | 4 perfiles de config + funcion `getStorefrontConfig()` |
| `packages/shared/src/types.ts` | `BusinessType` con 4 primarios + legacy |
| `apps/web/app/composables/useStorefrontConfig.ts` | Composable que expone `config`, `isCartMode`, `isWhatsAppMode` |
| `apps/web/app/components/storefront/ProductCardVisual.vue` | Card grande con carousel (moda, otro) |
| `apps/web/app/components/storefront/ProductCardCompact.vue` | Card compacto con info densa (tienda, servicios) |
| `apps/web/app/pages/tienda/index.vue` | Catalogo que selecciona card segun config |
| `apps/api/src/routes/onboarding.ts` | Categorias pre-configuradas por tipo |

### Backward compatibility

Los 11 tipos legacy siguen funcionando:
- bodega, farmacia, ferreteria, libreria, autopartes, distribuidora → perfil **tienda**
- ropa, cosmeticos → perfil **moda**
- peluqueria → perfil **servicios**
- electronica → perfil **otro**

### Lo que NO cambia por tipo

- POS (interfaz de vender) — excepto los tabs de categorias
- Dashboard
- Inventario
- Reportes
- Configuracion

---

## Futuro (no implementado)

1. **Override manual** — Campo `storefront_config` en `store_settings` para que el dueno sobreescriba defaults
2. **Selector de variantes** — Tallas/colores en el storefront (backend ya soporta)
3. **Temas visuales** — Colores de marca, logo, banner (documentado en doc 41)
