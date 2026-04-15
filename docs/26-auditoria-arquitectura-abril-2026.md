# Nova: Auditoria de Arquitectura - Abril 2026

> Codebase: ~18,000 lineas | 26 tablas | 40+ endpoints | 30 paginas | 23 tests
> Stack: Nuxt 4 + Hono + PostgreSQL + Redis + Clerk + Drizzle ORM
> Produccion: nova-api.aikalabs.cc, nova.aikalabs.cc, *.novaincs.com

---

## 1. Flujo de Autenticacion

### Diagrama

```
┌─────────────────────────────────────────────────────────────────┐
│                        DISPOSITIVO                              │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                  │
│  │ Landing  │───>│ Clerk    │───>│ /auth/   │                  │
│  │          │    │ SignIn   │    │ resolve  │                  │
│  └──────────┘    └──────────┘    └────┬─────┘                  │
│                                       │                         │
│                              GET /api/me                        │
│                                       │                         │
│                          ┌────────────┼────────────┐            │
│                          │            │            │            │
│                     USER_NOT_FOUND    OK        ERROR           │
│                          │            │            │            │
│                    ┌─────┴─────┐ ┌────┴────┐  ┌───┴───┐       │
│                    │Onboarding │ │setUser()│  │Retry  │       │
│                    │           │ │roster() │  │       │       │
│                    └─────┬─────┘ │autoRef()│  └───────┘       │
│                          │       └────┬────┘                   │
│                          │            │                         │
│                          └────────────┼─────> Dashboard         │
│                                       │                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    FLUJO DIARIO                           │  │
│  │                                                          │  │
│  │  App abre -> restoreUser() de localStorage               │  │
│  │          -> loadFromCache() roster                       │  │
│  │          -> isAuthenticated = true                       │  │
│  │          -> Dashboard (sin API call)                     │  │
│  │                                                          │  │
│  │  Cambio turno -> /auth/pin                               │  │
│  │             -> PIN 4 digitos                             │  │
│  │             -> bcrypt.compare LOCAL (no API)             │  │
│  │             -> switchUser() -> Dashboard                 │  │
│  │                                                          │  │
│  │  Accion restringida (void sale) ->                       │  │
│  │             -> Modal PIN del dueno                       │  │
│  │             -> bcrypt local (rapido)                     │  │
│  │             -> POST /api/verify-owner-pin (confirma)     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    CADA REQUEST API                       │  │
│  │                                                          │  │
│  │  $api(path) -> Authorization: Bearer {Clerk JWT}         │  │
│  │             -> X-Acting-As: {userId} (solo empleados)    │  │
│  │                                                          │  │
│  │  Backend:                                                │  │
│  │    1. verifyToken(JWT) -> clerkId                        │  │
│  │    2. findUserByClerkId(clerkId) -> owner                │  │
│  │    3. findBusinessById(owner.businessId) -> business     │  │
│  │    4. X-Acting-As? -> validar mismo business             │  │
│  │    5. set_config('app.current_business_id', bizId)       │  │
│  │    6. RLS filtra automaticamente todas las queries       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Comparacion con Square POS y Shopify POS

| Aspecto | Square POS | Shopify POS | Nova |
|---------|-----------|-------------|------|
| Auth del dispositivo | OAuth token del owner | Shopify account | Clerk JWT del owner |
| Identificacion empleado | PIN 4 digitos, local | PIN 4 digitos, local | PIN 4 digitos, bcrypt local |
| Roster cacheado | Si, en el dispositivo | Si, en el dispositivo | Si, localStorage |
| PIN viaja al servidor? | No | No | No (solo verify-owner-pin para void) |
| Cambio de usuario | PIN sin API call | PIN sin API call | PIN sin API call |
| Owner approval | PIN del owner en modal | PIN del owner en modal | PIN local + server double-check |

**Veredicto:** El patron es correcto y sigue las mejores practicas de la industria.

---

## 2. Multi-tenancy y Subdominios

### Como funciona

```
bodegadonpedro.novaincs.com
       │
       ▼
