# Nova: Roadmap para Produccion

> Estado actual: Backend y frontend 100% conectados a DB real. Zero mock data.
> Fecha: Abril 2026

---

## Bloqueantes para Deploy

Estos items deben resolverse ANTES del primer deploy en Coolify.

### 1. Crear DB "nova" en el Data Plane

El script `init-databases.sh` en la infra de Hetzner crea las DBs por proyecto.
Hay que agregar "nova" a la lista:

```bash
# En platform-infra/src/data-plane.ts -> init-databases.sh
DATABASES="whabi docflow aurora propi nova"
```

Tambien crear el archivo `src/projects/nova.ts` en platform-infra con:

- `novaPostgresUrl` (directo para migrations: puerto 5432)
- `novaPgbouncerUrl` (runtime: puerto 6432)
- `novaRedisUrl` (DB 4)
- MinIO buckets: `nova-receipts` (futuro)

### 2. Ejecutar Drizzle Migrations

Las tablas no se crean automaticamente. Despues de crear la DB:

```bash
# Desde una maquina con acceso a la DB (via Tailscale)
DATABASE_URL=postgresql://platform:<pw>@10.0.1.20:5432/nova npx drizzle-kit push
```

Luego ejecutar `init.sql` para las RLS policies:

```bash
psql postgresql://platform:<pw>@10.0.1.20:5432/nova < packages/db/init.sql
```

**Importante**: Crear un role `nova_app` con permisos limitados para que RLS funcione:

```sql
CREATE ROLE nova_app LOGIN PASSWORD '<generar>';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nova_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nova_app;
```

La app debe conectar como `nova_app` (no como `platform` que es superuser y bypasea RLS).

### 3. CORS Configurable

Actualmente hardcodeado a `http://localhost:3000`. Cambiar a env var:

```typescript
// app.ts
cors({
  origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3000"],
});
```

Env var en Coolify: `CORS_ORIGIN=https://nova.tudominio.com`

### 4. Tasa de Cambio Inicial

El exchange rate service falla con 503 si no hay tasa en Redis ni DB.
Antes del primer uso, insertar una tasa:

```sql
INSERT INTO exchange_rates (date, rate_bcv) VALUES (NOW(), 476.43);
```

O crear el endpoint `POST /api/exchange-rate` (la funcion `setCurrentRate` ya existe).

### 5. Seed con PINs Reales

El seed.ts tiene hashes placeholder. Actualizar para generar hashes bcrypt reales:

```typescript
const pinHash = await bcrypt.hash("0000", 10);
```

### 6. Variables de Entorno para Coolify

```
# Requeridas
DATABASE_URL=postgresql://nova_app:<pw>@10.0.1.20:6432/nova
CLERK_SECRET_KEY=sk_live_...
NODE_ENV=production

# Recomendadas
REDIS_URL=redis://:<pw>@10.0.1.20:6379/4
CORS_ORIGIN=https://nova.tudominio.com
PORT=3001

# Frontend (Nuxt)
NUXT_PUBLIC_API_BASE=https://api.nova.tudominio.com
NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...

# Opcionales (habilitar cuando se necesiten)
OPENROUTER_API_KEY=...          # AI narratives en reportes
GROQ_API_KEY=...                # Fallback AI
WA_PHONE_NUMBER_ID=...          # WhatsApp Cloud API
WA_ACCESS_TOKEN=...             # WhatsApp Cloud API
WA_VERIFY_TOKEN=...             # WhatsApp webhook verification
```

---

## Post-Deploy (prioridad alta)

Resolver en las primeras 1-2 semanas despues del deploy.

### 7. WhatsApp: Lookup de Usuario por Telefono

`routes/whatsapp.ts` linea 81: el webhook recibe mensajes pero no busca el usuario
en DB por telefono. Responde a cualquier numero sin verificar `whatsappEnabled`.

Necesita: query `findUserByPhone` en `@nova/db`, verificar que el usuario existe
y tiene `whatsappEnabled: true`.

### 8. WhatsApp: Webhook Signature Verification

`services/whatsapp-sender.ts` linea 63: `verifyWebhookSignature` siempre retorna `true`.
Implementar HMAC-SHA256 con `WA_APP_SECRET`.

### 9. WhatsApp: Rate Limiter en Redis

`routes/whatsapp.ts` linea 23: rate limiter usa `Map` en memoria. Se pierde al
reiniciar. Migrar a Redis con TTL.

### 10. Endpoint POST /api/exchange-rate

La funcion `setCurrentRate` existe en `services/exchange-rate.ts` pero no tiene ruta.
Crear endpoint protegido (owner-only) para que el dueno pueda actualizar la tasa
desde la app o via cron.

### 11. ReportLayout Period Selector

`components/shared/ReportLayout.vue` tiene selector de periodo pero no emite eventos.
Los reportes siempre cargan el periodo default. Conectar el selector para que los
reportes reaccionen al cambio de periodo.

### 12. Excel Import (inventory/import.vue)

La pagina parsea archivos Excel/CSV localmente pero no hace POST para crear los
productos. Conectar a `POST /api/products` en batch.

---

## Post-Deploy (prioridad media)

Resolver en las primeras 4-6 semanas.

### 13. Tests de Integracion

Solo hay 2 tests (health + shared utils). Los endpoints criticos necesitan tests
con DB real. El CI ya tiene PostgreSQL y Redis como services.

Prioridad de tests:

1. POST /api/sales (transaccion atomica, validaciones)
2. POST /auth/pin (lockout logic)
3. POST /onboarding (transaccion atomica)
4. POST /api/sales/:id/void (restauracion de stock)

### 14. Error Boundary Global (Frontend)

No hay error handler global. Si un `$api` call falla fuera de un try/catch,
la app se rompe silenciosamente. Agregar `app:error` hook en Nuxt.

### 15. Predictions y Gamification

Los modulos `predictions.ts` y `gamification.ts` en `@nova/shared` tienen funciones
puras probadas (21 tests) pero no estan conectados a ningun endpoint ni pagina.

- Predictions: "se acaba en ~X dias" por producto
- Gamification: seller goals, streaks, daily targets

### 16. PgBouncer Transaction Mode + RLS

PgBouncer esta en modo `transaction`. El `set_config` con `false` (session-level)
puede no funcionar correctamente con PgBouncer porque las conexiones se reciclan
entre transacciones. Opciones:

a) Cambiar a `set_config('app.current_business_id', $1, true)` (transaction-local)
y wrappear cada request en una transaccion
b) Usar conexion directa (puerto 5432) en vez de PgBouncer
c) Configurar PgBouncer en modo `session` para Nova

Recomendacion: opcion (b) para empezar, evaluar performance despues.

### 17. Dockerfile Verificacion

El Dockerfile multi-stage existe pero no ha sido probado con el codigo actual.
Los paths de dist pueden haber cambiado. Probar build local antes de deploy.

---

## Arquitectura de Deploy en Coolify

```
Coolify (Control Plane 10.0.1.10)
├── nova-api (Docker, puerto 3001)
│   ├── DATABASE_URL -> 10.0.1.20:5432/nova (directo, no PgBouncer por RLS)
│   ├── REDIS_URL -> 10.0.1.20:6379/4
│   └── CLERK_SECRET_KEY
├── nova-web (Docker, puerto 3000)
│   ├── NUXT_PUBLIC_API_BASE -> http://nova-api:3001 (o URL publica)
│   └── NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY
└── Traefik (reverse proxy)
    ├── nova.tudominio.com -> nova-web:3000
    └── api.nova.tudominio.com -> nova-api:3001
```
