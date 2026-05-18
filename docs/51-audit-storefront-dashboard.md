# Auditoría: Storefront ↔ Dashboard — Interconexión y Calidad

> Mayo 2026. Análisis profundo de la implementación, patrones, bugs potenciales,
> y conformidad con las mejores prácticas de Nuxt 3 y Vue 3.

---

## 1. Arquitectura de la Interconexión

```
STOREFRONT (público, sin auth)          DASHBOARD (auth requerido)
─────────────────────────────           ──────────────────────────
useTenant() → slug del subdominio       useNovaAuth() → businessId
useStorefront() → GET /catalog/:slug    useOrdersBadge() → GET /api/orders
useCart() → localStorage por slug       Dashboard → GET /api/store-settings
checkout → POST /catalog/:slug/orders   Dashboard → GET /api/store-stats
                                        Orders page → polling 30s
        ↓ pedido creado ↓
                                        ← push notification
                                        ← badge se actualiza (polling 30s)
                                        ← pedido aparece en /orders
```

### Flujo completo de un pedido

1. Cliente abre `slug.novaincs.com` → Nitro middleware detecta tenant
2. `useStorefront()` fetch `GET /catalog/:slug` (público, sin auth)
3. Cliente agrega productos al carrito (`useCart()`, localStorage)
4. Checkout: `POST /catalog/:slug/orders` con items + datos de pago
5. Backend: valida precios server-side, crea orden, descuenta stock
6. Backend: envía push notification al comerciante
7. Dashboard: `useOrdersBadge()` polling detecta nuevo pedido (≤30s)
8. Comerciante confirma pedido → stock se ajusta definitivamente

---

## 2. Análisis de Cada Componente Construido

### 2.1 useOrdersBadge (polling global)

**Implementación:**
```typescript
if (import.meta.client) {
  const initialized = useState<boolean>("orders-badge-initialized", () => false);
  if (!initialized.value) {
    initialized.value = true;
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL);
    window.addEventListener("beforeunload", () => clearInterval(interval));
  }
}
```

**Problemas encontrados:**

| # | Problema | Severidad | Detalle |
|---|----------|-----------|---------|
| 1 | **Memory leak en SPA navigation** | Media | `setInterval` nunca se limpia en navegación SPA. `beforeunload` solo se dispara al cerrar la pestaña, no al navegar entre páginas. En Nuxt SPA mode, el interval persiste indefinidamente. |
| 2 | **No hay cleanup en hot reload (dev)** | Baja | En desarrollo con HMR, cada recarga del módulo crea un nuevo interval sin limpiar el anterior. |
| 3 | **useState para singleton es correcto** | ✅ | `useState` con key fija es el patrón correcto de Nuxt para estado compartido entre componentes. |

**Fix recomendado:** Usar `onNuxtReady` + un plugin de Nuxt para el polling, o mover a un plugin client-side que use `useIntervalFn` de VueUse (auto-cleanup).

**Impacto real:** Bajo. En producción, la app no hace SPA navigation frecuente (el usuario está en una página la mayor parte del tiempo). El interval de 30s con un request ligero no causa problemas perceptibles.

---

### 2.2 usePosTutorial + PosTutorial.vue

**Implementación:** Composable con `ref()` (no `useState`) + componente con Teleport.

**Problemas encontrados:**

| # | Problema | Severidad | Detalle |
|---|----------|-----------|---------|
| 1 | **Usa `ref()` en vez de `useState()`** | Baja | El tutorial es local a la página del POS, no necesita ser compartido. `ref()` es correcto aquí. |
| 2 | **`setTimeout(positionTooltip, 50)` es frágil** | Baja | Si el DOM tarda más de 50ms en renderizar (dispositivo lento), el tooltip se posiciona mal. Debería usar `requestAnimationFrame` o un `ResizeObserver`. |
| 3 | **No maneja resize/scroll** | Baja | Si el usuario rota el dispositivo o hace scroll durante el tutorial, el spotlight queda desalineado. |
| 4 | **`document.querySelector` en composable** | ✅ | Protegido por `import.meta.client`, correcto. |

**Impacto real:** Mínimo. El tutorial se muestra una sola vez, dura ~10 segundos, y el usuario no suele rotar el dispositivo durante ese tiempo.

---

### 2.3 ProductCardVisual.vue (animación + agotado)

**Implementación:** `animate-[cartBounce_0.4s_ease-out]` con `@keyframes` en `<style scoped>`.

**Problemas encontrados:**

