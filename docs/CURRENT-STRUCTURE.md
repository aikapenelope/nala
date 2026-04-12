# Nova: Estructura Actual del Codigo y UX

> Documento de referencia para entender el estado actual antes de hacer cambios.
> Fecha: Abril 2026

---

## 1. Estructura de Archivos

```
apps/
  api/src/                    # Backend Hono (puerto 3001)
    config.ts                 # Validacion de env vars al startup
    db.ts                     # Singleton PostgreSQL (Drizzle ORM)
    redis.ts                  # Singleton Redis (ioredis)
    index.ts                  # Entry point: init DB/Redis, start server
    app.ts                    # Hono app: middleware chain + routes
    types.ts                  # AppEnv (user, businessId, db en context)
    middleware/
      auth.ts                 # Clerk JWT -> DB lookup, dev fallback
      tenant.ts               # SET app.current_business_id para RLS
    routes/
      health.ts               # GET /health (DB + Redis check)
      auth.ts                 # POST /auth/pin, GET /auth/employees, POST /api/verify-owner-pin
      onboarding.ts           # POST /onboarding (business + owner + categories + accounts)
      inventory.ts            # CRUD productos, variantes, categorias
      sales.ts                # CRUD ventas, cotizaciones, tasa de cambio
      customers.ts            # CRUD clientes, cuentas por cobrar/pagar, day-close
      reports.ts              # 7 reportes + alertas inteligentes
      accounting.ts           # Chart of accounts, journal entries, OCR
      whatsapp.ts             # Webhook Meta (parcialmente conectado)
    services/
      exchange-rate.ts        # Tasa manual USD/EUR, Redis cache + DB
      ai-narrative.ts         # OpenRouter/Groq para narrativas de reportes
      ocr-pipeline.ts         # GPT-4o-mini vision para facturas
      whatsapp-interpreter.ts # LLM interpreta mensajes WhatsApp
      whatsapp-sender.ts      # Meta Cloud API sender

  web/app/                    # Frontend Nuxt 4 (puerto 3000)
    layouts/
      default.vue             # Desktop: sidebar + header + content
                              # Mobile: header + content + bottom tabs
    components/
      desktop/Sidebar.vue     # Navegacion lateral (8 items, admin-only filter)
      mobile/BottomTabs.vue   # 5 tabs: Inicio, Vender, Inventario, Clientes, Mas
      shared/
        AppHeader.vue         # Business name + role badge + Clerk UserButton
        OwnerPinModal.vue     # Modal PIN para acciones restringidas
        ReportLayout.vue      # Layout comun para reportes (period selector + export)
        BarcodeScanner.vue    # Escaner de codigo de barras (camara)
        EmptyState.vue        # Estado vacio generico
    composables/
      useApi.ts               # $api wrapper con JWT auto-attach
      useNovaAuth.ts          # Auth unificado (Clerk + PIN), localStorage
      useDevice.ts            # isMobile/isDesktop media queries
      useOfflineDb.ts         # IndexedDB (Dexie) para cache offline
      useProductCache.ts      # Cache de productos en IndexedDB
      useOfflineQueue.ts      # Cola de ventas offline (FIFO sync)
    middleware/
      admin-only.ts           # Redirige a / si no es owner
    pages/                    # Ver seccion 3 para detalle

packages/
  db/src/
    schema.ts                 # 20+ tablas Drizzle (670 lineas)
    client.ts                 # createDb() con postgres.js
    queries.ts                # findUserByClerkId, findBusinessById, etc.
    seed.ts                   # Seed con PINs bcrypt reales
  shared/src/
    types.ts, schemas.ts      # Tipos y Zod schemas compartidos
    constants.ts              # PIN_LENGTH, MAX_PIN_ATTEMPTS, etc.
    inventory.ts              # createProductSchema, calculateStockSemaphore
    sales.ts                  # createSaleSchema, calculateSaleTotal
    customers.ts              # createCustomerSchema, calculateAgingColor
    predictions.ts            # Predicciones (no conectado)
    gamification.ts           # Seller goals/streaks (no conectado)
```

---

## 2. Flujo de Autenticacion (Actual)

