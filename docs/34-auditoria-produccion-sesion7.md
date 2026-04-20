# Nova: Auditoria de Produccion - Que Falta para Usuarios Reales

> Revision exhaustiva del codebase en su estado actual (post-sesion 7).
> Clasificado por severidad: bloqueante, importante, nice-to-have.

---

## BLOQUEANTE: No se puede lanzar sin esto

### 1. PWA icons no existen
- `nuxt.config.ts` referencia `/icon-192x192.png` y `/icon-512x512.png`
- `apps/web/public/` solo tiene `favicon.ico` y `robots.txt`
- **Impacto**: La app no se puede instalar como PWA en Android/iOS. El manifest falla.
- **Fix**: Generar iconos desde el logo de Nova (N en dark-pill). 5 minutos con cualquier generador.

### 2. npm audit: 1 critica + 7 high
- `@clerk/shared` 3.x: vulnerabilidad critica (route protection bypass)
- `drizzle-orm` <0.45.2: SQL injection via identificadores
- `xlsx`: vulnerabilidad conocida sin fix (riesgo bajo, solo genera, no parsea)
- `serialize-javascript` en workbox: riesgo bajo (build-time only)
- **Fix**: `npm audit fix` resuelve clerk y drizzle. xlsx no tiene fix pero el riesgo es aceptable.

### 3. No hay body size limit
- Hono no tiene `bodyLimit` configurado
- Un atacante puede enviar un POST con body de 100MB y crashear el servidor
- **Fix**: `app.use("*", bodyLimit({ maxSize: 1024 * 1024 }))` (1MB)

### 4. No hay request timeout
- Si una query de Postgres se cuelga, el request queda abierto indefinidamente
- **Fix**: `app.use("*", timeout(30000))` (30 segundos)

---

## IMPORTANTE: Deberia estar antes de escalar

### 5. Error tracking (Sentry)
- No hay tracking de errores en produccion
- Si algo falla, nadie se entera hasta que un usuario se queja
- **Fix**: Sentry free tier. `@sentry/node` en API, `@sentry/vue` en frontend. 30 min de setup.

### 6. og:image y meta tags para compartir
- No hay og:image. Cuando alguien comparte un link de Nova en WhatsApp, se ve un rectangulo gris
- **Fix**: Crear imagen estatica 1200x630, agregar meta tags en `nuxt.config.ts`

### 7. Backup automatizado de PostgreSQL
- No hay cron de backup. Si el disco falla, se pierde todo
- La infra tiene MinIO en el data plane -- perfecto para guardar backups
- **Fix**: Cron `pg_dump | gzip > minio` diario. 15 min de setup en Coolify.

### 8. Monitoring/alertas
- Health check existe (`/health`) pero nadie lo monitorea
- No hay alertas cuando el API cae o la DB se llena
- **Fix**: Uptime Kuma ya esta en el control plane (segun la infra). Configurar checks para API y Web.

### 9. Recibo PDF individual
- El checkout muestra "Enviar recibo por WhatsApp" (texto plano via wa.me)
- No hay opcion de descargar/imprimir un recibo PDF con detalle de items
- **Fix**: Usar pdfmake (ya instalado) para generar recibo con items, totales, metodo de pago

### 10. Logs estructurados en produccion
- `structuredLogger` existe pero los logs van a stdout
- En produccion necesitan ir a un servicio (Loki, CloudWatch, o al menos un archivo rotado)
- **Fix**: Para empezar, Coolify captura stdout. Suficiente para v1. Loki para v2.

### 11. drizzle-orm upgrade a >=0.45.2
- Vulnerabilidad de SQL injection via identificadores
- Es breaking change pero riesgo bajo segun el changelog
- **Fix**: `npm install drizzle-orm@latest` + correr tests + verificar migraciones

---

## NICE-TO-HAVE: Mejora la experiencia pero no bloquea

### 12. Busqueda global (cmd+k)
- No hay forma rapida de buscar productos, clientes, ventas desde cualquier pagina
- Patron comun en apps modernas (Notion, Linear, Slack)
- **Fix**: Componente modal con input que busca en /products, /customers, /sales

### 13. Devolucion rapida
- Actualmente para devolver hay que anular toda la venta
- Un bodeguero necesita devolver 1 item de una venta de 5 items
- **Fix**: Nuevo endpoint POST /sales/:id/return con items parciales

### 14. Pagina de movimientos de inventario
- Los stock_movements se registran pero no hay UI para verlos
- El dueno no puede ver "quien ajusto el stock y cuando"
- **Fix**: Nueva pagina /inventory/movements con filtros por producto/fecha/tipo

### 15. Charts reales en reportes
- Los reportes usan barras CSS basicas (div con height%)
- No hay tooltips, no hay interactividad
- **Fix**: Chart.js o vue-chartjs para graficos interactivos

### 16. POS con categorias e imagenes
- El grid de productos no tiene tabs de categorias para filtrar
- No hay imagenes de producto (solo inicial del nombre)
- **Fix**: Tabs horizontales con categorias, placeholder de imagen con upload a MinIO

### 17. E2E browser tests
- Solo hay tests unitarios y de integracion (API level)
- No hay tests que verifiquen el flujo completo en el browser
- **Fix**: Playwright con flujos criticos: login -> crear producto -> vender -> verificar stock

### 18. Resend email en produccion
- El email usa `onboarding@resend.dev` como remitente por defecto
- En produccion necesita un dominio verificado en Resend
- **Fix**: Verificar dominio en Resend, configurar RESEND_FROM env var

---

## Estado de seguridad

| Control | Estado | Notas |
|---------|--------|-------|
| RLS tenant isolation | OK | Todas las tablas, policies idempotentes |
| Auth (Clerk JWT) | OK | Middleware en todas las rutas protegidas |
| PIN auth (employees) | OK | bcrypt + lockout 5/15min |
| Rate limiting | OK | Endpoints publicos + API |
| UUID validation | OK | Todos los path params |
| Security headers | OK | Hono secureHeaders() |
| Scanner blocking | OK | /.env, /wp-admin, etc. |
| Graceful shutdown | OK | SIGTERM/SIGINT handlers |
| CORS | OK | Configurable via env var |
| Body size limit | FALTA | Sin limite, riesgo de DoS |
| Request timeout | FALTA | Sin timeout, riesgo de hang |
| npm vulnerabilities | FALTA | 1 critica + 7 high |
| Error tracking | FALTA | Sin Sentry ni alternativa |
| DB backups | FALTA | Sin cron de backup |

---

## Orden recomendado para produccion

### Dia 1: Bloqueantes (2-3 horas)
1. Generar PWA icons y agregarlos a public/
2. `npm audit fix` (clerk + drizzle)
3. Agregar body size limit y request timeout
4. Verificar que el build de Docker funciona con los cambios

### Dia 2: Importantes (3-4 horas)
5. Sentry setup (API + frontend)
6. og:image + meta tags
7. Backup cron de PostgreSQL a MinIO
8. Configurar Uptime Kuma para API y Web
9. Recibo PDF individual

### Dia 3: Calidad (2-3 horas)
10. drizzle-orm upgrade
11. Verificar Resend con dominio propio
12. Revisar logs en Coolify

### Despues del lanzamiento
13-18. Nice-to-have items segun feedback de usuarios
