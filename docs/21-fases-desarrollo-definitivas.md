# Nova: Fases de Desarrollo Definitivas

> Orden exacto de construcción, qué se entrega en cada fase, qué tests se escriben, y cuándo se despliega.

---

## Cómo se Desarrolla Profesionalmente

### 3 ambientes, 3 propósitos

| Ambiente | Dónde | Para qué | Cuándo |
|---|---|---|---|
| **Local** | Tu máquina (`npm run dev`) | Desarrollo diario. Ves la app en localhost:3000. Errores en terminal + navegador | Todo el tiempo |
| **CI (GitHub Actions)** | Servidores de GitHub (gratis) | Typecheck + lint + tests automáticos en cada push. Ves errores en el PR | Cada push |
| **Staging (Coolify)** | Hetzner app plane | Verificar que funciona en servidor real (PostgreSQL, Redis, SSL, dominio) | Cada 2-3 semanas (fin de fase) |

### Estrategia de tests: incremental

No se escriben 500 tests antes de codear. Se escribe el feature, se escribe el test del feature, el CI lo corre. Cada fase agrega tests para lo que se construyó.

```
Fase 0: 0 tests (solo CI pipeline funcionando)
Fase 1: ~10 tests (auth, RLS, PIN)
Fase 2: ~25 tests (+ inventario, variantes, importación)
Fase 3: ~45 tests (+ ventas, offline queue, multi-moneda)
Fase 4: ~60 tests (+ clientes, cuentas, cierre de día)
Fase 5: ~75 tests (+ dashboard, reportes, IA)
Fase 6: ~90 tests (+ contabilidad, OCR, matching)
Fase 7: ~100 tests (+ WhatsApp webhook)
Fase 8: ~110 tests (+ gamificación, onboarding)
Fase 9: ~150 tests (hardening: E2E, load, security)
```

### GitHub Actions CI pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: nova_test
          POSTGRES_USER: nova
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        ports: ['6379:6379']

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      
      # Typecheck: atrapa errores de tipos
      - run: npm run typecheck
      
      # Lint: atrapa errores de estilo y bugs comunes
      - run: npm run lint
      
      # Tests unitarios + integración
      - run: npm run test
        env:
          DATABASE_URL: postgresql://nova:test@localhost:5432/nova_test
          REDIS_URL: redis://localhost:6379
      
      # Build: verifica que compila sin errores
      - run: npm run build
```

Esto corre en cada push. Si algo falla, GitHub muestra X roja en el PR. No necesitas servidor propio para esto.

---

## Las Fases

### Fase 0: Proyecto Base (Semana 1)

**Objetivo:** Monorepo funcionando con CI. "Hello World" que compila y pasa tests.

**Tareas:**

```
1. Crear monorepo con Turborepo
   nova/
   ├── apps/
   │   ├── web/          ← nuxt init (Nuxt 4)
   │   └── api/          ← Hono project
   ├── packages/
   │   ├── shared/       ← tipos TypeScript + Zod schemas
   │   └── db/           ← Drizzle ORM + migrations
   ├── turbo.json
   └── package.json

2. Configurar Nuxt 4
   - TypeScript strict
   - Tailwind CSS v4
   - PWA module (@vite-pwa/nuxt)
   - ESLint + Prettier
   - Vitest para tests

3. Configurar Hono
   - TypeScript strict
   - Zod para validación
   - Drizzle ORM para PostgreSQL
   - Vitest para tests

4. Configurar Drizzle ORM
   - Schema inicial: businesses, users
   - Primera migration
   - Seed script con datos de prueba

5. Configurar GitHub Actions CI
   - PostgreSQL 16 + Redis 7 como services
   - Typecheck + lint + test + build

6. Configurar Dexie.js
   - Schema de IndexedDB para cache local
   - Service Worker básico para PWA

7. Docker Compose para desarrollo local
   - PostgreSQL 16 + pgvector + pg_trgm
   - Redis 7
   - MinIO (para storage de imágenes)
