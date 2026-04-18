# Nova: Features Actuales

> Ultima actualizacion: Abril 2026
> Codebase: ~20,900 lineas | 26 tablas (26 RLS policies) | 64 endpoints | 32 paginas | 49 tests
> Stack: Nuxt 4.4 + Hono + PostgreSQL 16 + Redis 7 + Clerk + Drizzle ORM
> Produccion: novaincs.com | api.novaincs.com | *.novaincs.com (subdominios por tenant)
> Migraciones: 7 (0000-0006)

---

## Resumen

Nova es un backoffice operativo para comerciantes informales y PyMEs en Venezuela. Ventas, inventario, clientes, cuentas, reportes y contabilidad en un solo lugar. Funciona offline. Inteligencia en cada pantalla.

**Para quien es:** Ferreterias, bodegas, tiendas de ropa, autopartes, peluquerias, farmacias, tiendas de electronica, librerias, cosmeticos, distribuidoras. PyMEs de 1 a 30 empleados.

**Moneda dual:** Opera en dolares (USD) como moneda base con conversion automatica a bolivares (VES) usando la tasa BCV del dia. Cada negocio configura su propia tasa.

---

## 1. Punto de Venta (POS)

| Feature | Detalle |
|---------|---------|
| Venta rapida | Registro en 3-4 toques desde grid de productos |
| 7 metodos de pago | Efectivo, Pago Movil, Binance, Zinli, Transferencia, Zelle, Fiado |
| Split payment | Multiples metodos de pago en una sola venta |
| Descuentos | Por porcentaje (%) y monto fijo (USD), a nivel de item y de venta |
| Offline | IndexedDB (Dexie.js) + cola FIFO, sincroniza al volver internet |
| Cotizaciones | Crear cotizacion, convertir a venta con un toque |
| Anulacion | Requiere PIN del dueno + motivo obligatorio. Restaura stock automaticamente |
| Tasa de cambio | BCV oficial (scraping automatico) + tasa manual por negocio. USD y EUR |

### Flujo de venta
1. Tocar producto en el grid (o buscar por nombre/barcode)
2. Ajustar cantidad (+/-) en el ticket
3. Tocar "Cobrar $XX"
4. Seleccionar metodo(s) de pago
5. Confirmar -> venta registrada, stock decrementado, asiento contable generado

---

## 2. Inventario

| Feature | Detalle |
|---------|---------|
| Productos | CRUD completo con nombre, descripcion, SKU, barcode, costo, precio, stock |
| Variantes | Talla, color, etc. Cada variante tiene su propio SKU, stock, costo y precio |
| Categorias | Pre-configuradas por tipo de negocio en onboarding. CRUD para agregar mas |
| Semaforo de stock | Verde (OK), amarillo (bajo), rojo (critico), gris (sin movimiento 60+ dias) |
| Prediccion de agotamiento | "Se acaba en ~X dias" basado en velocidad de venta de los ultimos 30 dias |
| Alertas de vencimiento | Productos que vencen en los proximos 30 dias |
| Unidades de medida | Conversion entre unidades (ej: 1 caja = 12 unidades) |
| Ajuste manual | Conteo fisico con motivo obligatorio. Genera movimiento de stock con audit trail |
| Movimientos de stock | Log explicito de cada cambio: venta, compra, ajuste, anulacion |
| Importacion batch | Subir Excel con multiples productos de una vez |
| Historial de precios | Cada cambio de costo/precio queda registrado con fecha y quien lo hizo |
| OCR de facturas | Foto de factura de proveedor -> GPT-4o-mini vision -> extrae items -> matching contra inventario -> confirmar -> actualiza stock y crea gasto |

### Matching OCR
1. Alias exacto (aprendido de confirmaciones anteriores)
2. SKU exacto
3. Fuzzy por nombre (pg_trgm)
4. Producto nuevo (si no matchea)

---

## 3. Clientes y CRM

| Feature | Detalle |
|---------|---------|
| Perfil automatico | Se construye desde el historial de compras |
| Segmentos | VIP, frecuente, en riesgo, inactivo, nuevo, con deuda. Calculo automatico |
| Cuentas por cobrar | Fiado con pagos parciales, aging por colores (verde/amarillo/rojo) |
| Cupo de credito | Limite de fiado por cliente, validado en checkout |
| Cobro por WhatsApp | Genera link wa.me con mensaje pre-armado y monto pendiente |
| Busqueda | Fuzzy search por nombre (pg_trgm) |

