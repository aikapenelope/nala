# Nova: Deploy Troubleshooting Log

> Problemas encontrados y resueltos durante el primer deploy en Coolify/Hetzner.
> Fecha: Abril 2026

---

## 1. ESM Module Resolution (API)

**Error:** `Cannot find module '/app/apps/api/dist/config'`

**Causa:** `tsc` con `moduleResolution: "bundler"` no agrega extensiones `.js` a los imports. Node ESM las requiere.

**Solucion:** Reemplazar `tsc` con `tsup` como bundler. tsup genera un solo archivo ESM (`dist/index.js`, ~392KB) que bundlea `@nova/shared` y `@nova/db` y deja las dependencias npm como externas.

**Archivo:** `apps/api/tsup.config.ts`, `apps/api/package.json` (build script)

---

## 2. ioredis Dynamic Require (API)

**Error:** `Dynamic require of "events" is not supported`

**Causa:** tsup con `noExternal: [/(.*)/]` intentaba bundlear `ioredis` que usa `require("events")` (CommonJS) incompatible con ESM output.

**Solucion:** Cambiar tsup config a solo bundlear `@nova/shared` y `@nova/db` (`noExternal: ["@nova/shared", "@nova/db"]`). Todo lo demas queda como external y se resuelve desde `node_modules`.

**Archivo:** `apps/api/tsup.config.ts`

---

## 3. Redis URL con / en el password

**Error:** `Redis connection error: connect ECONNREFUSED 127.0.0.1:6379`

**Causa:** El password de Redis contenia `/` que Node interpretaba como parte del path de la URL, rompiendo el parsing.

**Solucion:** URL-encodear el `/` como `%2F` en la env var `REDIS_URL`.

**Archivo:** ESC environment `platform-infra/nova`

---

## 4. @clerk/shared Missing Modules (Web)

**Error:** `Cannot find module '@clerk/shared/dist/runtime/netlifyCacheHandler.mjs'`
y luego `apiUrlFromPublishableKey.mjs`, etc.

**Causa:** Nitro genera `index.mjs` con imports a `@clerk/shared/dist/runtime/*.mjs` como dependencias externas, pero el `.output` de Nuxt no incluye el paquete completo.

**Solucion:** En el Dockerfile, despues de copiar `.output`, hacer `RUN rm -rf` de cualquier archivo parcial de `@clerk` que Nitro dejo, y luego `COPY` el paquete completo desde el builder.

**Archivo:** `Dockerfile` (stage web)

---

## 5. @clerk/shared Version Mismatch (Web)

**Error:** `The requested module '@clerk/shared/loadClerkJsScript' does not provide an export named 'setClerkJSLoadingErrorPackageName'`

**Causa:** Dos versiones de `@clerk/shared` en el monorepo:
- `@clerk/backend@2.x` (API) depende de `@clerk/shared@3.47.3`
- `@clerk/nuxt@2.x` (Web) depende de `@clerk/shared@4.6.0`

npm hoists la version 3.x al top-level `node_modules/@clerk/shared`. El COPY del Dockerfile copiaba la 3.x al container web, pero Nuxt necesita la 4.x.

**Solucion:** Copiar desde `node_modules/@clerk/nuxt/node_modules/@clerk/shared` (4.6.0) en vez del top-level `node_modules/@clerk/shared` (3.47.3).

**Archivo:** `Dockerfile` (stage web)

---

## 6. Lockfile Deletion Causing Version Drift

**Error:** Mismo que #5, pero persistia incluso despues de corregir el COPY path.

**Causa:** El Dockerfile tenia `rm -rf package-lock.json && npm install` para resolver binarios nativos de linux. Esto causaba que npm resolviera versiones diferentes de `@clerk/*` que las del lockfile original.

**Solucion:** Usar `npm ci` en vez de borrar el lockfile. `npm ci` respeta las versiones exactas del lockfile y resuelve binarios nativos automaticamente. Se agrego `python3 make g++` al stage deps para compilacion de binarios nativos.

**Archivo:** `Dockerfile` (stage deps)

---

## 7. Clerk Secret Key Missing (Web)

**Error:** `Missing Clerk Secret Key. Go to https://dashboard.clerk.com`

**Causa:** `@clerk/nuxt` necesita `CLERK_SECRET_KEY` como env var de runtime en el server-side para verificar sesiones. Solo se habia puesto como build arg.

**Solucion:** Agregar `CLERK_SECRET_KEY` y `NUXT_CLERK_SECRET_KEY` como env vars de runtime en Coolify para el servicio web.

**Archivo:** Configuracion de Coolify (env vars del servicio nova-web)

---

## 8. SSL Error 526 (Cloudflare)

**Error:** Pagina en blanco, error 526 en Cloudflare.

**Causa:** Cloudflare en modo proxy (nube naranja) no podia verificar el SSL del App Plane.

**Solucion:** Configurar los dominios `nova.aikalabs.cc` y `nova-api.aikalabs.cc` en Cloudflare con proxy habilitado (igual que los otros proyectos). Traefik en Coolify genera los certificados automaticamente.

**Archivo:** Configuracion de Cloudflare DNS

---

## 9. Auth Flow: /auth/login 404

**Error:** `Page not found: /auth/login`

**Causa:** El PIN screen tenia un link a `/auth/login` que no existia. No habia pagina de login con Clerk.

**Solucion:** Crear `apps/web/app/pages/auth/login.vue` con el componente `<SignIn />` de Clerk.

**Archivo:** `apps/web/app/pages/auth/login.vue`

---

## Resumen de Env Vars para Coolify

### nova-api (runtime)
```
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://platform:<pw>@10.0.1.20:5432/nova
REDIS_URL=redis://:<pw_url_encoded>@10.0.1.20:6379/4
CLERK_SECRET_KEY=sk_live_...
CORS_ORIGIN=https://nova.aikalabs.cc
OPENROUTER_API_KEY=sk-or-...
GROQ_API_KEY=gsk_...
```

### nova-web (build args)
```
NUXT_PUBLIC_API_BASE=https://nova-api.aikalabs.cc
NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
```

### nova-web (runtime)
```
CLERK_SECRET_KEY=sk_live_...
NUXT_CLERK_SECRET_KEY=sk_live_...
```
