# Nala: Roadmap de Producto

> Mayo 2026. Filosofia Treinta: la venta genera el dato.
> Referencia: Treinta (Colombia, $46M, 7M+ usuarios), Square (EEUU), Loyverse (global).

---

## Filosofia

**La venta genera el dato. No al reves.**

El vendedor nunca "llena un sistema". Vende, y el sistema se organiza solo. Cada venta actualiza inventario, crea clientes, calcula estadisticas, y genera contabilidad automaticamente.

| Enfoque tradicional (Fina, Saint) | Enfoque Nala |
|---|---|
| "Registra tus productos con todos los datos" | "Nombre, precio, foto. Vende" |
| "Configura tu plan de cuentas" | "Vende. La contabilidad se genera sola" |
| "Registra a tus clientes" | "Vende. El cliente se crea cuando compra" |
| "Llena el formulario de gastos" | "Toma foto de la factura. Listo" |
| "Revisa tus 10 reportes" | "El dashboard te dice que hacer" |

### Principios

1. **2 toques para vender**: tap producto, tap cobrar
2. **3 campos para crear producto**: nombre, precio, foto. El resto es expandible
3. **0 configuracion para empezar**: nombre del negocio + primer producto = listo
4. **La camara es un input**: barcode, foto de factura, foto de lista de precios
5. **WhatsApp es el canal**: cobros de fiado, pedidos, comprobantes
6. **El dashboard sugiere acciones**: "3 productos criticos" -> tap -> ir a inventario
7. **Los datos se generan solos**: contabilidad, historial de precios, movimientos de stock

---

## Que cambiar en Nala

### Simplificar (inspirado en Treinta/Square/Loyverse)

| Que | Hoy | Debe ser |
|-----|-----|---------|
| Vender | POS con pasos intermedios | 2 toques: tap producto, tap cobrar |
| Crear producto | 15+ campos visibles | 3 campos: nombre, precio, foto. "Mas detalles" expandible |
| Crear cliente | Manual, antes de vender | Automatico: se crea cuando compra o hace pedido |
| Fiar | Requiere seleccionar cliente primero | "Fiar a [nombre]" directo desde el ticket |
| Cobrar fiado | Link wa.me manual | Boton "Cobrar" -> WhatsApp con mensaje pre-armado |
| Reportes | 10 paginas separadas | 1 pagina con 3 tabs: Hoy, Semana, Mes |
| Settings | 7 sub-paginas | 1 pagina con secciones colapsables |
| Onboarding | Multiples pasos | Nombre negocio + primer producto = listo |
| Import productos | Solo Excel, solo desktop | Excel + foto de lista de precios. Mobile y desktop |

### Lo que Nala ya tiene mejor que todos

| Feature | Treinta | Square | Loyverse | Nala |
|---------|---------|--------|----------|------|
| Tienda online PWA | Catalogo basico | Requiere Shopify | No | Completa con checkout |
| Pedidos online | No | Via Shopify | No | Flujo completo |
| OCR facturas | No | No | No | Si (GPT-4o-mini) |
| Inventario semaforo | Basico | Basico | Basico | Completo + prediccion |
| Cierre de caja | Basico | Si | No | Completo (apertura + cierre) |
| Cuentas por cobrar | Si | No | No | Con pagos parciales + aging |
| Bimoneda USD/Bs | No | No | No | Si, con tasa BCV |

---

## Features por agregar

| # | Feature | Descripcion | Fase |
|---|---------|-------------|------|
| 1 | **Cobro fiado por WhatsApp** | Boton "Cobrar" en cada deuda -> abre wa.me con mensaje pre-armado | 1 |
| 2 | **Tasa BCV auto + IGTF** | Fetch automatico cada 6h. IGTF 3% en ventas en divisas | 1 |
| 3 | **Validacion precios server-side** | Comparar precio enviado vs precio real en DB al crear pedido | 1 |
| 4 | **Paginacion catalogo** | LIMIT 100 + scroll infinito en storefront | 1 |
| 5 | **Import Excel mejorado** | Deteccion de duplicados por SKU. Funciona en mobile | 2 |
| 6 | **Import por foto** | Tomar foto de lista de precios del proveedor -> OCR -> crear productos | 2 |
| 7 | **Comprobante por WhatsApp** | Post-venta: compartir recibo como imagen por WhatsApp | 2 |
| 8 | **Multi-usuario** | Roles: owner, manager, cashier. Invitacion por link | 3 |
| 9 | **Dashboard con sugerencias** | "3 productos criticos" -> tap -> inventario. Reglas simples, no AI | 3 |
| 10 | **Link de pago compartible** | `nala.app/pay/abc123` con datos de pago + upload comprobante | 4 |
| 11 | **Personalizacion storefront** | Color de marca + logo + dominio custom | 5 |

