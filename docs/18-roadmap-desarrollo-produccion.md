# Nova: Roadmap de Desarrollo y Guía de Producción

---

## Qué Está Listo y Qué Falta

### Listo (17 docs, 6,000+ líneas)

Todo el QUÉ está documentado: features, UX, arquitectura, stack, decisiones técnicas, wireframes, comparaciones, pipeline OCR, WhatsApp, multi-tenant, dashboard.

### Falta (el CÓMO)

El código. Pero no se pre-elabora en documentos -- se descubre codeando. Lo único que vale documentar antes es el orden de construcción y las prácticas de producción.

---

## Roadmap de Desarrollo

### Fase 0: Setup (1 semana)

- Crear proyecto Nuxt 4 con TypeScript, Tailwind CSS v4, PWA module
- Crear proyecto Hono con TypeScript
- Monorepo: frontend + backend en el mismo repo
- Configurar PostgreSQL con RLS, pg_trgm, pgvector en data plane
- Configurar Dexie.js para IndexedDB
- Configurar Coolify para deploy automático desde GitHub
- Configurar dominio + SSL en Traefik
- ESLint, Prettier, CI básico en GitHub Actions (lint + typecheck en cada PR)
- Estructura de carpetas y convenciones de código
- Drizzle ORM para migrations de PostgreSQL

**Entregable:** Proyecto vacío que hace deploy automático a staging. "Hello World" en producción.

### Fase 1: Auth + Multi-tenant (1 semana)

- Registro de negocio (onboarding: tipo de negocio → pre-configuración automática)
- Login con email + password
- JWT con refresh tokens (almacenados en Redis)
- RLS policies en PostgreSQL (business_id en cada tabla)
- Middleware de tenant en Hono (setea business_id por request)
- 2 roles: Dueño (ve todo) + Empleado (solo vende, PIN propio)
- 2FA por email para Dueño
- Rate limiting por tenant en Hono

**Entregable:** Un usuario puede registrar su negocio, hacer login, y crear empleados con PIN. RLS verificado: un tenant no ve datos de otro.

### Fase 2: Inventario (2 semanas)

- CRUD de productos con variantes (padre → hijos con SKU, stock, costo, precio)
- Categorías pre-configuradas por tipo de negocio (editables)
- Unidades de medida con conversión (caja → unidades)
- Importación desde Excel con mapeo inteligente de columnas (solo desktop)
- Semáforo de stock (verde/amarillo/rojo/gris)
- Búsqueda con autocompletado + escáner de código de barras (cámara)
- Edición inline en tabla (desktop)
- Lista con swipe para acciones (móvil)
- Fechas de vencimiento con alertas
- Cache en IndexedDB (productos disponibles sin internet)

**Entregable:** Inventario completo funcionando en desktop y móvil. Importación desde Excel. Escáner de barras.

### Fase 3: Ventas (2 semanas)

- Pantalla de venta: grid de más vendidos (ordenados por frecuencia) + búsqueda + escáner
- Ticket activo con edición de cantidad, descuentos por línea y por total
- 7 métodos de pago: efectivo, Pago Móvil, Binance, Zinli, transferencia, Zelle, fiado
- Fiado vinculado a cliente (genera cuenta por cobrar automáticamente)
- Cotizaciones: crear, enviar por WhatsApp, convertir en venta
- Historial de ventas con filtros (fecha, vendedor, método de pago, producto)
- Anulación de ventas con motivo obligatorio (queda en log)
- PIN por empleado en cada venta (accountability)
- Cola de ventas offline (IndexedDB → sync cuando hay internet)
- Tasa BCV automática (scraper/API → cache en Redis → actualización diaria)
- Multi-moneda: precios en USD, cobro en Bs. con conversión automática

**Entregable:** Se puede vender en 3-4 toques. Funciona sin internet. Tasa BCV automática.

### Fase 4: Clientes + Cuentas (2 semanas)

- Perfil automático de cliente: historial de compras, frecuencia, ticket promedio, productos favoritos, saldo
- Segmentos automáticos: VIP, frecuentes, en riesgo, nuevos, con deuda, inactivos
- Badges visuales en toda la app
- Cuentas por cobrar / por pagar con código de color por antigüedad
- Cobro por WhatsApp (generador de links wa.me con mensaje personalizado)
- Cobro masivo ("Cobrar a todos los vencidos")
- Registro de pagos con conciliación básica
- Cuadre de caja / cierre de día automático
- Detección de discrepancias ("caja debería tener $420, se registraron $405")
- Resumen de cierre al dueño por push notification

**Entregable:** CRM básico con segmentos. Cuentas con cobro por WhatsApp. Cierre de día con cuadre.

### Fase 5: Dashboard + Reportes (2 semanas)

- Dashboard con progressive disclosure:
  - Nivel 1: número grande (ventas del día) + tendencia + 2 tarjetas + alertas accionables
  - Nivel 2 (scroll): gráfico semanal + narrativa IA + detalle
