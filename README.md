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
| Lineas de codigo | ~21,400 |
| Tablas PostgreSQL | 26 (todas con RLS) |
| RLS policies | 26 |
| Endpoints API | 67 |
| Paginas frontend | 32 |
| Tests automatizados | 49 (unit + E2E API) |
| Migraciones Drizzle | 6 |

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
  api/     Hono REST API (67 endpoints, structured JSON logging, rate limiting)
  web/     Nuxt 4.4 SSR + PWA (32 paginas, subdomain-per-tenant)
packages/
  db/      Drizzle ORM schema (26 tablas, 26 RLS policies, 6 migraciones)
  shared/  Zod schemas, constantes, utilidades (IVA, IGTF, moneda dual)
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
- IVA (0%, 8%, 16%) + IGTF 3% en pagos en divisas
- Descuento por porcentaje y monto fijo
- Numeros de control secuenciales (SENIAT-ready)
- Notas de credito con devolucion parcial y restauracion de stock
- Cotizaciones convertibles a venta
- Split payment (multiples metodos en una venta)

### Inventario
- Variantes (talla, color), barcode, semaforo de stock
- Prediccion de agotamiento, alertas de vencimiento
- Unidades de medida con conversion (caja -> unidad)
- Ajuste manual de inventario con audit trail
- Movimientos de stock explicitos (venta, compra, ajuste)
- Importacion batch, OCR de facturas de proveedores

### Clientes y CRM
- Perfil automatico con segmentos (VIP, en riesgo, inactivo)
- Cuentas por cobrar con pagos parciales y aging
- Cupo de credito por cliente (validado en checkout)
- Cobro por WhatsApp en un toque
- RIF del cliente para facturacion formal

### Proveedores
- Directorio con RIF, telefono, email, direccion
- Vinculado a gastos y facturas de compra
- Libro de compras con totales por periodo

### Reportes con IA
- 10 reportes: diario, semanal, rentabilidad, inventario, cuentas por cobrar, vendedores, financiero, flujo de caja, alertas, libro de compras
- Narrativa generada por IA (OpenRouter/Groq)
- Export PDF, Excel, email via Resend
- Proyeccion de flujo de caja a 7 y 30 dias

### Contabilidad
- Plan de cuentas pre-configurado por tipo de negocio
- Asientos automaticos desde ventas y gastos
- RIF del negocio para documentos fiscales
- Campo de control fiscal para integracion con imprenta digital

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

## Moneda dual VES/USD

Nova opera en dolares (USD) como moneda base con conversion automatica a bolivares (VES) usando la tasa BCV del dia. Cada negocio configura su propia tasa. El IGTF (3%) se calcula automaticamente en pagos en divisas (Binance, Zinli, Zelle).

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
| [25 - Auditoria y roadmap](docs/25-auditoria-y-roadmap-definitivo.md) | Auditoria de codigo, plan dia por dia |
| [26 - Auditoria arquitectura](docs/26-auditoria-arquitectura-abril-2026.md) | Auth flow, multi-tenancy, Drizzle, riesgos |
| [27 - Auditoria produccion](docs/27-auditoria-produccion-abril-2026.md) | Roadmap de sprints, estado de cada feature |
| [28 - Gap analysis SENIAT](docs/28-seniat-gap-analysis.md) | Requisitos PA 000102/000121, gaps, ruta a homologacion |

## Licencia

Apache License 2.0. Ver [LICENSE](LICENSE).