---

## Que esta sobredimensionado en Nala hoy

### Eliminar (no aporta valor, agrega complejidad)

| Feature | Tabla(s) | Razon |
|---------|---------|-------|
| Segmentos de clientes | `customerSegments` | CRM enterprise. 0% uso |
| Unidades de medida | `unitsOfMeasure` | Sobreingenieria |
| Cuentas bancarias | `bankAccounts` | El vendedor sabe sus cuentas |
| Preferencias de notificacion | `notificationPreferences` | No hay notificaciones reales |
| Tipos de recargo | `surchargeTypes` | Delivery fee ya esta en store_settings |
| Offline sales queue | `useOfflineQueue` composable | Complejidad alta, uso ~0% |
| Product cache agresivo | `useProductCache` (1000 items) | Innecesario con buena conexion |
| Catalogo duplicado | `/catalogo/[slug]` pagina | Duplica el storefront `/tienda` |
| 10 paginas de reportes | 10 archivos .vue | Consolidar en 1 pagina |

### Simplificar

| Feature | Hoy | Deberia ser |
|---------|-----|-------------|
| Crear producto | 15+ campos en formulario | 3 campos: nombre, precio, foto. "Mas detalles" expandible |
| Reportes | 10 paginas separadas | 1 pagina con 3 tabs: Hoy, Semana, Mes |
| Settings | 7 sub-paginas | 1 pagina con secciones colapsables |
| Contabilidad | Pagina dedicada con asientos | Invisible. Se genera sola. Sin UI |
| Proveedores | CRUD completo con pagina | Solo nombre en OCR. Sin pagina dedicada |
| Historial de precios | Tabla + UI | Mantener tabla, eliminar UI |

---

## Buyer Persona

### Roberto -- Comerciante (el cliente principal)

- **Negocio:** Bodega, mini-market, tienda de ropa, licoreria, tienda de celulares, distribuidora
- **Productos:** 50-500 items
- **Personas:** 1-5 (el dueno + ayudantes)
- **Facturacion:** $500-$10,000 USD/mes
- **Dispositivo:** Android gama media. Algunos tienen computadora en el mostrador
- **Hoy usa:** Cuaderno, Excel, Fina, o nada
- **Dolor:** "No se cuanto vendi", "Se me olvido que me deben", "Quiero que me pidan por internet"
- **No necesita:** Contabilidad formal, facturacion fiscal, reportes complejos

---

## Competencia

| Feature | Square | Loyverse | Treinta | Fina | Nala (propuesto) |
|---------|--------|----------|---------|------|-----------------|
| Venta en 2 toques | Si | Si | Si | No | **Si** |
| Producto en 3 campos | Si | Si | Si | No | **Si** |
| POS movil | Si | Si | Si | Si | **Si** |
| Inventario con semaforo | Basico | Basico | Basico | Basico | **Completo** |
| Fiado + cobro WhatsApp | No | No | Link | Link | **API real** |
| Tienda online PWA | Si (Shopify) | No | Basico | No | **Completa** |
| WhatsApp API real | No | No | No | No | **Si** |
| OCR facturas | No | No | No | No | **Si** |
| Input por voz | No | No | No | No | **Si** |
| Link de pago compartible | Si (Square) | No | No | No | **Si** |
| Import por foto | No | No | No | No | **Si** |
| Multi-usuario | Si | Add-on | Si | Si | **Si** |
| Bimoneda (USD/Bs) | No | No | No | Si | **Si** |
| Tasa BCV auto | No | No | No | Si | **Si** |
| IGTF | No | No | No | No | **Si** |
| Sugerencias inteligentes | No | No | No | No | **Si** |
| Dark mode storefront | Si | No | No | No | **Si** |

