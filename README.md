# Nala

POS + Tienda online para comerciantes venezolanos. Vende desde tu celular, controla tu inventario, y recibe pedidos online con tu propia tienda PWA.

## Para quien es

Bodegas, panaderias, tiendas de ropa, peluquerias, cafeterias, licorerías, tiendas de celulares. Comerciantes de 1-5 personas que hoy usan cuaderno, Excel, o notas del celular.

## Que hace

### Vender (POS)
- Registro de venta en 3-4 toques
- 7 metodos de pago venezolanos (Pago Movil, Binance, Zinli, Zelle, efectivo, transferencia, fiado)
- Precios en USD con conversion automatica a Bs (tasa BCV)
- Descuentos, split payment, recibo PDF

### Inventario
- Productos con semaforo de stock (verde/amarillo/rojo)
- Alertas cuando se acaba un producto
- Import masivo desde Excel/CSV

### Tienda online (Storefront PWA)
- Cada negocio tiene su URL: `tunegocio.novaincs.com`
- Catalogo publico con precios en USD y Bs
- Carrito, checkout, metodos de pago del vendedor
- Pedidos llegan al dashboard + WhatsApp
- Installable como app en el celular del cliente
- Dark mode automatico

### Clientes
- Directorio con telefono e historial de compras
- Control de fiado (quien te debe, cuanto, desde cuando)
- Cobro por WhatsApp en un toque

### Dashboard
- Ventas de hoy con tendencia
- Stock bajo, deudas pendientes, flujo de caja
- Tasa BCV del dia

## Stack tecnico

| Capa | Tecnologia |
|------|-----------|
| Frontend | Nuxt 4 (Vue 3), Tailwind 4, PWA |
| Backend | Hono (TypeScript) |
| Base de datos | PostgreSQL 16, Row Level Security |
| Cache | Redis 7 |
| Auth | Clerk (JWT) |
| Storage | MinIO (S3-compatible) |
| Hosting | Hetzner Cloud (Coolify) |
| Monorepo | Turborepo |
| CI/CD | GitHub Actions |

## Arquitectura

```
apps/
  api/     Hono REST API (90+ endpoints)
  web/     Nuxt 4 SSR + PWA (49 paginas, subdomain-per-tenant)
packages/
  db/      Drizzle ORM schema (31 tablas)
  shared/  Zod schemas, utilidades, constantes
```

## Desarrollo local

```bash
git clone https://github.com/aikapenelope/nala.git
cd nala
npm ci
docker compose up -d    # PostgreSQL 16 + Redis 7 + MinIO
cp .env.example .env    # Configurar Clerk keys
npm run dev             # API en :3001, Web en :3000
```

## Tests

```bash
npm test    # Unit + E2E API tests
```

## Documentacion

| Documento | Contenido |
|-----------|-----------|
| [40 - UI Roadmap](docs/40-roadmap-ui1.md) | Sprints UI completados (PRs #217-#221) |
| [41 - Personalizacion storefront](docs/41-storefront-personalization-roadmap.md) | Plan para branding custom (pendiente) |
| [42 - Auditoria de producto](docs/42-product-audit-simplification.md) | Analisis de simplificacion y limites |
| [43 - Enfoque y buyer persona](docs/43-product-focus-buyer-persona.md) | Definicion de cliente target y posicionamiento |

## Licencia

Apache License 2.0. Ver [LICENSE](LICENSE).