- Alertas con sugerencia + botón de acción
- 7 reportes pre-construidos con gráficos (Chart.js / Apache ECharts)
- Narrativa IA por reporte (OpenRouter → GPT-4o-mini)
- Selector de periodo (hoy, semana, mes, rango)
- Exportación PDF (jsPDF) y Excel (SheetJS)
- Comparativas automáticas (periodo vs periodo)
- Resumen diario automático por push notification (9pm)
- Todos los montos en USD + Bs. con tasa BCV

**Entregable:** Dashboard operacional. 7 reportes con IA. Exportación. Resumen diario automático.

### Fase 6: Contabilidad + OCR (2 semanas)

- Catálogo de cuentas pre-configurado por tipo de negocio
- Asientos automáticos desde ventas, gastos, pagos (invisible para el usuario)
- Exportación contable: Excel con formato libro diario (fecha, cuenta, debe, haber)
- Botón "Enviar al contador" (genera paquete + abre WhatsApp)
- Libros de compras/ventas formato SENIAT _(eliminado: Nova es para comercio informal)_
- OCR de facturas: cámara PWA → GPT-4o-mini vision (vía OpenRouter) → matching con inventario → confirmación → registro
- Matching: alias exacto → SKU exacto → fuzzy (pg_trgm) → producto nuevo
- Tabla de aliases por proveedor (aprendizaje automático)
- Validación matemática (qty × price = line_total, suma = total)

**Entregable:** Puente contable completo. OCR de facturas con matching inteligente.

### Fase 7: WhatsApp bidireccional (1 semana)

- Configurar Meta Cloud API (cuenta Facebook Business + webhook HTTPS)
- Mensajes salientes: resúmenes diarios, alertas críticas, cobros a clientes, reportes al contador
- Mensajes entrantes: LLM (GPT-4o-mini vía OpenRouter) interpreta → ejecuta acción → responde
- Confirmación antes de cualquier acción que modifique datos
- Cola de mensajes salientes en Redis
- Fallback: si OpenRouter falla, Groq para texto (sin vision)

**Entregable:** WhatsApp funcional como canal de entrada y salida.

### Fase 8: Gamificación + Pulido (1 semana)

- Ranking de vendedores (diario, semanal)
- Meta del día con barra de progreso
- Rachas y logros
- Log de actividad completo (filtrable por usuario, fecha, acción)
- Backups automáticos con indicador visible ("Último respaldo: hace 2h")
- Onboarding interactivo (tutorial dentro de la app con datos reales)
- Historial de precios por producto con alertas de margen
- Alertas predictivas de flujo de caja
- Estado de sincronización visible ("Actualizado hace 2 min" / "3 ventas pendientes")

**Entregable:** Producto pulido con gamificación, onboarding, y detalles de calidad.

### Fase 9: Testing + Hardening (2 semanas)

- Tests unitarios (Vitest) para lógica de negocio: ventas, inventario, cuentas, RLS, multi-moneda
- Tests E2E (Playwright) para flujos críticos: registro → venta → cobro → cierre de día
- Test de RLS: verificar que tenant A no ve datos de tenant B
- Test de offline: registrar ventas sin internet, verificar sync al reconectar
- Test de OCR con 20+ facturas reales venezolanas (diferentes formatos, proveedores)
- Load testing (k6): verificar que aguanta 100 usuarios concurrentes sin degradación
- Security audit: SQL injection, XSS, CSRF, rate limiting, JWT expiration
- Monitoreo: health checks en Hono, error tracking (Sentry), uptime monitoring
- Performance: Lighthouse score >90 en móvil, <2s de carga en 3G simulado

**Entregable:** Suite de tests. Monitoreo configurado. Security audit pasado.

### Fase 10: Beta + Launch (2 semanas)

- Deploy a producción en Hetzner vía Coolify
- 5-10 negocios beta (ferreterías, bodegas, tiendas de ropa reales)
- Feedback loop diario: qué funciona, qué confunde, qué falta
- Fixes y ajustes basados en feedback
- Landing page (puede ser una página simple en el mismo Nuxt)
- Plan gratis habilitado (1 usuario, 50 productos)
- Documentación de usuario básica (FAQ, guía rápida)
- Launch público

**Entregable:** Nova en producción con usuarios reales pagando.

---

## Timeline

```
Semana  1     : Fase 0 - Setup
Semana  2     : Fase 1 - Auth + Multi-tenant
Semana  3-4   : Fase 2 - Inventario
Semana  5-6   : Fase 3 - Ventas
Semana  7-8   : Fase 4 - Clientes + Cuentas
Semana  9-10  : Fase 5 - Dashboard + Reportes
Semana  11-12 : Fase 6 - Contabilidad + OCR
Semana  13    : Fase 7 - WhatsApp bidireccional
Semana  14    : Fase 8 - Gamificación + Pulido
Semana  15-16 : Fase 9 - Testing + Hardening
Semana  17-18 : Fase 10 - Beta + Launch
─────────────────────────────────────────────
Total: 18 semanas (~4.5 meses) para v1.0
```

---

## Prácticas de Desarrollo para Producción

### 1. Monorepo