---

## Que queda por detras (invisible pero funcionando)

| Sistema | Que hace | Por que mantenerlo |
|---------|---------|-------------------|
| Asientos contables | Se generan en cada venta automaticamente | Datos disponibles si se necesita exportar contabilidad |
| Historial de precios | Se registra al cambiar precio de producto | Audit trail |
| Stock movements | Se registra en cada venta, ajuste, compra | Trazabilidad de inventario |
| Activity log | Se registra cada accion del usuario | Seguridad y auditoria |
| Customer segments (tabla) | Existe sin UI | Podria usarse para WhatsApp broadcasts en el futuro |
| Quotations (tabla + endpoint) | Existe sin navegacion | La ruta sigue accesible por URL directa |
| Suppliers (tabla + endpoint) | Existe sin navegacion | Se usa internamente en OCR para matching |
| Accounting entries (tabla + endpoint) | Existe sin navegacion | Se generan automaticamente, consultables por API |

## Que se elimina completamente

| Componente | Razon |
|-----------|-------|
| `useOfflineQueue.ts` | Cola de ventas offline. Complejidad alta, uso 0% |
| `useProductCache.ts` sync agresivo (1000 items) | Reemplazar por cache simple |
| `useOfflineDb.ts` tabla `pendingSales` | Parte del offline queue |
| `/catalogo/[slug].vue` | Duplica el storefront `/tienda` |
| `/settings/bank-accounts.vue` | Nadie registra cuentas bancarias |
| `/settings/notifications.vue` | No hay notificaciones reales |
| `/settings/surcharges.vue` | Delivery fee ya esta en store_settings |
| 9 paginas de reportes individuales | Se consolidan en `/reports/index.vue` con tabs |

---

## Fases de ejecucion

### Fase 1 -- Limpiar, simplificar, robustecer (2-3 semanas)

**Objetivo:** Convertir Nala de "sistema con 49 paginas" a "app de ventas simple y robusta". Sin agregar features nuevos. Solo quitar lo que sobra y simplificar lo que queda.

#### Sprint 1A: Eliminar dead weight (3-4 dias)

**Codigo a eliminar/ocultar:**
- Eliminar pagina `/catalogo/[slug].vue` (duplica storefront)
- Eliminar composable `useOfflineQueue.ts` (cola de ventas offline)
- Simplificar `useProductCache.ts` (solo cache basico, no sync agresivo de 1000 items)
- Ocultar paginas de contabilidad de la navegacion (mantener generacion automatica de asientos)
- Ocultar pagina de proveedores de la navegacion
- Ocultar pagina de cotizaciones de la navegacion

**Tablas a dejar huerfanas (no eliminar de schema, solo quitar UI):**
- `customerSegments` -- quitar cualquier referencia en UI
- `unitsOfMeasure` -- quitar cualquier referencia en UI
- `bankAccounts` -- quitar pagina settings/bank-accounts
- `notificationPreferences` -- quitar pagina settings/notifications
- `surchargeTypes` -- quitar pagina settings/surcharges

#### Sprint 1B: Consolidar reportes (2-3 dias)

**Hoy:** 10 paginas separadas (daily, weekly, monthly-trend, profitability, inventory, receivable, sellers, financial, cash-flow, alerts)

**Despues:** 1 pagina `/reports/index.vue` con 3 tabs:
- **Hoy**: ventas del dia, comparacion con ayer, top productos, metodos de pago (merge de daily + alerts)
- **Periodo**: selector semana/mes, grafico de barras, tendencia, rentabilidad (merge de weekly + monthly-trend + profitability + financial)
- **Inventario**: stock bajo, productos sin movimiento, prediccion de agotamiento (merge de inventory)

Las paginas individuales se eliminan. Los endpoints API se mantienen (el tab llama al endpoint correspondiente).

#### Sprint 1C: Simplificar formulario de producto (2 dias)

**Hoy:** Formulario con 15+ campos visibles: nombre, descripcion, SKU, barcode, costo, precio, stock, stockMin, stockCritical, hasVariants, isService, wholesalePrice, wholesaleMinQty, brand, location, imageUrl, expiresAt, categoryId