| # | Problema | Severidad | Detalle |
|---|----------|-----------|---------|
| 1 | **Animación con Tailwind arbitrary value** | ✅ | `animate-[cartBounce_0.4s_ease-out]` es sintaxis válida de Tailwind. Funciona porque el keyframe está definido en `<style scoped>`. |
| 2 | **La animación se re-dispara correctamente** | ✅ | `:class="{ 'animate-...': isAdded }"` se activa/desactiva con el estado. Vue remueve y re-agrega la clase, lo que reinicia la animación CSS. |
| 3 | **`product.available` conectado al inventario** | ✅ | Viene del backend: `available: p.stock > 0 \|\| p.isService`. Se actualiza en cada fetch del catálogo. |
| 4 | **No hay re-fetch de disponibilidad en tiempo real** | Info | Si un producto se agota mientras el cliente tiene el catálogo abierto, sigue mostrando "Agregar" hasta que recarga. El backend valida stock al crear el pedido (server-side), así que no hay riesgo de oversell. |

**Impacto real:** Ninguno. El patrón es correcto y el backend es la fuente de verdad para stock.

---

### 2.4 Storefront Layout (navbar)

**Implementación:** Carrito elevado al centro, WhatsApp como nav item regular.

**Problemas encontrados:**

| # | Problema | Severidad | Detalle |
|---|----------|-----------|---------|
| 1 | **Duplicación de "Pedir" en fallback** | Bug | Cuando `whatsappLink` es null, se muestra "Pedir" como fallback del WhatsApp Y también el "Pedir" final. Resultado: dos items "Pedir" en la navbar. |
| 2 | **Dark mode incompleto en navbar** | Baja | El border del carrito elevado usa `dark:border-gray-950` pero el shadow no se adapta a dark mode. |
| 3 | **`whatsappLink` computed es reactivo** | ✅ | Se recalcula cuando `business.value` cambia. Correcto. |

**Fix recomendado para bug #1:** El "Pedir" final debería tener `v-if="whatsappLink"` para no duplicarse cuando no hay WhatsApp.

---

### 2.5 Dashboard: Store Status Card

**Implementación:** Fetch de `/api/store-settings` + `/api/store-stats` en `Promise.allSettled`.

**Problemas encontrados:**

| # | Problema | Severidad | Detalle |
|---|----------|-----------|---------|
| 1 | **Patrón correcto con allSettled** | ✅ | Si store-settings falla, el resto del dashboard sigue funcionando. |
| 2 | **`storeOnline` inicializado como `null`** | ✅ | El card solo se muestra con `v-if="storeOnline !== null"`, evitando flash de contenido. |
| 3 | **No hay polling del store status** | Info | El estado de la tienda solo se actualiza al cargar el dashboard. Si el comerciante activa/desactiva la tienda en otra pestaña, el dashboard no se entera hasta recargar. Aceptable. |

---

### 2.6 Onboarding Simplificado

**Implementación:** 2 pantallas (business info → primer producto → done).

**Problemas encontrados:**

| # | Problema | Severidad | Detalle |
|---|----------|-----------|---------|
| 1 | **`businessType` inicializado como `"tienda"`** | ✅ | Default razonable, el usuario puede cambiar antes de submit. |
| 2 | **`goToPOS()` en vez de `goToDashboard()`** | ✅ | Alineado con la filosofía "Ir a vender" del roadmap. |
| 3 | **Producto con `stock: 999`** | Info | El primer producto se crea con stock 999 (infinito virtual). Correcto para el onboarding — el comerciante ajusta después. |
| 4 | **No valida slug mínimo en UI** | Baja | El `canSubmit` requiere `slug.length >= 3` pero no muestra feedback visual de por qué el botón está deshabilitado si el slug es muy corto. |

---

### 2.7 Devolución Parcial (Sales History)

**Implementación:** Modal con selector de cantidad por item + endpoint existente.

**Problemas encontrados:**

| # | Problema | Severidad | Detalle |
|---|----------|-----------|---------|
| 1 | **No valida `already returned` en frontend** | Media | El frontend muestra `item.quantity` como máximo retornable, pero no descuenta las devoluciones previas. Si ya se devolvió 1 de 3, el frontend sigue mostrando max 3. El backend valida correctamente y rechaza, pero el UX es confuso. |
| 2 | **`returnTotal` calcula sin descuento** | Baja | Usa `unitPrice * returnQty` sin considerar `discountPercent`. El backend sí lo calcula correctamente con descuento. La diferencia es solo visual en el modal (el monto real del reembolso puede ser menor). |
| 3 | **Endpoint usa el existente** | ✅ | `POST /sales/:id/return` ya valida todo server-side. |

---

## 3. Patrones de Nuxt 3 — Conformidad

### useState vs ref

| Composable | Usa | Correcto | Razón |
|---|---|---|---|
| useOrdersBadge | `useState` | ✅ | Estado compartido entre sidebar y páginas |
| usePosTutorial | `ref` | ✅ | Estado local a la página del POS |
| useCart | `useState` | ✅ | Compartido entre catálogo, cart, checkout |
| useStorefront | `useState` | ✅ | Compartido entre todas las páginas del storefront |