```
nova/
├── apps/
│   ├── web/              ← Nuxt 4 (frontend)
│   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── composables/
│   │   │   ├── layouts/
│   │   │   ├── pages/
│   │   │   └── plugins/
│   │   ├── public/
│   │   ├── server/       ← API routes de Nuxt (si se usa)
│   │   └── nuxt.config.ts
│   └── api/              ← Hono (backend)
│       ├── src/
│       │   ├── routes/
│       │   ├── middleware/
│       │   ├── services/
│       │   └── index.ts
│       └── package.json
├── packages/
│   ├── shared/           ← Tipos TypeScript compartidos
│   │   ├── types/
│   │   ├── schemas/      ← Zod schemas (validación + tipos)
│   │   └── constants/
│   └── db/               ← Drizzle ORM schemas + migrations
│       ├── schema/
│       ├── migrations/
│       └── seed/
├── docker-compose.yml
├── package.json          ← workspace root
└── turbo.json            ← Turborepo config
```

### 2. TypeScript estricto

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true
  }
}
```

Tipos compartidos entre frontend y backend via `packages/shared`. Zod schemas para validación de inputs en API Y para structured output del LLM. Un solo schema define el tipo TypeScript, la validación del API, y el JSON schema del LLM.

### 3. Database migrations

Drizzle ORM para schema de PostgreSQL. Migrations versionadas en el repo. Nunca SQL manual en producción.

```typescript
// packages/db/schema/products.ts
export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id').notNull().references(() => businesses.id),
  name: text('name').notNull(),
  sku: text('sku'),
  cost: numeric('cost', { precision: 12, scale: 2 }),
  price: numeric('price', { precision: 12, scale: 2 }),
  stock: integer('stock').default(0),
  categoryId: uuid('category_id').references(() => categories.id),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### 4. CI/CD desde el día 1

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run typecheck    # tsc --noEmit
      - run: npm run lint         # eslint
      - run: npm run test         # vitest
```

Deploy automático a staging en cada merge a main (Coolify webhook). Deploy a producción: manual (botón en Coolify) después de verificar staging.

### 5. Environments

| Environment | URL | Deploy | Base de datos |
|---|---|---|---|
| Local | localhost:3000 | Manual (npm run dev) | PostgreSQL local o Docker |
| Staging | staging.nova.app | Automático (merge a main) | PostgreSQL en data plane (schema separado o DB separada) |
| Producción | nova.app | Manual (botón Coolify) | PostgreSQL en data plane (schema de producción) |

### 6. Error tracking

Sentry desde el día 1. Cada error captura: usuario, negocio (tenant), acción, stack trace, request context.

```typescript
// apps/api/src/middleware/error.ts
app.onError((err, c) => {
  Sentry.captureException(err, {
    extra: {
      businessId: c.get('businessId'),
      userId: c.get('userId'),
      path: c.req.path,
      method: c.req.method,
    }
  });
  return c.json({ error: 'Internal server error' }, 500);
});
```

### 7. Logging estructurado

JSON logs con request ID, tenant ID, user ID. Facilita debugging en multi-tenant.

```typescript
// Cada request tiene un ID único
app.use('*', async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-Id', requestId);
  
  const start = Date.now();
  await next();
  
  console.log(JSON.stringify({
    requestId,
    businessId: c.get('businessId'),
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration: Date.now() - start,
  }));
});
```

### 8. Rate limiting

```typescript
// Por tenant: 100 requests/minuto
// Por endpoint de OCR: 10 requests/minuto (más costoso)
// Por endpoint de WhatsApp: 30 requests/minuto
app.use('/api/*', rateLimiter({
  windowMs: 60_000,
  max: 100,
  keyGenerator: (c) => c.get('businessId'),
}));
```

### 9. Backups

- PostgreSQL: `pg_dump` diario a MinIO (cron en el data plane)
- Retención: 30 días
- Verificar restore mensualmente (script automatizado)
- MinIO: replicación a segundo bucket (si el volumen lo justifica)

### 10. Monitoreo

| Qué | Herramienta | Alerta |
|---|---|---|
| Errores de app | Sentry | Slack/email en cada error nuevo |
| Uptime | Uptime Kuma (ya en control plane) | Slack si cae >1 min |
| Performance API | Logs + métricas custom | Si p95 latency >2s |
| PostgreSQL | pg_stat_statements | Si queries lentas >500ms |
| Redis | Redis INFO | Si memoria >80% |
| Disco | df | Si disco >85% |
| SSL | Traefik | Si certificado expira en <14 días |

---

## Después de v1.0

### v2.0 (3 meses después de launch)

Basado en feedback de beta + métricas de uso:
- Integración Pago Móvil C2P (cobro directo)
- Campañas WhatsApp con segmentación avanzada
- Cotizaciones con aprobación online
- Programa de lealtad simple ("Compra 10, el 11 gratis")
- Órdenes de compra a proveedores
- Formatos contables Galac/Profit Plus
- Página de catálogo para clientes (v2 feature)
- PaddleOCR self-hosted si el volumen de OCR lo justifica

### v3.0 (4 meses después de v2)

- Multi-sucursal con transferencias de inventario
- API REST pública
- Tienda online básica
- Expansión LATAM (Colombia, Ecuador, Perú)
