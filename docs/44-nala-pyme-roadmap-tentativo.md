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

## Estado actual post Fase 1 + Fase 2

### Lo que Nala tiene hoy (completado)

| Feature | Estado | PR |
|---------|--------|----|
| POS con venta rapida | Solido | -- |
| Inventario con semaforo de stock | Solido | -- |
| Storefront PWA completo (tienda + checkout + pedidos) | Solido | -- |
| Clientes + fiado con pagos parciales + aging | Solido | -- |
| Bimoneda USD/Bs con tasa BCV | Solido | -- |
| OCR facturas (GPT-4o-mini) | Solido | -- |
| Cierre de caja (apertura + cierre) | Solido | -- |
| Formulario producto simplificado (3 campos + expandible) | **Completado** | #226 |
| Reportes consolidados (1 pagina, 3 tabs) | **Completado** | #225 |
| Settings consolidados (1 pagina colapsable) | **Completado** | #227 |
| Navegacion simplificada (7 items core + herramientas) | **Completado** | #224, #230 |
| Validacion precios server-side en pedidos | **Completado** | #228 |
| Paginacion catalogo publico | **Completado** | #228 |
| IGTF informativo en storefront checkout | **Completado** | #229 |
| Cobro individual por WhatsApp en cuentas | **Completado** | #231 |
| Fecha de cobro en fiado + cobros pendientes en dashboard | **Completado** | #232 |
| Comprobante de venta detallado por WhatsApp | **Completado** | #233 |
| Import Excel con deteccion duplicados + mobile | **Completado** | #234 |
| Import por foto de lista de precios (OCR) | **Completado** | #235 |

### Lo que se elimino/simplifico

| Componente | Accion | PR |
|-----------|--------|----|
| `useOfflineQueue.ts` (cola offline) | Eliminado. Checkout muestra "sin conexion" | #224 |
| `useProductCache.ts` (sync 1000 items) | Eliminado. Dead code, nadie lo usaba | #224 |
| `useOfflineDb.ts` (IndexedDB) | Eliminado. Dependencia de los anteriores | #224 |
| `/catalogo/[slug].vue` | Eliminado. Duplicaba storefront `/tienda` | #224 |
| Dependencia `dexie` | Eliminada del package.json | #224 |
| 9 paginas de reportes individuales | Consolidadas en 1 pagina con 3 tabs | #225 |
| 5 paginas de settings | Consolidadas en 1 pagina colapsable | #227 |
| Proveedores en navegacion | Oculto (pagina sigue accesible por URL) | #224 |
| Cotizaciones en navegacion | Oculto (pagina sigue accesible por URL) | #224 |
| Middleware `/catalogo` | Limpiado de auth y storefront redirect | #224 |

### Lo que queda por detras (invisible pero funcionando)

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

---

## Buyer Persona

### Carlos -- Comerciante pequeno (80% del mercado target)

- **Edad:** 28-45 anos
- **Negocio:** Bodega, panaderia, tienda de ropa, peluqueria, cafeteria, licoreria
- **Productos:** 20-200 items
- **Empleados:** Solo el (dueno-operador), maximo 1-2 ayudantes
- **Dispositivo:** Celular Android gama media (Samsung A series, Xiaomi Redmi)
- **Internet:** Movil 4G, no siempre estable pero funciona
- **Hoy usa:** Cuaderno, Excel, Fina, o nada
- **Dolor:** "No se cuanto vendi", "Se me olvido que me deben", "Quiero que me pidan por internet"
- **No necesita:** Contabilidad formal, facturacion fiscal, reportes complejos

### Maria -- Comerciante mediano (15% del mercado target)

- **Negocio:** Mini-market, tienda de repuestos, distribuidora pequena
- **Productos:** 200-500 items
- **Empleados:** 2-5 personas
- **Diferencia con Carlos:** Necesita reportes basicos, import de Excel, y control de fiado mas formal
- **Usa:** Herramientas colapsables (reportes, OCR, import, cierre de caja)

---

## Competencia

| Feature | Square | Loyverse | Treinta | Fina | Nala |
|---------|--------|----------|---------|------|------|
| Venta en 2 toques | Si | Si | Si | No | **Si** |
| Producto en 3 campos | Si | Si | Si | No | **Si** |
| POS movil | Si | Si | Si | Si | **Si** |
| Inventario con semaforo | Basico | Basico | Basico | Basico | **Completo** |
| Fiado + cobro WhatsApp | No | No | Link | Link | **Boton directo** |
| Tienda online PWA | Si (Shopify) | No | Basico | No | **Completa** |
| OCR facturas | No | No | No | No | **Si** |
| Import por foto | No | No | No | No | **Si** |
| Bimoneda (USD/Bs) | No | No | No | Si | **Si** |
| Tasa BCV auto | No | No | No | Si | **Si** |
| IGTF | No | No | No | No | **Si** |
| Recibo WhatsApp detallado | No | No | No | No | **Si** |
| Cobros con fecha de vencimiento | No | No | No | No | **Si** |

---

## Fases de ejecucion