### Segmentos automaticos
- **VIP**: Top 10% por gasto total
- **Frecuente**: 4+ compras
- **En riesgo**: 30-90 dias sin comprar
- **Inactivo**: 90+ dias sin comprar
- **Nuevo**: Creado hace menos de 30 dias
- **Con deuda**: Saldo pendiente > 0

---

## 4. Proveedores

| Feature | Detalle |
|---------|---------|
| Directorio | Nombre, telefono, email, direccion, notas |
| CRUD | Crear, listar, editar (GET/POST/PATCH /suppliers) |
| Vinculado a gastos | Las facturas de compra (OCR) se asocian al proveedor |
| Aliases | El sistema aprende como cada proveedor nombra los productos |

---

## 5. Reportes (9 tipos)

Todos los reportes incluyen narrativa generada por IA (OpenRouter GPT-4o-mini, fallback Groq).

| Reporte | Endpoint | Contenido |
|---------|----------|-----------|
| Diario | GET /reports/daily | Ventas de hoy, comparativa vs ayer y vs misma dia semana pasada, top 5 productos, desglose por metodo de pago |
| Semanal | GET /reports/weekly | Total del periodo, desglose diario, mejor dia, producto estrella, comparativa vs periodo anterior |
| Rentabilidad | GET /reports/profitability | Top 20 productos por margen, rotacion, contribucion al revenue. Score compuesto |
| Inventario | GET /reports/inventory | Total productos, valor del inventario, stock bajo, stock critico, stock muerto |
| Cuentas por cobrar | GET /reports/receivable | Total pendiente, aging (verde/amarillo/rojo), top 10 deudores |
| Vendedores | GET /reports/sellers | Ranking por total vendido, cantidad de ventas, ticket promedio |
| Financiero | GET /reports/financial | P&L simplificado: revenue, costo de ventas, gastos, ganancia bruta/neta, margenes |
| Flujo de caja | GET /reports/cash-flow | Proyeccion a 7 y 30 dias, promedio diario revenue/gastos, pendientes por cobrar/pagar, tendencia 14 dias |
| Alertas | GET /reports/alerts | Stock critico, stock bajo, deudas vencidas (30+ dias), stock muerto (60+ dias), productos por vencer |

### Exportacion
- **PDF**: Diario, semanal, financiero
- **Excel**: Diario, semanal, vendedores
- **Email**: Cualquier reporte via Resend (con PDF adjunto)

---

## 6. Contabilidad

| Feature | Detalle |
|---------|---------|
| Plan de cuentas | Pre-configurado por tipo de negocio (8 cuentas base). Editable |
| Asientos automaticos | Cada venta genera debito a Caja + credito a Ventas. Cada gasto genera debito a Costo de ventas + credito a Caja |
| Journal entries | Listado con filtro por periodo |
| Enviar al contador | Genera paquete Excel + abre WhatsApp con archivo adjunto |

---

## 7. Operaciones

| Feature | Detalle |
|---------|---------|
| Apertura de caja | Declarar efectivo al inicio del dia (POST /cash-opening) |
| Cierre de caja | Contar efectivo, comparar con esperado (solo pagos en efectivo del dia), registrar diferencia |
| Multi-empleado | Dueno + empleados con PIN de 4 digitos. Cambio de turno sin API call |
| Ranking de vendedores | Quien vendio mas en el periodo |
| Catalogo publico | Cada negocio tiene `negocio.novaincs.com` con productos, precios, y boton "Pedir por WhatsApp" |

---

## 8. Dashboard

| Elemento | Detalle |
|----------|---------|
| Saludo | Nombre del negocio + hora del dia ("Buenos dias, Bodega Don Pedro") |
| Ventas de hoy | Monto total con tendencia verde/rojo vs ayer |
| 3 cards | "Te deben" (cuentas por cobrar), "Se acaban" (stock bajo), "En 7 dias" (flujo de caja proyectado) |
| Alertas | Cards con colores por severidad: stock critico, deudas vencidas, productos por vencer |
| Grafico semanal | Barras con ventas de los ultimos 7 dias + narrativa IA |
| Tasa BCV | Tasa oficial del dia + boton para cambiar tasa manual |
| Ultima venta | Monto y hace cuanto tiempo |

---

## 9. Autenticacion (patron Square POS)