```
Usuario nuevo:
  /landing -> "Crear cuenta gratis" -> /onboarding
  /onboarding: Clerk sign-up -> tipo de negocio -> nombre + PIN -> POST /onboarding -> /

Usuario existente (dueno):
  /auth/login -> Clerk SignIn -> redirect a /
  / (dashboard): si no autenticado -> redirect a /landing

Empleado (dispositivo compartido):
  /auth/pin -> ingresa PIN 4 digitos -> POST /auth/pin -> / (dashboard)

Cambiar usuario:
  Sidebar (desktop) -> click en nombre -> /auth/pin
  Header -> Clerk UserButton (solo duenos)
```

### Problemas del flujo actual:

1. **No hay proteccion global de rutas.** Cualquier URL es accesible sin autenticacion. Solo el dashboard (/) redirige a /landing. Si alguien va directo a /sales, ve la pagina (vacia, pero la ve).

2. **El PIN screen no sabe el businessId.** Depende de localStorage que puede no existir si es la primera vez. Sin businessId, el PIN no funciona.

3. **No hay flujo post-Clerk-login.** Despues de que Clerk autentica al dueno, no hay logica que busque el usuario en la DB de Nova y setee el NovaUser. El dashboard carga pero las API calls fallan porque no hay businessId.

4. **Onboarding no verifica si ya tiene negocio.** Si el dueno ya hizo onboarding y vuelve a /onboarding, puede crear un duplicado (el backend lo rechaza con 409, pero el frontend no maneja ese caso bien).

5. **El landing tiene layout: false pero el onboarding usa default layout.** El onboarding muestra sidebar y header, lo cual es confuso para un usuario nuevo que aun no tiene negocio.

6. **El link "Mas" en mobile bottom tabs va a /more que no existe.** Da 404.

---

## 3. Mapa de Paginas

### Paginas sin layout (standalone)

| Ruta | Proposito | Estado |
|------|-----------|--------|
| `/landing` | Marketing page para visitantes | Funciona |
| `/auth/login` | Clerk SignIn para duenos | Funciona |

### Paginas con layout default (sidebar + header)

| Ruta | Acceso | Proposito | Estado |
|------|--------|-----------|--------|
| `/` | Todos | Dashboard con ventas del dia, alertas, grafico semanal | Funciona pero redirige a /landing si no autenticado |
| `/auth/pin` | Todos | Teclado PIN para empleados | Funciona pero tiene layout (sidebar visible, confuso) |
| `/onboarding` | Todos | Crear negocio (3 pasos) | Funciona pero tiene layout (sidebar visible, confuso) |
| `/sales` | Todos | POS: grid de productos + ticket | Funciona |
| `/sales/checkout` | Todos | Seleccion de metodo de pago + confirmar venta | Funciona |
| `/sales/history` | Todos | Historial de ventas con filtros | Funciona |
| `/inventory` | Todos | Lista de productos con semaforo | Funciona |
| `/inventory/[id]` | Owner | Crear/editar producto | Funciona |
| `/inventory/import` | Owner | Importar desde Excel | NO conectado al API |
| `/clients` | Todos | Lista de clientes | Funciona |
| `/accounts` | Owner | Cuentas por cobrar/pagar | Funciona |
| `/accounts/day-close` | Owner | Cierre de caja | Funciona |
| `/reports` | Owner | Hub de 7 reportes | Funciona |
| `/reports/daily` | Owner | Resumen del dia | Funciona |
| `/reports/weekly` | Owner | Resumen semanal | Funciona |
| `/reports/profitability` | Owner | Rentabilidad por producto | Funciona |
| `/reports/inventory` | Owner | Estado del inventario | Funciona |
| `/reports/receivable` | Owner | Aging de cuentas por cobrar | Funciona |
| `/reports/sellers` | Owner | Ventas por vendedor | Funciona |
| `/reports/financial` | Owner | P&L simplificado | Funciona |
| `/accounting` | Owner | Chart of accounts + journal entries | Funciona |

### Paginas que no existen pero se referencian

