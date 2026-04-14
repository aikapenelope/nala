# Nova

Backoffice operativo para comerciantes y PyMEs en Venezuela. Ventas, inventario, clientes, cuentas, reportes y contabilidad en un solo lugar.

## Estado

Nova esta corriendo en produccion:

```
API:  https://nova-api.aikalabs.cc
Web:  https://nova.aikalabs.cc
CI:   GitHub Actions (typecheck + lint + 17 tests + build)
```

## Stack tecnico

| Capa | Tecnologia |
|---|---|
| Frontend | Nuxt 4 (Vue 3), Tailwind 4, PWA con Service Workers |
| DB local | IndexedDB (Dexie.js) — cache local + cola offline |
| Backend | Hono (TypeScript) |
| Base de datos | PostgreSQL 16 + pgvector, Row Level Security |
| Cache | Redis 7 |
| Auth | Clerk (JWT) + PIN local (bcrypt en browser) |
| IA | OpenRouter (GPT-4o-mini), Groq (fallback) |
| OCR | GPT-4o-mini vision via OpenRouter |
| Hosting | Hetzner Cloud (Coolify) |
| CI/CD | GitHub Actions |
| Monorepo | Turborepo |

## Arquitectura

```
apps/
  api/     Hono REST API (40+ endpoints, structured JSON logging, rate limiting)
  web/     Nuxt 4 SSR + PWA (27 paginas, subdomain-per-tenant)
packages/
  db/      Drizzle ORM schema (26 tablas, RLS policies)
  shared/  Zod schemas, constantes, utilidades
```

### Multi-tenancy

- **DB**: PostgreSQL RLS con `set_config('app.current_business_id', ...)` por request
- **Auth**: Clerk JWT autentica el dispositivo, PIN identifica al empleado localmente
- **Subdominios**: cada negocio tiene su URL publica (`negocio.{dominio}`) con catalogo integrado
- **Cache**: Redis keys scopeadas por tenant (`nova:{businessId}:...`)

### Autenticacion (patron Square)

1. Dueno hace sign-in con Clerk (una vez por dispositivo)
2. Empleados usan PIN de 4 digitos contra roster cacheado en localStorage (bcrypt)
3. Backend recibe Clerk JWT + header X-Acting-As con userId del empleado
4. No hay endpoints publicos de auth — PIN se verifica localmente

## Para quién es

Ferreterias, bodegas, tiendas de ropa, autopartes, peluquerias, farmacias, tiendas de electronica, librerias, cosmeticos, distribuidoras. PyMEs de 1 a 30 empleados en Venezuela.

## Que hace

- **Ventas**: registro en 3-4 toques, 7 metodos de pago, funciona offline
- **Inventario**: variantes, semaforo de stock, prediccion de agotamiento, importacion Excel
- **Clientes**: perfil automatico, cuentas por cobrar/pagar, cobro via wa.me/
- **Reportes**: 7 reportes con narrativa IA, dashboard con progressive disclosure
- **Contabilidad**: asientos automaticos, catalogo de cuentas por tipo de negocio, exportacion para el contador
- **Catalogo publico**: pagina web por negocio con productos, precios, boton "Pedir por WhatsApp"
- **Multi-empleado**: dueno + empleados con PIN, ranking de vendedores, cierre de dia

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

## Documentacion

| Documento | Contenido |
|---|---|
| [01 - Features actuales de Fina](docs/01-fina-features-actuales.md) | Inventario completo de lo que ofrece Fina hoy |
| [02 - Contexto Venezuela](docs/02-respuestas-contexto-venezuela.md) | APIs locales, integracion contable, POS descartado |
| [03 - Extras propuestos B-J](docs/03-extras-propuestos-B-a-J.md) | 38 features detallados con complejidad y prioridad |
| [04 - Consolidado de features](docs/04-todos-los-features-consolidado.md) | 102 features con tabla de decision |
| [05 - Competidores y features modernos](docs/05-competidores-y-features-modernos.md) | Analisis de Square, Toast, Shopify, QuickBooks, Alegra |
| [06 - Por que Fina gana con menos](docs/06-por-que-fina-gana-con-menos.md) | Analisis de simplicidad, contexto Venezuela |
| [07 - Vision de producto](docs/07-nala-vision-producto-2026.md) | Vision completa: experiencia escritorio/movil, features v1.0 |
| [08 - WhatsApp entrada + diferenciadores](docs/08-whatsapp-entrada-y-diferenciadores.md) | ~~WhatsApp bidireccional~~ (descartado, ver doc 22). OCR, cierre automatico, diferenciadores |
| [09 - Decisiones tecnicas](docs/09-decisiones-tecnicas.md) | Roles, flujo contable, OCR con GPT-4o-mini vision |
| [10 - Build vs OSS base](docs/10-build-vs-oss-base.md) | Por que construir desde cero |
| **[11 - Especificacion final](docs/11-especificacion-final.md)** | **Documento definitivo: capacidades, arquitectura, modelo de datos, UX, stack** |
| [12 - Pipeline OCR en detalle](docs/12-ocr-pipeline-detalle.md) | Flujo completo de lectura de facturas |
| [13 - Cierre contable, migracion, multi-tenant, PWA](docs/13-cierre-contable-migracion-multitenant-pwa.md) | Cuadre de caja, PostgreSQL RLS, PWA vs desktop |
| [14 - Experiencia desktop vs movil](docs/14-experiencia-desktop-vs-movil.md) | Patrones Square/Shopify/Lightspeed, wireframes |
| [15 - Catalogo, stack tecnico, estrategia offline](docs/15-catalogo-stack-offline.md) | Nuxt 4, IndexedDB, Hono, online-first |
| [16 - Fina vs Nova + estructura dashboard](docs/16-fina-vs-nala-dashboard-estructura.md) | Comparacion feature por feature, wireframes dashboard |
| [17 - Dashboard rediseno basado en investigacion](docs/17-dashboard-rediseno-investigacion.md) | Progressive disclosure, alertas accionables |
| [18 - Roadmap de desarrollo y produccion](docs/18-roadmap-desarrollo-produccion.md) | 10 fases de desarrollo, CI/CD, testing |
| [19 - WhatsApp arquitectura y seguridad](docs/19-whatsapp-arquitectura-seguridad.md) | ~~Descartado~~ (ver doc 22). Webhook y LLM interpreter eliminados |
| [20 - Sistema de PIN y modos Admin/Empleado](docs/20-sistema-pin-modos-admin-empleado.md) | Clerk + PIN, dispositivo compartido, cambio de usuario |
| [21 - Fases de desarrollo definitivas](docs/21-fases-desarrollo-definitivas.md) | 10 fases con tareas exactas, tests por fase |
| **[22 - Roadmap de produccion](docs/22-production-roadmap-whatsapp-compliance.md)** | **Roadmap vigente. Decisiones WhatsApp/gamificacion, cambios realizados (PRs #66-#73), pendientes** |
| **[23 - Analisis subdomain-per-tenant](docs/23-subdomain-tenant-analysis.md)** | **Investigacion Shopify/Slack/Fina, auditoria de codigo, plan de implementacion** |
| **[24 - Activar subdominios paso a paso](docs/24-activar-subdominios-paso-a-paso.md)** | **Guia operativa: comprar dominio, DNS, Coolify, Clerk, verificacion** |

## Licencia

Apache License 2.0. Ver [LICENSE](LICENSE).
