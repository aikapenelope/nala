# Roadmap de Debilidades — Auditoría Completa Mayo 2026

> Score actual: 7.8/10
> Objetivo: 9.0/10
> Última revisión: Mayo 2026 (auditoría profunda: DB, API, Frontend, Infra, Seguridad, Testing)

---

## Prioridad Alta (bloquean escala o tienen riesgo de datos)

### 1. FORCE ROW LEVEL SECURITY en todas las tablas
- **Categoría:** Seguridad
- **Riesgo:** Si la app se conecta como table owner (rol `platform`), RLS se bypasea silenciosamente. El middleware siempre setea `set_config` pero no hay defensa si un bug lo omite.
- **Fix:** `ALTER TABLE <table> FORCE ROW LEVEL SECURITY` en todas las tablas con RLS.
- **Impacto:** Previene data leaks si un endpoint olvida pasar por tenant middleware.
- **Esfuerzo:** 2h (migración + test de que migraciones siguen funcionando con FORCE).

### 2. Unique constraint en (business_id, sku) para productos
- **Categoría:** Modelo de datos
- **Riesgo:** Dos productos del mismo negocio pueden tener el mismo SKU. El import de Excel no detecta duplicados correctamente si no hay constraint en DB.
- **Fix:** `CREATE UNIQUE INDEX idx_products_business_sku ON products(business_id, sku) WHERE sku IS NOT NULL`
- **Impacto:** Previene datos corruptos en inventario.
- **Esfuerzo:** 30min (migración + verificar que no hay duplicados existentes).

### 3. Quick sales sin transacción atómica
- **Categoría:** Integridad transaccional
- **Riesgo:** `POST /sales/quick` inserta la venta y luego el pago en statements separados. Si el insert de payment falla, queda una venta sin pago registrado.
- **Fix:** Envolver en `db.transaction()`.
- **Impacto:** Previene ventas huérfanas sin pago.
- **Esfuerzo:** 30min.

### 4. Validación de JSONB fields (surcharges, businessHours, paymentMethods)
- **Categoría:** Validación de datos
- **Riesgo:** Estos campos aceptan cualquier JSON. Un cliente malicioso o un bug en el frontend puede guardar datos malformados que rompen el rendering.
- **Fix:** Zod schemas para cada JSONB field, validados en el endpoint antes de guardar.
- **Impacto:** Previene datos corruptos que causan crashes en el frontend.
- **Esfuerzo:** 2h.

### 5. exchange_rates unique index usa timestamp en vez de date
- **Categoría:** Modelo de datos
- **Riesgo:** El unique index es `(business_id, date)` pero `date` es `timestamp with time zone`. Dos rates el mismo día con diferente hora (ej: 8am y 2pm) crearían dos registros. El query `ORDER BY date DESC LIMIT 1` devuelve el último, pero la intención es una rate por día.
- **Fix:** Cambiar el tipo de `date` a `date` (sin timezone) o usar `DATE(date)` en el unique index.
- **Impacto:** Previene rates duplicados por día.
- **Esfuerzo:** 1h (migración + ajustar queries).

### 6. No hay ON DELETE strategy en saleItems → products
- **Categoría:** Integridad referencial
- **Riesgo:** Si un producto se elimina (hard delete), los `sale_items` quedan con un `product_id` huérfano. Queries de reportes que hacen JOIN con products fallan silenciosamente (rows desaparecen del resultado).
- **Fix:** Cambiar FK a `ON DELETE SET NULL` o `ON DELETE RESTRICT` (preferido — impide borrar productos con ventas). Alternativamente, asegurar que solo se hace soft-delete (`is_active = false`).
- **Impacto:** Previene pérdida de datos históricos de ventas.
- **Esfuerzo:** 1h (migración + verificar que el código solo hace soft-delete).

### 7. No hay PgBouncer (connection pooler externo)
- **Categoría:** Escalabilidad
- **Riesgo:** El pool de postgres.js tiene 20 conexiones directas. Si se escala a 3+ replicas del API (para alta disponibilidad), se consumen 60+ conexiones directas a PostgreSQL. El límite default de PostgreSQL es 100. Esto satura la DB antes de saturar el API.
- **Fix:** Agregar PgBouncer en modo `transaction` entre el API y PostgreSQL. Permite 100+ API connections mapeadas a 20 DB connections reales.
- **Impacto:** Permite escalar horizontalmente sin saturar PostgreSQL.
- **Esfuerzo:** 4h (configurar PgBouncer en docker-compose + ajustar connection string).

