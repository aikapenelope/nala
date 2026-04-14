# Nova: Auditoria de Codigo y Roadmap Definitivo

> Fecha: Abril 2026
> Codebase: 15,830 lineas, 26 tablas, 40+ endpoints, 27 paginas, 17 tests
> Estado: produccion (nova-api.aikalabs.cc, nova.aikalabs.cc)

---

## Auditoria de Codigo

### Lo que esta bien

**Arquitectura.** Nuxt 4 + Hono + PostgreSQL + Redis + Clerk. Monorepo Turborepo. Cada pieza tiene proposito claro. No hay tecnologia innecesaria ni experimental.

**Multi-tenancy.** RLS en PostgreSQL con `set_config` por request. 26 tablas con policies. Exchange rates scopeadas por tenant. El patron JWT -> user -> businessId -> RLS es el mismo que usan Slack y Shopify en 2026.

**Auth.** Clerk + PIN local (bcrypt en browser) es exactamente el patron de Square POS. No hay endpoints publicos de auth. Roster cacheado en localStorage. Backend solo ve JWT + X-Acting-As.

**Flujo de ventas.** POST /api/sales es robusto: valida stock, fiado requiere customer, pagos cubren total, transaccion atomica (sale + items + payments + stock decrement + fiado + accounting entries + activity log). 7 pasos en una transaccion.

**Seguridad.** Scanner bot blocking, secure headers, CORS con wildcard para subdominios, rate limiting (publico/auth/write), structured JSON logging con requestId/userId/businessId, slugs reservados rechazados en onboarding.

**Decisiones.** WhatsApp eliminado (compliance Meta 2026), gamificacion eliminada (tablas muertas), subdominios como capa frontend-only (zero cambios en backend), exchange rates aisladas por tenant.

### Problemas encontrados

**1. `drizzle-kit push --force` en cada deploy**

`entrypoint-api.sh` linea 18 ejecuta `drizzle-kit push --force` en cada deploy. Esto compara el schema TypeScript con la DB y aplica cambios destructivos. Si alguien renombra una columna, `push --force` dropea la vieja y crea una nueva, perdiendo datos.

No es un problema ahora (schema estable) pero es inaceptable con datos reales de clientes.

**2. `set_config` session-level con connection pool**

`middleware/tenant.ts` usa `set_config(..., false)` (session-level). Con `postgres.js` y conexion directa funciona, pero a escala con requests concurrentes hay riesgo teorico de que dos requests compartan conexion y se pise el RLS context.

No es un problema con el trafico actual. Se resuelve con `set_config(..., true)` + transacciones explicitas cuando el trafico lo justifique.

**3. Tests superficiales**

17 tests verifican que endpoints rechazan requests sin auth y retornan status correcto. No hay tests que:
- Creen negocio + productos + venta en DB de test
- Verifiquen que stock se decrementa
- Verifiquen que RLS aisla datos entre tenants
- Verifiquen que fiado crea accounts_receivable

El CI tiene PostgreSQL + Redis como services. Los tests de integracion son posibles y necesarios.

**4. Seed sin slug**

`packages/db/src/seed.ts` crea negocio sin slug. Despues de PR #73, el onboarding requiere slug. El catalogo publico no funciona en dev local sin slug en el seed.

**5. Errores de DB no se traducen a mensajes utiles**

Si la transaccion de ventas falla (unique constraint, FK violation), el cliente recibe 500 generico. Deberia capturar errores especificos y retornar mensajes claros.

### Conclusion

No hay fallas de arquitectura. Los problemas son de madurez (tests, migraciones, manejo de errores), no de diseno. El enfoque es correcto para produccion.

---

## Roadmap Definitivo

### Dia 1: Activar subdominios

Seguir doc 24 (paso a paso):

| Paso | Que | Tiempo |
|---|---|---|
| 1 | Comprar dominio dedicado | 10 min |
| 2 | DNS en Cloudflare (wildcard + raiz) | 10 min |
| 3 | Coolify: agregar wildcard + env vars + redeploy | 15 min |
| 4 | Clerk: agregar dominio | 5 min |
| 5 | Verificar (dig, curl, navegador) | 10 min |

### Dia 2: Migraciones Drizzle versionadas

Eliminar `drizzle-kit push --force` del entrypoint. Reemplazar con migraciones versionadas.

| Tarea | Archivo |
|---|---|
| Generar migracion inicial del schema actual | `npx drizzle-kit generate` -> crea `drizzle/` con SQL |
| Cambiar entrypoint para usar `drizzle-kit migrate` | `entrypoint-api.sh` |
| Agregar `drizzle/` al repo (versionado) | `.gitignore` verificar que no lo excluye |
| Probar: deploy no rompe nada | Coolify redeploy |

