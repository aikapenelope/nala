# Nova: Roadmap de Produccion + Rediseno WhatsApp (Compliance Meta 2026)

> Fecha: Abril 2026
> Estado: Backend y frontend conectados a DB real. Zero mock data.
> Siguiente paso: Resolver bloqueantes, redisenar WhatsApp, deploy a Coolify.

---

## Parte 1: Analisis de Compliance WhatsApp Business Platform 2026

### Que cambio en Meta (enero 2026)

El 15 de enero de 2026, Meta implemento cambios significativos en la WhatsApp Business Platform:

1. **Ban de chatbots de proposito general**: Proveedores de IA (ChatGPT, Perplexity, Copilot) estan prohibidos de usar la API como canal de distribucion. La IA como producto principal esta prohibida.

2. **IA auxiliar SI permitida**: Bots de soporte, booking, order tracking, notificaciones y ventas siguen permitidos siempre que la IA sea *auxiliar* a un servicio de negocio legitimo.

3. **Pricing por mensaje** (desde julio 2025):
   - **Marketing**: mensajes promocionales (~$0.03-0.07 LATAM)
   - **Utility**: transaccionales, confirmaciones (~$0.005-0.02)
   - **Authentication**: OTP/2FA (~$0.02-0.04)
   - **Service**: respuestas dentro de ventana 24h (**gratis**)

4. **Ventana de 24 horas**: Cuando un usuario escribe, tienes 24h para responder libremente. Fuera de esa ventana, solo templates aprobados.

5. **Opt-in obligatorio**: Solo puedes contactar personas que dieron consentimiento explicito.

6. **Escalation paths obligatorios**: Si usas automatizacion, debes tener caminos claros de escalacion a humano (telefono, email, web, visita).

Fuentes:
- https://business.whatsapp.com/policy
- https://respond.io/blog/whatsapp-general-purpose-chatbots-ban
- https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform/

### Donde el diseno actual de Nova viola o esta en zona gris

| Feature en docs 08/19 | Problema | Severidad |
|---|---|---|
| Consultas del dueno por WA ("cuanto vendi hoy") via LLM | Asistente conversacional de IA = funcionalidad principal, no auxiliar | **Alta** |
| LLM como interprete de lenguaje natural (`whatsapp-interpreter.ts`) | GPT-4o-mini parsea cualquier mensaje abierto. Esto es un chatbot de proposito general disfrazado | **Alta** |
| Ventas simples por WA ("3 pan campesino pago movil") | Flujo complejo que requiere interpretacion de lenguaje natural abierto | **Alta** |
| Acciones por WA (cambiar precios, registrar gastos) | Mutaciones de datos via chat conversacional abierto | **Media** |
| Notificaciones salientes (resumenes, alertas, cobros) | **Permitido**. Templates Utility/Marketing con opt-in | OK |
| Cobro a clientes (recordatorio de pago) | **Permitido**. Template Utility con opt-in del cliente | OK |
| Catalogo compartible (link a pagina publica) | **Permitido**. Marketing template | OK |

### La linea roja de Meta

> "AI Providers are strictly prohibited from accessing or using the WhatsApp Business Solution [...] when such technologies are the primary (rather than incidental or ancillary) functionality being made available for use."

En el diseno original de Nova, el flujo de WhatsApp entrante **ES** un asistente conversacional de IA. El usuario escribe en lenguaje natural, un LLM interpreta, y ejecuta acciones. Esto es exactamente lo que Meta prohibe.

### Configuracion actual en el codigo

El repo tiene implementado:

| Archivo | Que hace | Estado |
|---|---|---|
| `routes/whatsapp.ts` | Webhook GET (verificacion Meta) + POST (recibe mensajes) | Parcial: no busca usuario por telefono |
| `services/whatsapp-interpreter.ts` | LLM (GPT-4o-mini) interpreta mensajes en lenguaje natural | **Debe eliminarse** |
| `services/whatsapp-sender.ts` | Envia mensajes via Meta Cloud API | OK, se mantiene |
| `services/ai-narrative.ts` | Genera narrativas para reportes (no WhatsApp) | OK, no afectado |

Variables de entorno configuradas en `.env.example`:
- `WA_PHONE_NUMBER_ID` - ID del numero de WhatsApp Business
- `WA_ACCESS_TOKEN` - Token de acceso a Meta Cloud API
- `WA_VERIFY_TOKEN` - Token de verificacion del webhook

Estas variables son correctas y se mantienen. Lo que cambia es **como** se usan.

---

## Parte 2: Nuevo Diseno de WhatsApp (Compliant)