### 8. No hay CSRF protection en storefront checkout
- **Categoría:** Seguridad
- **Riesgo:** El endpoint `POST /catalog/:slug/orders` no requiere autenticación y no tiene protección CSRF. Un sitio malicioso podría hacer que un usuario envíe un pedido sin su consentimiento (aunque el impacto es bajo porque no hay dinero involucrado directamente).
- **Fix:** Agregar un token CSRF generado en el HTML del storefront y validado en el POST. O usar `SameSite=Strict` cookies + verificar `Origin` header.
- **Impacto:** Defensa en profundidad para el checkout público.
- **Esfuerzo:** 2h.

---

## Prioridad Media (mejoran resiliencia y operabilidad)

### 9. Circuit breaker para servicios externos
- **Categoría:** Manejo de errores
- **Riesgo:** Si fal.ai, BCV scraper, o Resend están caídos, cada request que los usa espera hasta timeout (25-30s). No hay backoff ni circuit breaker.
- **Fix:** Implementar circuit breaker pattern (3 fallos consecutivos → open → skip por 60s → half-open → retry).
- **Impacto:** Requests no se bloquean esperando servicios caídos.
- **Esfuerzo:** 4h.

### 10. set_config RLS fuera de transacción de venta
- **Categoría:** Integridad transaccional
- **Riesgo:** El tenant middleware hace `set_config` y luego `await next()`. Si postgres.js reasigna la conexión del pool entre el set_config y la transacción de venta (teóricamente posible bajo alta carga), el RLS context podría ser incorrecto.
- **Fix:** Mover el `set_config` dentro de cada transacción que lo necesita, o usar `set_config(..., true)` (transaction-local) dentro del `db.transaction()`.
- **Impacto:** Elimina un vector teórico de data leak bajo carga extrema.
- **Esfuerzo:** 3h (refactor del tenant middleware).

### 11. productAliases.supplierId es text en vez de uuid
- **Categoría:** Modelo de datos
- **Riesgo:** Inconsistencia de tipos. No hay FK constraint, permite valores inválidos.
- **Fix:** Migración para cambiar a `uuid` con FK a `suppliers.id`.
- **Impacto:** Integridad referencial.
- **Esfuerzo:** 1h.

### 12. customer_segments tabla redundante con RFM
- **Categoría:** Modelo de datos
- **Riesgo:** Dos sistemas de segmentación coexisten: `customer_segments` (tabla N:M con labels simples) y `customers.rfm_segment` (columna con scoring real). El frontend usa ambos en diferentes lugares.
- **Fix:** Deprecar `customer_segments` y migrar todo a `rfm_segment`. O mantener ambos con roles claros (RFM = scoring automático, segments = tags manuales del usuario).
- **Impacto:** Reduce confusión y queries innecesarios.
- **Esfuerzo:** 2h (decidir estrategia + migrar frontend).

### 13. paymentMethod sin validación de enum
- **Categoría:** Validación de datos
- **Riesgo:** El campo `method` en sale_payments y `paymentMethod` en orders acepta cualquier string. Un typo ("pago_moivl") crea un método fantasma que aparece en reportes.
- **Fix:** Zod enum con los métodos válidos: `z.enum(["efectivo", "pago_movil", "zelle", "binance", "zinli", "transferencia", "fiado", "efectivo_usd"])`.
- **Impacto:** Datos limpios en reportes de métodos de pago.
- **Esfuerzo:** 1h.

### 14. Reports sin paginación
- **Categoría:** Performance
- **Riesgo:** `GET /quotations` devuelve hasta 500 rows. Reportes de inventario devuelven todos los productos. Con 1,000 negocios y 200+ productos cada uno, estos responses pueden ser grandes.
- **Fix:** Agregar paginación con cursor o offset a endpoints que devuelven listas largas.
- **Impacto:** Reduce memoria del servidor y tiempo de respuesta.
- **Esfuerzo:** 3h.

### 15. Dashboard hace 12 API calls en paralelo
- **Categoría:** Performance
- **Riesgo:** En conexión 3G venezolana (300-500ms RTT), 12 calls en paralelo saturan el ancho de banda. El skeleton se muestra 3-5 segundos.
- **Fix:** Dividir en 2 fases: critical (4 calls) → render → deferred (8 calls). O crear un endpoint `/api/dashboard` que devuelve todo en una sola respuesta.
- **Impacto:** First paint 2-3x más rápido.
- **Esfuerzo:** 4h (endpoint consolidado) o 2h (two-phase loading).

