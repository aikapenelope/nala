# Nova: Estado Actual del Sistema de Autenticacion

> Fecha: Abril 2026
> Estado: Limpio, funcional, sin Organizations ni PIN.
> Base para construir encima.

---

## 1. Flujo Actual (Simple, Funcional)

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
| `app/middleware/auth.global.ts` | Proteccion global de rutas. Rutas publicas pasan. Si Clerk no ha cargado, no redirige. Si logueado pero sin NovaUser, va a /auth/resolve. Si no logueado, va a /landing |
| `app/middleware/admin-only.ts` | Middleware por pagina para rutas solo-owner (settings, reports, accounting) |
| `app/composables/useApi.ts` | Cliente HTTP. Obtiene token via `useClerk().value.session.getToken()`. Adjunta como Bearer header. Maneja 401 con banner de sesion expirada |
| `app/composables/useNovaAuth.ts` | Estado del usuario Nova. `resolveUser()` llama GET /api/me. Maneja USER_NOT_FOUND -> needs_onboarding |
| `app/pages/auth/login.vue` | Clerk `<SignIn>` component. Si ya logueado, redirige a /auth/resolve |
| `app/pages/auth/signup.vue` | Clerk `<SignUp>` component |
| `app/pages/auth/resolve.vue` | Espera Clerk, llama resolveUser(), redirige segun resultado. Tiene boton "Cerrar sesion" si falla |
| `app/pages/onboarding/index.vue` | 3 pasos: tipo negocio -> nombre/slug/owner -> listo. POST /onboarding |
| `app/plugins/nova-auth.client.ts` | No-op. Hook point para futuras necesidades |
| `app/layouts/default.vue` | Muestra banner "Sesion expirada" si sessionExpired es true |

### Backend (apps/api)

| Archivo | Funcion |
|---------|---------|
| `src/middleware/auth.ts` | Verifica Clerk JWT con `verifyToken()`. Busca user por `clerkId` en DB. Si no existe, 404 USER_NOT_FOUND. Si existe, setea user + businessId en contexto Hono |
| `src/middleware/tenant.ts` | Setea `app.current_business_id` en PostgreSQL para RLS |
| `src/routes/onboarding.ts` | POST /onboarding: verifica JWT, crea business + user + categorias + cuentas contables en transaccion |
| `src/routes/team.ts` | CRUD de empleados (100% DB, sin Clerk Organizations) |
| `src/app.ts` | Monta rutas publicas (health, catalog, onboarding) y protegidas (/api/*) |

### DB (packages/db)

| Archivo | Funcion |
|---------|---------|
| `src/schema.ts` | Tablas businesses (con clerkOrgId legacy) y users (con pinHash legacy) |
| `src/queries.ts` | `findUserByClerkId()` y `findBusinessById()` -- las unicas queries de auth activas |

---

## 3. Lo Que Se Elimino (y por que)

### Sistema de PIN (eliminado del codigo activo)
- **Que era**: Empleados usaban PIN de 4 digitos para identificarse en dispositivo compartido
- **Archivos eliminados**: `POST /auth/pin`, `GET /auth/employees`, `POST /api/verify-owner-pin`, `/auth/pin.vue`, `OwnerPinModal.vue`
- **Por que se elimino**: El sistema de PIN dependia de localStorage para businessId, tenia endpoints publicos vulnerables, y no funcionaba sin que el dueno configurara el dispositivo primero
- **Columnas DB que quedan** (requieren migracion para eliminar):
  - `users.pin_hash` -- hash bcrypt del PIN
  - `users.pin_failed_attempts` -- contador de intentos fallidos
  - `users.pin_locked_until` -- timestamp de lockout
- **Seed data**: `packages/db/src/seed.ts` aun tiene PIN hashes para tests

### Clerk Organizations (eliminado del codigo activo)
- **Que era**: Cada business se vinculaba a una Clerk Organization. El JWT incluia orgId. Empleados se invitaban via Clerk org invitations
- **Archivos eliminados**: Toda la logica de `createClerkClient`, `organizations.createOrganization`, `setActive({ organization })`, `findBusinessByClerkOrgId`, `findUserInBusiness`
- **Por que se elimino**: Con "Membership required", la sesion quedaba en estado "pending" (tratada como signed-out). `getToken` no devolvia token. Todas las llamadas API fallaban con 401. Chicken-and-egg: para crear org necesitas token, para tener token necesitas org
- **Columnas DB que quedan** (requieren migracion para eliminar):
  - `businesses.clerk_org_id` -- ID de la Clerk Organization
  - `idx_businesses_clerk_org_id` -- indice unico

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
  -> c.set("user", activeUser)
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
| GET/POST/PATCH/DELETE | /api/employees/* | CRUD empleados |
| GET/POST | /api/products/* | Inventario |
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

## 7. Para Construir Encima

### Si quieres agregar Organizations:
1. Clerk Dashboard: "Membership optional" (NO "required")
2. Onboarding crea la Organization via backend (`createClerkClient`)
3. Despues de crear, `setActive({ organization })` + `getToken({ skipCache: true })`
4. Auth middleware: si hay orgId en JWT, buscar business por clerkOrgId. Si no, buscar user por clerkId (fallback)
5. Ver investigacion completa en el PR #189

### Si quieres agregar sistema de PIN:
1. Seguir el plan de AUTH-REFACTOR-PLAN.md (PIN local, no server-side)
2. GET /api/team-roster (protegido) descarga empleados con PIN hashes
3. PIN se verifica localmente contra roster cacheado
4. Todas las requests van con JWT del dueno + header X-Acting-As
5. Backend valida que el employee pertenece al mismo business
