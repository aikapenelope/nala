# Nova: Auditoria de Produccion - Abril 2026

> Codebase: ~22,000 lineas | 29 tablas (29 RLS policies) | 80+ endpoints | 32 paginas | 49 tests
> Stack: Nuxt 4.4 + Hono + PostgreSQL 16 + Redis 7 + Clerk + Drizzle ORM
> Produccion: novaincs.com, api.novaincs.com, *.novaincs.com
> Migraciones: 8 (0000-0007)

---

## Estado actual: Production-ready

Todos los sprints completados. Proveedores, cupos de credito,
movimientos de inventario, apertura de caja, ajuste manual, tasa BCV
automatica, alertas de vencimiento. Dashboard rediseñado. 49 tests en CI.
Campos fiscales SENIAT eliminados en migracion 0006 (Nova es para comercio informal).

---

## Completado por sesion

### Sesion 1 (PRs #79-#101)
Roadmap original de 8 dias, hotfixes de deploy, auditoria de auth, DB error handling,
split de reports, settings API, OCR fallback.

### Sesion 2 (PRs #102-#116)

| PR | Contenido |
|----|-----------|
| #102 | Settings UI, segmentos de clientes, cash flow projection |
| #103 | Sprint 1: RLS safety, error handling, CI, roster retry |
| #104 | Sprint 2: RLS en tablas hijas + migracion 0002 |
| #105 | Roadmap actualizado |
| #106 | Sprint 3: dashboard dedup, SSR health, $fetch fix |
| #107 | Sprint 4: offline queue, SEO catalogo |
| #109 | Sprint 5: 49 API E2E tests |
| #110 | Roadmap |
| #111 | Dashboard redesign visual |
| #112 | IVA, proveedores, NC, cupos, descuento fijo (migracion 0003) |
| #113 | Roadmap + cobertura FoxPro |
| #114 | Control numbers, IGTF, stock movements, purchase book, BCV, alertas vencimiento (migracion 0004) |
| #115 | Gap analysis SENIAT (doc 28) |
| #116 | RIF, apertura de caja, ajuste manual inventario (migracion 0005) |

### Sesion 3 (PR #119)

| PR | Contenido |
|----|-----------|
| #119 | Eliminar campos SENIAT/fiscal, simplificar flujo de ventas (migracion 0006) |

### Sesion 4 (PR #122)

| PR | Contenido |
|----|-----------|
| #122 | Feature parity: 14 features en 5 sprints (migracion 0007). Utilidad por venta, servicios, cargos adicionales, precio al mayor, canales de venta, gastos fijos/variables, estado de cuenta proveedor, tendencia mensual, stats por cliente, cuentas bancarias, surcharge types, notificaciones |

PR #108 (Playwright E2E) cerrado sin merge -- reemplazado por #109.

---

## Features implementadas

### POS y ventas
- Venta en 3-4 toques, 7 metodos de pago venezolanos
- Descuento por porcentaje y monto fijo
- Cargos adicionales configurables (delivery, propinas, empaques)
- Canales de venta (POS, WhatsApp, delivery, online)
- Utilidad por venta (totalCostUsd calculado automaticamente)
- Precio al mayor (wholesalePrice + wholesaleMinQty)
- Cotizaciones convertibles a venta
- Split payment (multiples metodos)
- Offline queue (IndexedDB + sync FIFO)
- Anulacion con PIN del dueno

### Inventario
- Variantes (talla, color), barcode, semaforo de stock
- Productos tipo servicio (sin stock, para peluquerias/talleres)
- Marca y ubicacion fisica del producto
- Prediccion de agotamiento, alertas de vencimiento (30 dias)
- Unidades de medida con conversion
- Ajuste manual de inventario con audit trail
- Movimientos de stock explicitos (venta, compra, ajuste)
- Importacion batch, OCR de facturas
- Historial de precios

### Clientes y CRM
- Perfil automatico con segmentos (VIP, en riesgo, inactivo)
- Estadisticas detalladas por cliente (historial, top productos, tendencia 6 meses)
- Cuentas por cobrar con pagos parciales y aging
- Cupo de credito por cliente (validado en checkout)
- Cobro por WhatsApp

### Proveedores
- Directorio con telefono, email, direccion
- CRUD completo (GET/POST/PATCH /suppliers)
- Estado de cuenta por proveedor (compras, deudas, historial)
- Vinculado a gastos y facturas de compra

### Reportes (11)
- Diario, semanal, rentabilidad, inventario, cuentas por cobrar
- Vendedores, financiero (P&L con gastos fijos/variables), flujo de caja (7d/30d)
- Alertas inteligentes, tendencia mensual (12 meses), stats por cliente
- Narrativa AI (OpenRouter/Groq)
- Export PDF, Excel, email

### Contabilidad
- Plan de cuentas pre-configurado por tipo de negocio
- Asientos automaticos desde ventas y gastos
- Gastos clasificados: fijos, variables, costo de venta

### Dashboard
- Saludo con nombre del negocio + hora del dia
- Ventas con tendencia verde/rojo
- 3 cards: "Te deben", "Se acaban", "En 7 dias"
- Alertas con colores (stock, vencimiento, deudas)
- Skeleton loading + boton actualizar
- Tasa BCV oficial (scraping) + tasa manual

### Operaciones
- Apertura de caja (POST /cash-opening)
- Cierre de caja con comparacion
- Multi-empleado con PIN, ranking de vendedores
- Catalogo publico por subdominio con SEO
- Tasa BCV + EUR manual por negocio