### 16. Catálogo público hace 6 round-trips al DB
- **Categoría:** Performance
- **Riesgo:** `GET /catalog/:slug` ejecuta: 1) business lookup, 2) products query, 3) count query, 4) categories query, 5) images batch, 6) exchange rate transaction. Con latencia de DB de 2-5ms cada una, son 12-30ms solo en round-trips.
- **Fix:** Consolidar queries 2+3 con `SELECT *, COUNT(*) OVER()` (window function). Consolidar 1+4 en un solo query con JOIN. Resultado: 3 round-trips en vez de 6.
- **Impacto:** -50% latencia del endpoint de catálogo.
- **Esfuerzo:** 2h.

### 17. `publicRateLimit` aplicado dos veces al catálogo
- **Categoría:** Bug
- **Riesgo:** En `app.ts`: `app.use("/catalog/*", publicRateLimit)` aplica rate limit a todas las rutas de catalog. Luego dentro de `catalog.ts`: `catalog.post("/:slug/orders", publicRateLimit, ...)` lo aplica de nuevo al POST. El usuario consume 2 tokens del rate limit por cada orden.
- **Fix:** Remover el `publicRateLimit` duplicado del POST de orders (ya está cubierto por el global).
- **Impacto:** Los clientes no pierden rate limit tokens innecesariamente.
- **Esfuerzo:** 5min.

### 18. No hay DB health check en /health endpoint
- **Categoría:** Observabilidad
- **Riesgo:** El endpoint `/health` solo verifica que el proceso Node.js responde. No verifica que la conexión a PostgreSQL o Redis esté activa. Un load balancer puede seguir enviando tráfico a una instancia con DB desconectada.
- **Fix:** Agregar `SELECT 1` al health check (con timeout de 2s). Separar en `/health/live` y `/health/ready`.
- **Impacto:** Load balancer detecta instancias con DB caída.
- **Esfuerzo:** 1h.

### 19. `x-forwarded-for` spoofeable sin validación
- **Categoría:** Seguridad
- **Riesgo:** El rate limiting usa `x-forwarded-for` para identificar al cliente. Si no hay un reverse proxy (Nginx, Cloudflare) que sanitize este header, un atacante puede enviar `X-Forwarded-For: 1.2.3.4` y bypassear el rate limit.
- **Fix:** Configurar el reverse proxy para sobreescribir `X-Forwarded-For` con la IP real del socket. En el API, confiar solo en el primer valor si hay proxy configurado, o usar `X-Real-IP` del proxy.
- **Impacto:** Rate limiting efectivo contra atacantes.
- **Esfuerzo:** 1h (configuración de proxy + validación en middleware).

### 20. No hay partitioning en sales/stock_movements
- **Categoría:** Escalabilidad
- **Riesgo:** Con volumen alto (>1M rows en sales, >5M en stock_movements), las queries de reportes por rango de fecha se degradan. Full table scans en tablas grandes causan latencia y lock contention.
- **Fix:** Implementar partitioning por mes en `sales` y `stock_movements` usando PostgreSQL native partitioning (`PARTITION BY RANGE (created_at)`).
- **Impacto:** Queries de reportes 10-100x más rápidos con volumen alto.
- **Esfuerzo:** 1 día (migración compleja, requiere recrear tablas).

### 21. No hay CDN configurado
- **Categoría:** Performance / Infraestructura
- **Riesgo:** Cada request al storefront (HTML, JS, CSS, imágenes) va directo al servidor. Sin CDN, los cache headers (`s-maxage`) no tienen efecto. Usuarios en Venezuela con alta latencia al servidor sufren tiempos de carga innecesarios.
- **Fix:** Configurar Cloudflare (free tier) o similar delante del dominio. Los route rules ya emiten los headers correctos.
- **Impacto:** -200-500ms TTFB para visitantes recurrentes.
- **Esfuerzo:** 2h (configuración DNS + Cloudflare).

### 22. No hay staging environment
- **Categoría:** Deployment
- **Riesgo:** Los cambios van directo de dev a producción. No hay forma de validar migraciones, performance, o integraciones en un ambiente que replica producción sin afectar usuarios reales.
- **Fix:** Crear un ambiente staging en Coolify con DB separada y datos anonimizados.
- **Impacto:** Reduce riesgo de deploys fallidos en producción.
- **Esfuerzo:** 4h (clonar configuración + script de anonimización de datos).