### Principio: WhatsApp = canal de marketing + notificaciones, no interfaz alternativa

El dueno consulta metricas y opera el negocio desde la PWA (que ya es mobile-first). WhatsApp se usa para:

1. **Notificaciones salientes al dueno** (Utility templates)
2. **Cobros a clientes** (Utility templates)
3. **Catalogo publico compartible** (Marketing + pagina web)
4. **Respuestas estructuradas a clientes externos** (Service, dentro de 24h)

### Flujo del catalogo (el diferenciador principal)

```
Cliente externo ve el negocio (redes, boca a boca, referido)
    |
    v
Escribe al WhatsApp del negocio: "Hola, quiero ver sus productos"
    |
    v
Bot estructurado responde (dentro de ventana 24h, gratis):
    "Hola! Bienvenido a [Nombre del Negocio]. Que te gustaria hacer?"
    [Ver Catalogo]  [Horarios]  [Ubicacion]
    |
    v
Cliente toca [Ver Catalogo]
    |
    v
Recibe link: nova.app/catalogo/{slug-del-negocio}
    |
    v
Abre pagina publica: ve productos con fotos, precios, disponibilidad
(pagina ligera, no requiere login, funciona en cualquier navegador)
    |
    v
Toca "Pedir por WhatsApp" en un producto
    |
    v
Se abre WhatsApp del negocio con mensaje prellenado:
"Hola, me interesa: 3x Pan Campesino ($4.50)"
    |
    v
El dueno/empleado ve el pedido en WA personal del negocio
y lo registra como venta en la PWA de Nova
```

**No es e-commerce.** No hay carrito, no hay checkout, no hay pago online. Es un catalogo visual que facilita la comunicacion. El pedido se cierra por WhatsApp como ya lo hacen los comerciantes venezolanos hoy.

### Que se mantiene (100% compliant)

#### A. Notificaciones salientes al dueno (Utility templates)

| Template | Trigger | Contenido |
|---|---|---|
| `daily_summary` | Cron 9pm | "Hoy vendiste $420 en 23 ventas. +12% vs ayer. Top: Pan Campesino" |
| `weekly_summary` | Cron lunes 8am | "Esta semana: $2,800. +5% vs semana pasada. Mejor dia: sabado" |
| `stock_critical` | Evento: producto baja de stock_critical | "ALERTA: Harina PAN tiene 2 unidades. Pedir al proveedor" |
| `anomaly_alert` | Evento: anomalia detectada | "3 anulaciones hoy (promedio: 0.2). Revisar en la app" |

Estos son templates pre-aprobados por Meta. No requieren interaccion. El dueno solo recibe.

#### B. Cobros a clientes (Utility templates)

| Template | Trigger | Contenido |
|---|---|---|
| `payment_reminder` | Dueno toca "Cobrar" en PWA | "Hola {nombre}, tienes un saldo pendiente de ${monto} en {negocio}. Puedes pagar por [metodos]" |
| `bulk_collection` | Dueno toca "Cobrar a todos" en PWA | Envia template a cada cliente con deuda |

Requiere opt-in del cliente (registrado con telefono y consentimiento en la PWA).

#### C. Catalogo publico

- Pagina web publica: `nova.app/catalogo/{slug}`
- Generada desde los productos del negocio en tiempo real
- El dueno comparte el link por WA, redes, o donde quiera
- El cliente ve productos, precios, disponibilidad
- Boton "Pedir por WhatsApp" abre WA del negocio con mensaje prellenado

#### D. Respuestas estructuradas a clientes (Service, gratis en 24h)

Cuando un cliente externo escribe al WA del negocio:

- Bot responde con **botones predefinidos** (no lenguaje natural):
  - [Ver Catalogo] -> link a pagina publica
  - [Horarios] -> texto con horarios
  - [Ubicacion] -> link a Google Maps
  - [Hablar con alguien] -> escalacion a humano (el dueno)

- Si el cliente pregunta por un producto especifico (keyword match simple, no LLM):
  - "Pan" -> "Tenemos Pan Campesino ($1.50), Pan Integral ($2.00). Ver catalogo completo: [link]"

- **No hay LLM**. Solo keyword matching basico + botones interactivos.

### Que se elimina

| Feature original | Razon de eliminacion | Alternativa |
|---|---|---|
| Consultas de metricas por WA | Viola policy (asistente IA) | PWA mobile (ya existe, es mobile-first) |
| LLM interpreter de lenguaje natural | Viola policy (chatbot de proposito general) | Bot estructurado con botones |
| Ventas por WA | Viola policy (flujo complejo via IA) | PWA mobile |
| Cambio de precios por WA | Viola policy (mutacion via IA) | PWA mobile |
| Registro de gastos por WA | Viola policy (mutacion via IA) | PWA mobile |
| OCR por WA | Ya estaba descartado (WA comprime imagenes) | PWA camara nativa |