### Fase 1 -- Limpiar, simplificar, robustecer -- COMPLETADA

| Sprint | Descripcion | PR | Estado |
|--------|-------------|-----|--------|
| 1A | Eliminar dead weight (offline queue, catalogo duplicado, nav) | #224 | Completado |
| 1B | Consolidar 9 reportes en 3 tabs | #225 | Completado |
| 1C | Simplificar formulario producto (3 campos + expandible) | #226 | Completado |
| 1D | Consolidar settings en 1 pagina colapsable | #227 | Completado |
| 1E | Validacion precios server-side + paginacion catalogo | #228 | Completado |
| 1E2 | IGTF informativo en storefront checkout | #229 | Completado |
| 1F | Actualizar links dashboard a reportes consolidados | #230 | Completado |

**Resultado:** De 49 paginas a 7 items de navegacion core. -3,429 lineas, +1,155 lineas. Reduccion neta de ~2,274 lineas.

**Cambios vs plan original:**
- `useOfflineQueue` se desacoplo del checkout antes de eliminar (el plan decia "eliminar" directo, pero checkout lo usaba)
- `useProductCache` era dead code puro, se elimino sin simplificar (el plan decia "simplificar")
- IGTF se implemento como display informativo en storefront (el plan lo ponia como campo en schema + backend)
- Tasa BCV auto-fetch y limpieza de rate limit store se dejaron fuera (ya existia la base, no era critico)

---

### Fase 2 -- Import + Comprobantes + Cobro WhatsApp -- COMPLETADA

| Sprint | Descripcion | PR | Estado |
|--------|-------------|-----|--------|
| 2A | Cobro individual por WhatsApp en cuentas por cobrar | #231 | Completado |
| 2B | Fecha de cobro en fiado + cobros pendientes en dashboard | #232 | Completado |
| 2C | Comprobante de venta detallado por WhatsApp | #233 | Completado |
| 2D | Import Excel con deteccion duplicados + mobile | #234 | Completado |
| 2E | Import por foto de lista de precios (OCR) | #235 | Completado |

**Cambios vs plan original:**
- Se agrego cobro de fiado por WhatsApp (feature #1 del doc original que se habia perdido entre la tabla y los sprints)
- Se agrego fecha de cobro en fiado + seccion "cobros pendientes" en dashboard (no estaba en el plan original)
- El comprobante por WhatsApp se implemento como texto formateado rico (no como imagen, que requeriria canvas/server rendering)
- Multi-usuario (roles) se saco de Fase 3 por decision de producto

---

### Fase 3 -- Dashboard inteligente (2 semanas) -- PENDIENTE

**Objetivo:** El dashboard no solo muestra datos, sugiere acciones. Carlos abre Nala y sabe que hacer.

**Sugerencias accionables (reglas simples, no AI):**
- "3 productos con stock critico" -> tap -> ir a inventario filtrado por stock rojo
- "5 fiados vencidos por $120" -> tap -> ir a cuentas por cobrar
- "$450 en ventas hoy, 15% mas que ayer" -> informativo
- "Producto estrella: Harina PAN (32 vendidos esta semana)" -> informativo
- "2 pedidos pendientes" -> tap -> ir a pedidos

**Implementacion:**
- Endpoint `GET /api/reports/alerts` ya existe y retorna alertas
- Agregar reglas para: stock critico, fiados vencidos, tendencia de ventas, producto estrella
- Cada alerta tiene: icono, titulo, sugerencia, link de accion, severidad (critical/warning/info)
- Mostrar las top 5 alertas en el dashboard con cards accionables

---

### Fase 4 -- Link de pago compartible (1-2 semanas) -- PENDIENTE

**Objetivo:** Carlos comparte un link por WhatsApp y el cliente paga sin necesitar la app.

**Flujo:**
1. Carlos crea un link de pago: `nala.app/pay/abc123`
2. El link muestra: nombre del negocio, monto, metodos de pago aceptados
3. El cliente sube comprobante de pago (foto)
4. Carlos recibe notificacion y confirma el pago

**Implementacion:**
- Nueva tabla `payment_links` (businessId, amount, description, status, paymentProofUrl)
- Endpoint `POST /api/payment-links` (crear link)
- Endpoint `GET /pay/:code` (pagina publica, sin auth)
- Endpoint `POST /pay/:code/proof` (subir comprobante)
- UI: boton "Crear link de pago" en el dashboard o en cuentas

---

### Fase 5 -- Personalizacion storefront (1 semana) -- PENDIENTE

**Objetivo:** La tienda online de cada negocio se ve unica.

**Features:**
- Color de marca (primary color picker)
- Logo del negocio (upload a MinIO)
- Mensaje de bienvenida personalizado (ya existe el campo `welcomeMessage` en store_settings)
- Dominio custom (subdominio ya funciona, agregar CNAME custom)

**Implementacion:**
- Agregar campos `brandColor` y `logoUrl` a `store_settings`
- El storefront layout lee estos valores y aplica CSS custom
- Upload de logo via endpoint existente de MinIO
- Para dominio custom: configuracion DNS en Cloudflare (manual por ahora)

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