---

## Prioridad Baja (hardening, nice-to-have)

### 23. No hay tests del frontend (E2E)
- **Categoría:** Testing
- **Riesgo:** No hay tests automatizados para el flujo de compra del storefront (navegar catálogo → agregar al carrito → checkout → confirmar). Un cambio en un composable puede romper el flujo sin que nadie lo detecte hasta que un cliente se queje.
- **Fix:** Implementar Playwright con 3-5 tests E2E: flujo de compra completo, dark mode toggle, PWA install banner, infinite scroll.
- **Impacto:** Confianza en que el storefront funciona después de cada deploy.
- **Esfuerzo:** 1 día.

### 24. No hay tests de concurrencia
- **Categoría:** Testing
- **Riesgo:** No se verifica que dos ventas simultáneas del último item no creen overselling. El código usa `WHERE stock >= qty` que es correcto, pero no hay test que lo demuestre.
- **Fix:** Test que lanza 10 ventas concurrentes del mismo producto con stock=1 y verifica que solo 1 tiene éxito.
- **Impacto:** Confianza en el sistema bajo carga.
- **Esfuerzo:** 3h.

### 25. No hay tests para void/return flows
- **Categoría:** Testing
- **Riesgo:** El flujo de void (restaurar stock, revertir fiado, revertir stats) y return (parcial) no tienen tests de integración. Un cambio en el código podría romper la reversión sin que nadie se entere.
- **Fix:** Tests e2e: crear venta → void → verificar stock restaurado + customer stats revertidos.
- **Impacto:** Previene regresiones en flujos críticos.
- **Esfuerzo:** 4h.

### 26. No hay tests para RFM scoring
- **Categoría:** Testing
- **Riesgo:** El servicio de RFM calcula quintiles y asigna segmentos. Si la lógica tiene un bug (ej: todos los clientes quedan como "lost"), no hay test que lo detecte.
- **Fix:** Unit tests con datos sintéticos: 10 clientes con diferentes patrones → verificar que los segmentos son correctos.
- **Impacto:** Confianza en la segmentación.
- **Esfuerzo:** 2h.

### 27. No hay load testing (k6/Artillery)
- **Categoría:** Testing
- **Riesgo:** No se conoce el punto de quiebre del sistema. No se sabe cuántos requests/segundo aguanta antes de degradarse. Un pico de tráfico (ej: promoción viral) podría tumbar el servicio.
- **Fix:** Script de k6 que simula 100 usuarios concurrentes navegando el catálogo + 10 haciendo checkout. Ejecutar antes de cada release mayor.
- **Impacto:** Conocer los límites y planificar escalamiento.
- **Esfuerzo:** 4h.

### 28. No hay contract testing API ↔ Frontend
- **Categoría:** Testing
- **Riesgo:** Si el API cambia la forma de un response (ej: renombra un campo), el frontend se rompe en runtime sin que TypeScript lo detecte (los tipos son manuales, no generados del schema).
- **Fix:** Generar tipos del API automáticamente (OpenAPI spec → TypeScript types) o usar Zod schemas compartidos entre API y frontend via `@nova/shared`.
- **Impacto:** Detecta breaking changes en compile time.
- **Esfuerzo:** 4h.

### 29. No hay distributed tracing (OpenTelemetry)
- **Categoría:** Observabilidad
- **Riesgo:** Cuando un request es lento, no se puede ver qué parte del pipeline (auth, RLS, query, external service) es la culpable.
- **Fix:** Integrar OpenTelemetry SDK con spans para: auth, tenant, DB queries, Redis, external APIs.
- **Impacto:** Debugging de latencia en producción.
- **Esfuerzo:** 1 día.

### 30. No hay readiness probe separada del liveness probe
- **Categoría:** Deployment
- **Riesgo:** El health check actual verifica DB + Redis. Si la DB está caída, el container se marca como unhealthy y se reinicia. Pero durante migraciones, la DB puede estar temporalmente inaccesible — el container no debería reiniciarse, solo dejar de recibir tráfico.
- **Fix:** Separar en `/health/live` (proceso vivo) y `/health/ready` (DB + Redis accesibles).
- **Impacto:** Deploys más estables.
- **Esfuerzo:** 1h.

