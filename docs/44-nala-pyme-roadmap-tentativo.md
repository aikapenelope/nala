# Nala: Roadmap Tentativo -- Sistema PyME Moderno para Venezuela

> Mayo 2026. Analisis tentativo. Pendiente de revision y aprobacion.
> Referencia: Treinta (Colombia, $46M Series A, 7M+ usuarios), Fina (Venezuela).

---

## Filosofia de producto

**La venta genera el dato. No al reves.**

El vendedor nunca deberia sentir que esta "llenando un sistema". Deberia sentir que esta vendiendo, y el sistema se llena solo. Cada accion del vendedor (vender, recibir mercancia, cobrar) alimenta automaticamente inventario, clientes, estadisticas, y contabilidad.

| Enfoque tradicional (Fina, Saint) | Enfoque Nala (inspirado en Treinta) |
|---|---|
| "Registra tus productos con todos los datos" | "Pon nombre, precio y foto. Vende. El resto se calcula" |
| "Configura tu plan de cuentas" | "Vende. La contabilidad se genera sola" |
| "Registra a tus clientes" | "Vende. El cliente se crea cuando compra" |
| "Llena el formulario de gastos" | "Toma foto de la factura. Listo" |
| "Revisa tus 10 reportes" | "Abre la app. El dashboard te dice que hacer" |

### Principios de diseno

1. **2 toques para vender**: tap producto, tap cobrar. Nada mas
2. **3 campos para crear producto**: nombre, precio, foto. Todo lo demas es opcional y expandible
3. **0 configuracion para empezar**: onboarding = crear negocio + agregar primer producto. 2 minutos
4. **La camara es un input**: escanear barcode, tomar foto de factura, tomar foto de lista de precios
5. **La voz es un input**: "agregar 10 harina pan a 1.50" funciona
6. **WhatsApp es el canal**: notificaciones, cobros, pedidos, comprobantes -- todo por WhatsApp
7. **El dashboard sugiere acciones**: no muestra datos pasivos. Dice "haz esto" con un boton

---

## Posicionamiento

**Nala es un sistema de gestion para PyMEs venezolanas con tienda online y WhatsApp integrado.**

No es un ERP fiscal (no compite con Saint/Profit/Hybrid). No es una app para solopreneurs (eso es novaincs). Es el sistema que usa un negocio de 2-15 personas que quiere organizarse, vender online, y comunicarse con sus clientes por WhatsApp de forma profesional.

### Diferencia con novaincs

| | novaincs | Nala |
|---|---------|------|
| **Target** | Solopreneur, vendedor Instagram, <200 items | PyME, 2-15 personas, 200-2000 items |
| **Foco** | Catalogo visual + AI images + WhatsApp conversacional | Gestion operativa + storefront + WhatsApp transaccional |
| **Complejidad** | Minima (como Instagram) | Media (como Treinta pero moderno) |
| **Storefront** | PWA basica con AI images | PWA completa con checkout, pedidos, dark mode |
| **AI** | Agentes autonomos (venta, contenido, finanzas) | OCR facturas, voz-to-data, sugerencias inteligentes |
| **Precio** | $0-15/mes | $15-30/mes |

---

## Features de Treinta que Nala debe adoptar

### Core (la venta como centro)

| Feature Treinta | Estado en Nala | Accion |
|----------------|---------------|--------|
| **Venta en 2 toques** (tap producto, tap cobrar) | POS existe pero tiene pasos intermedios | Simplificar: eliminar pantalla de checkout separada para ventas rapidas |
| **Producto en 3 campos** (nombre, precio, foto) | Formulario de 15+ campos | Redisenar: 3 campos visibles + "Mas detalles" expandible |
| **Cliente se crea al comprar** | Hay que crear cliente manualmente antes | Crear automaticamente al registrar venta con nombre/telefono |
| **Fiado en 1 toque** | Existe pero requiere seleccionar cliente primero | Simplificar: "Fiar a [nombre]" directo desde el ticket |
| **Recordatorio de fiado por WhatsApp** | Solo link wa.me manual | Boton "Cobrar" que abre WhatsApp con mensaje pre-armado (Fase 1) y luego automatico (Fase 2 con API) |
| **Estadisticas simples** (hoy, semana, mes) | 10 paginas de reportes | Consolidar en 1 dashboard con 3 periodos |
| **Catalogo compartible** | Storefront PWA completo (mejor que Treinta) | Ya resuelto. Mantener |
| **Funciona offline** | Existe pero sobreingenieriado | Simplificar: solo cache de productos para POS. Eliminar cola de ventas |
| **Onboarding en 5 minutos** | Existe pero tiene demasiados pasos | Reducir a: nombre negocio + primer producto + listo |

