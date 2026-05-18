# Nala

Vende facil. Controla todo. Desde tu celular.

Nala es un POS + tienda online para comerciantes venezolanos. Registra una venta en 2 toques, lleva tu inventario sin esfuerzo, cobra fiados por WhatsApp, y recibe pedidos online con tu propia tienda.

No es un ERP. No es un sistema contable. Es la herramienta que reemplaza el cuaderno, las notas del celular, y el Excel del comerciante que quiere digitalizarse sin complicarse.

## Filosofia

**La venta genera el dato. No al reves.**

El vendedor nunca "llena un sistema". Vende, y el sistema se organiza solo. Cada venta actualiza inventario, registra al cliente, calcula estadisticas, y genera contabilidad automaticamente.

| Enfoque tradicional | Enfoque Nala |
|---|---|
| "Registra tus productos con todos los datos" | "Nombre, precio, foto. Vende" |
| "Configura tu plan de cuentas" | "Vende. La contabilidad se genera sola" |
| "Registra a tus clientes" | "Vende. El cliente se crea cuando compra" |
| "Llena el formulario de gastos" | "Toma foto de la factura. Listo" |
| "Revisa tus 10 reportes" | "1 pagina, 3 tabs. Listo" |

## Para quien es

**Carlos (80%)** -- Bodega, tienda de barrio, mini-market, peluqueria. 20-200 productos. Solo el o con 1-2 ayudantes. Android gama media. Hoy usa cuaderno o Excel.

**Maria (15%)** -- Tienda de ropa, cosmeticos, accesorios. 200-500 productos. 2-5 personas. Necesita fotos bonitas, carrito online, reportes.

**Fuera de scope** -- Farmacias, ferreterias, librerias (miles de SKUs). Negocios que necesitan facturacion fiscal SENIAT. Esos necesitan Profit Plus, Valery, o Fina.

### Tipos de negocio

Al crear tu cuenta, eliges uno de 4 tipos. Esto configura las categorias del POS y como se ve tu tienda online:

| Tipo | Para quien | POS (categorias) | Tienda online |
|------|-----------|-------------------|---------------|
| **Tienda** | Bodega, mini-market | Abarrotes, Lacteos, Bebidas, Limpieza, Snacks | Compacto, pedido por WhatsApp |
| **Moda** | Ropa, cosmeticos, accesorios | Ropa mujer/hombre, Calzado, Accesorios | Visual con fotos grandes, carrito |
| **Servicios** | Peluqueria, barberia | Cortes, Coloracion, Tratamientos, Unas | Lista, reserva por WhatsApp |
| **Otro** | Cualquier otro | General | Visual con carrito |

---

## Features completos

### POS (punto de venta)

- Venta en 2 toques: tap producto, tap cobrar
- 7 metodos de pago venezolanos: efectivo, Pago Movil, Binance, Zinli, Zelle, transferencia, fiado
- Precios en USD y Bs simultaneo con tasa BCV
- Descuentos por linea y por venta (porcentaje y monto fijo)
- Split payment (pagar con multiples metodos)
- Cargos adicionales configurables (delivery, propina, empaque)
- Canal de venta: POS, WhatsApp, delivery, online
- Anulacion de ventas con razon obligatoria y autorizacion
- Recibo PDF descargable
- Recibo WhatsApp detallado (nombre del negocio, items, totales, metodo de pago, tasa BCV)

### Inventario

- Crear producto: 3 campos visibles (nombre, precio, stock). Todo lo demas en seccion expandible
- Semaforo de stock: verde (OK), amarillo (bajo), rojo (critico), gris (sin movimiento 60+ dias)
- Variantes de producto (talla, color, modelo) con SKU, precio y stock independiente
- Productos tipo servicio (sin stock)
- Precio al mayor con cantidad minima
- Barcode/SKU para busqueda rapida
- Categorias pre-configuradas por tipo de negocio
- Import masivo desde Excel/CSV con deteccion de duplicados por SKU (funciona en mobile)
- Import por foto: toma foto de la lista de precios del proveedor -> OCR extrae productos y precios
- Ajuste manual de stock con razon y log de movimiento
- Prediccion de agotamiento: "se acaba en ~X dias" basado en velocidad de venta

### Tienda online (storefront PWA)

- Cada negocio tiene su URL: `tunegocio.novaincs.com`
- **Adaptativo por tipo de negocio**: cards visuales (moda) o compactos (tienda), carrito o WhatsApp directo
- Catalogo con precios en USD y Bs (tasa BCV en tiempo real)
- Filtro por categorias (sticky horizontal pills)
- Carrito persistente (localStorage por tenant) o pedido directo por WhatsApp
- Checkout con datos del cliente (nombre, telefono, nota)
- Metodos de pago configurados por el vendedor con instrucciones (banco, telefono, CI)
- Upload de comprobante de pago (imagen, MinIO)
- Delivery opcional con fee configurable y zonas
- Monto minimo de pedido
- IGTF informativo (3%) cuando el metodo de pago es en divisas
- Validacion de precios server-side (previene manipulacion de precios por el cliente)
- Paginacion del catalogo con infinite scroll
- PWA installable con manifest dinamico por tenant
- SEO optimizado (Open Graph, Twitter Cards)
- Auto-cancel de pedidos pendientes despues de 24 horas

