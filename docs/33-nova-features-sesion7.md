# Nova: Features Completos - Sesiones 1-7

> Documento consolidado de todo lo construido. Actualizado post-sesion 7.

---

## Metricas del proyecto

| Metrica | Valor |
|---------|-------|
| Lineas de codigo | ~26,200 |
| Archivos fuente | 143 (.ts, .vue, .css, .sql) |
| Tablas PostgreSQL | 30 (con RLS en todas) |
| Endpoints API | 87 (16 archivos de rutas) |
| Paginas frontend | 43 |
| Componentes shared | 8 |
| Composables | 8 |
| Tests | 10 archivos |
| Migraciones SQL | 9 |
| PRs mergeados | #79-#144 (66 PRs) |

---

## Stack tecnico

| Capa | Tecnologia |
|------|-----------|
| Frontend | Nuxt 4.4 + Vue 3.5 + Tailwind 4 |
| Backend | Hono 4.7 + Zod validation |
| ORM | Drizzle ORM 0.41 |
| Base de datos | PostgreSQL 16 + pgvector + pg_trgm |
| Cache | Redis 7 (rate limiting, sessions) |
| Auth | Clerk (owner) + bcrypt PIN (employees) |
| Storage | MinIO (S3-compatible) |
| AI | OpenRouter / Groq (narrativas, OCR) |
| Email | Resend |
| PDF | pdfmake |
| Excel | xlsx |
| PWA | @vite-pwa/nuxt (offline, installable) |
| Monorepo | Turborepo |
| CI | GitHub Actions (typecheck + lint + test + build) |
| Deploy | Docker multi-stage -> Coolify en Hetzner |

---

## Modulos funcionales

### 1. Onboarding
- Registro de negocio con slug unico (subdominio)
- Seleccion de tipo de negocio (bodega, ferreteria, ropa, etc.)
- Categorias pre-configuradas segun tipo
- Chart of accounts automatico
- Vinculacion con Clerk auth

### 2. POS (Point of Sale)
- Grid de productos con busqueda y barcode scanner
- Ticket lateral (desktop) / bottom sheet (mobile)
- 3-4 taps para completar una venta
- 7 metodos de pago: efectivo, pago movil, binance, zinli, transferencia, zelle, fiado
- Split payments (multiples metodos en una venta)
- Cargos adicionales (delivery, propinas, empaques)
- Canales de venta: POS, WhatsApp, delivery, online
- Conversion USD/Bs con tasa BCV manual
- Fiado genera accounts_receivable automaticamente
- Offline queue con IndexedDB (sync automatico al reconectar)

### 3. Inventario
- CRUD productos con variantes (talla, color, atributos JSON)
- SKU, barcode, costo, precio, stock, stock minimo/critico
- Semaforo de stock (verde/amarillo/rojo/gris)
- Prediccion de agotamiento (dias hasta depletion)
- Historial de precios (alerta cuando sube el costo)
- Productos tipo servicio (sin tracking de stock)
- Precio al mayor con cantidad minima
- Marca y ubicacion fisica
- Unidades de medida con factor de conversion
- Importacion masiva desde Excel
- Ajuste manual de stock con razon
- Stock movements con qty_after_transaction (historial reconstruible)
- Soft-delete (isActive = false, preserva historial)

### 4. Clientes
- CRUD con nombre, telefono, segmentos
- Segmentacion automatica: VIP, frecuente, en riesgo, nuevo, con deuda, inactivo
- Stats por cliente: total compras, ticket promedio, saldo
- Edicion inline desde la lista

### 5. Cuentas
- **Por cobrar**: aging con semaforo (verde/amarillo/rojo), abonar parcial, cobrar a todos por WhatsApp
- **Por pagar**: CRUD deudas con proveedores, pagar parcial
- Balance neto (por cobrar - por pagar)
- Apertura de caja diaria con monto inicial
- Cierre de dia con reconciliacion

### 6. Ventas
- Historial con filtros (fecha, metodo de pago)
- Utilidad por venta (profit = total - costo)
- Anulacion con motivo + PIN del dueno
- Anulacion revierte: stock, stock_movements, accounts_receivable, customer balance
- Cotizaciones (draft -> convertir a venta)

### 7. Reportes (9 reportes)
- Resumen diario (ventas, comparativa vs semana pasada, top productos, top vendedor)
- Resumen semanal (tendencias, mejor dia, producto estrella)
- Flujo de caja (proyeccion 7 y 30 dias)
- Rentabilidad (margen, rotacion, score por producto)
- Movimiento inventario (entradas, salidas, valorizacion)
- Cuentas por cobrar (aging, top deudores)
- Ventas por vendedor (ranking, totales, ticket promedio)
- Resumen financiero (P&L basico)
- Tendencia mensual (ultimos 12 meses)
- Narrativa AI en cada reporte (OpenRouter/Groq)
- Exportar PDF y Excel
- Enviar por email al contador

### 8. Contabilidad
- OCR de facturas (foto -> datos extraidos via AI)
- Gastos fijos y variables
- Chart of accounts basico (8 cuentas)
- Accounting entries (preparado para doble entrada futura)

### 9. Proveedores
- CRUD con nombre, RIF, telefono, email, direccion
- Estado de cuenta (compras, payables, gastos recientes)

### 10. Configuracion
- Equipo: CRUD empleados con PIN, permisos por rol (dueno vs empleado)
- Negocio: email contador, WhatsApp del negocio
- Tasa de cambio: BCV manual (USD y EUR)
- Cargos adicionales: CRUD surcharge types
- Cuentas bancarias: CRUD
- Notificaciones: alertas diarias por email

### 11. Catalogo publico
- Pagina publica por slug: `novaincs.com/catalogo/mi-bodega`
- Grid de productos con precios
- Boton "Pedir por WhatsApp"

### 12. Seguridad
- RLS en todas las tablas (tenant isolation)
- Auth: Clerk JWT (owner) + bcrypt PIN (employees)
- PIN lockout: 5 intentos, 15 min bloqueo
- Rate limiting: endpoints publicos y API
- UUID validation en todos los path params
- Security headers (Hono secureHeaders)
- Scanner bot blocking (/.env, /wp-admin, etc.)
- Graceful shutdown (SIGTERM/SIGINT)

### 13. Design system
- Plus Jakarta Sans typography
- Glassmorphism: glass, glass-strong, card-premium
- Dark pill (nav active, CTAs)
- Gradient text
- Spring animations (transition-spring)
- Card hover lift (card-lift)
- Progress bar with glow
- Page transitions (fade + slide)
- Fondo morado (from-[#f8f7ff] via-[#f0eef9] to-[#e8e4f3])
- Premium scrollbar
- Responsive: desktop sidebar + mobile bottom tabs
- Skeleton loading states

---

## Features agregados en sesion 7

### PR #144: Premium design system en paginas internas
- 15 archivos, 11 paginas + 2 componentes + CSS + config
- Todas las paginas internas ahora usan el design system premium
- Page transitions entre paginas
- Modales glassmorphism en toda la app

### PR #145: Analisis ERPNext vs Nova (doc 32)
- Comparacion patron-por-patron de 12 dimensiones
- Scorecard con acciones concretas
- Plan de accion priorizado

### PR #146: Adopcion de patrones ERPNext (pendiente merge)
- `qty_after_transaction` en stock_movements
- Indice compuesto en sales para reportes
- `logActivity` en 10 endpoints que no lo tenian
- Stock movement logging en void (faltaba)
- Helpers `decrementStock`/`incrementStock`/`logStockMovements`
- 5 tests RLS extendidos
- 7 tests de cadena de side-effects
