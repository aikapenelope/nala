# Nova: Analisis de Subdomain-per-Tenant

> Fecha: Abril 2026
> Contexto: Nova corriendo en produccion (nova.aikalabs.cc). 26 tablas, 40+ endpoints, 27 paginas.
> Pregunta: implementar bodegadonpedro.nova.aikalabs.cc o no?

---

## 1. Como lo Hacen los SaaS Modernos en 2026

### Subdomain-per-tenant (el patron de Fina)

| SaaS | Patron | Ejemplo |
|---|---|---|
| **Fina** (competidor directo) | Wildcard subdomain via CloudFront | `bodegadonpedro.finapartner.com` (DNS: `*.finapartner.com` -> CloudFront) |
| **Shopify** | Subdomain para admin, dominio custom para storefront | `mi-tienda.myshopify.com` (admin), `mitienda.com` (storefront) |
| **Slack** | Subdomain por workspace | `empresa.slack.com` |
| **Notion** | Path-based (NO subdomain) | `notion.so/workspace-name/...` |
| **Linear** | Path-based (NO subdomain) | `linear.app/team-slug/...` |
| **Vercel** | Subdomain para previews, path para dashboard | `proyecto.vercel.app` (deploy), `vercel.com/team/...` (dashboard) |
| **Square** | Sin subdomain. Tenant por sesion | `squareup.com/dashboard` (mismo URL para todos) |

**Observacion clave:** no hay consenso. Los SaaS B2B modernos estan divididos. Shopify y Slack usan subdominios porque el tenant es visible al usuario final (clientes ven la URL). Notion, Linear, y Square usan path o sesion porque el tenant es interno (solo el equipo lo ve).

**Fina usa subdominios** porque cada negocio tiene una URL publica que comparte con clientes. Es un diferenciador de marketing: "entra a tunegocio.finapartner.com".

### Path-based tenancy (la alternativa)

```
nova.aikalabs.cc/t/bodegadonpedro/dashboard
nova.aikalabs.cc/t/bodegadonpedro/ventas
```

| Ventaja | Desventaja |
|---|---|
| Zero config DNS | URL mas larga y fea |
| Un solo origen = un solo Service Worker, localStorage, cookies | No se puede comunicar como "tu URL" al cliente |
| Clerk funciona sin cambios | Requiere reescribir todas las rutas |
| PWA se instala una sola vez | El slug contamina todas las rutas |

### Session-based tenancy (lo que Nova hace hoy)

```
nova.aikalabs.cc/dashboard  (el tenant se resuelve del JWT)
```

| Ventaja | Desventaja |
|---|---|
| Zero config DNS, zero cambio de rutas | El usuario no tiene "su URL" |
| Todo funciona como esta | No se puede compartir un link directo al negocio |
| PWA, localStorage, Clerk, todo en un origen | Multi-negocio requiere logout/login |

---

## 2. Analisis del Codigo Actual de Nova

### Donde se resuelve el tenant hoy

El tenant se resuelve en **5 puntos** del sistema:

```
1. authMiddleware (backend)
   JWT -> verifyClerkJwt -> clerkUserId -> findUserByClerkId -> user.businessId
   El businessId viene del usuario, no de la URL.

2. tenantMiddleware (backend)
   c.get("businessId") -> set_config('app.current_business_id', businessId)
   RLS filtra todo por este businessId.

3. useNovaAuth (frontend)
   localStorage("nova:user") -> { businessId, businessName }
   El frontend sabe el tenant por el usuario logueado.

4. useTeamRoster (frontend)
   localStorage("nova:team-roster") -> { businessId, roster }
   El PIN screen sabe el negocio por el roster cacheado.

5. auth.global.ts (frontend middleware)
   Chequea: NovaUser en state? -> Clerk signed in? -> roster en cache? -> landing
   Nunca mira la URL para determinar el tenant.
```

**Conclusion:** el tenant esta 100% acoplado a la sesion del usuario (Clerk JWT + localStorage). La URL no participa en la resolucion del tenant en ningun punto.

### Que cambiaria con subdominios

Para que `bodegadonpedro.nova.aikalabs.cc` funcione, habria que:

