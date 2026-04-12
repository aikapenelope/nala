# Nova: Auth Flow - Analisis, Comparacion con Square, y Plan de Accion

> Analisis completo del sistema de autenticacion actual, comparacion con el
> estandar de la industria (Square POS), y plan para llevarlo a produccion.
> Fecha: Abril 2026

---

## 1. Como Funciona Square (El Estandar)

Square separa la autenticacion en dos capas:

### Capa 1: Cuenta del Dueno (Dashboard)
- El dueno crea cuenta con email/password en Square Dashboard (web)
- Desde el Dashboard, el dueno administra TODO: empleados, permisos, dispositivos, reportes
- El Dashboard es la "fuente de verdad" del negocio

### Capa 2: Passcodes en el Dispositivo Compartido (POS)
- El dueno hace login UNA VEZ en el dispositivo (tablet/telefono) con su cuenta
- Despues de eso, el dispositivo queda vinculado al negocio permanentemente
- A partir de ahi, el POS solo pide passcode (PIN de 4 digitos)
- Hay 3 tipos de passcode:
  - **Owner passcode**: acceso total, lo recibe al crear la cuenta
  - **Personal passcode**: unico por empleado, trackea ventas/tiempo por persona
  - **Team passcode**: compartido entre todos, sin tracking individual

### Flujo de Square en la Practica
```
Dia 1 (setup):
  Dueno -> Square Dashboard (web) -> crea cuenta -> agrega empleados -> asigna PINs
  Dueno -> Square POS (tablet) -> login con cuenta -> dispositivo vinculado

Dia 2+ (operacion diaria):
  Empleado llega -> tablet muestra PIN screen -> pone su PIN -> empieza a vender
  Otro empleado -> toca "Switch user" -> pone su PIN -> vende con su identidad
  Dueno -> pone su PIN -> acceso total (reportes, anular ventas, etc.)
  
  El dispositivo NUNCA pide email/password despues del dia 1.
  Solo PINs. Rapido. Sin friccion.
```

### Seguridad de Square
- El PIN es por negocio (dos negocios pueden tener PINs iguales sin conflicto)
- El dispositivo sabe a que negocio pertenece (vinculado en el setup)
- Los PINs se generan o asignan desde el Dashboard, no desde el POS
- Si un empleado se va, el dueno lo desactiva desde el Dashboard
- Opcionalmente: badges fisicos (NFC) ademas del PIN

---

## 2. Como Funciona Nova Actualmente

### Capa 1: Clerk (Autenticacion del Dueno)
- El dueno se registra via Clerk (email, Google, etc.)
- Clerk le da un `clerk_id` (ej: `user_2abc123`)
- El frontend llama a `POST /onboarding` que crea:
  - Business (nombre, tipo)
  - User owner (vinculado al clerk_id, con PIN hasheado)
  - Categorias pre-configuradas
  - Chart of accounts

### Capa 2: PIN (Empleados en Dispositivo Compartido)
- El PIN screen (`/auth/pin`) pide un PIN de 4 digitos
- El frontend envia `POST /auth/pin` con `{ businessId, pin }`
- El backend busca todos los usuarios activos de ese negocio
- Compara el PIN con bcrypt contra cada usuario
- Si match: devuelve el usuario (id, name, role, businessId)
- El frontend guarda el usuario en `useState` + `localStorage`

### Capa 3: API Protegida
- Cada request a `/api/*` pasa por `authMiddleware`
- El middleware verifica el JWT de Clerk y busca el usuario en DB por `clerk_id`
- Setea `user`, `businessId`, y `db` en el contexto de Hono
- El `tenantMiddleware` ejecuta `SET app.current_business_id` para RLS

---

## 3. Problemas del Flujo Actual

### Problema 1: No hay flujo post-Clerk-login
**Que pasa:** El dueno se autentica con Clerk. Clerk le da un JWT. Pero el frontend
no llama a `GET /api/me` para obtener su NovaUser. El `useState("nova-user")` queda
en `null`. El dashboard ve `isAuthenticated = false` y redirige a `/landing`.

**Resultado:** El dueno se logea exitosamente con Clerk pero Nova no lo reconoce.

**Solucion:** Despues de que Clerk autentica, el frontend debe llamar `GET /api/me`
automaticamente. Si el usuario existe en DB, setear NovaUser. Si no existe (no hizo
onboarding), redirigir a `/onboarding`.