```

**Tests en esta fase:**
- CI pipeline funciona (typecheck + lint + build pasan)
- 1 test de health check del API (`GET /health` → 200)
- 1 test de conexión a PostgreSQL
- 1 test de conexión a Redis

**Entregable:** `npm run dev` abre la app en localhost. CI pasa en verde. Monorepo compila.

---

### Fase 1: Auth + Multi-tenant + Modos (Semana 2)

**Objetivo:** Un dueño puede registrar su negocio, crear empleados con PIN, y la app muestra modo Admin vs Empleado.

**Tareas:**

```
1. Integrar Clerk
   - Nuxt Clerk module
   - Registro de usuario (email + password)
   - Login / logout
   - 2FA opcional

2. Onboarding post-registro
   - "¿Qué tipo de negocio tienes?" (selector visual)
   - Crear registro en tabla businesses
   - Pre-configurar categorías por tipo de negocio
   - Pre-configurar catálogo de cuentas contables
   - Crear usuario owner en tabla users (con clerk_id)

3. Sistema de PIN
   - Pantalla de PIN (teclado numérico, 4 dígitos)
   - Crear empleados con nombre + PIN (desde config)
   - Cambio rápido de usuario (tap → PIN → switch)
   - Bloqueo después de 5 intentos fallidos

4. Multi-tenant (RLS)
   - business_id en todas las tablas
   - Políticas RLS en PostgreSQL
   - Middleware en Hono que setea business_id por request
   - Verificar que tenant A no ve datos de tenant B

5. Modos Admin vs Empleado
   - Sidebar condicional (admin ve 8 secciones, empleado ve 4)
   - Protección de rutas (middleware)
   - Header con indicador de usuario y rol
   - Escalación con PIN del dueño (modal)

6. Layout responsive
   - Desktop: sidebar + main area
   - Móvil: bottom tabs + stack
   - Detección por viewport (useMediaQuery)
```

**Tests:**
- Registro crea negocio + usuario owner
- Login con Clerk devuelve JWT válido
- PIN correcto autentica empleado
- PIN incorrecto 5 veces bloquea
- RLS: tenant A no ve datos de tenant B (test crítico)
- Empleado no puede acceder a rutas de admin
- Cambio de usuario mantiene business_id

**Entregable:** App con login, onboarding, PIN, 2 modos visualmente distintos. RLS verificado.

---

### Fase 2: Inventario (Semanas 3-4)

**Objetivo:** Inventario completo con variantes, importación, escáner, y semáforo de stock.

**Tareas:**

```
1. Schema de productos
   - products (padre): name, category_id, cost, price
   - product_variants: sku, stock, cost, price, attributes (JSON)
   - categories: pre-configuradas por tipo de negocio
   - Unidades de medida con factor de conversión

2. CRUD de productos
   - Agregar producto (formulario: nombre + precio mínimo)
   - Editar producto (inline en desktop, formulario en móvil)
   - Variantes (talla, color, referencia)
   - Categorías (dropdown)
   - Foto de producto (upload a MinIO)

3. Lista de inventario
   - Desktop: tabla con columnas (nombre, SKU, stock, costo, precio, margen, estado)
   - Móvil: lista con cards y semáforo
   - Semáforo: verde (OK), amarillo (bajo), rojo (crítico), gris (sin movimiento 60+ días)
   - Búsqueda instantánea con autocompletado
   - Filtros: categoría, estado, proveedor

4. Escáner de código de barras
   - Integrar librería de escaneo (html5-qrcode o similar)
   - Cámara del celular para escanear
   - Buscar producto por código escaneado

5. Importación desde Excel
   - Upload de archivo (CSV, XLSX)
   - Detección automática de columnas por nombre de header
   - Mapeo manual como fallback
   - Preview de primeros 5 registros
   - Validación (precios faltantes, duplicados, SKUs existentes)
   - Solo disponible en desktop