| Componente | Cambio |
|---|---|
| **DNS** | Wildcard `*.nova.aikalabs.cc` en Cloudflare |
| **SSL** | Wildcard cert (Cloudflare lo da gratis con proxy) |
| **Traefik** | Regla wildcard que rutee `*.nova.aikalabs.cc` al frontend |
| **Nuxt server middleware** | Parsear el subdominio del Host header, resolver el slug a businessId |
| **auth.global.ts** | Si hay subdominio, el tenant ya se conoce. El PIN screen puede mostrarse directo |
| **authMiddleware (backend)** | Opcion: aceptar un header `X-Tenant-Slug` ademas del JWT para resolver el tenant |
| **onboarding** | Agregar paso donde el dueno elige su slug |
| **Clerk** | Configurar `nova.aikalabs.cc` como dominio raiz. Clerk comparte sesiones entre subdominios del mismo dominio raiz automaticamente |
| **PWA** | Cada subdominio es un origen diferente = Service Worker separado, localStorage separado, cache separado |
| **useTeamRoster** | El roster en localStorage no se comparte entre subdominios. Cada subdominio necesita su propio roster |
| **Catalogo publico** | Ya no necesita `/catalogo/{slug}`. El subdominio ES el catalogo |

---

## 3. El Problema de la PWA

Este es el punto critico que define la decision.

### Cada subdominio es un origen diferente

Segun la especificacion de Service Workers y la Same-Origin Policy:

- `bodegadonpedro.nova.aikalabs.cc` y `ferreteriajuan.nova.aikalabs.cc` son **origenes diferentes**
- Cada uno tiene su propio Service Worker, su propio cache, su propio localStorage, su propio IndexedDB
- La PWA se instala **por origen**. Si un dueno tiene 2 negocios, instala 2 PWAs

### Impacto concreto en Nova

| Feature | Sin subdominios (hoy) | Con subdominios |
|---|---|---|
| Service Worker | 1 SW para toda la app | 1 SW por negocio (duplica recursos) |
| localStorage | Compartido (roster, user, products cache) | Separado por subdominio. El roster de bodegadonpedro no existe en ferreteriajuan |
| IndexedDB (offline) | 1 DB con todos los datos cacheados | 1 DB por subdominio. Cada negocio tiene su propio cache |
| PWA install | 1 instalacion | 1 instalacion por negocio |
| Offline queue | 1 cola de ventas pendientes | 1 cola por subdominio |
| Clerk session | 1 sesion compartida | Clerk comparte sesiones entre subdominios del mismo root domain (funciona) |

**Para un dueno con 1 negocio:** no hay diferencia practica. El subdominio funciona bien.

**Para un dueno con 2+ negocios:** tiene que instalar la PWA 2 veces, cada una con su propio cache. Esto es mas storage en el dispositivo pero tambien mas aislamiento (que puede ser deseable).

**Para un empleado en dispositivo compartido:** el subdominio ya identifica el negocio. El PIN screen aparece directo sin necesidad de que el dueno haya hecho login antes en ese subdominio especifico... **excepto que el roster no existe en localStorage de ese subdominio**. El dueno tendria que hacer login al menos una vez en cada subdominio para descargar el roster.

### El problema real del roster

Hoy el flujo es:
1. Dueno hace login con Clerk en `nova.aikalabs.cc`
2. `resolveClerkUser()` descarga el roster y lo guarda en localStorage
3. Empleado abre la misma URL -> middleware ve roster en localStorage -> PIN screen

Con subdominios:
1. Dueno hace login con Clerk en `bodegadonpedro.nova.aikalabs.cc`
2. `resolveClerkUser()` descarga el roster y lo guarda en localStorage **de ese subdominio**
3. Empleado abre `bodegadonpedro.nova.aikalabs.cc` -> middleware ve roster -> PIN screen

Esto **funciona igual** porque el empleado siempre abre el mismo subdominio que el dueno configuro. El roster esta en el localStorage correcto. No hay problema.

---

## 4. Impacto en la DB y RLS

### Hoy

```
Request -> JWT -> clerkId -> findUserByClerkId -> user.businessId -> set_config RLS
```

El tenant se resuelve indirectamente via el usuario autenticado.

### Con subdominios

Dos opciones:

**Opcion A: el subdominio es solo cosmético (recomendada)**

El backend sigue resolviendo el tenant via JWT exactamente como hoy. El subdominio solo afecta al frontend (que pagina mostrar, que roster cargar). El backend no necesita saber el subdominio.

Seguridad: identica a hoy. El JWT determina el tenant. Si alguien inventa un subdominio, el backend ignora el subdominio y usa el JWT.

**Opcion B: el subdominio determina el tenant en el backend**

El backend parsea el subdominio, busca el business por slug, y lo usa para RLS. El JWT solo autentica al usuario, no determina el tenant.