### Dia 3-4: Tests de integracion

Tests con DB real (el CI ya tiene PostgreSQL + Redis).

| Test | Que verifica | Archivo |
|---|---|---|
| Onboarding completo | Crear negocio + owner + categorias + accounts en transaccion | `__tests__/onboarding.test.ts` |
| Flujo de venta | Crear producto, vender, verificar stock decrementado | `__tests__/sales-integration.test.ts` |
| Venta con fiado | Venta fiado crea accounts_receivable, actualiza balance cliente | `__tests__/sales-integration.test.ts` |
| Anulacion de venta | Void restaura stock, marca sale como voided | `__tests__/sales-integration.test.ts` |
| RLS aislamiento | Negocio A no ve productos/ventas de negocio B | `__tests__/rls.test.ts` |
| Catalogo publico | GET /catalog/:slug retorna productos correctos, 404 para slug inexistente | `__tests__/catalog.test.ts` (expandir) |

Requiere: helper de setup que crea negocio + usuario de test en la DB, y limpia despues.

### Dia 5: Exportacion PDF

| Tarea | Archivo |
|---|---|
| Instalar `pdfmake` en apps/api | `package.json` |
| Crear servicio de generacion PDF | `services/pdf-generator.ts` |
| Endpoint: GET /api/reports/daily/export?format=pdf | `routes/reports.ts` |
| Endpoint: GET /api/reports/weekly/export?format=pdf | `routes/reports.ts` |
| Endpoint: GET /api/reports/financial/export?format=pdf | `routes/reports.ts` |
| Boton "Descargar PDF" en cada pagina de reporte | `reports/*.vue` |

### Dia 6: Exportacion Excel

| Tarea | Archivo |
|---|---|
| Endpoint: GET /api/reports/daily/export?format=xlsx | `routes/reports.ts` |
| Endpoint: GET /api/reports/weekly/export?format=xlsx | `routes/reports.ts` |
| Endpoint: GET /api/reports/sellers/export?format=xlsx | `routes/reports.ts` |
| Libro de ventas formato SENIAT (xlsx) | `routes/reports.ts` |
| Boton "Descargar Excel" en cada pagina de reporte | `reports/*.vue` |

`xlsx` ya esta en dependencias del frontend. Para el backend, instalar `xlsx` o generar CSV (mas simple, Excel lo abre).

### Dia 7: Email transaccional

| Tarea | Archivo |
|---|---|
| Instalar Resend SDK | `apps/api/package.json` |
| Crear servicio de email | `services/email.ts` |
| Endpoint: POST /api/reports/{type}/send-email | `routes/reports.ts` |
| Boton "Enviar por email" en cada reporte | `reports/*.vue` |
| Campo email del contador en settings | `settings/index.vue` + schema businesses |
| Boton "Enviar al contador" que genera PDF y lo envia | `reports/*.vue` |

El usuario controla cuando envia. No hay cron. El boton genera el PDF y lo envia via Resend.

### Dia 8: Import Excel + ReportLayout + Seed

**Import Excel:**

| Tarea | Archivo |
|---|---|
| Conectar inventory/import.vue a POST /api/products batch | `pages/inventory/import.vue` |
| Endpoint: POST /api/products/batch (crear multiples productos) | `routes/inventory.ts` |
| Validacion de columnas requeridas | `routes/inventory.ts` |
| Preview antes de importar | `pages/inventory/import.vue` |

**ReportLayout period selector:**

| Tarea | Archivo |
|---|---|
| Conectar v-model del selector de periodo | `components/shared/ReportLayout.vue` |
| Cada reporte reacciona al cambio de periodo | `reports/*.vue` (ya tienen la logica, solo falta el binding) |

**Seed con slug:**

| Tarea | Archivo |
|---|---|
| Agregar slug al seed | `packages/db/src/seed.ts` |
| Agregar whatsappNumber al seed | `packages/db/src/seed.ts` |

---

## Despues del dia 8 (prioridad media/baja)

| Item | Prioridad | Descripcion |
|---|---|---|
| Segmentos de clientes | Media | Calculo automatico: VIP, frecuente, en riesgo, inactivo |
| Sentry error tracking | Media | @sentry/node + @sentry/vue |
| Uptime monitoring | Media | Configurar Uptime Kuma |
| Prediccion flujo de caja | Media | Proyectar ingresos/gastos, alertar deficit |
| Iconos PWA | Baja | icon-192x192.png y icon-512x512.png |
| PgBouncer + RLS | Baja | Solo necesario a escala |
| Service Worker offline | Baja | Verificar que funciona sin internet |
| CI/CD automatico | Baja | Push a main -> staging |
| E2E tests Playwright | Baja | Login, producto, venta, dashboard |