**Despues:** 3 campos visibles + seccion expandible:
```
[Foto]  (tap para tomar/seleccionar)
[Nombre del producto]
[Precio de venta]     [Stock]

v Mas detalles (colapsado por defecto)
  [Costo]  [SKU]  [Barcode]
  [Categoria]  [Marca]
  [Stock minimo]  [Stock critico]
  [Precio al mayor]  [Cantidad minima]
  [Fecha vencimiento]
  [Ubicacion]  [Descripcion]
  [ ] Es servicio (sin stock)
  [ ] Tiene variantes
```

El 80% de los vendedores solo llena nombre + precio + foto. El 20% que necesita mas, expande.

#### Sprint 1D: Simplificar settings (1-2 dias)

**Hoy:** 7 sub-paginas (business, exchange-rate, store, bank-accounts, notifications, surcharges, index)

**Despues:** 1 pagina con secciones colapsables:
- **Negocio** (nombre, slug, telefono, direccion, WhatsApp)
- **Tasa de cambio** (BCV auto + manual)
- **Tienda online** (redirect a /store que ya es completa)

Eliminar: bank-accounts, notifications, surcharges como paginas separadas.

#### Sprint 1E: Robustez critica (2-3 dias)

- **Validacion de precios server-side** en `POST /catalog/:slug/orders` (comparar precio enviado vs precio real en DB)
- **Paginacion del catalogo publico** (`GET /catalog/:slug` con `?limit=100&offset=0` + scroll infinito en frontend)
- **Tasa BCV auto-fetch** (cron job o piggyback que jala la tasa BCV cada 6 horas automaticamente)
- **IGTF automatico** (3% en ventas en divisas, campo en sale + calculo en checkout)
- **Timeout explicito en OCR** (15 segundos, con mensaje claro al usuario)
- **Limpiar memory store** de rate limit periodicamente (evitar memory leak)

#### Sprint 1F: Simplificar navegacion final (1 dia)

Ajustar sidebar y mobile "Mas" para reflejar los cambios:

**Sidebar desktop (7 items core):**
1. Inicio (dashboard)
2. Vender (POS)
3. Pedidos (storefront orders)
4. Tienda Online (storefront config)
5. Inventario (productos + stock)
6. Clientes (CRM basico + fiado)
7. Configuracion

**Herramientas (colapsable):**
- Historial de ventas
- Cuentas (por cobrar)
- Cierre de caja
- Reportes (1 pagina consolidada)
- Gastos / OCR

**Eliminado de navegacion (paginas siguen existiendo por si acaso):**
- Contabilidad (asientos) -- invisible, automatica
- Proveedores -- solo en OCR
- Cotizaciones -- oculto
- Bank accounts, notifications, surcharges -- eliminados

---

### Fase 2 -- Import + Comprobantes (2 semanas)
- Import Excel mejorado: deteccion duplicados por SKU, funciona en mobile
- Import por foto de lista de precios (OCR -> crear productos)
- Comprobante de venta compartible por WhatsApp (imagen)

### Fase 3 -- Multi-usuario + Dashboard inteligente (3 semanas)
- Roles: owner, manager, cashier. Invitacion por link
- Dashboard con sugerencias accionables (stock critico, fiados pendientes, tendencia)

### Fase 4 -- Link de pago + Personalizacion (2 semanas)
- Link de pago compartible: `nala.app/pay/abc123`
- Color de marca + logo en storefront

---

## Nota sobre costos

| Servicio externo | Costo estimado | Uso |
|-----------------|---------------|-----|
| WhatsApp Cloud API | ~$5-15/mes por negocio | Notificaciones transaccionales |
| Groq Whisper | ~$0.001/transcripcion | Input por voz |
| GPT-4o-mini (OCR + parsing) | ~$0.005-0.01/request | OCR facturas, parsing voz, import foto |
| Clerk auth | $0 (free tier 10K MAU) | Autenticacion |
| Hetzner hosting | $8.49/mes (CX32) | Soporta 50-100 negocios |

Costo total de infraestructura para 100 negocios: ~$60-80/mes.
Revenue a 100 negocios x $20/mes promedio: $2,000/mes.
Margen: ~96%.