Nitro server middleware (SSR)
  → extrae "bodegadonpedro" del Host header
  → event.context.tenantSlug = "bodegadonpedro"
       │
       ▼
useTenant() composable (client)
  → lee tenantSlug del SSR context o window.location
       │
       ▼
auth.global.ts middleware
  → si hay tenantSlug + no auth → catalogo publico
  → si hay tenantSlug + roster → pantalla PIN
  → si hay auth → dashboard normal
       │
       ▼
API (Hono)
  → CORS acepta *.novaincs.com
  → authMiddleware → tenantMiddleware → RLS
  → cada query filtrada por business_id automaticamente
```

### Que resuelve el subdominio

1. **Catalogo publico sin login:** El cliente final ve productos sin crear cuenta
2. **Identidad visual:** Cada negocio tiene su URL para compartir en WhatsApp/Instagram
3. **Tenant detection sin JavaScript:** El middleware SSR detecta el tenant del Host header
4. **Separacion limpia:** El subdominio es frontend-only, el backend no cambia

### Integracion verificada

| Capa | Archivo | Estado |
|------|---------|--------|
| DNS wildcard | Cloudflare *.novaincs.com | Configurado |
| SSR detection | server/middleware/tenant.ts | OK - extrae slug del Host |
| Client detection | composables/useTenant.ts | OK - SSR + client fallback |
| Auth routing | middleware/auth.global.ts | OK - catalogo o PIN segun contexto |
| CORS | apps/api/src/app.ts | OK - acepta *.novaincs.com |
| Catalogo API | routes/catalog.ts | OK - query por slug sin RLS |
| Onboarding | routes/onboarding.ts | OK - slug unico con check-slug |
| Clerk | nuxt.config.ts | OK - dominio novaincs.com configurado |

---

## 3. Evaluacion de Drizzle ORM

### Situacion actual

Drizzle esta implementado y funcionando en produccion. El schema tiene 26 tablas con relaciones, indices, y tipos correctos. Las queries en los endpoints usan el query builder de Drizzle correctamente.

### Problemas que tuvimos con Drizzle

| Problema | Causa | Solucion aplicada |
|----------|-------|-------------------|
| `drizzle-kit migrate` se cuelga | postgres.js no cierra el pool | migrate.mjs con sql.end() |
| Migration 0000 falla en DB existente | Tablas existen pero no estan registradas | Bootstrap one-time en migrate.mjs |
| drizzle-kit CLI incompatible con sh | Template literals en inline script | Archivo .mjs separado |

### Debemos cambiar Drizzle?

**No.** Drizzle ya esta implementado, funciona, y los problemas que tuvimos fueron especificos del CLI de migraciones, no del ORM en si. El query builder de Drizzle funciona perfectamente con tsup ESM.

Lo que si hicimos fue **dejar de usar el CLI de drizzle-kit en runtime** y reemplazarlo con un script de migracion propio (`migrate.mjs`) que usa la API programatica de Drizzle directamente. Esto elimina todos los problemas del CLI.

### Comparacion con alternativas

| Aspecto | Drizzle (actual) | pg directo (Aurora) | Prisma |
|---------|-----------------|--------------------|----|
| Type safety | Excelente (schema = types) | Manual | Excelente (codegen) |
| Bundle size | Pequeno | Minimo | Grande (engine WASM) |
| ESM compat | Buena (query builder) | Nativa | Problematica |
| Migraciones | CLI problematico, API OK | SQL inline, simple | CLI robusto |
| Learning curve | Baja | Minima | Media |
| Queries complejas | SQL template literals | SQL directo | Limitado |

**Recomendacion:** Mantener Drizzle para el query builder y schema. Usar `migrate.mjs` propio para migraciones (ya implementado). No migrar a pg directo porque perderiamos type safety en 40+ endpoints.

---

## 4. Puntos de Fallo y Riesgos

### Criticos (arreglar ahora)

| # | Problema | Impacto | Estado |
|---|---------|---------|--------|
| 1 | `restoreUser()` no se llamaba al recargar | Cada F5 forzaba round-trip a /api/me | **PR #89 - fix listo** |

### Medios (arreglar pronto)

| # | Problema | Impacto | Solucion propuesta |
|---|---------|---------|-------------------|
| 2 | JWT expira + roster cacheado = 401 silencioso | Empleado ve errores sin explicacion | Interceptor en useApi que detecta 401 y muestra "Sesion expirada, el dueno debe re-autenticar" |
| 3 | Ventana de 5 min con PIN viejo tras cambio | Empleado despedido puede operar 5 min | Reducir refresh a 1 min, o forzar refresh al cambiar PIN |
| 4 | reports.ts tiene 1500+ lineas | Dificil de mantener | Dividir en reports-data.ts, reports-pdf.ts, reports-xlsx.ts, reports-email.ts |
| 5 | `set_config` session-level con pool | Riesgo teorico de RLS leak bajo carga | Documentado. Migrar a transacciones explicitas cuando el trafico lo justifique |

### Bajos (backlog)

| # | Problema | Impacto |
|---|---------|---------|
| 6 | Subdominio no valida match con business del usuario | UI confusa si owner navega a otro subdominio |
| 7 | PIN hashes en localStorage | Riesgo si alguien accede al dispositivo fisicamente |
| 8 | No hay rate limit en PIN attempts (client-side) | Brute force local (mitigado por bcrypt lento) |

---

## 5. Complejidad y Mantenimiento

### Metricas de complejidad

| Metrica | Valor | Evaluacion |
|---------|-------|-----------|
| Lineas de codigo | ~18,000 | Normal para el scope |
| Tablas en DB | 26 | Alto pero justificado (multi-tenant + contabilidad) |
| Endpoints API | 40+ | Proporcional a las features |
| Paginas frontend | 30 | Normal |
| Dependencias runtime (API) | 9 | Bajo, bien controlado |
| Capas de auth | 3 (Clerk + PIN + RLS) | Necesario para multi-tenant POS |

### Que hace complejo el mantenimiento

**Complejidad necesaria (no se puede simplificar):**
- Multi-tenancy con RLS: 26 tablas con policies. Cada tabla nueva necesita policy.
- Dual auth (Clerk + PIN): dos sistemas que deben estar sincronizados.
- Dual currency (USD + VES): tasa manual por negocio, conversion en cada venta.
- Monorepo 4 packages: cambios en shared/db afectan api y web.

**Complejidad que se puede reducir:**
- `reports.ts` de 1500 lineas -> dividir en modulos
- pdfmake con createRequire hack -> evaluar jsPDF (ESM nativo) en futuro
- Tests solo cubren auth reject + integracion basica -> expandir cobertura

### Veredicto final

**Lo estan haciendo bien.** La arquitectura es la correcta para un POS multi-tenant. Las decisiones (Clerk, PIN local, RLS, subdominios) son las mismas que usan Square y Shopify. El codigo esta bien documentado y estructurado.

El riesgo principal no es tecnico sino operacional: mantener 26 tablas con RLS, 40 endpoints, y 3 capas de auth requiere disciplina. Los tests de integracion (Sprint 2) y las migraciones versionadas (Sprint 1) son las dos piezas mas importantes para eso, y ya estan implementadas.

---

## 6. Proximos pasos recomendados (por prioridad)

1. **Mergear PR #89** - fix de restoreUser (afecta UX en cada recarga)
2. **Interceptor 401 en useApi** - manejar JWT expirado gracefully
3. **Dividir reports.ts** - mantenibilidad
4. **Reducir roster refresh a 1 min** - seguridad
5. **Sentry error tracking** - visibilidad de errores en produccion