| Paso | Detalle |
|------|---------|
| 1. Clerk sign-in | El dueno se autentica una vez por dispositivo con Clerk (Google, email) |
| 2. PIN empleado | Empleados usan PIN de 4 digitos contra roster cacheado en localStorage (bcrypt) |
| 3. Backend | Recibe Clerk JWT + header X-Acting-As con userId del empleado activo |
| 4. Cambio de turno | PIN se verifica localmente, no hay API call. Instantaneo |
| 5. Acciones restringidas | Anular venta, ajustar stock, crear empleado: requieren PIN del dueno (verificacion local + server-side) |

### Seguridad
- PIN lockout: 5 intentos fallidos -> bloqueo 5 minutos
- Rate limiting: 60 req/min publico, 120 req/min autenticado, 30 req/min escritura
- Scanner bot blocking: paths conocidos (.env, .git, wp-admin, etc.) retornan 404 silencioso
- Security headers (Hono secure-headers)
- RLS en 26 tablas con cleanup en finally (previene leak entre tenants)

---

## 10. Multi-tenancy

| Capa | Implementacion |
|------|---------------|
| Base de datos | PostgreSQL RLS con `set_config('app.current_business_id', ...)` por request |
| Cleanup | `finally` block limpia el contexto RLS en cada request (previene leak en pool) |
| Auth | Clerk JWT identifica el dispositivo, PIN identifica al empleado |
| Subdominios | Cada negocio tiene su URL publica (`negocio.novaincs.com`) |
| Cache | Redis keys scopeadas por tenant (`nova:{businessId}:...`) |
| Onboarding | Crea negocio + owner + categorias + plan de cuentas en una transaccion atomica |

---

## 11. Onboarding

Flujo en 3 pasos despues de Clerk sign-up:

1. **Tipo de negocio**: Ferreteria, bodega, ropa, autopartes, peluqueria, farmacia, electronica, libreria, cosmeticos, distribuidora, otro
2. **Datos del negocio**: Nombre + slug (URL publica, validacion en tiempo real)
3. **PIN del dueno**: 4 digitos (bcrypt)

Crea en una transaccion atomica:
- Business record
- Owner user (vinculado a Clerk ID)
- Categorias pre-configuradas segun tipo de negocio
- Plan de cuentas contable (8 cuentas base)

---

## 12. PWA y Offline

| Feature | Detalle |
|---------|---------|
| Instalable | Service Worker con auto-update (@vite-pwa/nuxt) |
| Cache de productos | IndexedDB (Dexie.js) para acceso rapido sin red |
| Cola offline | Ventas se guardan en IndexedDB si no hay internet, sync FIFO al reconectar |
| Responsive | Desktop: sidebar + contenido. Mobile: contenido + bottom tabs |

---

## 13. Infraestructura

| Componente | Detalle |
|------------|---------|
| Hosting | Hetzner Cloud hel1 (Coolify) |
| Base de datos | PostgreSQL 16 + pgvector + pg_trgm |
| Cache | Redis 7 |
| Storage | MinIO (S3-compatible, para imagenes de productos y facturas OCR) |
| CI/CD | GitHub Actions: typecheck + lint + 49 tests + build en cada push/PR |
| Docker | Multi-stage Dockerfile: deps -> builder -> api (port 3001) -> web (port 3000) |
| Migraciones | Drizzle versionadas (7 migraciones) + init.sql para RLS policies |

---

## 14. Stack tecnico

| Capa | Tecnologia | Version |
|------|-----------|---------|
| Frontend | Nuxt (Vue 3) | 4.4 |
| CSS | Tailwind CSS | 4 |
| PWA | @vite-pwa/nuxt | 1.0.0 |
| Auth | @clerk/nuxt + @clerk/backend | 2.1.2 / 2.5.0 |
| Offline DB | Dexie.js (IndexedDB) | 4.0.11 |
| Backend | Hono + @hono/node-server | 4.7.10 |
| Validacion | Zod + @hono/zod-validator | 3.24.4 |
| ORM | Drizzle ORM | 0.41.0 |
| DB | PostgreSQL 16 + pgvector | - |
| Cache | Redis 7 (ioredis) | 5.10.1 |
| IA | OpenRouter (GPT-4o-mini) | - |
| IA fallback | Groq (Llama 3.1) | - |
| PDF | pdfmake | 0.3.7 |
| Excel | SheetJS (xlsx) | 0.18.5 |
| Email | Resend | 6.11.0 |
| Build (API) | tsup | 8.5.1 |
| Monorepo | Turborepo | 2.5.0 |
| Runtime | Node.js | 22+ |

---

## 15. Base de datos (26 tablas)