### Restaurantes (vertical clave)

| Feature Treinta | Estado en Nala | Accion |
|----------------|---------------|--------|
| **Mesas** (asignar pedido a mesa) | No existe | Agregar en Fase 5 |
| **Comandas** (enviar pedido a cocina) | No existe | Agregar en Fase 5 |
| **Propinas** | No existe como concepto separado | Agregar como campo en checkout |
| **Division de cuentas** | No existe | Agregar en Fase 5 |
| **Recetas** (plato = ingredientes) | No existe | Agregar en Fase 5 |
| **Modificadores** (sin cebolla, extra queso) | No existe | Agregar en Fase 5 |

### Gestion (lo que Treinta tiene y Nala ya tiene mejor)

| Feature | Treinta | Nala | Ventaja Nala |
|---------|---------|------|-------------|
| Inventario con semaforo | Basico | Completo (verde/amarillo/rojo + prediccion) | Nala gana |
| Variantes (talla, color) | Si | Si | Empate |
| Cierre de caja | Basico | Completo (apertura + cierre + comparacion) | Nala gana |
| Cuentas por cobrar | Si | Si (con pagos parciales + aging) | Nala gana |
| OCR facturas | No | Si (GPT-4o-mini) | Nala gana |
| Tienda online | Catalogo basico | PWA completa con checkout | Nala gana |
| Pedidos online | No | Flujo completo (pending->confirmed->delivered) | Nala gana |

---

## Features nuevos y modernos para Venezuela 2026

### 1. Ingesta de datos por voz (Groq Whisper)
- El vendedor dice "agregar 10 harina pan a 1.50" y el producto se crea/actualiza
- Usa Groq Whisper para transcripcion ultra-rapida
- Parsing con GPT-4o-mini para extraer: accion, producto, cantidad, precio
- **Por que es novedoso**: Ningun sistema en Venezuela tiene input por voz

### 2. WhatsApp transaccional real (Cloud API)
- Notificacion automatica al vendedor cuando llega pedido
- Confirmacion automatica al cliente cuando se confirma pedido
- Recordatorio de fiado automatico ("Hola Maria, tienes $15 pendientes")
- Resumen diario al vendedor ("Hoy vendiste $450, 23 ventas")
- **Costo**: ~$0.008/msg utility en LATAM. 20 pedidos/dia = ~$5/mes

### 3. Tasa BCV auto-fetch + IGTF automatico
- Jalar tasa BCV automaticamente cada dia
- Calcular IGTF (3%) automaticamente en ventas en divisas
- Mostrar precio en Bs y USD en todo el sistema

### 4. Scan-to-add (camara como input principal)
- Escanear barcode para agregar producto al ticket POS
- Escanear barcode para buscar producto en inventario
- Escanear factura del proveedor con OCR
- Feedback haptico y sonido al escanear

### 5. Link de pago compartible
- Generar link unico por venta/pedido: `nala.app/pay/abc123`
- El cliente abre, ve el monto, los datos de Pago Movil/Binance/Zelle
- Sube comprobante de pago desde el mismo link
- El vendedor recibe notificacion cuando el cliente paga

### 6. Recetas/composicion (restaurantes)
- Crear receta: "Hamburguesa = 1 pan + 1 carne + 2 tomate + 1 lechuga"
- Al vender hamburguesa, se descuentan los ingredientes automaticamente
- Calcular costo real del plato basado en ingredientes

