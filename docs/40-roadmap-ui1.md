# Nova UI Roadmap v1: Storefront + Dashboard Polish

> Auditoria post-storefront. Priorizado por impacto en conversion y UX.
> Fecha: Mayo 2026. Estado: Storefront feature completo (PRs #206-#215).

---

## Bugs y gaps funcionales (fix inmediato)

### 1. Header de la tienda no muestra nombre del negocio
- **Archivo:** `app/layouts/storefront.vue`
- **Problema:** Usa `<slot name="store-name">Tienda</slot>` pero ningun hijo lo llena. Siempre dice "Tienda".
- **Fix:** Usar `useStorefront().business.name` directamente en el layout en vez de slot.

### 2. Cart badge no muestra conteo en header
- **Archivo:** `app/layouts/storefront.vue`
- **Problema:** `<slot name="cart-badge" />` nunca se llena. El icono del carrito no muestra cuantos items hay.
- **Fix:** Usar `useCart().itemCount` directamente en el layout.

### 3. `/settings/store.vue` duplicado sigue dando error
- **Archivo:** `app/pages/settings/store.vue`
- **Problema:** La pagina vieja sigue existiendo y da error. Ahora la pagina principal es `/store`.
- **Fix:** Eliminar `/settings/store.vue` o redirigir a `/store`.

### 4. Tasa BCV solo se muestra en catalogo
- **Archivos:** `app/pages/tienda/cart.vue`, `app/pages/tienda/checkout.vue`
- **Problema:** El carrito y checkout solo muestran USD. El cliente tiene que calcular Bs mentalmente.
- **Fix:** Pasar `exchangeRate` de `useStorefront()` al carrito y checkout. Mostrar `$5.00 / Bs. 432.40`.

### 5. Auto-cancel no se ejecuta automaticamente
- **Archivo:** `apps/api/src/utils/auto-cancel.ts`
- **Problema:** El endpoint `POST /api/orders/auto-cancel` existe pero nada lo llama.
- **Fix:** Agregar un check al inicio del `GET /api/orders` que cancele stale orders del business (piggyback en el polling de 30s).

---

## PWA Storefront: mejoras de UX (lo que ve el cliente)

### 6. PWA install prompt custom
- **Prioridad:** Alta
- **Referencia:** Starbucks PWA, Twitter Lite
- **Que hacer:** Capturar `beforeinstallprompt` event. Mostrar un banner fijo en el footer de la tienda: "Instala esta tienda en tu celular" con boton "Instalar". En iOS mostrar instrucciones de Safari (Share > Add to Home Screen).
- **Impacto:** 3x mas instalaciones vs prompt nativo del browser.

### 7. Compartir tienda (link + redes sociales)
- **Prioridad:** Alta
- **Referencia:** Stan Store, Linktree
- **Que hacer:** En la pagina `/store` del dashboard, agregar seccion "Compartir tu tienda" con:
  - Link copiable (ya existe)
  - Boton "Compartir por WhatsApp" (abre wa.me con texto pre-armado: "Visita mi tienda: {url}")
  - Boton "Compartir en Instagram" (copia link + instrucciones para bio)
  - Boton "Compartir" nativo (Web Share API si disponible)
- **Por que es mejor que QR:** El vendedor esta en su celular. Compartir un link en WhatsApp/Instagram es 1 tap. El QR requiere que alguien lo escanee fisicamente. El link llega a mas personas.

### 8. Busqueda de productos en catalogo
- **Prioridad:** Media
- **Referencia:** Square Online, Shopify
- **Que hacer:** Input de busqueda debajo del header en `/tienda/index.vue`. Filtra por nombre en tiempo real (client-side, ya tenemos todos los productos cargados).
- **Impacto:** Util cuando el negocio tiene >20 productos.

### 9. Sticky "Agregar al carrito" en mobile
- **Prioridad:** Media
- **Referencia:** Shopify 2026, Gymshark
- **Que hacer:** Cuando el usuario scrollea en el catalogo y un producto esta visible, mostrar un boton fijo en la parte inferior (thumb zone). Alternativa: el floating cart button ya existe, solo falta hacerlo mas prominente.

### 10. Micro-interacciones
- **Prioridad:** Baja
- **Referencia:** Tendencia ecommerce 2026
- **Que hacer:**
  - Animacion al agregar al carrito (icono vuela al badge del header)
  - Transiciones suaves entre paginas (ya hay `pageTransition` pero se puede mejorar)
  - Shimmer effect en skeleton loading (en vez de bloques grises estaticos)
  - Haptic feedback en mobile (navigator.vibrate en add-to-cart)

### 11. Dark mode
- **Prioridad:** Baja
- **Referencia:** Tendencia 2026
- **Que hacer:** Respetar `prefers-color-scheme: dark` del sistema. Aplicar paleta oscura al layout storefront.

---

## Dashboard del vendedor: mejoras de UX

### 12. Sonido de notificacion para pedidos nuevos
- **Prioridad:** Alta
- **Referencia:** Toast POS, UberEats Merchant, DoorDash
- **Que hacer:** En el polling de 30s de `/orders/index.vue`, si `pendingCount` aumenta, reproducir un sonido corto (beep). Usar `new Audio('/notification.mp3').play()`. Agregar toggle en settings para silenciar.
- **Impacto:** El vendedor no tiene que mirar la pantalla constantemente.

### 13. Onboarding checklist widget en dashboard
- **Prioridad:** Alta
- **Referencia:** Shopify setup guide
- **Que hacer:** En el dashboard principal (`/index.vue`), mostrar un widget "Configura tu tienda online" con checklist:
  - [x] Crear negocio
  - [ ] Agregar productos
  - [ ] Configurar metodos de pago
  - [ ] Activar tienda
  - [ ] Compartir link
- Se oculta cuando todo esta completo. Cada item lleva a la pagina correspondiente.

### 14. Preview de la tienda desde el dashboard
- **Prioridad:** Media
- **Referencia:** Shopify, Wix
- **Que hacer:** En `/store`, agregar un boton "Ver como se ve tu tienda" que abre un iframe o nueva tab con la tienda del vendedor. Mostrar un mockup de celular con la URL.

### 15. Estadisticas basicas de la tienda
- **Prioridad:** Media
- **Referencia:** Square Analytics, Shopify
- **Que hacer:** En `/store`, mostrar cards con:
  - Pedidos esta semana
  - Ingresos por storefront
  - Pedidos pendientes
  - Tasa de conversion (si se implementa tracking de visitas)

### 16. Web Push notifications
- **Prioridad:** Media (requiere setup de push server)
- **Referencia:** Toast POS, DoorDash Merchant
- **Que hacer:** Implementar Web Push API para notificar al vendedor en su celular cuando llega un pedido nuevo. Reemplaza el polling de 30s con notificaciones reales.
- **Prerequisito:** Service worker ya existe (via @vite-pwa/nuxt). Falta el push server (puede ser un servicio como web-push npm package).

---

## Orden de ejecucion sugerido

### Sprint UI-1: Fixes criticos (1 dia)
Items: 1, 2, 3, 4, 5

### Sprint UI-2: Compartir + Install + Sonido (1 dia)
Items: 6, 7, 12

### Sprint UI-3: Busqueda + Onboarding + Preview (1 dia)
Items: 8, 13, 14

### Sprint UI-4: Polish visual (1 dia)
Items: 9, 10, 15

### Sprint UI-5: Futuro
Items: 11, 16

---

## Notas tecnicas

### PWA Install Prompt
```typescript
// En app.vue o storefront layout:
let deferredPrompt: BeforeInstallPromptEvent | null = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner.value = true;
});

function installPwa() {
  deferredPrompt?.prompt();
  deferredPrompt = null;
  showInstallBanner.value = false;
}
```

### Web Share API (compartir nativo)
```typescript
async function shareStore() {
  if (navigator.share) {
    await navigator.share({
      title: business.name,
      text: `Visita mi tienda: ${storeUrl}`,
      url: storeUrl,
    });
  } else {
    // Fallback: copiar link
    await navigator.clipboard.writeText(storeUrl);
  }
}
```

### Sonido de notificacion
```typescript
// En /orders/index.vue, dentro del polling:
const prevCount = ref(0);
watch(pendingCount, (newVal) => {
  if (newVal > prevCount.value && prevCount.value > 0) {
    new Audio('/sounds/new-order.mp3').play().catch(() => {});
  }
  prevCount.value = newVal;
});
```