### Core
| Tabla | Proposito |
|-------|-----------|
| businesses | Tenants. Nombre, tipo, slug, telefono, direccion, WhatsApp |
| users | Owners (Clerk) y empleados (PIN). Rol, pin_hash, lockout |
| activity_log | Audit trail de todas las acciones por usuario |

### Inventario
| Tabla | Proposito |
|-------|-----------|
| categories | Categorias de productos por negocio |
| units_of_measure | Unidades con abreviatura (unidad, caja, kg, litro) |
| products | Productos con costo, precio, stock, semaforo, vencimiento |
| product_variants | Variantes (talla, color) con su propio stock/precio |
| price_history | Log de cada cambio de costo/precio |
| stock_movements | Log de cada cambio de stock (venta, compra, ajuste) |

### Ventas
| Tabla | Proposito |
|-------|-----------|
| exchange_rates | Tasa BCV/EUR por dia por negocio |
| sales | Ventas completadas/anuladas. Total USD/Bs, tasa, descuentos |
| sale_items | Items de cada venta con cantidad, precio, descuento |
| sale_payments | Pagos de cada venta (split payment) |
| quotations | Cotizaciones (draft -> converted) |

### Clientes y cuentas
| Tabla | Proposito |
|-------|-----------|
| customers | Perfil CRM: compras, gasto, ticket promedio, saldo, cupo |
| customer_segments | Segmentos calculados (VIP, en riesgo, etc.) |
| accounts_receivable | Fiado: monto, pagado, saldo, estado |
| accounts_payable | Deudas con proveedores |
| day_closes | Cierre de caja: contado vs esperado |
| cash_openings | Apertura de caja: efectivo declarado |

### Contabilidad y gastos
| Tabla | Proposito |
|-------|-----------|
| suppliers | Directorio de proveedores |
| accounting_accounts | Plan de cuentas (activo, pasivo, patrimonio, ingreso, gasto) |
| accounting_entries | Asientos contables automaticos |
| expenses | Gastos/compras (desde OCR o manual) |
| expense_items | Items de cada gasto |
| product_aliases | Aliases OCR aprendidos por proveedor |

---

## 16. Paginas frontend (32)

### Publicas
| Ruta | Proposito |
|------|-----------|
| /landing | Marketing page |
| /auth/login | Clerk sign-in |
| /auth/signup | Clerk sign-up |
| /auth/pin | Teclado PIN para empleados |
| /auth/resolve | Resolucion post-login |
| /onboarding | Crear negocio (3 pasos) |
| /catalogo/[slug] | Catalogo publico por subdominio |

### Protegidas (requieren auth)
| Ruta | Acceso | Proposito |
|------|--------|-----------|
| / | Todos | Dashboard |
| /sales | Todos | POS: grid de productos + ticket |
| /sales/checkout | Todos | Seleccion de pago + confirmar |
| /sales/history | Todos | Historial de ventas con filtros |
| /inventory | Todos | Lista de productos con semaforo |
| /inventory/[id] | Owner | Crear/editar producto |
| /inventory/import | Owner | Importar desde Excel |
| /clients | Todos | Lista de clientes |
| /clients/new | Owner | Crear cliente |
| /accounts | Owner | Cuentas por cobrar/pagar |
| /accounts/day-close | Owner | Cierre de caja |
| /reports | Owner | Hub de reportes |
| /reports/daily | Owner | Resumen del dia |
| /reports/weekly | Owner | Resumen semanal |
| /reports/profitability | Owner | Rentabilidad por producto |
| /reports/inventory | Owner | Estado del inventario |
| /reports/receivable | Owner | Aging cuentas por cobrar |
| /reports/sellers | Owner | Ventas por vendedor |
| /reports/financial | Owner | P&L simplificado |
| /reports/cash-flow | Owner | Proyeccion de flujo de caja |
| /accounting | Owner | Plan de cuentas + asientos |
| /settings | Owner | Hub de configuracion |
| /settings/business | Owner | Datos del negocio |
| /settings/team | Owner | Gestion de empleados |
| /more | Todos | Menu adicional (mobile) |

---

## 17. Lo que Nova NO hace (fuera de scope)

- Facturacion electronica / cumplimiento SENIAT (eliminado en PR #119 -- Nova es para comercio informal)
- Nomina / RRHH
- Costos FIFO / promedio ponderado
- Multi-almacen
- Integracion bancaria directa
- Contabilidad completa (balance general, estados financieros auditables)
- Declaraciones de impuestos