### 7. Multi-usuario con roles
- Owner: todo
- Manager: todo menos config de negocio y anulaciones
- Cashier: vender, ver inventario, ver pedidos
- Invitacion por link o codigo

### 8. Dashboard inteligente con sugerencias
- "Tienes 3 productos con stock critico" -> tap -> ir a inventario
- "5 clientes te deben mas de $50" -> tap -> enviar cobro por WhatsApp
- "Vendiste 30% menos que la semana pasada" -> tap -> ver detalle
- Reglas simples con datos reales, no AI autonoma

### 9. Notas de entrega / Comprobante de venta
- Documento basico post-venta (no factura fiscal)
- Compartible por WhatsApp como imagen o PDF

### 10. Import inteligente (Google Sheets + foto de lista)
- Import desde Google Sheets
- Import desde foto de lista de precios (OCR + parsing)
- El vendedor toma foto de la lista del proveedor -> se crean/actualizan productos

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

### Principal: Roberto -- Dueno de PyME (60% del target)

- **Edad:** 30-50 anos
- **Negocio:** Mini-market, ferreteria pequena, restaurante, distribuidora, tienda de repuestos
- **Productos:** 200-1000 items
- **Empleados:** 2-10 personas
- **Facturacion:** $2,000-$15,000 USD/mes
- **Dispositivo:** Android gama media + computadora en el mostrador
- **Hoy usa:** Fina, Excel, cuaderno, o Saint viejo sin actualizar
- **Dolor:** "Necesito organizarme pero los sistemas son complicados o caros"

### Secundario: Ana -- Administradora (30% del target)

- **Rol:** Lleva las cuentas de 1-3 negocios
- **Necesita:** Reportes claros, control de gastos, cierre de caja
- **Dolor:** "Paso horas consolidando datos de diferentes fuentes"

### Terciario: Carlos -- Comerciante pequeno (10% del target)

- Bodega, panaderia, <200 items
- Usa Nala en modo simple (POS + inventario + storefront)

---

## Diferenciadores vs competencia

| Feature | Treinta | Fina | Saint | Nala (propuesto) |
|---------|---------|------|-------|-----------------|
| Venta en 2 toques | Si | No | No | **Si** |
| Producto en 3 campos | Si | No | No | **Si** |
| POS movil | Si | Si | No | **Si** |
| Inventario con semaforo | Basico | Basico | Si | **Completo** |
| Fiado + cobro WhatsApp | Link | Link | No | **API real** |
| Tienda online PWA | Basico | No | No | **Completa** |
| WhatsApp API real | No | No | No | **Si** |
| OCR facturas | No | No | No | **Si** |
| Input por voz | No | No | No | **Si** |
| Link de pago compartible | No | No | No | **Si** |
| Import por foto | No | No | No | **Si** |
| Recetas (restaurantes) | Si | No | No | **Si** |
| Mesas + comandas | Si | No | No | **Si** |
| Multi-usuario | Si | Si | Si | **Si** |
| Tasa BCV auto | N/A | Si | Si | **Si** |
| IGTF | N/A | No | Si | **Si** |
| Sugerencias inteligentes | No | No | No | **Si** |
| Dark mode storefront | No | No | No | **Si** |

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

### Fase 2 -- WhatsApp real + Link de pago (3 semanas)
- WhatsApp Cloud API integration
- Templates: pedido nuevo, confirmacion, recordatorio fiado, resumen diario
- Link de pago compartible con upload de comprobante

### Fase 3 -- Multi-usuario + Roles (2 semanas)
- Owner, Manager, Cashier
- Invitacion por link

### Fase 4 -- Input moderno (3 semanas)
- Voz-to-data (Groq Whisper + GPT-4o-mini parsing)
- Import por foto de lista de precios
- Barcode scanner mejorado

### Fase 5 -- Restaurantes (3 semanas)
- Mesas + comandas
- Recetas (composicion de productos)
- Modificadores de platos
- Propinas
- Division de cuentas

### Fase 6 -- Personalizacion storefront (2 semanas)
- Color de marca + logo
- Dominio custom

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