### 31. No hay rollback automático de migraciones
- **Categoría:** Deployment
- **Riesgo:** Si una migración falla a mitad (ej: ALTER TABLE en tabla grande timeout), la DB queda en estado inconsistente. No hay forma automática de revertir.
- **Fix:** Cada migración debería tener un archivo `down` correspondiente. O usar migraciones idempotentes (IF NOT EXISTS, IF EXISTS).
- **Impacto:** Recovery más rápido de deploys fallidos.
- **Esfuerzo:** 4h (escribir downs para las 22 migraciones existentes).

### 32. orders.items como JSONB pierde integridad referencial
- **Categoría:** Modelo de datos
- **Riesgo:** Si un producto se elimina, el snapshot en `orders.items` mantiene el `productId` pero no se puede hacer JOIN para obtener datos actualizados. Esto es intencional (snapshot del momento de la orden) pero dificulta reportes que cruzan órdenes con productos.
- **Fix:** Aceptable como está (es un snapshot por diseño). Documentar que `orders.items` es inmutable y no debe joinarse con `products`.
- **Impacto:** Ninguno funcional — solo claridad de diseño.
- **Esfuerzo:** 0 (documentación).

### 33. /metrics endpoint sin auth en red privada
- **Categoría:** Seguridad
- **Riesgo:** Si la red privada se compromete, un atacante puede ver métricas operacionales (request rates, error rates, memory usage). No datos de negocio, pero sí información útil para reconocimiento.
- **Fix:** Agregar basic auth o IP whitelist al endpoint `/metrics`.
- **Impacto:** Defensa en profundidad.
- **Esfuerzo:** 30min.

### 34. No hay error boundary global en frontend
- **Categoría:** Frontend / UX
- **Riesgo:** Si un composable o componente lanza una excepción no capturada (ej: `TypeError: Cannot read property of null`), la página entera se rompe y muestra una pantalla blanca. El usuario no tiene forma de recuperarse excepto recargar.
- **Fix:** Implementar `<NuxtErrorBoundary>` en el layout del storefront con un fallback amigable ("Algo salió mal, recarga la página").
- **Impacto:** UX resiliente — errores parciales no destruyen toda la página.
- **Esfuerzo:** 1h.

### 35. `bcryptjs` en dependencies del frontend web
- **Categoría:** Bundle size
- **Riesgo:** `bcryptjs` (~50KB) está en `package.json` del web app. Probablemente se usa en algún componente del dashboard (owner lock PIN verification client-side), pero contamina el bundle del storefront.
- **Fix:** Mover la verificación de PIN al backend (ya existe `POST /api/owner-lock/verify`). Remover `bcryptjs` del frontend o moverlo a dynamic import.
- **Impacto:** -50KB del bundle del storefront.
- **Esfuerzo:** 1h.

### 36. No hay width/height en imágenes de productos (CLS)
- **Categoría:** Performance / UX
- **Riesgo:** Las imágenes de productos en el catálogo no tienen `width` y `height` explícitos en el HTML. Cuando la imagen carga, el layout salta (Cumulative Layout Shift). Google penaliza esto en Core Web Vitals.
- **Fix:** Usar `aspect-ratio` CSS (ya se usa `aspect-square` en el card) y agregar `width`/`height` attributes al `<img>` tag. O usar `<NuxtImg>` con dimensiones.
- **Impacto:** Mejor CLS score, mejor ranking SEO.
- **Esfuerzo:** 30min.

### 37. CSS muerto en main.css
- **Categoría:** Code quality
- **Riesgo:** Las clases `.storefront-card`, `.storefront-btn-primary` y `.storefront-btn-primary:hover` fueron agregadas en el commit de dark mode pero nunca se usan en ningún template (los componentes usan clases Tailwind inline).
- **Fix:** Eliminar las 12 líneas de CSS muerto.
- **Impacto:** Limpieza de código.
- **Esfuerzo:** 5min.

### 38. No hay backup strategy documentada
- **Categoría:** Operaciones
- **Riesgo:** Si la base de datos se corrompe o se pierde (fallo de disco, error humano), no hay procedimiento documentado de backup/restore. No se sabe si hay backups automáticos, con qué frecuencia, ni dónde se almacenan.
- **Fix:** Documentar: 1) pg_dump diario automatizado, 2) retención de 30 días, 3) almacenamiento en bucket S3/MinIO separado, 4) procedimiento de restore probado.
- **Impacto:** Capacidad de recuperación ante desastres.
- **Esfuerzo:** 4h (configurar + documentar + probar restore).