| Ruta | Referenciada desde | Problema |
|------|-------------------|----------|
| `/more` | BottomTabs mobile | 404 |
| `/settings` | Sidebar desktop | 404 |
| `/clients/new` | Boton en clients/index | 404 |
| `/inventory/new` | Boton en inventory/index | Funciona (usa /inventory/[id] con id="new") |

---

## 4. Estructura del Dashboard (/)

```
Si no autenticado:
  -> redirect a /landing

Si autenticado:
  ┌─────────────────────────────────────────┐
  │ [Tasa: USD 477.14 · EUR 560.04] [Cambiar] │  <- Solo owner ve "Cambiar"
  ├─────────────────────────────────────────┤
  │                                         │
  │         $0.00                            │  <- Ventas de hoy (link a /sales/history)
  │         vendidos hoy                     │
  │                                         │
  ├────────────┬────────────┬───────────────┤
  │  $0        │  0         │  0 alertas    │  <- Tarjetas resumen
  │  por cobrar│  stock bajo│  (solo desktop)│
  ├────────────┴────────────┴───────────────┤
  │ [online] Actualizado                     │  <- Indicador sync
  │                                         │
  │ [+ Nueva venta]                          │  <- Solo mobile
  ├─────────────────────────────────────────┤
  │ Alertas que necesitan tu atencion        │  <- De GET /api/reports/alerts
  │ ┌─────────────────────────────────────┐ │
  │ │ 🔴 Producto X: solo 2 en stock     │ │
  │ │    Stock critico. Pedir urgente.    │ │
  │ │                        [Ver producto]│ │
  │ └─────────────────────────────────────┘ │
  ├─────────────────────────────────────────┤
  │ Como te fue esta semana (solo owner)     │
  │ [grafico de barras diario]               │
  │ "narrativa IA..."                        │
  │                    [Ver reporte completo] │
  ├─────────────────────────────────────────┤
  │ Ultima venta: $X.XX, hace Y min          │
  └─────────────────────────────────────────┘
```

---

## 5. Navegacion

### Desktop (sidebar)

```
Nova (logo)
─────────────
● Inicio        -> /
  Vender        -> /sales
  Inventario    -> /inventory
  Clientes      -> /clients
  Cuentas       -> /accounts      (owner only)
  Reportes      -> /reports       (owner only)
  Contabilidad  -> /accounting    (owner only)
  Config.       -> /settings      (owner only, 404)
─────────────
[Avatar] Pedro Rodriguez -> /auth/pin
```

Los iconos del sidebar son texto plano ("home", "shopping-cart", etc.), no iconos reales. Se muestran como texto.

### Mobile (bottom tabs)

```
┌──────┬──────┬──────┬──────┬──────┐
│ home │shop- │pack- │users │ menu │
│Inicio│Vender│Invent│Client│ Mas  │
└──────┴──────┴──────┴──────┴──────┘
```

"Mas" va a /more que no existe (404). Los iconos tambien son texto plano.

---

## 6. Problemas de UX Identificados

### Criticos (bloquean uso)

1. **No hay proteccion global de rutas.** Un usuario no autenticado puede navegar a cualquier pagina.
2. **Post-Clerk-login no setea NovaUser.** El dueno se autentica con Clerk pero Nova no sabe quien es (no busca en DB).
3. **PIN screen necesita businessId.** Si no hay en localStorage, no funciona.
4. **/more y /settings dan 404.**

### Confusos

5. **Onboarding y PIN screen muestran sidebar/header.** Un usuario nuevo ve navegacion a secciones que no puede usar.
6. **Iconos son texto plano.** "home", "shopping-cart" se muestran como palabras, no como iconos graficos.
7. **No hay pagina de "Mas" en mobile.** Las secciones admin (cuentas, reportes, contabilidad) no son accesibles en mobile.
8. **El header dice "Nova" hardcodeado.** Deberia mostrar el nombre del negocio del usuario.
9. **No hay indicacion de que pagina estas.** El sidebar no resalta la pagina activa visualmente (el active-class existe pero los iconos de texto no se distinguen).
10. **El ReportLayout tiene period selector que no funciona.** Cambia el valor pero no re-fetcha los datos.

