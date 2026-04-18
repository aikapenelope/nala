# Nova

Backoffice operativo para comerciantes y PyMEs en Venezuela. Ventas, inventario, clientes, cuentas, reportes y contabilidad en un solo lugar. Funciona offline. Inteligencia en cada pantalla.

## Estado

Nova esta corriendo en produccion:

```
Web:  https://novaincs.com
API:  https://api.novaincs.com
CI:   GitHub Actions (typecheck + lint + 49 tests + build)
```

## Metricas del proyecto

| Metrica | Valor |
|---------|-------|
| Lineas de codigo | ~22,000 |
| Tablas PostgreSQL | 29 (todas con RLS) |
| RLS policies | 29 |
| Endpoints API | 80+ |
| Paginas frontend | 32 |
| Tests automatizados | 49 (unit + E2E API) |
| Migraciones Drizzle | 8 |

## Stack tecnico

| Capa | Tecnologia |
|---|---|
| Frontend | Nuxt 4.4 (Vue 3), Tailwind 4, PWA |
| DB local | IndexedDB (Dexie.js) — cache + cola offline |
| Backend | Hono (TypeScript), tsup bundle |
| Base de datos | PostgreSQL 16 + pgvector, Row Level Security |
| Cache | Redis 7 |
| Auth | Clerk (JWT) + PIN local (bcrypt en browser) |
| IA | OpenRouter (GPT-4o-mini), Groq (fallback) |
| OCR | GPT-4o-mini vision via OpenRouter |
| Hosting | Hetzner Cloud hel1 (Coolify) |
| CI/CD | GitHub Actions |
| Monorepo | Turborepo |

## Arquitectura

```
apps/
  api/     Hono REST API (80+ endpoints, structured JSON logging, rate limiting)
  web/     Nuxt 4.4 SSR + PWA (32 paginas, subdomain-per-tenant)
packages/
  db/      Drizzle ORM schema (29 tablas, 29 RLS policies, 8 migraciones)
  shared/  Zod schemas, constantes, utilidades (moneda dual VES/USD)
```

### Multi-tenancy

- **DB**: PostgreSQL RLS con `set_config` por request + cleanup en `finally`
- **Auth**: Clerk JWT autentica el dispositivo, PIN identifica al empleado localmente
- **Subdominios**: cada negocio tiene su URL publica (`negocio.novaincs.com`)
- **Cache**: Redis keys scopeadas por tenant (`nova:{businessId}:...`)

### Autenticacion (patron Square POS)

1. Dueno hace sign-in con Clerk (una vez por dispositivo)
2. Empleados usan PIN de 4 digitos contra roster cacheado en localStorage (bcrypt)
3. Backend recibe Clerk JWT + header X-Acting-As con userId del empleado
4. PIN se verifica localmente — no hay API call para cambio de turno

## Para quien es

Ferreterias, bodegas, tiendas de ropa, autopartes, peluquerias, farmacias, tiendas de electronica, librerias, cosmeticos, distribuidoras. PyMEs de 1 a 30 empleados en Venezuela.

## Que hace

### Punto de venta
- Registro en 3-4 toques, 7 metodos de pago venezolanos
- Funciona offline (IndexedDB + sync FIFO cuando vuelve internet)
- Descuento por porcentaje y monto fijo
- Cargos adicionales configurables (delivery, propinas, empaques)
- Canales de venta (POS, WhatsApp, delivery, online)
- Utilidad por venta en tiempo real (costo vs precio)
- Cotizaciones convertibles a venta
- Split payment (multiples metodos en una venta)
- Anulacion de ventas con PIN del dueno

### Inventario
- Variantes (talla, color), barcode, semaforo de stock
- Productos tipo servicio (sin stock, para peluquerias/talleres)
- Precio al mayor (wholesalePrice + cantidad minima)
- Marca y ubicacion fisica del producto
- Prediccion de agotamiento, alertas de vencimiento
- Unidades de medida con conversion (caja -> unidad)
- Ajuste manual de inventario con audit trail
- Movimientos de stock explicitos (venta, compra, ajuste)
- Importacion batch, OCR de facturas de proveedores

### Clientes y CRM
- Perfil automatico con segmentos (VIP, en riesgo, inactivo)
- Estadisticas detalladas por cliente (historial, top productos, tendencia)
- Cuentas por cobrar con pagos parciales y aging
- Cupo de credito por cliente (validado en checkout)
- Cobro por WhatsApp en un toque

### Proveedores
- Directorio con telefono, email, direccion
- Estado de cuenta por proveedor (compras, deudas, historial)
- Vinculado a gastos y facturas de compra

### Reportes con IA
- 11 reportes: diario, semanal, rentabilidad, inventario, cuentas por cobrar, vendedores, financiero (P&L con gastos fijos/variables), flujo de caja, alertas, tendencia mensual (12 meses), stats por cliente
- Narrativa generada por IA (OpenRouter/Groq)
- Export PDF, Excel, email via Resend
- Proyeccion de flujo de caja a 7 y 30 dias

### Contabilidad
- Plan de cuentas pre-configurado por tipo de negocio
- Asientos automaticos desde ventas y gastos
- Gastos clasificados: fijos, variables, costo de venta

### Dashboard visual
- Saludo con nombre del negocio + hora del dia
- Ventas de hoy con tendencia verde/rojo
- 3 cards: "Te deben", "Se acaban", "En 7 dias" (cash flow)
- Alertas con colores por severidad (stock, vencimiento, deudas)
- Skeleton loading + boton actualizar
- Tasa BCV oficial (scraping automatico) + tasa manual del negocio

### Operaciones
- Apertura y cierre de caja con comparacion
- Multi-empleado con PIN, ranking de vendedores
- Catalogo publico por subdominio con SEO para WhatsApp
- Tasa de cambio BCV + EUR manual por negocio

### Configuracion del negocio
- Cargos adicionales (surcharge types): delivery, propinas, empaques
- Cuentas bancarias: registro de cuentas para referencia
- Notificaciones: preferencias de alertas diarias por email

## Moneda dual VES/USD

Nova opera en dolares (USD) como moneda base con conversion automatica a bolivares (VES) usando la tasa BCV del dia. Cada negocio configura su propia tasa.

## Desarrollo local

```bash
# Requisitos: Node 22+, Docker (para PostgreSQL + Redis)
git clone https://github.com/aikapenelope/nala.git
cd nala
npm ci
docker compose up -d    # PostgreSQL 16 + Redis 7 + MinIO
cp .env.example .env    # Configurar Clerk keys
npm run dev             # Turborepo: API en :3001, Web en :3000
```

## Tests

```bash
npm test                # Unit + E2E API tests (49 tests)
```

Los E2E tests corren contra la API directamente via `app.request()` (Hono). No requieren Clerk ni browser. En CI corren con PostgreSQL + Redis reales.

## Documentacion

| Documento | Contenido |
|---|---|
| [29 - Features actuales](docs/29-nova-features-actuales.md) | Catalogo completo de features, endpoints, tablas, paginas |
| [27 - Auditoria produccion](docs/27-auditoria-produccion-abril-2026.md) | Roadmap de sprints, estado de cada feature |
| [26 - Auditoria arquitectura](docs/26-auditoria-arquitectura-abril-2026.md) | Auth flow, multi-tenancy, Drizzle, riesgos |
| [25 - Auditoria y roadmap](docs/25-auditoria-y-roadmap-definitivo.md) | Auditoria de codigo, plan dia por dia |

## Licencia

Apache License 2.0. Ver [LICENSE](LICENSE).
