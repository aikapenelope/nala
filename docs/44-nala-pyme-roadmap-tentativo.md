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

### Fase 1 -- Limpiar, simplificar, robustecer -- COMPLETADA

| Sprint | PR | Descripcion |
|--------|-----|-------------|
| 1A | #224 | Eliminar dead weight: offline queue, catalogo duplicado, nav cleanup |
| 1B | #225 | Consolidar 9 reportes en 1 pagina con 3 tabs |
| 1C | #226 | Simplificar formulario producto (3 campos + expandible) |
| 1D | #227 | Consolidar settings en 1 pagina colapsable |
| 1E | #228 | Validacion precios server-side + paginacion catalogo |
| 1E2 | #229 | IGTF informativo en storefront checkout |
| 1F | #230 | Actualizar links dashboard a reportes consolidados |

Resultado: -2,274 lineas netas. De 49 paginas a 7 items de navegacion core.

---

### Fase 2 -- Import + Comprobantes + Cobro WhatsApp -- COMPLETADA

| Sprint | PR | Descripcion |
|--------|-----|-------------|
| 2A | #231 | Cobro individual por WhatsApp en cuentas por cobrar |
| 2B | #232 | Fecha de cobro en fiado + cobros pendientes en dashboard |
| 2C | #233 | Comprobante de venta detallado por WhatsApp |
| 2D | #234 | Import Excel con deteccion duplicados + mobile |
| 2E | #235 | Import por foto de lista de precios (OCR) |

---

### PWA-first + Imagenes -- COMPLETADA

| Sprint | PR | Descripcion |
|--------|-----|-------------|
| PWA | #238 | SSR default mobile, safe area insets, POS grid responsive |
| Imagen | #239 | Upload de imagenes de producto (camara/galeria + MinIO) |
| Nav | #240 | Link de import por foto en inventario |
| UX | #241 | Pull-to-refresh en dashboard |

---

### Fase 3 -- Dashboard inteligente (2 semanas) -- PENDIENTE

Sugerencias accionables en el dashboard (reglas simples, no AI):
- "3 productos con stock critico" -> tap -> inventario filtrado
- "5 fiados vencidos por $120" -> tap -> cuentas por cobrar
- "Producto estrella: Harina PAN (32 vendidos)" -> informativo
- "2 pedidos pendientes" -> tap -> pedidos

### Fase 4 -- Link de pago compartible (1-2 semanas) -- PENDIENTE

`nala.app/pay/abc123` con datos de pago + upload comprobante. Carlos lo comparte por WhatsApp.

### Fase 5 -- Personalizacion storefront (1 semana) -- PENDIENTE

Color de marca + logo + mensaje de bienvenida en la tienda online.

---

## Pipelines de limpieza

| Pipeline | Estado | Riesgo |
|----------|--------|--------|
| Auto-cancel pedidos >24h | Funciona (piggyback en GET /orders) | Sin cron configurado. Si vendedor no abre pedidos, no se ejecuta |
| Cache catalogo Redis (TTL 60s) | Funciona | Ninguno |
| Idempotencia pedidos (Redis TTL 10min) | Funciona | Ninguno |
| Rate limit memory store | **Problema potencial** | Map nunca se limpia. Si Redis cae, crece sin limite |
| Stock movements | Crece indefinidamente | OK para 1-2 anos. Despues necesita particionamiento |
| Activity log | Crece indefinidamente | OK para 1-2 anos |

---

## Nota sobre costos

| Servicio externo | Costo estimado | Uso |
|-----------------|---------------|-----|
| GPT-4o-mini (OCR + import foto) | ~$0.005-0.01/request | OCR facturas, import por foto |
| Clerk auth | $0 (free tier 10K MAU) | Autenticacion |
| Hetzner hosting | $8.49/mes (CX32) | Soporta 50-100 negocios |

Costo total de infraestructura para 100 negocios: ~$15-25/mes.
Revenue a 100 negocios x $20/mes promedio: $2,000/mes.
Margen: ~98%.

> Nota: WhatsApp Cloud API ($5-15/mes) no se usa. Todos los features de WhatsApp usan links wa.me/ que abren la app del telefono del vendedor. Cero costo.