### Problema 2: No hay forma de agregar empleados
**Que pasa:** El unico empleado que existe es el que se crea en el seed. No hay
endpoint ni pagina para que el dueno agregue empleados.

**Resultado:** El sistema de PINs es inutil en produccion porque no hay empleados.

**Solucion:** Crear:
- `POST /api/employees` (nombre, PIN, role) - solo owner
- `GET /api/employees` (lista de empleados del negocio)
- `PATCH /api/employees/:id` (editar nombre, PIN, desactivar)
- Pagina `/settings/team` para gestionar empleados

### Problema 3: El PIN screen depende de localStorage
**Que pasa:** El PIN screen necesita `businessId` para saber contra que negocio
verificar el PIN. Lo busca en `localStorage("nova:user")` o `localStorage("nova:businessId")`.

**Resultado:** En un dispositivo nuevo (o si se borra el cache), el PIN screen no
funciona porque no tiene businessId.

**Solucion:** El flujo correcto es:
1. Dueno hace login con Clerk en el dispositivo nuevo
2. El frontend obtiene businessId de `GET /api/me`
3. Guarda businessId en localStorage
4. A partir de ahi, el PIN screen funciona sin necesidad de Clerk

Si no hay businessId en localStorage, el PIN screen debe mostrar:
"Este dispositivo no esta configurado. El dueno debe iniciar sesion primero."

### Problema 4: No hay proteccion global de rutas
**Que pasa:** Cualquier URL es accesible sin autenticacion. Solo el dashboard (/)
tiene logica de redireccion. Si alguien va directo a `/sales` o `/inventory`, ve
la pagina (vacia porque las API calls fallan, pero la ve).

**Resultado:** UX confusa. Errores de API en consola. Paginas rotas.

**Solucion:** Middleware global de Nuxt que en cada navegacion:
```
1. Hay NovaUser en useState? -> continuar
2. Hay usuario en localStorage? -> restaurar y continuar
3. Hay sesion de Clerk activa? -> llamar GET /api/me -> setear NovaUser
4. La ruta es publica (/landing, /auth/login, /onboarding)? -> continuar
5. Nada de lo anterior -> redirigir a /landing
```

### Problema 5: Onboarding y PIN screen muestran sidebar
**Que pasa:** Estas paginas usan el layout default que tiene sidebar y header.
Un usuario nuevo que esta en el onboarding ve navegacion a secciones que no puede usar.

**Resultado:** Confuso. Parece que la app esta rota.

**Solucion:** Onboarding y PIN screen deben usar `layout: false` (como el landing
y el login).

### Problema 6: El header dice "Nova" hardcodeado
**Que pasa:** `SharedAppHeader` recibe `business-name="Nova"` hardcodeado desde
el layout.

**Resultado:** Todos los negocios ven "Nova" en vez de su nombre.

**Solucion:** El header debe leer el nombre del negocio del NovaUser o de un
endpoint `GET /api/business` que devuelva la info del negocio actual.

---

## 4. Modelo de Datos Actual

```sql
businesses
  id          UUID PK
  name        TEXT        -- "Bodega Don Pedro"
  type        TEXT        -- "bodega", "ferreteria", etc.
  is_active   BOOLEAN

users
  id              UUID PK
  business_id     UUID FK -> businesses.id
  clerk_id        TEXT UNIQUE NULLABLE  -- solo owners tienen clerk_id
  name            TEXT
  role            TEXT        -- "owner" o "employee"
  pin_hash        TEXT        -- bcrypt hash del PIN de 4 digitos
  is_active       BOOLEAN
  pin_failed_attempts  INT
  pin_locked_until     TIMESTAMP
```

**Observaciones:**
- Un business tiene 1+ users
- Solo el owner tiene `clerk_id` (vinculo con Clerk)
- Los employees NO tienen clerk_id (solo PIN)
- El PIN es por usuario, no por negocio
- Dos usuarios del mismo negocio no pueden tener el mismo PIN (no hay constraint
  en DB pero el flujo de verificacion itera todos y devuelve el primero que matchea)
- Dos usuarios de negocios DIFERENTES si pueden tener el mismo PIN (el businessId
  en el request filtra)

---

## 5. Como Sabe el PIN Screen a Que Negocio Pertenece

Flujo actual:
```
1. Dueno hace onboarding -> POST /onboarding -> respuesta incluye businessId
2. Frontend guarda businessId en localStorage("nova:businessId")
3. PIN screen lee localStorage("nova:businessId") o localStorage("nova:user").businessId
4. PIN screen envia POST /auth/pin con { businessId, pin }
5. Backend busca usuarios de ESE businessId y compara PINs
```