### Impacto en el codigo

| Archivo | Accion |
|---|---|
| `services/whatsapp-interpreter.ts` | **Eliminar**. Reemplazar con keyword matcher simple para clientes externos |
| `routes/whatsapp.ts` | **Reescribir**. Webhook para clientes externos (no dueno). Botones interactivos |
| `services/whatsapp-sender.ts` | **Mantener + extender**. Agregar envio de templates y mensajes interactivos |
| `docs/08-whatsapp-entrada-y-diferenciadores.md` | **Actualizar**. Reflejar nuevo diseno |
| `docs/19-whatsapp-arquitectura-seguridad.md` | **Actualizar**. Eliminar seccion de entrada conversacional |

### Nuevos archivos necesarios

| Archivo | Funcion |
|---|---|
| `routes/catalog.ts` | Pagina publica de catalogo (SSR o API) |
| `apps/web/app/pages/catalogo/[slug].vue` | Pagina publica del catalogo (no requiere auth) |
| `services/whatsapp-templates.ts` | Gestion de templates pre-aprobados |
| `services/whatsapp-notifications.ts` | Cron jobs para resumenes diarios/semanales |

---

## Parte 3: Roadmap Completo de Produccion

### Fase A: Bloqueantes para Deploy (Semana 1-2)

Estos items deben resolverse ANTES del primer deploy en Coolify.

#### A1. Crear DB "nova" en el Data Plane

En el repo `platform-infra`, agregar "nova" a `init-databases.sh`:

```
DATABASES="whabi docflow aurora nova"
```

Crear `src/projects/nova.ts` con:
- `novaPostgresUrl` (directo, puerto 5432, para RLS)
- `novaRedisUrl` (DB 4)
- MinIO bucket: `nova-receipts` (futuro)

#### A2. Ejecutar Drizzle Migrations

```bash
DATABASE_URL=postgresql://platform:<pw>@10.0.1.20:5432/nova npx drizzle-kit push
psql postgresql://platform:<pw>@10.0.1.20:5432/nova < packages/db/init.sql
```

Crear role `nova_app` con permisos limitados (RLS no funciona con superuser).

**Futuro**: migrar de `drizzle-kit push` a `drizzle-kit migrate` con archivos de migracion versionados.

#### A3. Validacion de env vars al boot

Crear schema Zod que valide variables requeridas al arrancar el servidor. Si falta `DATABASE_URL` o `CLERK_SECRET_KEY`, el servidor debe fallar inmediatamente con mensaje claro, no en runtime.

```typescript
// apps/api/src/env.ts
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  CLERK_SECRET_KEY: z.string().min(1),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3001),
  REDIS_URL: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  // ... opcionales
});
```

#### A4. CORS configurable por entorno

Ya esta parcialmente implementado (`process.env.CORS_ORIGIN?.split(",")`) pero necesita documentacion y verificacion de que funciona con Coolify.

#### A5. Iconos PWA

Crear `/icon-192x192.png` y `/icon-512x512.png` en `apps/web/public/`. Sin estos, la PWA no se instala correctamente en Android/iOS.

#### A6. Health check profundo

El `/health` actual solo retorna 200. Debe verificar:
- Conexion a PostgreSQL (query simple)
- Conexion a Redis (PING)
- Retornar estado de cada dependencia

```json
{
  "status": "healthy",
  "postgres": "ok",
  "redis": "ok",
  "uptime": 3600
}
```

#### A7. Tasa de cambio inicial

Insertar tasa BCV inicial en la DB o documentar que el dueno debe configurarla desde la PWA antes de crear ventas. El endpoint `POST /api/exchange-rate` ya existe.

---

### Fase B: Seguridad y Hardening (Semana 2-3)

#### B1. Webhook WhatsApp: HMAC verification

`verifyWebhookSignature` en `whatsapp-sender.ts` siempre retorna `true`. Implementar verificacion real con `crypto.createHmac('sha256', appSecret)`.

#### B2. Rate limiter en Redis

El rate limiter de WhatsApp usa `Map` en memoria. Migrar a Redis con TTL:

```typescript
const key = `wa:rate:${phone}`;
const count = await redis.incr(key);
if (count === 1) await redis.expire(key, 3600);
if (count > WA_RATE_LIMIT_PER_HOUR) return rateLimit();
```

#### B3. Error boundary global (frontend)