6. Cache en IndexedDB
   - Productos se cachean en Dexie.js después de cada fetch
   - Búsqueda funciona desde cache (sin internet)
   - Indicador de última sincronización
```

**Tests:**
- CRUD de productos (crear, leer, actualizar, eliminar)
- Variantes se crean correctamente (padre + hijos)
- Importación Excel mapea columnas correctamente
- Importación detecta duplicados
- Semáforo calcula estado correcto (verde/amarillo/rojo/gris)
- Búsqueda encuentra por nombre, SKU, categoría
- RLS: productos de tenant A no aparecen en tenant B

**Entregable:** Inventario completo en desktop y móvil. Importación desde Excel. Escáner de barras.

---

### Fase 3: Ventas (Semanas 5-6)

**Objetivo:** Registrar ventas en 3-4 toques. Funciona sin internet. Tasa BCV automática.

**Tareas:**

```
1. Pantalla de venta
   - Grid de productos (más vendidos primero, ordenados por frecuencia)
   - Búsqueda + escáner de barras
   - Ticket activo (lista de items con cantidad editable)
   - Descuentos por línea y por total
   - Selección de cliente (para fiado)

2. Checkout
   - Selector de método de pago (7 métodos con iconos grandes)
   - Si fiado: vincula a cliente, genera cuenta por cobrar
   - Confirmar → venta registrada
   - Opción: enviar recibo por WhatsApp (link wa.me)

3. Historial de ventas
   - Lista filtrable: fecha, vendedor (PIN), método de pago, producto
   - Detalle de cada venta
   - Anulación con motivo obligatorio + PIN del dueño

4. Tasa BCV automática
   - Cron job o scraper que obtiene tasa BCV diaria
   - Cache en Redis (se consulta una vez, se usa todo el día)
   - Precios en USD, cobro en Bs. con conversión automática
   - Historial de tasa por transacción

5. Cola de ventas offline
   - Ventas sin internet se guardan en IndexedDB (Dexie.js)
   - Flag synced: false
   - Cuando vuelve internet: se envían en orden (FIFO)
   - Indicador: "3 ventas pendientes de sincronizar"
   - Resolución: servidor es fuente de verdad

6. Cotizaciones
   - Crear cotización (misma interfaz que venta)
   - Enviar por WhatsApp (link wa.me con PDF o texto)
   - Convertir cotización en venta (un toque)
```

**Tests:**
- Venta registra correctamente (items, total, método de pago, vendedor)
- Venta descuenta inventario
- Fiado genera cuenta por cobrar vinculada al cliente
- Anulación requiere PIN del dueño
- Anulación restaura inventario
- Tasa BCV se aplica correctamente a conversión Bs./USD
- Cola offline: venta se guarda en IndexedDB cuando no hay internet
- Cola offline: venta se sincroniza cuando vuelve internet
- Descuento calcula total correctamente

**Entregable:** Se puede vender en 3-4 toques. Funciona sin internet. Tasa BCV automática.

---

### Fase 4: Clientes + Cuentas (Semanas 7-8)

**Objetivo:** CRM básico con segmentos. Cuentas con cobro por WhatsApp. Cierre de día.

**Tareas:**

```
1. Clientes
   - Perfil automático: historial de compras, frecuencia, ticket promedio, productos favoritos
   - Segmentos automáticos: VIP, frecuentes, en riesgo, nuevos, con deuda, inactivos
   - Badges visuales en toda la app
   - Búsqueda instantánea
   - Notas del vendedor

2. Cuentas por cobrar
   - Lista con código de color por antigüedad (verde/amarillo/rojo)
   - Cobro por WhatsApp: genera link wa.me con mensaje personalizado
   - Cobro masivo: "Cobrar a todos los vencidos"
   - Registro de pagos con conciliación básica
   - Total pendiente visible

3. Cuentas por pagar
   - Lista de deudas con proveedores
   - Marcar como pagado
   - Historial de pagos

