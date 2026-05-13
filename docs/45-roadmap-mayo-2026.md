# Nova: Roadmap Mayo 2026

> Fuente unica de verdad. Reemplaza docs 36, 44, PRODUCTION-ROADMAP.
> Actualizado: 13 mayo 2026 post-auditoria completa de codigo.

---

## Estado actual

| Metrica | Valor |
|---------|-------|
| LOC | ~30,000 |
| Tablas | 30 (schema.ts) |
| Migraciones | 15 (journal) |
| Endpoints API | 87 |
| Paginas frontend | 35 |
| Componentes | 10 |
| Composables | 12 |
| Tests | 10 archivos (~132 cases) |
| CI | GitHub Actions (typecheck + lint + test + build con Postgres + Redis) |
| PRs | #79-#257 |

### Que funciona en produccion

- POS con categorias, barcode scanner, creacion rapida de producto
- Dashboard con 10 API calls en paralelo, pull-to-refresh, skeleton loading
- Inventario con semaforo de stock, prediccion de agotamiento, imagenes, vista lista/grid
- Storefront PWA con checkout, validacion de precios server-side, IGTF en checkout
- OCR de facturas (GPT-4o-mini vision)
- Cierre/apertura de caja
- Cuentas por cobrar con cobro por WhatsApp (wa.me pre-armado)
- Reportes consolidados en 3 tabs (Hoy, Periodo, Inventario)
- Tasa BCV manual + endpoint auto-fetch como fallback
- Pedidos online con confirmacion rapida desde dashboard
- Command palette (Cmd+K)
- Glassmorphism design system

### Que se arreglo hoy (PRs #254-#257)

- [x] Migration bootstrap para DBs push-era (journal + SHA-256 hashes)
- [x] RLS resiliente (query pg_tables antes de aplicar policies)
- [x] init.sql con DO blocks condicionales
- [x] Bug de imagenes: upload devuelve presigned URL + recovery de URLs legacy
- [x] Thumbnails en inventario (lista desktop + cards mobile)
- [x] Vista grid con toggle lista/cuadricula

---

## Lo que hay que arreglar primero

### Prioridad 1: Bugs y deuda tecnica (antes de features nuevos)

#### 1.1 Eliminar duplicacion RLS (init.sql vs applyRlsPolicies)

**Problema:** El entrypoint corre `psql init.sql` y luego el API corre `applyRlsPolicies()` en TypeScript. Ambos hacen exactamente lo mismo. Si se agrega una tabla nueva, hay que actualizar dos archivos.

**Fix:** Eliminar el paso de `psql init.sql` del entrypoint. Dejar solo `applyRlsPolicies()` que ya es resiliente (query pg_tables, skip missing). Mantener `init.sql` solo como referencia/documentacion, no ejecutarlo.

**Archivos:** `entrypoint-api.sh`, `Dockerfile` (quitar `postgresql-client` del stage api)

**Estimado:** 30 min

#### 1.2 IGTF en el POS

**Problema:** El IGTF (3%) esta implementado en el storefront checkout (`/tienda/checkout.vue`) pero NO en el POS checkout (`/sales/checkout.vue`). Un vendedor que cobra en divisas desde el POS no calcula el impuesto.

**Fix:** Agregar checkbox "Incluir IGTF (3%)" en `/sales/checkout.vue` cuando el metodo de pago es en divisas (Zelle, Binance, efectivo USD). Mismo patron que el storefront.

**Archivos:** `apps/web/app/pages/sales/checkout.vue`

**Estimado:** 1-2 horas

#### 1.3 Paginacion del catalogo publico

**Problema:** `GET /catalog/:slug` carga todos los productos de una vez. Con 200+ productos, la pagina sera lenta en mobile.

**Fix:** Agregar `?limit=50&offset=0` al endpoint. Scroll infinito en `/tienda/index.vue` con IntersectionObserver.

**Archivos:** `apps/api/src/routes/catalog.ts`, `apps/web/app/pages/tienda/index.vue`

**Estimado:** 2-3 horas

#### 1.4 Orden de migraciones en journal

**Problema:** PR #254 agrego las migraciones faltantes al journal pero en orden incorrecto. `0009` (idx 11) se ejecuta despues de `0012` (idx 10). En una DB fresca, `0013_single_user_cleanup` hace DROP COLUMN de columnas que `0012_clerk_organizations` crea, pero `0013` se ejecuta despues de `0012` en el journal. Esto funciona porque los DROPs usan `IF EXISTS`, pero el orden deberia ser cronologico para claridad.

**Fix:** Reordenar las entradas del journal para que los idx sean cronologicos. No afecta DBs existentes (ya tienen el journal seeded).

**Archivos:** `packages/db/drizzle/meta/_journal.json`

**Estimado:** 15 min

#### 1.5 Consistencia visual en paginas secundarias

**Problema:** `/more.vue`, `/clients/index.vue`, `/settings/index.vue` usan `bg-white shadow-sm rounded-xl` plano mientras el resto de la app usa glassmorphism (`card-premium`, `glass`). Se siente como dos apps distintas.

**Fix:** Migrar estas 3 paginas al design system premium. No cambiar funcionalidad, solo clases CSS.

**Archivos:** `apps/web/app/pages/more.vue`, `apps/web/app/pages/clients/index.vue`, `apps/web/app/pages/settings/index.vue`

**Estimado:** 2-3 horas

---

### Prioridad 2: Features que mejoran la experiencia

#### 2.1 Toast/snackbar de confirmacion

**Problema:** No hay feedback visual al completar acciones (guardar producto, crear venta, confirmar pedido). El usuario no sabe si funciono.