No hay error handler global en Nuxt. Agregar `app:error` hook para capturar errores no manejados y mostrar UI de error amigable.

#### B4. Structured logging

Reemplazar `hono/logger` (texto plano) con logging estructurado (JSON) para facilitar debugging en produccion. Incluir request ID, user ID, business ID en cada log.

#### B5. Validacion de env vars (frontend)

Similar a A3 pero para Nuxt. Verificar que `NUXT_PUBLIC_API_BASE` y `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY` estan configurados.

---

### Fase C: WhatsApp Rediseñado (Semana 3-5)

#### C1. Eliminar whatsapp-interpreter.ts

Eliminar el servicio de interpretacion LLM. Reemplazar con un keyword matcher simple para respuestas a clientes externos.

#### C2. Reescribir webhook handler

El webhook ahora maneja mensajes de **clientes externos** (no del dueno):

- Mensaje de texto -> respuesta con botones interactivos
- Keyword match simple ("productos", "catalogo", "horario") -> respuesta predefinida
- Boton [Ver Catalogo] -> envia link a pagina publica
- Boton [Hablar con alguien] -> escalacion a humano
- Cualquier otro mensaje -> "Hola! Soy el asistente de {negocio}. [Ver Catalogo] [Horarios] [Ubicacion]"

#### C3. Crear servicio de templates

Gestion de templates pre-aprobados por Meta:
- `daily_summary` (Utility)
- `weekly_summary` (Utility)
- `stock_alert` (Utility)
- `payment_reminder` (Utility)
- `catalog_share` (Marketing)

#### C4. Crear servicio de notificaciones (cron)

Cron jobs para enviar notificaciones automaticas al dueno:
- 9pm: resumen diario
- Lunes 8am: resumen semanal
- Evento: alerta de stock critico

Opciones de implementacion:
- Node-cron dentro del proceso de la API
- Coolify scheduled tasks
- GitHub Actions scheduled workflow

#### C5. Pagina publica de catalogo

`/catalogo/{slug}` - pagina publica (sin auth) que muestra:
- Nombre y logo del negocio
- Productos con foto, nombre, precio, disponibilidad
- Filtro por categoria
- Boton "Pedir por WhatsApp" que abre `wa.me/{numero}?text={mensaje_prellenado}`
- SEO basico (meta tags, Open Graph)

Esta pagina es el puente entre WhatsApp y la PWA. El dueno comparte el link, el cliente ve productos, y pide por WA.

#### C6. Actualizar documentacion

Actualizar docs 08 y 19 para reflejar el nuevo diseno. Eliminar referencias a consultas del dueno por WA y LLM interpreter.

---

### Fase D: Testing (Semana 4-6)

#### D1. Tests de flujo de ventas

El endpoint mas critico (`POST /api/sales`) necesita tests de integracion:
- Venta exitosa con stock suficiente
- Venta rechazada por stock insuficiente
- Venta con fiado (crea accounts_receivable)
- Venta con descuento
- Anulacion de venta (restaura stock)

#### D2. Tests de autenticacion

- Clerk JWT valido -> acceso permitido
- JWT invalido -> 401
- X-Acting-As con empleado valido -> contexto correcto
- X-Acting-As con empleado de otro negocio -> 403
- Dev mode sin CLERK_SECRET_KEY -> mock user

#### D3. Tests de RLS/multi-tenant

- Negocio A no puede ver datos de negocio B
- `set_config` funciona correctamente con el pool de conexiones

#### D4. Tests de WhatsApp (nuevo diseno)

- Webhook verification (GET)
- Mensaje de texto -> respuesta con botones
- Keyword match -> respuesta correcta
- Rate limiting funciona
- HMAC verification funciona

#### D5. E2E smoke tests

Expandir `e2e/smoke.spec.ts` con Playwright:
- Login con Clerk
- Crear producto
- Registrar venta
- Ver dashboard
- Ver reportes

---

### Fase E: Features Pendientes (Semana 5-8)

#### E1. Segmentos de clientes automaticos

La tabla `customerSegments` existe pero no hay logica que calcule segmentos. Implementar:
- VIP: >10 compras Y ticket promedio > promedio del negocio
- Frecuente: >5 compras en ultimos 30 dias
- En riesgo: no compra hace 30-60 dias
- Inactivo: no compra hace 60+ dias
- Con deuda: balance > 0
- Nuevo: primera compra en ultimos 7 dias

Ejecutar calculo como cron diario o al crear una venta.

#### E2. Exportacion PDF/Excel

