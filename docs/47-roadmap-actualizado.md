# Nala: Roadmap actualizado — Mayo 2026

> Fuente unica de verdad. Reemplaza doc 45 y todos los anteriores.
> Actualizado: 14 mayo 2026 post-auditoria completa de codigo + PRs #254-#274.

---

## Estado actual

| Metrica | Valor |
|---------|-------|
| LOC | ~31,000 |
| Tablas | 34 (schema.ts) |
| Migraciones | 17 (journal) |
| Paginas frontend | 35 |
| Componentes | 11 |
| Composables | 13 |
| Tests | 14 archivos |
| CI | GitHub Actions (typecheck + lint + test + build con Postgres + Redis) |
| PRs | #79-#274 |

### Que funciona en produccion

- POS con categorias, barcode scanner, creacion rapida de producto
- Dashboard con 10 API calls en paralelo, pull-to-refresh, skeleton loading
- Inventario con semaforo de stock, prediccion de agotamiento, multi-imagen (5 fotos), vista lista/grid
- Storefront PWA con checkout, carousel de imagenes, infinite scroll, IGTF
- OCR de facturas (GPT-4o-mini vision)
- Cierre/apertura de caja
- Cuentas por cobrar con cobro por WhatsApp (wa.me pre-armado)
- Reportes consolidados en 3 tabs (Hoy, Periodo, Inventario) + export Excel
- Tasa BCV manual + endpoint auto-fetch como fallback
- Pedidos online con confirmacion rapida desde dashboard + sonido
- Command palette (Cmd+K)
- Toast notifications en settings, clientes, pedidos, historial
- Glassmorphism design system
- Devolucion parcial (API endpoint, falta UI)
- Proxy de imagenes publico con CORP cross-origin (fix verificado)
- Migracion automatica de bucket legacy en MinIO

### Resuelto en PRs #254-#274