Seguridad: peor. Si el backend confia en el subdominio para el tenant, un usuario autenticado en un negocio podria cambiar el subdominio y acceder a datos de otro negocio (si el backend no valida que el usuario pertenece a ese negocio).

**Recomendacion: Opcion A.** El subdominio es frontend-only. El backend sigue usando JWT -> user -> businessId -> RLS. Zero cambios en el backend.

---

## 5. Impacto en Clerk

Clerk tiene soporte nativo para subdominios del mismo dominio raiz:

> "When you set a root domain for your production deployment, Clerk's authentication will work across all subdomains. User sessions will also be shared across the subdomains."

Esto significa:
- Si el dueno hace login en `nova.aikalabs.cc`, la sesion es valida en `bodegadonpedro.nova.aikalabs.cc`
- Si el dueno hace login en `bodegadonpedro.nova.aikalabs.cc`, la sesion es valida en `nova.aikalabs.cc`
- No necesita "satellite domains" (eso es para dominios completamente diferentes)
- Solo necesita configurar `nova.aikalabs.cc` como root domain en Clerk Dashboard

**Implicacion de seguridad:** Clerk recomienda configurar `authorizedParties` para evitar subdomain cookie leaking. Si un subdominio es comprometido, podria generar sesiones validas para otros subdominios. Esto se mitiga con la allowlist.

---

## 6. Implementacion Practica

### DNS (Cloudflare)

Un registro wildcard:

```
*.nova.aikalabs.cc  CNAME  nova.aikalabs.cc  (proxied)
```

Cloudflare genera wildcard SSL automaticamente cuando el registro esta proxied. Zero costo adicional.

### Traefik (Coolify)

Agregar regla wildcard que rutee al frontend:

```
Host(`{subdomain:[a-z0-9-]+}.nova.aikalabs.cc`)
```

### Nuxt server middleware

Nuevo archivo `server/middleware/tenant.ts`:

```typescript
export default defineEventHandler((event) => {
  const host = getRequestHeader(event, 'host') ?? '';
  const match = host.match(/^([a-z0-9-]+)\.nova\.aikalabs\.cc$/);

  if (match && match[1] !== 'www' && match[1] !== 'api') {
    // Set the tenant slug in the event context for SSR
    event.context.tenantSlug = match[1];
  }
});
```

### Onboarding

Agregar paso 2.5 despues de "Nombre del negocio":

```
Elige tu URL: [________].nova.aikalabs.cc
```

Auto-generar slug del nombre del negocio (slugify). Validar unicidad contra la DB. El campo `slug` ya existe en la tabla `businesses` con unique index.

### auth.global.ts

```typescript
// Si hay subdominio, el tenant ya se conoce
// El PIN screen puede mostrarse directo si hay roster para este subdominio
if (import.meta.client) {
  const host = window.location.hostname;
  const match = host.match(/^([a-z0-9-]+)\.nova\.aikalabs\.cc$/);
  if (match) {
    // Estamos en un subdominio de tenant
    // Si hay roster cacheado, mostrar PIN screen
    // Si no, mostrar login de dueno (necesita configurar este dispositivo)
  }
}
```

### Catalogo publico

Con subdominios, el catalogo publico cambia de `/catalogo/{slug}` a simplemente la raiz del subdominio para visitantes no autenticados:

```
bodegadonpedro.nova.aikalabs.cc  (visitante no autenticado) -> catalogo publico
bodegadonpedro.nova.aikalabs.cc  (empleado con PIN) -> dashboard
```

El auth middleware decide: si no hay sesion ni roster, mostrar el catalogo publico en vez del landing generico.

---

## 7. Que Mejora vs Que Empeora

### Mejora

| Aspecto | Detalle |
|---|---|
| **Comunicacion** | "Entra a bodegadonpedro.nova.aikalabs.cc" es memorable y profesional |
| **Catalogo integrado** | El subdominio ES el catalogo. No necesita `/catalogo/{slug}` separado |
| **PIN screen directo** | El subdominio identifica el negocio. El empleado ve PIN screen sin que el dueno haya hecho login reciente |
| **Paridad con Fina** | Fina usa exactamente este patron. Los comerciantes venezolanos ya lo entienden |
| **Multi-negocio natural** | Un dueno con 2 negocios tiene 2 URLs claras |
| **SEO del catalogo** | Cada negocio tiene su propio subdominio indexable |

### Empeora