### 39. No hay secrets rotation
- **Categoría:** Seguridad
- **Riesgo:** Las credenciales (DATABASE_URL, REDIS_URL, CLERK_SECRET_KEY, MINIO credentials) son estáticas. Si una se filtra, no hay mecanismo para rotarla sin downtime.
- **Fix:** Usar un secrets manager (Vault, AWS Secrets Manager, o Coolify's built-in secrets) con rotation policy. Diseñar el sistema para aceptar credential refresh sin restart.
- **Impacto:** Reduce ventana de exposición si un secret se compromete.
- **Esfuerzo:** 1 día.

### 40. Dockerfile copia todo node_modules al API stage
- **Categoría:** Build / Deploy
- **Riesgo:** El stage `api` del Dockerfile copia `COPY --from=builder /app/node_modules ./node_modules` (~500MB). Esto incluye devDependencies y paquetes del frontend que el API no necesita. Aumenta el tamaño de la imagen y el tiempo de deploy.
- **Fix:** Usar `npm ci --omit=dev` en un stage separado para producción, o copiar solo los paquetes que el API bundle necesita (las external dependencies de tsup).
- **Impacto:** Imagen 3-5x más pequeña, deploys más rápidos.
- **Esfuerzo:** 2h.

### 41. No hay test coverage medido en CI
- **Categoría:** Testing
- **Riesgo:** No se sabe qué porcentaje del código está cubierto por tests. No hay forma de detectar si un PR reduce la cobertura. Áreas críticas (ventas, stock, RLS) podrían perder cobertura sin que nadie lo note.
- **Fix:** Agregar `--coverage` a vitest en CI. Publicar reporte en el PR. Establecer threshold mínimo (ej: 70% para rutas críticas).
- **Impacto:** Visibilidad de la calidad del testing.
- **Esfuerzo:** 1h.

---

## Resumen por esfuerzo

| Esfuerzo | Items | IDs |
|----------|-------|-----|
| < 30 min | 4 | #17, #36, #37, #41 |
| 30min - 1h | 7 | #2, #3, #13, #18, #19, #30, #35 |
| 1-2 horas | 8 | #1, #4, #5, #6, #8, #11, #21, #34 |
| 3-4 horas | 9 | #9, #10, #14, #16, #22, #24, #25, #27, #38, #40 |
| 1 día | 5 | #7, #15, #20, #23, #29, #39 |
| Decisión de diseño | 2 | #12, #32 |

---

## Orden recomendado de implementación

### Sprint A (1 día): Integridad de datos + bugs
- #2 Unique constraint SKU
- #3 Quick sales transacción
- #5 Exchange rates date type
- #13 Payment method enum
- #17 Rate limit duplicado (5min fix)
- #37 CSS muerto (5min fix)

### Sprint B (1 día): Seguridad
- #1 FORCE ROW LEVEL SECURITY
- #4 Validación JSONB fields
- #6 ON DELETE strategy en saleItems
- #8 CSRF protection storefront
- #19 x-forwarded-for validación
- #33 Auth en /metrics

### Sprint C (1 día): Performance
- #15 Dashboard endpoint consolidado o two-phase
- #16 Catálogo 6→3 round-trips
- #14 Paginación en reports
- #36 Width/height en imágenes (CLS)
- #35 bcryptjs fuera del frontend

### Sprint D (1 día): Observabilidad + Deployment
- #18 DB health check en /health
- #30 Readiness probe
- #29 OpenTelemetry (inicio)
- #34 Error boundary frontend
- #41 Test coverage en CI

### Sprint E (1 día): Testing
- #23 Tests E2E frontend (Playwright)
- #24 Tests de concurrencia
- #25 Tests de void/return
- #26 Tests de RFM

### Sprint F (1 día): Infraestructura
- #7 PgBouncer
- #21 CDN (Cloudflare)
- #22 Staging environment
- #40 Dockerfile optimizado

### Sprint G (1 día): Hardening largo plazo
- #9 Circuit breaker
- #10 set_config dentro de transacciones
- #20 Partitioning sales/stock_movements
- #38 Backup strategy
- #39 Secrets rotation

---

## Métricas de progreso

| Área | Score actual | Objetivo |
|------|-------------|----------|
| Base de datos | 8.5 | 9.5 |
| Comunicación API↔DB | 8.0 | 9.0 |
| Backend API | 8.0 | 9.0 |
| Frontend | 7.5 | 8.5 |
| Seguridad | 8.0 | 9.0 |
| Infraestructura | 7.0 | 8.5 |
| Testing | 6.5 | 8.0 |
| **TOTAL** | **7.8** | **9.0** |