### Configuracion del negocio
- Cargos adicionales (surcharge_types): delivery, propinas, empaques
- Cuentas bancarias (bank_accounts): registro para referencia
- Notificaciones (notification_preferences): alertas diarias por email

### Seguridad
- RLS en 29 tablas con cleanup en finally
- Rate limiting (Redis + fallback)
- Scanner bot blocking
- Security headers
- PIN lockout (5 intentos)
- handleDbError en todos los endpoints de escritura

---

## Cobertura vs FoxPro legacy

### Nova TIENE que FoxPro NO tiene
- POS mobile-first con offline queue
- OCR de facturas con IA
- Reportes con narrativa AI
- CRM automatico con segmentos + stats por cliente
- Cobro por WhatsApp
- Catalogo publico por subdominio
- Multi-tenant SaaS con RLS
- Tasa BCV por scraping
- Alertas de vencimiento
- Utilidad por venta en tiempo real
- Cargos adicionales configurables
- Canales de venta (POS, WhatsApp, delivery, online)
- Tendencia mensual (12 meses)

### Nova equivalente a FoxPro
- Inventario con variantes, barcode, semaforo, unidades
- Cuentas por cobrar/pagar con pagos parciales
- Proveedores con estado de cuenta
- Cupos de credito
- Descuentos por % y monto fijo
- Precio al mayor
- Plan de cuentas con asientos automaticos
- Gastos fijos/variables/costo de venta
- Apertura y cierre de caja
- Cotizaciones
- Historial de precios
- Movimientos de inventario

### Excede el scope
- Facturacion electronica SENIAT (eliminado en PR #119 -- Nova es para comercio informal)
- Nomina/RRHH
- Costos FIFO/promedio ponderado
- Multi-almacen
- Integracion bancaria

---

## Backlog

| # | Tarea | Notas |
|---|-------|-------|
| 1 | Error tracking | Decidir herramienta para todos los proyectos |
| 2 | PWA icons | Subir logo de Nova |
| 3 | og:image catalogo | Subir /og-catalog.png (1200x630) |
| 4 | Recibo/factura PDF individual | Para enviar al cliente o imprimir |
| 5 | Pagina de movimientos de inventario | La tabla existe, falta UI |
| 6 | Devolucion rapida desde historial | Boton "Devolver" en detalle de venta |
| 7 | Busqueda global | Productos + clientes + ventas |
| 8 | E2E browser tests en CI | Requiere Clerk test keys |
| 9 | robots.txt / sitemap.xml | SEO |
| 10 | Precios por cliente | Solo si hay demanda |
| 11 | Ordenes de compra | Conectar con OCR confirm |

---

## Roadmap (futuro)

| Feature | Complejidad | Notas |
|---------|-------------|-------|
| Multi-almacen | Alta | Requiere reestructurar modelo de stock (warehouse_stock). Solo si hay demanda |
| Mensajeria masiva WhatsApp | Alta | Requiere WhatsApp Business API + aprobacion de templates por Meta. Segmentacion ya existe |

---

## SENIAT (eliminado)

Los campos fiscales SENIAT (IVA, IGTF, RIF, numeros de control, notas de credito, libro de compras/ventas)
fueron eliminados en PR #119 (migracion 0006). Nova es para comercio informal en Venezuela y no necesita
cumplimiento SENIAT. Esto simplifica el flujo critico de ventas sin afectar al usuario target.

---

## Variables de entorno (Coolify)

### API
| Variable | Critica | Estado |
|----------|---------|--------|
| DATABASE_URL | Si | OK |
| CLERK_SECRET_KEY | Si | OK |
| REDIS_URL | Si | OK |
| CORS_ORIGIN | Si | `https://novaincs.com` |
| TENANT_DOMAIN | Si | `novaincs.com` |
| OPENROUTER_API_KEY | No | Opcional (narrativas AI) |
| GROQ_API_KEY | No | Opcional (fallback AI) |

### Web (build args)
| Variable | Critica | Estado |
|----------|---------|--------|
| NUXT_PUBLIC_API_BASE | Si | OK |
| NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY | Si | OK |

---

## Lecciones aprendidas

### Sesion 1 (PRs #79-#101)
- Drizzle query builder: excelente. drizzle-kit CLI: fragil. Usar migrate.mjs propio.
- pdfmake es CJS-only: requiere createRequire(import.meta.url) en bundle ESM.
- useState/useRuntimeConfig de Nuxt: NUNCA a nivel de modulo.
- Coolify se satura con muchos PRs seguidos: mergear en batches de 2-3.

### Sesion 2 (PRs #102-#116)
- NUXT_PUBLIC_API_BASE es build-time: requiere rebuild del web service.
- Clerk redirect_uri_mismatch: verificar redirect URI en Google Cloud Console.
- set_config session-level con pool: limpiar en finally para evitar RLS leak.
- Migraciones con backfill: nullable -> UPDATE -> SET NOT NULL.
- $fetch<T> de Nuxt con baseURL externo requiere cast `as T`.
- @clerk/nuxt en SSR: fuerza HTTPS, imposible E2E browser sin keys reales.
- calculateSaleTotal revertido de {subtotal, discountTotal, taxTotal, total} a number (PR #119).
- supplier_id text -> uuid: RENAME old -> ADD new -> DROP old.
- BCV rate scraping: API publica en bcv-exchange-rates.vercel.app, timeout 10s.