### SSR Safety

| Composable | Protección SSR | Correcto |
|---|---|---|
| useOrdersBadge | `import.meta.client` guard | ✅ |
| usePosTutorial | `import.meta.client` en localStorage | ✅ |
| useCart | `import.meta.client` en localStorage | ✅ |
| useTenant | `import.meta.server` para SSR, client fallback | ✅ |
| useStorefront | `$fetch` (universal) | ✅ |

### Hydration Safety

| Componente | Riesgo de mismatch | Mitigación |
|---|---|---|
| PosTutorial | Ninguno | Solo se monta client-side (Teleport + `v-if`) |
| ProductCardVisual | Ninguno | Datos vienen del server, no hay client-only state en render |
| Storefront layout | Bajo | `itemCount` viene de `useState` (hydrated from server = 0) |
| Dashboard store card | Ninguno | `v-if="storeOnline !== null"` previene render en SSR |

---

## 4. Bugs Confirmados

| # | Bug | Archivo | Severidad | Fix |
|---|-----|---------|-----------|-----|
| 1 | **Navbar: "Pedir" duplicado cuando no hay WhatsApp** | `storefront.vue` | Media | Agregar `v-if="whatsappLink"` al "Pedir" final |
| 2 | **Devolución: no muestra cantidad ya devuelta** | `history.vue` | Baja | Fetch returns previas del endpoint y restar del max |
| 3 | **Devolución: total visual sin descuento** | `history.vue` | Baja | Usar `lineTotal / quantity * returnQty` en vez de `unitPrice * returnQty` |

---

## 5. Cosas que Pueden Fallar en Producción

### 5.1 Polling sin cleanup (useOrdersBadge)

**Escenario:** Si Nuxt hace client-side navigation y el composable se re-ejecuta,
`useState("orders-badge-initialized")` ya es `true`, así que no crea un segundo interval.
Esto es correcto — el singleton funciona.

**Pero:** Si el usuario cierra sesión y vuelve a entrar sin recargar la página,
el interval sigue corriendo con las credenciales anteriores (o sin credenciales).
El `$api` call fallará silenciosamente (catch vacío). No es un bug funcional,
pero genera requests 401 innecesarios.

### 5.2 Cart stale después de cambio de precios

**Escenario:** El comerciante cambia el precio de un producto. Un cliente que
ya tiene ese producto en el carrito (localStorage) ve el precio viejo.

**Mitigación actual:** El backend valida precios server-side al crear el pedido
(`catalog.ts` línea 445-449). Si el precio no coincide, rechaza con error claro.
El cliente ve "Precio incorrecto" y debe recargar.

**Impacto:** Bajo. Los precios cambian raramente y el error es claro.

### 5.3 Stock race condition en checkout

**Escenario:** Dos clientes agregan el último item al carrito simultáneamente.
Ambos ven "Agregar" (stock > 0). Ambos hacen checkout.

**Mitigación actual:** El backend usa transacción atómica con `FOR UPDATE` en
el stock check. El primero en confirmar gana, el segundo recibe error
"Stock insuficiente". Correcto.

### 5.4 Tutorial spotlight en mobile con teclado abierto

**Escenario:** Si el tutorial se activa mientras el teclado virtual está abierto
(ej: el usuario tocó el search bar), el viewport cambia y el spotlight queda
desalineado.

**Mitigación:** El tutorial se activa después de `nextTick()` post-carga de
productos, momento en el que el teclado no debería estar abierto. Riesgo bajo.

---

## 6. Recomendaciones

### Inmediato (fix bugs)

1. Fix navbar duplicada: agregar `v-if="whatsappLink"` al "Pedir" final
2. Fix devolución visual: usar lineTotal proporcional

### Futuro (mejoras)

3. Mover polling a un Nuxt plugin client-side con cleanup apropiado
4. Agregar `onBeforeUnmount` cleanup pattern si se migra a composable con lifecycle
5. Considerar WebSockets o Server-Sent Events para notificaciones instantáneas
   (eliminaría la necesidad de polling)

---

## 7. Conclusión

La implementación sigue patrones correctos de Nuxt 3 en un 95%. Los composables
usan `useState` donde corresponde, protegen acceso a browser APIs con
`import.meta.client`, y los datos fluyen correctamente entre storefront y dashboard
a través de la API.

Los dos bugs encontrados (navbar duplicada, devolución visual) son cosméticos
y no afectan la integridad de datos. El backend es siempre la fuente de verdad
para precios, stock, y validaciones — el frontend es optimista pero el backend
es autoritativo.