### Pedidos online

- Lista de pedidos con tabs por estado: pendiente, confirmado, entregado, cancelado
- **Push notifications** nativas cuando llega un pedido nuevo
- Polling cada 30 segundos + sonido de notificacion configurable
- Badge de pedidos pendientes en la navegacion
- Confirmar pedido (decrementa stock atomicamente, crea venta, registra movimientos)
- Entregar pedido
- Cancelar pedido con razon (restaura stock si estaba confirmado)
- Link WhatsApp pre-armado para contactar al cliente

### Clientes y fiado

- Clientes se crean automaticamente cuando compran o hacen pedido
- Fiado con pagos parciales y aging (verde <15d, amarillo 15-30d, rojo >30d)
- Fecha de cobro opcional al fiar (aparece en dashboard cuando vence)
- Cobro individual por WhatsApp: boton verde en cada deuda con mensaje personalizado
- Limite de credito por cliente (bloquea fiado si excede)
- Segmentacion automatica: VIP, frecuente, en riesgo, nuevo, con deuda, inactivo
- Historial de compras por cliente
- Estadisticas por cliente: total gastado, ticket promedio, tendencia mensual

### Cuentas por cobrar y por pagar

- Cuentas por cobrar con aging visual y cobro WhatsApp individual
- Cuentas por pagar con CRUD completo
- Pagos parciales con registro de metodo y referencia
- Balance neto (por cobrar - por pagar)

### Cierre de caja

- Apertura de caja con monto declarado
- Cierre de caja: efectivo contado vs esperado, diferencia, total ventas, total anulaciones
- Historial de cierres

### Reportes (1 pagina, 3 tabs)

- **Tab Hoy**: ventas del dia, transacciones, ticket promedio, vs ayer, metodos de pago, top productos
- **Tab Periodo**: selector semana/mes/mes anterior, totales, grafico de barras diario, mejor dia, producto estrella
- **Tab Inventario**: productos totales, valor del inventario, stock bajo/critico/sin movimiento, ranking de menos vendidos
- Export PDF (diario, semanal, financiero)
- Export Excel (diario, semanal, vendedores, libro de ventas)
- Envio por email con PDF adjunto (via Resend)
- Narrativa generada por IA en cada reporte (GPT-4o-mini con fallback a Groq)

### Gastos y OCR

- Registro de gastos con categorias (variable, fijo, COGS)
- OCR de facturas: toma foto -> GPT-4o-mini extrae proveedor, items, totales
- Matching automatico de items contra inventario (aliases -> SKU -> fuzzy)
- Validacion matematica de la factura (qty * precio = total linea, suma = total)
- Confirmacion manual antes de registrar

### Configuracion (1 pagina colapsable)

- Negocio: email del contador, WhatsApp del negocio
- Tasa de cambio: BCV oficial (fetch automatico desde ve.dolarapi.com) + manual USD/EUR
- Tienda online: metodos de pago, delivery, activar/desactivar, mensaje de bienvenida

### Dashboard

- KPIs del dia: ventas, transacciones, ticket promedio, tendencia vs ayer
- Grafico semanal de barras
- Metodos de pago del dia (barras con porcentaje)
- Cobros pendientes: deudas con fecha vencida + boton WhatsApp directo
- Tiles de insight: top vendedor, producto estrella, stock critico, margen bruto
- Tasa de cambio editable inline
- Onboarding checklist para nuevos usuarios

---

## Analisis internos (invisible para el vendedor)

Estos sistemas funcionan automaticamente sin que el vendedor los vea ni los configure:

| Sistema | Que hace | Donde se usa |
|---------|---------|-------------|
| **Asientos contables** | Se generan en cada venta, gasto, y pago. Doble partida automatica | Exportable por API. Sin UI |
| **Historial de precios** | Registra cada cambio de costo/precio con timestamp y usuario | Audit trail. Sin UI |
| **Stock movements** | Log de cada entrada/salida con tipo (venta, ajuste, compra, anulacion) y qty_after_transaction | Trazabilidad completa. Reconstruccion historica |
| **Activity log** | Cada accion del usuario: venta, anulacion, pago, cambio de precio, login | Seguridad y auditoria |
| **Segmentacion de clientes** | Calcula automaticamente: VIP (top 10% gasto), frecuente (4+ compras), en riesgo (30d sin compra), inactivo (90d) | Badges en lista de clientes |
| **Prediccion de agotamiento** | Calcula dias hasta agotar stock basado en velocidad de venta de 30 dias | Reportes de inventario |
| **Deteccion de anomalias** | Detecta: tasa alta de anulaciones, descuentos inusuales, picos/caidas de ventas, deficit de caja proyectado | Alertas en dashboard |
| **Narrativa IA** | GPT-4o-mini genera resumen en espanol de cada reporte ("Esta semana vendiste $3,270, 8% mas que la anterior") | Cada reporte |
| **Product aliases** | Aprende nombres de productos del proveedor para matching automatico en OCR | OCR de facturas |
| **Auto-cancel pedidos** | Cancela pedidos pendientes >24h automaticamente | Limpieza de storefront |
| **Row Level Security** | Cada query filtra por business_id. Un negocio nunca ve datos de otro | PostgreSQL RLS |
| **Rate limiting** | Limita requests por IP en endpoints publicos (storefront, upload) | Middleware |
| **Idempotency** | Pedidos del storefront tienen key de idempotencia para evitar duplicados en retry | Redis TTL 10min |