| Aspecto | Detalle | Severidad |
|---|---|---|
| **PWA por subdominio** | Cada subdominio es un origen diferente = SW separado, cache separado | Media (funciona, solo usa mas storage) |
| **Complejidad de infra** | Wildcard DNS + wildcard SSL + Traefik config | Baja (Cloudflare lo resuelve con 1 registro) |
| **Nuxt server middleware** | Nuevo middleware para parsear subdominio | Baja (~20 lineas) |
| **Onboarding** | Paso extra para elegir slug | Baja (1 campo mas) |
| **Dev local** | Necesitas `*.localhost` o `/etc/hosts` para probar subdominios | Baja (se puede usar flag de feature) |

### Neutral

| Aspecto | Detalle |
|---|---|
| **Seguridad** | El subdominio es publico pero la auth sigue siendo JWT + PIN. El backend no confia en el subdominio |
| **RLS** | Zero cambios. El backend sigue resolviendo tenant via JWT |
| **API** | Zero cambios. `useApi` sigue llamando a `nova-api.aikalabs.cc` con JWT |
| **Clerk** | Funciona nativamente con subdominios del mismo root domain |

---

## 8. Recomendacion

**Implementar, pero como capa de frontend solamente.**

El subdominio es un feature de UX y marketing, no de arquitectura. El backend no cambia. La resolucion del tenant sigue siendo JWT -> user -> businessId -> RLS. El subdominio solo afecta:

1. Que URL ve el usuario en el navegador
2. Que negocio muestra el catalogo publico
3. Que roster carga el PIN screen

Esto minimiza el riesgo (zero cambios en backend, zero cambios en RLS, zero cambios en la API) y maximiza el beneficio (paridad con Fina, URL memorable, catalogo integrado).

### Plan de implementacion

**Sprint 1: Infra + DNS (1 dia)**

| Tarea | Archivo/Servicio |
|---|---|
| Agregar wildcard DNS en Cloudflare | `*.nova.aikalabs.cc` CNAME proxied |
| Configurar Traefik para wildcard | Coolify config |
| Configurar Clerk root domain | Clerk Dashboard -> `nova.aikalabs.cc` |

**Sprint 2: Slug en onboarding (2 dias)**

| Tarea | Archivo |
|---|---|
| Agregar campo slug al onboarding form | `apps/web/app/pages/onboarding/index.vue` |
| Generar slug automatico del nombre | `apps/web/app/pages/onboarding/index.vue` |
| Validar unicidad del slug via API | `apps/api/src/routes/onboarding.ts` |
| Guardar slug en la DB al crear negocio | `apps/api/src/routes/onboarding.ts` |
| Endpoint para verificar disponibilidad | `apps/api/src/routes/onboarding.ts` (GET /onboarding/check-slug/:slug) |

**Sprint 3: Server middleware + auth (2 dias)**

| Tarea | Archivo |
|---|---|
| Crear Nuxt server middleware para parsear subdominio | `apps/web/server/middleware/tenant.ts` (nuevo) |
| Pasar tenantSlug al frontend via SSR context | `apps/web/server/middleware/tenant.ts` |
| Actualizar auth.global.ts para usar subdominio | `apps/web/app/middleware/auth.global.ts` |
| Si subdominio + no auth -> mostrar catalogo en vez de landing | `apps/web/app/middleware/auth.global.ts` |
| Actualizar PIN screen para mostrar nombre del negocio del subdominio | `apps/web/app/pages/auth/pin.vue` |

**Sprint 4: Catalogo integrado (1 dia)**

| Tarea | Archivo |
|---|---|
| Redirigir `/catalogo/{slug}` al subdominio correspondiente | `apps/web/app/pages/catalogo/[slug].vue` |
| Mostrar catalogo en la raiz del subdominio para visitantes | `apps/web/app/pages/index.vue` o nueva pagina |
| Boton "Compartir mi catalogo" en settings con la URL del subdominio | `apps/web/app/pages/settings/index.vue` |

**Sprint 5: Dev experience (1 dia)**

| Tarea | Archivo |
|---|---|
| Documentar setup local para subdominios | `README.md` o `docs/` |
| Flag de feature para desactivar subdominios en dev | `nuxt.config.ts` runtimeConfig |
| Tests para el server middleware | `apps/web/server/middleware/__tests__/` |

**Total: ~7 dias de trabajo.** Zero cambios en el backend (API, auth middleware, RLS, DB queries). Solo frontend + infra.