### Menores

11. **El landing page se ve en /landing, no en /.** Un visitante nuevo que va a nova.aikalabs.cc ve el dashboard (que redirige a /landing), no el landing directamente.
12. **No hay pagina /clients/new.** El boton "+ Cliente" en la lista de clientes da 404.
13. **El checkout no recuerda items si recargas la pagina.** Usa sessionStorage que se pierde.
14. **No hay confirmacion al anular venta.** El modal de PIN aparece pero no pide motivo de anulacion.

---

## 7. Stack Tecnico

| Capa | Tecnologia | Version |
|------|-----------|---------|
| Frontend | Nuxt 4 (Vue 3) | 4.4.2 |
| CSS | Tailwind CSS v4 | 4.1.7 |
| PWA | @vite-pwa/nuxt | 1.0.0 |
| Auth | @clerk/nuxt | 2.1.2 |
| Offline | Dexie.js (IndexedDB) | 4.0.11 |
| Backend | Hono | 4.7.10 |
| ORM | Drizzle ORM | 0.41.0 |
| DB | PostgreSQL 16 + pgvector | - |
| Cache | Redis 7 | - |
| Storage | MinIO | - |
| AI | OpenRouter (GPT-4o-mini) | - |
| Build (API) | tsup | 8.5.1 |
| Build (Web) | Nuxt/Nitro | node-server preset |
| Monorepo | Turborepo | 2.9.5 |
| Deploy | Coolify on Hetzner | - |

---

## 8. API Endpoints

### Publicos (sin auth)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | /health | Health check (DB + Redis) |
| POST | /auth/pin | Verificar PIN empleado |
| GET | /auth/employees?businessId= | Lista empleados para shortcuts |
| POST | /onboarding | Crear negocio + owner |
| GET/POST | /webhooks/whatsapp | Meta webhook |

### Protegidos (auth + tenant RLS)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | /api/me | Info del usuario actual |
| POST | /api/verify-owner-pin | Verificar PIN dueno (acciones restringidas) |
| GET/POST | /api/products | Listar/crear productos |
| GET/PATCH/DELETE | /api/products/:id | Detalle/editar/borrar producto |
| POST | /api/products/:id/variants | Crear variante |
| PATCH/DELETE | /api/products/variants/:id | Editar/borrar variante |
| GET/POST | /api/categories | Listar/crear categorias |
| GET/POST | /api/sales | Listar/crear ventas |
| GET | /api/sales/:id | Detalle de venta |
| POST | /api/sales/:id/void | Anular venta |
| GET/POST | /api/exchange-rate | Obtener/setear tasa de cambio |
| GET/POST | /api/quotations | Listar/crear cotizaciones |
| POST | /api/quotations/:id/convert | Convertir cotizacion a venta |
| GET/POST | /api/customers | Listar/crear clientes |
| GET/PATCH | /api/customers/:id | Detalle/editar cliente |
| GET | /api/accounts/receivable | Cuentas por cobrar |
| POST | /api/accounts/receivable/:id/payment | Registrar pago |
| POST | /api/accounts/receivable/collect-all | Links WhatsApp cobro |
| GET/POST | /api/accounts/payable | Cuentas por pagar |
| PATCH | /api/accounts/payable/:id/pay | Registrar pago |
| POST | /api/day-close | Cierre de caja |
| GET | /api/day-close/history | Historial de cierres |
| GET | /api/accounting/accounts | Chart of accounts |
| GET | /api/accounting/entries | Journal entries |
| POST | /api/ocr/invoice | Procesar factura con OCR |
| POST | /api/ocr/confirm | Confirmar OCR (crear gasto) |
| GET | /api/reports/daily | Resumen del dia |
| GET | /api/reports/weekly | Resumen semanal |
| GET | /api/reports/profitability | Rentabilidad |
| GET | /api/reports/inventory | Estado inventario |
| GET | /api/reports/receivable | Aging cuentas por cobrar |
| GET | /api/reports/sellers | Ventas por vendedor |
| GET | /api/reports/financial | P&L |
| GET | /api/reports/alerts | Alertas inteligentes |