Los reportes necesitan exportacion:
- PDF: usar `@react-pdf/renderer` o `pdfmake` para generar PDFs server-side
- Excel: usar `xlsx` (ya en dependencias del frontend) para generar archivos

Endpoints: `GET /api/reports/{type}/export?format=pdf|xlsx`

#### E3. Importacion Excel (conectar)

`inventory/import.vue` parsea archivos pero no hace POST. Conectar a `POST /api/products` en batch. Agregar:
- Validacion de columnas requeridas
- Preview antes de importar
- Reporte de errores por fila

#### E4. Gamificacion (conectar)

Las tablas `sellerGoals` y `sellerStreaks` existen. El endpoint `/reports/gamification` existe. Falta:
- Actualizar `sellerGoals` automaticamente al crear una venta
- Actualizar `sellerStreaks` en el cron de cierre de dia
- Mostrar gamificacion en el dashboard del empleado

#### E5. Seed de datos iniciales

Crear seed para:
- Catalogo de cuentas contables por tipo de negocio (ferreteria, bodega, tienda de ropa, etc.)
- Categorias default por tipo de negocio
- Unidades de medida comunes (unidad, caja, kg, litro)

#### E6. Prediccion de flujo de caja

Implementar el feature descrito en doc 08:
- Proyectar ingresos basado en promedio de ventas por dia de la semana
- Sumar gastos fijos conocidos
- Sumar cuentas por pagar con fecha proxima
- Alertar si algun dia el balance proyectado es negativo

---

### Fase F: Observabilidad (Semana 6-8)

#### F1. Error tracking

Integrar Sentry (o alternativa) para capturar errores en produccion:
- Backend: `@sentry/node` en Hono
- Frontend: `@sentry/vue` en Nuxt

#### F2. Metricas basicas

Agregar metricas de negocio al health check o endpoint dedicado:
- Numero de negocios activos
- Ventas del dia (agregado)
- Errores por hora
- Latencia de endpoints criticos

#### F3. Uptime monitoring

Configurar Uptime Kuma (ya en el control plane) para monitorear:
- `GET /health` de la API
- Pagina principal del frontend
- Pagina de catalogo

---

### Fase G: Optimizacion y Escala (Semana 8-10)

#### G1. PgBouncer + RLS

Resolver el conflicto entre PgBouncer transaction mode y `set_config` session-level. Opciones:
- Usar conexion directa (puerto 5432) para empezar
- Migrar a `set_config(..., true)` con transacciones explicitas
- Configurar PgBouncer en modo session para Nova

#### G2. Service Worker offline real

Verificar que el service worker de `@vite-pwa/nuxt` funciona correctamente:
- Intercepta requests de navegacion offline
- Muestra pagina cached cuando no hay internet
- La cola offline (`useOfflineQueue`) sincroniza al volver

#### G3. Migraciones Drizzle versionadas

Migrar de `drizzle-kit push` (destructivo) a `drizzle-kit generate` + `drizzle-kit migrate` con archivos de migracion versionados en el repo.

#### G4. CI/CD automatico

Configurar deploy automatico a Coolify:
- Push a `main` -> deploy a staging
- Tag `v*` -> deploy a produccion
- Smoke tests post-deploy

---

## Resumen de Prioridades

| Prioridad | Fase | Semana | Items |
|---|---|---|---|
| **Critico** | A: Bloqueantes | 1-2 | DB, migrations, env validation, CORS, PWA icons, health check |
| **Alto** | B: Seguridad | 2-3 | HMAC, rate limiter Redis, error boundary, structured logging |
| **Alto** | C: WhatsApp | 3-5 | Eliminar LLM, reescribir webhook, templates, catalogo publico |
| **Alto** | D: Testing | 4-6 | Ventas, auth, RLS, WhatsApp, E2E |
| **Medio** | E: Features | 5-8 | Segmentos, export PDF/Excel, import Excel, gamificacion, seed, flujo de caja |
| **Medio** | F: Observabilidad | 6-8 | Sentry, metricas, uptime |
| **Bajo** | G: Optimizacion | 8-10 | PgBouncer, SW offline, migraciones, CI/CD |

---

## Diagrama de Dependencias

```
Fase A (Bloqueantes)
  |
  v
Fase B (Seguridad) -----> Fase C (WhatsApp)
  |                           |
  v                           v
Fase D (Testing) <-----------+
  |
  v
Fase E (Features) ---------> Fase F (Observabilidad)
  |                           |
  v                           v
Fase G (Optimizacion) <------+
```

Fases A y B son secuenciales. C puede empezar en paralelo con B. D depende de B y C. E y F pueden ir en paralelo. G es la ultima.