4. Cierre de día
   - Cuadre de caja: usuario ingresa efectivo contado
   - Nova compara con ventas registradas
   - Diferencia: ofrece registrar venta genérica o faltante
   - Genera resumen del día
   - Genera asientos contables
   - Envía resumen por push notification
   - Resetea fondo de caja
```

**Tests:**
- Perfil de cliente calcula frecuencia y ticket promedio correctamente
- Segmentos se asignan automáticamente (VIP = top 10%, en riesgo = 30+ días sin compra)
- Cobro por WhatsApp genera link correcto con monto y nombre
- Pago registrado reduce saldo del cliente
- Cierre de día detecta diferencia entre caja contada y ventas registradas
- Cierre genera asientos contables correctos

**Entregable:** CRM con segmentos. Cobros por WhatsApp. Cierre de día con cuadre.

---

### Fase 5: Dashboard + Reportes (Semanas 9-10)

**Objetivo:** Dashboard con progressive disclosure. 7 reportes con IA. Resumen diario automático.

**Tareas:**

```
1. Dashboard (progressive disclosure)
   - Nivel 1: número grande (ventas del día) + tendencia + 2 tarjetas + alertas accionables
   - Nivel 2 (scroll): gráfico semanal + narrativa IA
   - Alertas con sugerencia + botón de acción
   - Estado de sincronización visible
   - Última acción realizada

2. 7 reportes pre-construidos
   - Resumen del día
   - Resumen semanal/mensual
   - Rentabilidad por producto
   - Movimiento de inventario
   - Cuentas por cobrar aging
   - Ventas por vendedor
   - Resumen financiero (P&L simplificado)

3. Cada reporte tiene:
   - Gráfico (Chart.js o Apache ECharts)
   - Tabla con datos
   - Narrativa IA (OpenRouter → GPT-4o-mini)
   - Selector de periodo
   - Exportación PDF (jsPDF) y Excel (SheetJS)
   - Botón "Enviar al contador por WhatsApp"
   - Montos en USD + Bs.

4. Resumen diario automático
   - Cron job a las 9pm
   - Genera resumen para cada negocio activo
   - Envía por push notification
   - (WhatsApp se agrega en Fase 7)

5. Predicciones e inteligencia
   - Predicción de agotamiento por producto ("se acaba en ~X días")
   - Comparativas automáticas (periodo vs periodo)
   - Detección de anomalías (anulaciones inusuales, ventas atípicas)
   - Alertas predictivas de flujo de caja
```

**Tests:**
- Dashboard muestra ventas del día correctamente
- Comparativa calcula % de cambio vs periodo anterior
- Reporte P&L suma ingresos - costos - gastos = ganancia correctamente
- Narrativa IA se genera sin errores (mock de OpenRouter en tests)
- Exportación PDF genera archivo válido
- Predicción de agotamiento calcula días restantes basado en velocidad de venta
- Anomalía detecta anulaciones por encima del promedio

**Entregable:** Dashboard operacional. 7 reportes con IA. Resumen diario.

---

### Fase 6: Contabilidad + OCR (Semanas 11-12)

**Objetivo:** Puente contable completo. OCR de facturas con matching inteligente.

**Tareas:**

```
1. Contabilidad
   - Catálogo de cuentas pre-configurado por tipo de negocio
   - Asientos automáticos desde ventas, gastos, pagos (invisible para el usuario)
   - Exportación: Excel con formato libro diario (fecha, cuenta, debe, haber)
   - Botón "Enviar al contador" (genera paquete + abre WhatsApp)
   - Libros de compras/ventas formato SENIAT _(eliminado: Nova es para comercio informal)_

2. OCR de facturas
   - Botón "Escanear factura" → cámara PWA (resolución completa)
   - Enviar imagen a GPT-4o-mini vision (vía OpenRouter)
   - Structured output: proveedor, fecha, items con cantidad y precio
   - Matching con inventario:
     a. Buscar en product_aliases (match aprendido)
     b. Buscar por SKU exacto
     c. Fuzzy match con pg_trgm
     d. Si no hay match: formulario de producto nuevo pre-llenado
   - Validación matemática (qty × price = line_total)
   - Usuario confirma → transacción atómica: gasto + stock + aliases + asientos
   - Tabla product_aliases para aprendizaje por proveedor