**Fix:** Crear composable `useToast()` con componente flotante. Llamar despues de cada accion exitosa. Patron: toast verde "Producto guardado" que desaparece en 3s.

**Archivos:** Nuevo composable + componente, editar ~8 paginas

**Estimado:** 3-4 horas

#### 2.2 Comprobante compartible por WhatsApp

**Problema:** Post-venta, el vendedor quiere enviar el recibo al cliente por WhatsApp. El endpoint `GET /api/sales/:id/receipt` ya genera PDF, pero no hay boton en la UI.

**Fix:** Agregar boton "Compartir" en `/sales/history` y en la pantalla post-checkout. Usar Web Share API (nativa en mobile) con fallback a descarga directa.

**Archivos:** `apps/web/app/pages/sales/history.vue`, `apps/web/app/pages/sales/checkout.vue`

**Estimado:** 2-3 horas

#### 2.3 Export a Excel desde reportes e inventario

**Problema:** El endpoint `reports-xlsx.ts` existe pero no hay boton en la UI que lo llame.

**Fix:** Agregar boton "Exportar" en `/reports/index.vue` y `/inventory/index.vue`. Descarga directa del XLSX.

**Archivos:** 2 paginas frontend

**Estimado:** 1-2 horas

#### 2.4 Notificacion sonora de nuevo pedido

**Problema:** `useOrderSound.ts` existe pero hay que verificar que funciona. Cuando un cliente hace un pedido en el storefront, el dueno deberia escuchar un sonido si tiene la app abierta.

**Fix:** Verificar composable, agregar audio file, integrar con polling de pedidos.

**Archivos:** `apps/web/app/composables/useOrderSound.ts`

**Estimado:** 1 hora

---

### Prioridad 3: Simplificar (quitar lo que sobra)

#### 3.1 Ocultar paginas que no aportan valor

**Accion:** Quitar de la navegacion (sidebar + mobile "Mas"), mantener rutas accesibles por URL:
- Contabilidad (asientos) -- se genera sola, no necesita UI
- Proveedores -- solo se usa internamente en OCR
- Cotizaciones -- 0 uso

**Archivos:** `Sidebar.vue`, `BottomTabs.vue`, `more.vue`

**Estimado:** 1 hora

#### 3.2 Eliminar codigo muerto

**Accion:** Verificar y eliminar si no se usan:
- `useOfflineQueue.ts` (cola de ventas offline, complejidad alta, uso 0%)
- `/catalogo/[slug].vue` si duplica `/tienda`
- Paginas de settings individuales que ya estan consolidadas

**Estimado:** 1-2 horas

---

### Prioridad 4: Features nuevos (diferenciadores)

#### 4.1 Devolucion parcial

**Descripcion:** `POST /sales/:id/return` con items parciales. Hoy hay que anular toda la venta.

**Estimado:** 1 dia

#### 4.2 Import por foto de lista de precios

**Descripcion:** Tomar foto de la lista de precios del proveedor -> OCR -> crear/actualizar productos. El pipeline OCR ya existe para facturas, se reutiliza.

**Estimado:** 1-2 dias

#### 4.3 Multi-usuario (Clerk Organizations)

**Descripcion:** Roles owner/manager/cashier. Invitacion por link. Ver doc AUTH-CURRENT-STATE.md seccion 7.

**Estimado:** 2-3 dias

#### 4.4 Personalizacion del storefront

**Descripcion:** Color de marca, logo, dark mode. `welcomeMessage` ya existe en `store_settings`.

**Estimado:** 1-2 dias

---

## Orden de ejecucion recomendado

```
Semana 1: Prioridad 1 (bugs + deuda tecnica)
  1.1 Eliminar duplicacion RLS .............. 30 min
  1.2 IGTF en POS ........................... 2 horas
  1.3 Paginacion catalogo ................... 3 horas
  1.4 Orden migraciones ..................... 15 min
  1.5 Consistencia visual ................... 3 horas

Semana 2: Prioridad 2 (UX) + Prioridad 3 (simplificar)
  2.1 Toast/snackbar ........................ 4 horas
  2.2 Comprobante WhatsApp .................. 3 horas
  2.3 Export Excel .......................... 2 horas
  2.4 Sonido pedidos ........................ 1 hora
  3.1 Ocultar paginas ....................... 1 hora
  3.2 Eliminar codigo muerto ................ 2 horas

Semana 3-4: Prioridad 4 (features nuevos)
  4.1 Devolucion parcial .................... 1 dia
  4.2 Import por foto ....................... 2 dias
  4.3 Multi-usuario ......................... 3 dias
  4.4 Personalizacion storefront ............ 2 dias
```

---

## Tablas huerfanas (mantener en schema, sin UI)

| Tabla | Razon para mantener |
|-------|-------------------|
| `customerSegments` | Podria usarse para WhatsApp broadcasts futuro |
| `unitsOfMeasure` | Ya tiene datos en produccion, no vale la pena migrar |
| `bankAccounts` | Idem |
| `notificationPreferences` | Idem |
| `surchargeTypes` | Delivery fee ya esta en store_settings |

---

## Docs deprecados

Los siguientes docs son historicos y no deben consultarse para decisiones:

- `PRODUCTION-ROADMAP.md` -- apunta a doc 22 que ya no aplica
- `docs/22-*` -- roadmap WhatsApp eliminado
- `docs/36-roadmap-consolidado.md` -- reemplazado por este doc
- `docs/44-nala-pyme-roadmap-tentativo.md` -- incorporado en este doc
- `docs/01-35` -- historico de sesiones, no roadmap

**Fuente de verdad: este archivo (docs/45-roadmap-mayo-2026.md).**
