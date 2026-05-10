# Nova UI Roadmap v1: Storefront + Dashboard Polish

> Auditoria post-storefront. Priorizado por impacto en conversion y UX.
> Fecha: Mayo 2026. Estado: **COMPLETADO** (PRs #217-#221).

---

## Estado de implementacion

| Sprint | Items | PR | Estado |
|--------|-------|----|--------|
| UI-1 | #1, #2, #3, #4, #5 | #217 | Completado |
| UI-2 | #6, #7, #12 | #218 | Completado |
| UI-3 | #8, #13, #14 | #219 | Completado |
| UI-4 | #9, #10, #15 | #220 | Completado |
| UI-5 | #11 | #221 | Completado |

**Descatalogado:** #16 (Web Push notifications) — redundante con WhatsApp como canal de notificacion principal. Se puede reconsiderar si se desacopla WhatsApp o se agregan empleados.

---

## Bugs y gaps funcionales — COMPLETADO (PR #217)

- **#1** Header nombre negocio: `storefront.vue` usa `useStorefront().business.name` directamente.
- **#2** Cart badge: `useCart().itemCount` con badge numerico (cap 99+).
- **#3** Duplicado `/settings/store.vue`: reemplazado con redirect 301 a `/store`.
- **#4** Tasa BCV en cart/checkout: `$X.XX / Bs. Y.YY` via `exchangeRate`.
- **#5** Auto-cancel: piggyback fire-and-forget en `GET /orders`.

## PWA Storefront — COMPLETADO (PRs #218-#221)

- **#6** PWA install prompt: composable `usePwaInstall` + banner con soporte iOS.
- **#7** Compartir tienda: WhatsApp, Instagram, Web Share API en `/store`.
- **#8** Busqueda productos: input client-side en catalogo (min 2 chars).
- **#9** Floating cart mejorado: subtotal visible, sombra prominente.
- **#10** Micro-interacciones: shimmer skeleton, haptic feedback.
- **#11** Dark mode: `prefers-color-scheme: dark` en todo el storefront.

## Dashboard vendedor — COMPLETADO (PRs #218-#220)

- **#12** Sonido notificacion: composable `useOrderSound` (Web Audio API, mute toggle).
- **#13** Onboarding checklist: composable `useOnboardingChecklist` + widget dashboard.
- **#14** Preview tienda: boton "Ver como se ve tu tienda" en `/store`.
- **#15** Estadisticas tienda: endpoint `GET /api/store-stats` + cards en `/store`.

## Descatalogado

- **#16** Web Push notifications: redundante con WhatsApp. El vendedor recibe notificacion inmediata via WhatsApp al llegar un pedido. Reconsiderar si se desacopla WhatsApp o se agregan empleados.

---

## Composables creados

| Composable | Sprint | Funcion |
|-----------|--------|---------|
| `usePwaInstall` | UI-2 | Captura beforeinstallprompt, detecta iOS, persiste dismissal |
| `useOrderSound` | UI-2 | Beep via Web Audio API, mute toggle en localStorage |
| `useOnboardingChecklist` | UI-3 | Verifica 5 pasos de setup, progress tracking |

## Endpoints API creados

| Endpoint | Sprint | Funcion |
|---------|--------|---------|
| `GET /api/store-stats` | UI-4 | Pedidos semana, ingresos, pendientes |
