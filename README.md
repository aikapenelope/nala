# Nala

Vende facil. Controla todo. Desde tu celular.

Nala es un sistema de ventas para comerciantes venezolanos. Registra una venta en 2 toques, lleva tu inventario sin esfuerzo, cobra fiados por WhatsApp, y recibe pedidos online con tu propia tienda.

## Filosofia

**La venta genera el dato.** El vendedor no "llena un sistema" -- vende, y el sistema se organiza solo. Cada venta actualiza inventario, registra al cliente, calcula estadisticas, y genera contabilidad automaticamente.

- **2 toques para vender**: tap producto, tap cobrar
- **3 campos para crear producto**: nombre, precio, foto. Todo lo demas es opcional
- **0 configuracion para empezar**: nombre del negocio + primer producto = listo
- **WhatsApp como canal**: cobros, pedidos, comprobantes -- todo por WhatsApp

## Para quien es

Bodegas, panaderias, tiendas de ropa, mini-markets, licorerías, tiendas de celulares, distribuidoras pequenas. Comerciantes de 1-10 personas en Venezuela que hoy usan cuaderno, Excel, o Fina.

## Que hace

### Vender
- POS en el celular: tap producto, tap cobrar
- 7 metodos de pago (Pago Movil, Binance, Zinli, Zelle, efectivo, transferencia, fiado)
- Precios en USD y Bs automatico (tasa BCV)
- Descuentos, split payment, recibo PDF y WhatsApp

### Inventario
- Agregar producto: nombre + precio + foto. Listo
- Semaforo de stock (verde/amarillo/rojo)
- Import masivo desde Excel/CSV
- OCR: toma foto de la factura del proveedor y se registra solo

### Tienda online
- Cada negocio tiene su URL: `tunegocio.novaincs.com`
- Catalogo con precios en USD y Bs
- Carrito, checkout, metodos de pago del vendedor
- Pedidos llegan al dashboard + WhatsApp
- PWA installable, dark mode

### Clientes y fiado
- Se crean automaticamente cuando compran
- Control de fiado: quien te debe, cuanto, desde cuando
- Cobro por WhatsApp en un toque

### Dashboard
- Ventas de hoy, semana, mes
- Stock bajo, deudas pendientes
- Sugerencias: "3 productos criticos", "5 clientes te deben"

## Lo que funciona por detras (invisible)

El vendedor no ve esto, pero el sistema lo genera automaticamente:
- Asientos contables en cada venta
- Historial de precios al cambiar un producto
- Movimientos de stock en cada venta y ajuste
- Log de actividad de cada accion

## Stack

| Capa | Tecnologia |
|------|-----------|
| Frontend | Nuxt 4 (Vue 3), Tailwind 4, PWA |
| Backend | Hono (TypeScript) |
| DB | PostgreSQL 16, Row Level Security |
| Cache | Redis 7 |
| Auth | Clerk (JWT) |
| Storage | MinIO (S3) |
| OCR | GPT-4o-mini via OpenRouter |
| Hosting | Hetzner Cloud (Coolify) |
| Monorepo | Turborepo |
| CI/CD | GitHub Actions |

## Desarrollo local

```bash
git clone https://github.com/aikapenelope/nala.git
cd nala
npm ci
docker compose up -d
cp .env.example .env
npm run dev
```

## Documentacion

| Doc | Contenido |
|-----|-----------|
| [44 - Roadmap](docs/44-nala-pyme-roadmap-tentativo.md) | Roadmap de producto, fases, filosofia, competencia |
| [43 - Buyer persona](docs/43-product-focus-buyer-persona.md) | Cliente target, posicionamiento, limites |
| [42 - Auditoria](docs/42-product-audit-simplification.md) | Analisis tecnico, puntos de fallo, simplificacion |
| [41 - Storefront branding](docs/41-storefront-personalization-roadmap.md) | Plan de personalizacion visual (pendiente) |

## Licencia

Apache License 2.0
