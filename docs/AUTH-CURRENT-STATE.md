# Nova: Estado Actual del Sistema de Autenticacion

> Fecha: Mayo 2026
> Estado: Single-user model. Un owner por negocio. Sin employees, PIN, ni Organizations.

---

## 1. Flujo Actual (Single-User)

```
Usuario nuevo:
  Landing (/landing) -> "Crear cuenta" -> /auth/signup
  -> Clerk crea cuenta (email/Google)
  -> Redirect a /auth/resolve
  -> GET /api/me -> 404 USER_NOT_FOUND
  -> Redirect a /onboarding
  -> POST /onboarding (crea business + user en DB)
  -> Dashboard (/)

Usuario existente:
  Landing (/landing) -> "Iniciar sesion" -> /auth/login
  -> Clerk sign-in
  -> Redirect a /auth/resolve
  -> GET /api/me -> 200 { user }
  -> Dashboard (/)

Usuario ya logueado (sesion activa):
  Cualquier ruta protegida
  -> Middleware: novaUser existe? -> OK, pasa
  -> Si no: Clerk isSignedIn? -> /auth/resolve -> GET /api/me -> OK
```

---

## 2. Archivos del Sistema de Auth

### Frontend (apps/web)

| Archivo | Funcion |
|---------|---------|
| `nuxt.config.ts` | Clerk module config: signInUrl, signUpUrl, forceRedirectUrl, afterSignOutUrl |
| `app/middleware/auth.global.ts` | Proteccion global de rutas. Si logueado pero sin NovaUser, va a /auth/resolve. Si no logueado, va a /landing |
| `app/composables/useApi.ts` | Cliente HTTP. Obtiene token via Clerk session. Adjunta como Bearer header |
| `app/composables/useNovaAuth.ts` | Estado del usuario Nova. `resolveUser()` llama GET /api/me. `isAdmin` siempre true |
| `app/pages/auth/login.vue` | Clerk `<SignIn>` component |
| `app/pages/auth/signup.vue` | Clerk `<SignUp>` component |
| `app/pages/auth/resolve.vue` | Espera Clerk, llama resolveUser(), redirige segun resultado |
| `app/pages/onboarding/index.vue` | 3 pasos: tipo negocio -> nombre/slug/owner -> listo. POST /onboarding |

### Backend (apps/api)

| Archivo | Funcion |
|---------|---------|
| `src/middleware/auth.ts` | Verifica Clerk JWT con `verifyToken()`. Busca user por `clerkId` en DB. Setea user + businessId en contexto Hono. Role siempre "owner" |
| `src/middleware/tenant.ts` | Setea `app.current_business_id` en PostgreSQL para RLS |
| `src/routes/onboarding.ts` | POST /onboarding: verifica JWT, crea business + user + categorias + cuentas contables en transaccion |
| `src/routes/team.ts` | Solo GET/PATCH /settings (configuracion del negocio) |
| `src/app.ts` | Monta rutas publicas (health, catalog, onboarding) y protegidas (/api/*) |

### DB (packages/db)

| Archivo | Funcion |
|---------|---------|
| `src/schema.ts` | Tablas businesses y users (sin PIN, sin clerkOrgId) |
| `src/queries.ts` | `findUserByClerkId()` y `findBusinessById()` |

---

## 3. Lo Que Se Elimino

### Sistema de PIN (eliminado)
- Empleados usaban PIN de 4 digitos para identificarse
- Columnas eliminadas: `pin_hash`, `pin_failed_attempts`, `pin_locked_until`
- Endpoints eliminados: POST /auth/pin, GET /auth/employees

### Clerk Organizations (eliminado)
- Cada business se vinculaba a una Clerk Organization
- Columna eliminada: `businesses.clerk_org_id`
- Logica eliminada: createClerkClient, organizations API

### Multi-usuario / Employees (eliminado)
- CRUD de empleados: GET/POST/PATCH/DELETE /employees
- Middleware admin-only (restriccion por rol)
- Roles owner/employee en frontend
- Pagina /settings/team

---

## 4. Como Funciona el Token

```
Frontend (useApi.ts):
  useClerk() -> captura ref durante setup del composable
  $api() -> clerkInstance.value.session.getToken() -> Bearer token

Backend (auth.ts):
  Authorization: Bearer <token>
  -> verifyToken(token, { secretKey }) -> payload.sub (clerkId)
  -> findUserByClerkId(db, clerkId) -> user
  -> findBusinessById(db, user.businessId) -> business
  -> c.set("user", { ...user, role: "owner" })
  -> c.set("businessId", business.id)
```

---

## 5. Rutas Publicas vs Protegidas

### Publicas (sin auth)
| Metodo | Ruta | Funcion |
|--------|------|---------|
| GET | /health | Health check |
| GET | /catalog/* | Catalogo publico por slug |
| GET | /onboarding/check-slug/:slug | Verificar disponibilidad de slug |
| POST | /onboarding | Crear negocio (requiere JWT pero no auth middleware) |

### Protegidas (auth + tenant RLS)
| Metodo | Ruta | Funcion |
|--------|------|---------|
| GET | /api/me | Resolver usuario actual |
| GET/PATCH | /api/settings | Configuracion del negocio |
| GET/POST/PATCH/DELETE | /api/products/* | Inventario |
| GET/POST | /api/sales/* | Ventas |
| GET | /api/reports/* | Reportes |
| ... | /api/* | Todas las demas rutas |

---

## 6. Variables de Entorno Requeridas

### Frontend (Nuxt)
```
NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
NUXT_CLERK_SECRET_KEY=sk_test_...
NUXT_PUBLIC_API_BASE=https://api.novaincs.com
NUXT_PUBLIC_TENANT_DOMAIN=novaincs.com
```

### Backend (API)
```
CLERK_SECRET_KEY=sk_test_...
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
PORT=3001
```

---

## 7. Modelo de Datos

```sql
businesses
  id          UUID PK
  name        TEXT
  type        TEXT
  slug        TEXT UNIQUE
  is_active   BOOLEAN

users
  id          UUID PK
  business_id UUID FK -> businesses.id
  clerk_id    TEXT UNIQUE
  name        TEXT
  role        TEXT (always "owner")
  is_active   BOOLEAN
```

Un business tiene exactamente 1 user (el owner). El user tiene `clerk_id` que lo vincula con Clerk.
