# Guía: Agregar Métricas Prometheus a un Proyecto

> Paso a paso para integrar `prom-client` en cualquier API Hono/Node.js.
> Después de seguir esta guía, Prometheus scrapea el endpoint `/metrics`
> y Grafana muestra request rate, latencia, y error rate por endpoint.

---

## Prerequisitos

- API basada en Hono (o cualquier framework Node.js)
- Observability Plane corriendo (Prometheus en 10.0.1.50:9090)
- Container con nombre legible en Coolify (Custom Container Name)

---

## Paso 1: Instalar dependencia

```bash
npm install prom-client
```

---

## Paso 2: Crear `src/metrics.ts`

Copiar este archivo tal cual. Funciona para cualquier API Hono:

```typescript
import {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics,
} from "prom-client";
import type { Context, Next } from "hono";

export const metricsRegistry = new Registry();

// Métricas automáticas de Node.js (CPU, RAM, event loop, GC)
collectDefaultMetrics({ register: metricsRegistry });

// Contador de requests
export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "path", "status"] as const,
  registers: [metricsRegistry],
});

// Histograma de latencia
export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "path"] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

// Middleware: mide cada request
export async function metricsMiddleware(c: Context, next: Next) {
  const start = performance.now();
  await next();
  const duration = (performance.now() - start) / 1000;
  const path = c.req.routePath || c.req.path;
  httpRequestsTotal.inc({
    method: c.req.method,
    path,
    status: String(c.res.status),
  });
  httpRequestDuration.observe({ method: c.req.method, path }, duration);
}

// Endpoint: GET /metrics
export async function metricsEndpoint(c: Context) {
  const metrics = await metricsRegistry.metrics();
  return c.text(metrics, 200, {
    "Content-Type": metricsRegistry.contentType,
  });
}
```

---

## Paso 3: Integrar en `app.ts`

```typescript
// Importar
import { metricsMiddleware, metricsEndpoint } from "./metrics";

// Agregar middleware DESPUÉS del logger, ANTES de las rutas:
app.use("*", metricsMiddleware);

// Agregar endpoint junto a /health (sin auth):
app.get("/metrics", metricsEndpoint);
```

---

## Paso 4: Deploy

Commit, push, Coolify redeploya automáticamente.

---

## Paso 5: Verificar

Después del deploy, desde cualquier servidor en la red privada:

```bash
curl http://<container-ip>:3001/metrics | head -20
```

Debes ver algo como:
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/health",status="200"} 142
http_requests_total{method="GET",path="/api/products",status="200"} 89
...
```

---

## Paso 6: Configurar Prometheus (una sola vez por proyecto)

Agregar el target en `/opt/observability/prometheus.yml` del Obs Plane:

```yaml
scrape_configs:
  # ... targets existentes ...
  - job_name: "nova-api"
    scrape_interval: 15s
    static_configs:
      - targets: ["10.0.1.30:3001"]  # IP del App Plane + puerto de la API
        labels:
          project: "nova"
```

Reiniciar Prometheus:
```bash
cd /opt/observability && docker compose restart prometheus
```

---

## Paso 7: Dashboard en Grafana

Queries útiles para el dashboard del proyecto:

| Métrica | PromQL |
|---------|--------|
| Requests/sec | `rate(http_requests_total{project="nova"}[5m])` |
| Error rate | `rate(http_requests_total{project="nova", status=~"5.."}[5m])` |
| Latencia p50 | `histogram_quantile(0.5, rate(http_request_duration_seconds_bucket{project="nova"}[5m]))` |
| Latencia p95 | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{project="nova"}[5m]))` |
| Latencia p99 | `histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{project="nova"}[5m]))` |
| Top endpoints lentos | `topk(5, histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{project="nova"}[5m])))` |
| Memory usage | `process_resident_memory_bytes{job="nova-api"}` |
| Event loop lag | `nodejs_eventloop_lag_seconds{job="nova-api"}` |

---

## Checklist para nuevo proyecto

- [ ] `npm install prom-client`
- [ ] Crear `src/metrics.ts` (copiar de arriba)
- [ ] Agregar `metricsMiddleware` en app.ts
- [ ] Agregar `app.get("/metrics", metricsEndpoint)` en app.ts
- [ ] Deploy
- [ ] Agregar scrape target en Prometheus
- [ ] Verificar con `curl /metrics`
- [ ] Crear dashboard en Grafana (o pedir que lo cree Neo)

---

## Notas Importantes

### Cardinality (evitar explosión de labels)

El middleware usa `c.req.routePath` (el patrón de la ruta, ej: `/api/sales/:id`)
en vez de `c.req.path` (la URL real, ej: `/api/sales/abc-123-def`).

Esto es CRÍTICO. Si usas la URL real, cada UUID genera un label diferente
y Prometheus se llena de series temporales (millones). Siempre usar el patrón.

### Seguridad

El endpoint `/metrics` no tiene autenticación. Esto es intencional:
- Solo es accesible desde la red privada (10.0.1.x)
- Prometheus necesita acceso sin auth para scrapearlo
- No expone datos de usuarios, solo contadores y latencias

### Performance

El overhead del middleware es < 0.1ms por request. Negligible.
`prom-client` usa contadores en memoria — no hace I/O.
