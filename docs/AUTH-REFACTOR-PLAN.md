# Nova: Plan de Refactor de Autenticacion -- Opcion B

> Clerk para autenticacion del dispositivo + PINs como identificacion local.
> Fecha: Abril 2026

---

## 1. Problema Actual

Nova tiene dos sistemas de auth paralelos que no se coordinan:

| Sistema | Donde | Que hace | Problema |
|---------|-------|----------|----------|
| Clerk JWT | `authMiddleware` | Verifica identidad del dueno contra Clerk | Solo funciona para el dueno. Empleados no tienen Clerk. |
| PIN publico | `POST /auth/pin` | Verifica PIN contra bcrypt hashes en DB | Endpoint publico. Cualquiera con un businessId + 10K intentos puede entrar. |

Los bugs historicos (PRs #55, #57, #60) fueron causados por la interaccion entre estos dos sistemas:
- El frontend no sabe cuando usar JWT vs nada
- `useAuth()` llamado fuera del setup de Vue
- El PIN screen depende de localStorage para businessId
- El onboarding no adjunta el JWT de Clerk

**El PIN no es el problema. La arquitectura dual es el problema.**

---

## 2. Arquitectura Objetivo

Un solo JWT (Clerk) autentica todas las requests al servidor. El PIN solo cambia el usuario activo en el frontend y en un header, nunca toca un endpoint publico.

```
ANTES (actual):
  Dueno  -> Clerk JWT -> authMiddleware -> /api/*
  Empleado -> POST /auth/pin (PUBLICO) -> devuelve user -> frontend setea NovaUser
  
  Problema: dos caminos de auth, el PIN es un vector de ataque.

DESPUES (objetivo):
  Dueno  -> Clerk JWT -> authMiddleware -> /api/*
  Empleado -> PIN screen (local) -> frontend setea actingUserId -> 
              Clerk JWT + X-Acting-As header -> authMiddleware -> /api/*
  
  Un solo JWT. El PIN nunca sale del dispositivo como auth.
```

### Flujo detallado

**Setup del dispositivo (una vez):**
```
1. Dueno abre nova.aikalabs.cc en la tablet del mostrador
2. Clerk sign-in (email/Google)
3. /auth/resolve -> GET /api/me -> NovaUser (owner)
4. Frontend guarda JWT de Clerk + businessId en el dispositivo
5. GET /api/team-roster -> descarga lista de empleados con PIN hashes
6. Guarda roster en localStorage (encriptado con businessId como salt)
```

**Operacion diaria (empleados):**
```
1. Empleado abre la tablet -> middleware ve businessId en localStorage
2. Muestra PIN screen
3. Empleado ingresa PIN -> comparacion LOCAL contra roster cacheado
4. Match -> frontend setea actingUserId en el estado
5. Todas las requests van con: Authorization: Bearer <clerk-jwt-del-dueno> + X-Acting-As: <employee-user-id>
6. Backend: verifica JWT (dueno), lee X-Acting-As, valida que el employee pertenece al mismo business, usa employee como user en el contexto
```

**Cambio de usuario:**
```
1. Toca "Cambiar usuario" -> PIN screen
2. Nuevo PIN -> comparacion local -> cambia actingUserId
3. El JWT de Clerk no cambia. Solo cambia quien esta "actuando".
```

**Acciones restringidas (anular venta, etc.):**
```
1. Empleado intenta anular -> modal pide PIN del dueno
2. PIN del dueno se compara LOCAL contra roster
3. Si match -> request va con X-Elevated-Action: true + X-Owner-Pin-Verified: <hash>
4. Backend valida que el owner PIN es correcto (doble check server-side)
```

---

## 3. Que Cambia en el Codigo

### Backend

| Archivo | Estado actual | Cambio |
|---------|--------------|--------|
| `POST /auth/pin` | Endpoint publico, verifica PIN contra DB | **Eliminar.** Mover a `POST /api/switch-user` (protegido por JWT) |
| `GET /auth/employees` | Endpoint publico, devuelve nombres | **Eliminar.** Reemplazar con `GET /api/team-roster` (protegido) que devuelve nombres + PIN hashes |
| `authMiddleware` | Solo verifica JWT de Clerk, busca user por clerkId | **Modificar.** Si hay header `X-Acting-As`, buscar ese user en vez del owner. Validar que pertenece al mismo business. |
| `POST /api/verify-owner-pin` | Protegido, verifica PIN del dueno server-side | **Mantener.** Sigue siendo necesario para doble verificacion de acciones restringidas. |
| `app.ts` | Monta `/auth` como ruta publica | **Modificar.** Eliminar rutas publicas de auth (excepto health y onboarding). |
| Nuevo: `POST /api/switch-user` | No existe | **Crear.** Protegido por JWT. Recibe `{ userId }`. Valida que el user pertenece al business del JWT. Devuelve user info. Para cuando el dispositivo no tiene roster cacheado. |
| Nuevo: `GET /api/team-roster` | No existe | **Crear.** Protegido por JWT. Devuelve lista de empleados con PIN hashes (bcrypt) para cache local. Solo el owner puede llamarlo. |

### Frontend

| Archivo | Estado actual | Cambio |
|---------|--------------|--------|
| `useNovaAuth.ts` | `switchUser()` llama `POST /auth/pin` | **Modificar.** `switchUser()` compara PIN localmente contra roster cacheado. Si match, setea `actingUserId`. No hace API call. |
| `useApi.ts` | Adjunta JWT de Clerk + X-Business-Id | **Modificar.** Adjunta JWT de Clerk + `X-Acting-As: <userId>` si hay un usuario actuando. Eliminar X-Business-Id (el backend lo saca del JWT). |
| `auth.global.ts` | 5 pasos con Clerk + localStorage | **Simplificar.** Si hay JWT de Clerk -> OK. Si hay roster cacheado -> PIN screen. Si nada -> landing. |
| `auth/pin.vue` | Llama `POST /auth/pin` (publico) | **Modificar.** Compara PIN localmente contra roster. No hace API call para auth. |
| Nuevo: `useTeamRoster.ts` | No existe | **Crear.** Composable que descarga y cachea el roster de empleados. Provee `verifyPinLocally(pin)` y `verifyOwnerPinLocally(pin)`. |
| `OwnerPinModal.vue` | Llama `POST /api/verify-owner-pin` | **Modificar.** Verificacion local primero (rapida), luego server-side para doble check. |
| `plugins/nova-auth.client.ts` | Restaura user de localStorage | **Modificar.** Tambien restaura roster y verifica que el JWT de Clerk sigue valido. |

### DB Schema

Sin cambios. La tabla `users` ya tiene todo lo necesario (`pinHash`, `role`, `businessId`, `clerkId`).

---

## 4. Seguridad: Antes vs Despues

| Vector | Antes | Despues |
|--------|-------|---------|
| Fuerza bruta de PIN | `POST /auth/pin` es publico. 10K combinaciones. Lockout debil (por usuario, no por IP). | PIN se verifica localmente. No hay endpoint publico. El roster solo se descarga con JWT valido. |
| businessId adivinado | Si alguien adivina un UUID, puede intentar PINs | No hay endpoint que acepte businessId sin JWT. |
| Replay de PIN | El PIN viaja en texto plano al servidor | El PIN nunca viaja al servidor (excepto verify-owner-pin para acciones criticas). |
| JWT robado | N/A para empleados (no usan JWT) | Si el JWT del dueno se roba, el atacante tiene acceso. Mitigacion: JWT expira en 5 min (Clerk default), refresh automatico. |
| Roster cacheado robado | N/A | Si alguien extrae localStorage, tiene los hashes bcrypt. Pero bcrypt con salt es resistente a fuerza bruta offline. Y sin el JWT, no puede hacer requests. |

---

## 5. Plan de Implementacion por Sprints

### Sprint A: Backend -- Nuevo middleware y endpoints (2-3 dias)

**Archivos a modificar:**
- `apps/api/src/middleware/auth.ts` -- Agregar logica de `X-Acting-As`
- `apps/api/src/app.ts` -- Eliminar rutas publicas de `/auth`, agregar nuevas rutas protegidas

**Archivos a crear:**
- `apps/api/src/routes/team.ts` -- `GET /api/team-roster` y `POST /api/switch-user`

**Archivos a eliminar:**
- Nada se elimina todavia. Las rutas viejas se mantienen temporalmente para backward compatibility.

**Criterio de completado:**
- `GET /api/team-roster` devuelve empleados con PIN hashes (solo owner)
- `POST /api/switch-user` valida userId pertenece al business del JWT
- `authMiddleware` acepta `X-Acting-As` y setea el user correcto en el contexto
- Tests unitarios para los 3 cambios

### Sprint B: Frontend -- Roster cache y PIN local (2-3 dias)

**Archivos a crear:**
- `apps/web/app/composables/useTeamRoster.ts` -- Descarga, cachea, y verifica PINs localmente

**Archivos a modificar:**
- `apps/web/app/composables/useNovaAuth.ts` -- `switchUser()` usa verificacion local
- `apps/web/app/composables/useApi.ts` -- Reemplazar `X-Business-Id` con `X-Acting-As`
- `apps/web/app/pages/auth/pin.vue` -- Verificacion local, sin API call
- `apps/web/app/plugins/nova-auth.client.ts` -- Cargar roster al inicio

**Criterio de completado:**
- PIN screen funciona sin hacer API call (verificacion local)
- Todas las requests llevan JWT de Clerk + X-Acting-As
- El roster se descarga al primer login del dueno y se refresca cada 5 minutos

### Sprint C: Eliminar endpoints publicos + cleanup (1 dia)

**Archivos a modificar:**
- `apps/api/src/app.ts` -- Eliminar `app.route("/auth", auth)`
- `apps/api/src/routes/auth.ts` -- Eliminar `POST /auth/pin` y `GET /auth/employees`
- `apps/web/app/middleware/auth.global.ts` -- Simplificar (ya no necesita check de Clerk en middleware, el roster maneja todo)

**Archivos a modificar:**
- `apps/web/app/components/shared/OwnerPinModal.vue` -- Verificacion local + server-side

**Criterio de completado:**
- No hay endpoints publicos de auth (excepto health, onboarding, webhooks)
- El PIN screen funciona 100% con verificacion local
- `POST /api/verify-owner-pin` sigue funcionando para acciones criticas
- E2E: dueno login -> agrega empleado -> empleado usa PIN -> vende -> dueno anula con PIN

### Sprint D: Gestion de empleados (2-3 dias)

Prerequisito para que el sistema de PINs sea util en produccion.

**Archivos a crear:**
- `apps/api/src/routes/team.ts` -- Agregar `POST /api/employees`, `PATCH /api/employees/:id`, `DELETE /api/employees/:id`
- `apps/web/app/pages/settings/team.vue` -- UI para agregar/editar/desactivar empleados

**Criterio de completado:**
- El dueno puede agregar empleados con nombre + PIN desde `/settings/team`
- El dueno puede editar nombre, cambiar PIN, desactivar empleado
- Validacion: no hay PINs duplicados dentro del mismo negocio
- El roster se actualiza automaticamente cuando se modifica un empleado

---

## 6. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Mitigacion |
|--------|-------------|------------|
| JWT de Clerk expira mientras empleado trabaja | Media | Refresh automatico en background. Si falla, mostrar "Sesion expirada, el dueno debe iniciar sesion". |
| Roster desactualizado (dueno agrega empleado en otro dispositivo) | Baja | Refresh cada 5 min + boton manual "Actualizar equipo" en PIN screen. |
| localStorage borrado (usuario limpia cache) | Baja | El middleware detecta que no hay roster ni businessId y redirige al dueno a login. |
| Empleado intenta acceder desde dispositivo no configurado | N/A | Sin roster cacheado, no hay PIN screen. Solo ve landing page. Debe pedir al dueno que configure el dispositivo. |

---

## 7. Estimacion Total

| Sprint | Esfuerzo | Dependencias |
|--------|----------|-------------|
| A: Backend middleware + endpoints | 2-3 dias | Ninguna |
| B: Frontend roster + PIN local | 2-3 dias | Sprint A |
| C: Cleanup endpoints publicos | 1 dia | Sprint B |
| D: Gestion de empleados | 2-3 dias | Sprint A |

**Total: 7-10 dias de trabajo.** Sprints A y D pueden hacerse en paralelo.

Despues de este refactor:
- Un solo sistema de auth (Clerk JWT)
- PIN es identificacion local, no autenticacion
- No hay endpoints publicos vulnerables
- La gestion de empleados funciona
- El flujo es identico al de Square POS