- [x] Migration bootstrap para DBs push-era
- [x] RLS resiliente con validacion de columnas (PR #265)
- [x] init.sql ya no se ejecuta (solo referencia)
- [x] Imagenes: bucket init, proxy publico, CORP header fix (PRs #266-#268)
- [x] Multi-imagen: hasta 5 fotos por producto, galeria, carousel (PRs #272-#274)
- [x] Orden de migraciones en journal corregido
- [x] Toast notifications integrados en 5 paginas
- [x] Paginacion del catalogo con infinite scroll
- [x] Vista grid con toggle lista/cuadricula en inventario

---

## Lo que falta

### CRITICO: Simplificar el flujo de ventas

**Problema principal:** Vender un producto requiere 4 pantallas y 6+ taps. Para una PyME venezolana donde el 80% de las ventas son "dame X, pago movil", eso es demasiada friccion. Treinta resuelve esto con 2 taps.

#### C.1 Venta rapida sin producto

**Que:** Boton prominente en el POS para registrar una venta sin seleccionar producto. Solo monto + metodo de pago. Para ventas informales, servicios, o productos que no estan en inventario.

**Por que:** El 80% de las PyMEs latinas no tienen todos sus productos cargados. Obligar a crear un producto antes de vender es la barrera #1 de adopcion.

**Estimado:** 1 dia

#### C.2 Checkout en una sola pantalla

**Que:** Eliminar la navegacion a `/sales/checkout`. Los metodos de pago aparecen en el mismo panel del ticket. Toca producto, toca metodo de pago, confirmar. Una pantalla.

**Detalles avanzados** (canal, recargos, IGTF, referencia, cliente) van en un colapsable "Mas opciones" que se abre solo cuando se necesita.

**Estimado:** 1-2 dias

#### C.3 Venta por monto directo desde el dashboard

**Que:** Widget en el dashboard: campo de monto + selector de metodo de pago + boton "Registrar". Para el dueno que solo quiere anotar que entro dinero.

**Estimado:** 4 horas

---

### Prioridad 1: Deuda tecnica restante

#### 1.1 Consistencia visual en paginas secundarias

**Problema:** `/more.vue`, `/clients/index.vue`, `/settings/index.vue` usan estilos planos mientras el resto usa glassmorphism.

**Estimado:** 2-3 horas

#### 1.2 Ocultar paginas que no aportan valor

**Accion:** Quitar de la navegacion:
- Cotizaciones (`/sales/quotations`) — 0 uso
- Proveedores (`/suppliers`) — solo se usa internamente en OCR
- Contabilidad asientos — se genera sola

**Estimado:** 1 hora

#### 1.3 Eliminar codigo muerto

- `useOfflineQueue.ts` — ya no existe (eliminado)
- `/catalogo/[slug].vue` — ya no existe
- `settings/store.vue` — solo 16 lineas, redirect a `/store`

**Estimado:** 30 min

---

### Prioridad 2: UX que falta

#### 2.1 UI de devolucion parcial

**Estado:** El endpoint `POST /api/sales/:id/return` ya existe (PR #c75e64e). La tabla `sale_returns` + `sale_return_items` existe. Falta la UI en `/sales/history` para seleccionar items a devolver.

**Estimado:** 1 dia

#### 2.2 Comprobante PDF compartible

**Estado:** El endpoint de PDF existe (`reports-pdf.ts`). Falta boton "Compartir" en historial de ventas usando Web Share API.

**Estimado:** 2-3 horas

#### 2.3 Export Excel desde inventario

**Estado:** El endpoint XLSX existe (`reports-xlsx.ts`). El boton ya existe en reportes. Falta en inventario.

**Estimado:** 1 hora

---

### Prioridad 3: Features diferenciadores

#### 3.1 Import por foto de lista de precios

**Que:** Foto de la lista del proveedor -> OCR -> crear/actualizar productos. Pipeline OCR ya existe para facturas.

**Estimado:** 1-2 dias

#### 3.2 Multi-usuario (Clerk Organizations)

**Que:** Roles owner/manager/cashier. Invitacion por link.

**Estimado:** 2-3 dias

#### 3.3 Personalizacion del storefront

**Que:** Color de marca, logo, dark mode. `welcomeMessage` ya existe en `store_settings`.

**Estimado:** 1-2 dias

#### 3.4 WhatsApp Business API (futuro)

**Que:** Recibir pedidos por WhatsApp, enviar confirmaciones automaticas, catalogo por chat.

**Estimado:** 1-2 semanas (requiere Meta Business verification)

---

## Orden de ejecucion recomendado

```
Inmediato: Simplificar ventas (lo mas importante)
  C.1 Venta rapida sin producto .............. 1 dia
  C.2 Checkout en una pantalla ............... 2 dias
  C.3 Widget de venta en dashboard ........... 4 horas

Semana siguiente: Deuda tecnica + UX
  1.1 Consistencia visual .................... 3 horas
  1.2 Ocultar paginas ........................ 1 hora
  1.3 Codigo muerto .......................... 30 min
  2.1 UI devolucion parcial .................. 1 dia
  2.2 Comprobante compartible ................ 3 horas
  2.3 Export Excel inventario ................ 1 hora

Despues: Features nuevos
  3.1 Import por foto ........................ 2 dias
  3.2 Multi-usuario .......................... 3 dias
  3.3 Personalizacion storefront ............. 2 dias
```

---

## Tablas sin UI (mantener en schema)

| Tabla | Razon |
|-------|-------|
| `customerSegments` | WhatsApp broadcasts futuro |
| `unitsOfMeasure` | Datos en produccion |
| `bankAccounts` | Datos en produccion |
| `notificationPreferences` | Datos en produccion |
| `surchargeTypes` | Usado en checkout POS |

---

## Docs deprecados

Todos los docs anteriores (01-45, PRODUCTION-ROADMAP, AUTH-*) son historicos.

**Fuente de verdad: este archivo (docs/47-roadmap-actualizado.md).**