3. Historial de precios
   - Cada cambio de costo/precio se registra con fecha
   - Alerta cuando costo sube y precio de venta no se ajustó
```

**Tests:**
- Asientos contables se generan correctamente desde ventas y gastos
- Exportación Excel tiene formato de libro diario válido
- OCR extrae datos de factura de prueba (imagen mock)
- Matching por alias funciona (alias existente → match directo)
- Matching por SKU funciona (SKU exacto → match directo)
- Fuzzy match sugiere producto correcto (similitud > 0.6)
- Producto nuevo se crea con datos pre-llenados de la factura
- Validación matemática detecta discrepancia en totales
- Transacción atómica: si falla un paso, nada se guarda

**Entregable:** Puente contable. OCR de facturas con matching. Historial de precios.

---

### Fase 7: WhatsApp Bidireccional (Semana 13)

**Objetivo:** WhatsApp funcional como canal de entrada y salida.

**Tareas:**

```
1. Configurar Meta Cloud API
   - Cuenta Facebook Business
   - App en Meta for Developers
   - Número de teléfono dedicado
   - Webhook HTTPS (endpoint en Hono)

2. Mensajes salientes
   - Resúmenes diarios (cron 9pm) → WhatsApp del dueño
   - Alertas críticas → WhatsApp del dueño
   - Cobros a clientes (cuando el dueño toca "Cobrar")
   - Reportes al contador (PDF adjunto)

3. Mensajes entrantes
   - Webhook handler en Hono
   - Identificación por teléfono (tabla users)
   - LLM interpreta mensaje → acción estructurada
   - Consultas de solo lectura (ventas, inventario, deudas)
   - Acciones con confirmación (cobrar, cambiar precio)
   - Rate limiting (30/hora)
   - Log de todas las acciones

4. Seguridad
   - Verificación de firma del webhook
   - Solo usuarios con whatsapp_enabled
   - Empleados: solo lectura
   - PIN para acciones críticas (>$100)
```

**Tests:**
- Webhook verifica firma de Meta correctamente
- Mensaje de número no registrado → respuesta de rechazo
- Consulta "cuánto vendí hoy" → respuesta con datos correctos
- Acción "cobra a Juan" → pide confirmación → ejecuta al confirmar
- Rate limiting bloquea después de 30 mensajes/hora
- Empleado no puede ejecutar acciones de modificación

**Entregable:** WhatsApp bidireccional funcionando.

---

### Fase 8: Gamificación + Pulido (Semana 14)

**Objetivo:** Producto pulido con detalles de calidad.

**Tareas:**

```
1. Gamificación
   - Ranking de vendedores (diario, semanal)
   - Meta del día con barra de progreso
   - Rachas (días consecutivos superando meta)
   - Vista del empleado: su rendimiento al hacer login

2. Onboarding interactivo
   - Tutorial dentro de la app con datos reales
   - Guía paso a paso: primera venta, primer producto, primer cobro
   - Tips contextuales (primera vez en cada sección)

3. Pulido general
   - Animaciones de transición (suaves, no excesivas)
   - Estados vacíos ("Aún no tienes productos. Agrega el primero")
   - Mensajes de error claros y accionables
   - Loading states (skeleton screens, no spinners)
   - Accesibilidad básica (contraste, tamaños de fuente, labels)

4. Backups visibles
   - Indicador: "Último respaldo: hace 2 horas"
   - Cron de pg_dump diario a MinIO

5. Benchmark anónimo (si hay suficientes negocios en beta)
   - Comparar métricas vs promedio de negocios similares
   - Datos 100% anonimizados y agregados