**El vinculo dispositivo-negocio es via localStorage.** No hay nada mas sofisticado.
Si el dueno hace login en otro dispositivo, el onboarding no se repite (409 duplicate),
pero el `GET /api/me` (que no se llama actualmente) devolveria el businessId y lo
guardaria en localStorage.

**Riesgo:** Si alguien conoce un businessId (es un UUID, dificil de adivinar) y un
PIN (4 digitos, 10,000 combinaciones), podria hacer POST /auth/pin desde cualquier
lugar. El endpoint es publico (no requiere JWT de Clerk).

**Mitigacion actual:** Lockout despues de 5 intentos fallidos (5 min). Pero no hay
rate limiting por IP ni CAPTCHA.

---

## 6. Que Debe Cambiar para Produccion

### Prioridad 1: Auth Flow Completo

1. **Middleware global de Nuxt** (`app/middleware/auth.global.ts`):
   - Restaura NovaUser de localStorage
   - Si hay sesion Clerk pero no NovaUser, llama GET /api/me
   - Redirige a /landing si no hay auth y la ruta no es publica
   - Redirige a /onboarding si hay Clerk pero no hay negocio

2. **Pagina /auth/login** con Clerk SignIn (ya existe, PR #52)

3. **Onboarding y PIN screen** con `layout: false`

4. **Header** muestra nombre del negocio real

### Prioridad 2: Gestion de Empleados

5. **Endpoints CRUD de empleados** (solo owner):
   - POST /api/employees (crear con nombre + PIN)
   - GET /api/employees (listar)
   - PATCH /api/employees/:id (editar, desactivar)
   - DELETE /api/employees/:id (soft delete)

6. **Pagina /settings/team** para gestionar empleados

7. **Pagina /settings** como hub (team, tasa de cambio, info del negocio)

### Prioridad 3: Seguridad del PIN

8. **Rate limiting por IP** en POST /auth/pin (Redis-based)
9. **Validar que no haya PINs duplicados** dentro del mismo negocio al crear empleado
10. **Audit log** de intentos de PIN fallidos con IP

### Prioridad 4: Device Management (futuro)

11. **Registro de dispositivos** (opcional, como Square): el dueno "autoriza"
    dispositivos desde el Dashboard. Solo dispositivos autorizados pueden usar
    el PIN screen.
12. **Forzar re-login del dueno** cada X dias en el dispositivo compartido
    (el JWT de Clerk expira pero el PIN sigue funcionando via localStorage)

---

## 7. Flujo Objetivo (Post-Implementacion)

```
PRIMER USO (dueno en su celular):
  1. Abre nova.aikalabs.cc
  2. Ve landing page -> "Crear cuenta gratis"
  3. Clerk sign-up (email o Google)
  4. Onboarding: tipo de negocio, nombre, su nombre, su PIN
  5. POST /onboarding crea todo
  6. Redirect a / (dashboard)
  7. Dashboard carga con datos reales (vacios pero funcionales)

CONFIGURAR DISPOSITIVO COMPARTIDO (tablet en el mostrador):
  1. Dueno abre nova.aikalabs.cc en la tablet
  2. Ve landing -> "Iniciar sesion"
  3. Clerk sign-in
  4. Middleware global: Clerk OK -> GET /api/me -> NovaUser encontrado
  5. businessId guardado en localStorage
  6. Dashboard carga
  7. Dueno va a /settings/team -> agrega empleados con nombre + PIN

OPERACION DIARIA (empleados):
  1. Empleado abre la tablet (ya configurada)
  2. Middleware global: no hay Clerk session, pero hay businessId en localStorage
  3. Muestra PIN screen automaticamente
  4. Empleado pone su PIN -> POST /auth/pin -> NovaUser seteado
  5. Empieza a vender

CAMBIAR DE USUARIO:
  1. Toca nombre en sidebar/header -> /auth/pin
  2. Otro empleado pone su PIN
  3. NovaUser cambia, permisos cambian

DUENO REVISA DESDE SU CELULAR (otro dispositivo):
  1. Abre nova.aikalabs.cc
  2. Middleware: no hay nada en localStorage
  3. Redirige a /landing -> "Iniciar sesion"
  4. Clerk sign-in
  5. GET /api/me -> NovaUser con role=owner
  6. Dashboard con acceso total
```