---

## Lo que tenemos de Treinta (y mejor)

Treinta (Colombia, $46M raised, 7M+ usuarios) es la referencia directa. Nala tiene lo mismo + extras para Venezuela:

| Feature | Treinta | Nala |
|---------|---------|------|
| POS movil | Si | **Si** |
| Venta en 2 toques | Si | **Si** |
| Producto en 3 campos | Si | **Si** |
| Inventario basico | Si | **Completo** (semaforo, prediccion, variantes) |
| Fiado | Si (link wa.me) | **Mejor** (pagos parciales, aging, fecha de cobro, boton WhatsApp directo) |
| Reportes | Basicos | **Con IA** (narrativa GPT-4o-mini en cada reporte) |
| Import Excel | Si | **Mejor** (deteccion duplicados, mobile) |
| Tienda online | Catalogo basico | **Completa** (checkout, carrito, pedidos, PWA, dark mode) |
| OCR facturas | No | **Si** (GPT-4o-mini vision) |
| Import por foto | No | **Si** (foto de lista de precios -> productos) |
| Bimoneda | No | **Si** (USD/Bs con tasa BCV automatica) |
| IGTF | No | **Si** (3% informativo en checkout) |
| Recibo WhatsApp | No | **Si** (detallado con items, totales, tasa) |
| Deteccion anomalias | No | **Si** (anulaciones, descuentos, picos, deficit) |
| Prediccion stock | No | **Si** (dias hasta agotamiento) |

## Lo que nos aleja de Fina

Fina va hacia facturacion fiscal, contabilidad formal, y compliance SENIAT. Nala va en la direccion opuesta:

| | Fina | Nala |
|---|---|---|
| **Target** | Mediano-grande (200-500+ productos) | Pequeno (20-200 productos) |
| **Contabilidad** | Pagina dedicada, plan de cuentas, asientos visibles | Invisible. Se genera sola. Sin UI |
| **Reportes** | 10+ paginas separadas | 1 pagina, 3 tabs |
| **Formulario producto** | 15+ campos visibles | 3 campos. El resto expandible |
| **Settings** | 7+ sub-paginas | 1 pagina colapsable |
| **Facturacion fiscal** | Si (SENIAT) | No. Fuera de scope |
| **Onboarding** | Multiples pasos, configuracion | Tipo de negocio + nombre = listo |
| **Complejidad** | Crece con cada feature | Se reduce con cada iteracion |
| **Filosofia** | "Configura, luego vende" | "Vende, el sistema se organiza" |

**Nala es para el que NO quiere un ERP.** El primer paso digital del comerciante. Cuando crece y necesita facturacion fiscal, se va a Fina. Pero los primeros 2-3 anos, Nala es perfecto.

---

## Stack

| Capa | Tecnologia |
|------|-----------| 
| Frontend | Nuxt 4 (Vue 3), Tailwind 4, PWA |
| Backend | Hono (TypeScript) |
| DB | PostgreSQL 16 + pgvector, Row Level Security |
| Cache | Redis 7 |
| Auth | Clerk (JWT) |
| Storage | MinIO (S3-compatible) |
| OCR/AI | GPT-4o-mini via OpenRouter, Groq (fallback) |
| Hosting | Hetzner Cloud (Coolify) |
| Monorepo | Turborepo + npm workspaces |
| CI/CD | GitHub Actions |

## Estructura del monorepo

```
nala/
  apps/
    api/          # Backend Hono (TypeScript)
    web/          # Frontend Nuxt 4 (Vue 3)
  packages/
    db/           # Drizzle ORM schema + migrations
    shared/       # Zod schemas, types, utilities
```

## Desarrollo local

```bash
git clone https://github.com/aikapenelope/nala.git
cd nala
npm ci
docker compose up -d    # PostgreSQL + Redis + MinIO
cp .env.example .env
npm run dev
```

## Documentacion

| Doc | Contenido |
|-----|-----------|
| [48 - Roadmap](docs/48-roadmap-analisis-producto.md) | Roadmap de producto, changelog, estado del sistema |
| [49 - Storefront por tipo](docs/49-storefront-por-tipo-de-negocio.md) | Como el storefront se adapta por tipo de negocio |
| [43 - Buyer persona](docs/43-product-focus-buyer-persona.md) | Cliente target, posicionamiento, limites |
| [41 - Personalizacion](docs/41-storefront-personalization-roadmap.md) | Roadmap de branding (colores, logo, temas) |

## Licencia

Apache License 2.0