```

**Tests:**
- Ranking calcula posiciones correctamente
- Meta del día muestra progreso correcto
- Racha se incrementa al superar meta y se resetea al fallar
- Onboarding se muestra solo la primera vez

**Entregable:** Producto pulido, gamificación, onboarding interactivo.

---

### Fase 9: Testing + Hardening (Semanas 15-16)

**Objetivo:** Producto robusto, seguro, y monitoreado.

**Tareas:**

```
1. Tests E2E (Playwright)
   - Flujo completo: registro → onboarding → agregar producto → venta → cobro → cierre de día
   - Flujo de empleado: PIN → venta → intento de acceder a admin → bloqueado
   - Flujo offline: desconectar → venta → reconectar → sincroniza
   - Flujo OCR: escanear factura → confirmar → stock actualizado

2. Tests de seguridad
   - RLS: 10 tests que verifican aislamiento entre tenants
   - SQL injection: intentos en todos los inputs
   - XSS: intentos en campos de texto
   - Rate limiting: verificar que bloquea después del límite
   - JWT: verificar expiración y refresh

3. Load testing (k6)
   - 100 usuarios concurrentes registrando ventas
   - Verificar que p95 latency < 2 segundos
   - Verificar que no hay errores bajo carga

4. Performance
   - Lighthouse score > 90 en móvil
   - Tiempo de carga < 2s en 3G simulado
   - Bundle size < 500KB (gzipped)

5. Monitoreo
   - Sentry para error tracking
   - Health checks en Hono (/health)
   - Uptime Kuma (ya en control plane)
   - Alertas por Slack/email si algo falla

6. Primer deploy a staging (Coolify)
   - Configurar app en Coolify
   - Variables de entorno (PostgreSQL, Redis, Clerk, OpenRouter, Meta)
   - Dominio staging.nova.app + SSL
   - Verificar que todo funciona en servidor real
```

**Tests totales al final de esta fase:** ~150

**Entregable:** Suite de tests completa. Monitoreo configurado. Deploy a staging funcionando.

---

### Fase 10: Beta + Launch (Semanas 17-18)

**Objetivo:** Nova en producción con usuarios reales.

**Tareas:**

```
1. Deploy a producción
   - Configurar app en Coolify (producción)
   - Dominio nova.app + SSL
   - Variables de entorno de producción
   - PostgreSQL de producción (migrations)
   - Redis de producción

2. Beta cerrada (5-10 negocios)
   - Reclutar: ferreterías, bodegas, tiendas de ropa reales
   - Onboarding asistido (ayudar a configurar)
   - Feedback diario: qué funciona, qué confunde, qué falta
   - Fixes rápidos basados en feedback

3. Ajustes post-beta
   - Corregir bugs encontrados
   - Ajustar UX basado en feedback
   - Optimizar queries lentas
   - Ajustar textos y mensajes

4. Landing page
   - Página simple en nova.app (puede ser una ruta de Nuxt)
   - Qué es Nova, para quién, pricing, registro

5. Launch público
   - Plan gratis habilitado
   - Planes Pro y Negocio habilitados (Stripe o similar)
   - Monitoreo activo las primeras 48 horas
```

**Entregable:** Nova en producción. Usuarios reales. Revenue.

---

## Timeline Visual

```
S1  ████ Fase 0: Setup (monorepo, CI, DB)
S2  ████ Fase 1: Auth + Multi-tenant + PIN + Modos
S3  ████████ Fase 2: Inventario
S4  ████████ 
S5  ████████ Fase 3: Ventas
S6  ████████
S7  ████████ Fase 4: Clientes + Cuentas
S8  ████████
S9  ████████ Fase 5: Dashboard + Reportes
S10 ████████
S11 ████████ Fase 6: Contabilidad + OCR
S12 ████████
S13 ████ Fase 7: WhatsApp
S14 ████ Fase 8: Gamificación + Pulido
S15 ████████ Fase 9: Testing + Hardening + Staging deploy
S16 ████████
S17 ████████ Fase 10: Beta + Launch
S18 ████████
```

**Total: 18 semanas. ~150 tests. 1 producto en producción.**
