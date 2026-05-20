# Sprint 5: Dashboard Endpoint Consolidation

> **Item #15 del roadmap de debilidades**
> **Esfuerzo estimado:** 4-5 horas
> **Riesgo:** Bajo (endpoint nuevo, no modifica los existentes)

---

## Problema

El dashboard (`apps/web/app/pages/index.vue`) hace **12 API calls en paralelo** al montar:

```
/api/reports/daily
/api/reports/weekly?period=week
/api/reports/financial?period=month
/api/accounts/receivable
/api/reports/inventory
/api/reports/alerts
/api/exchange-rate
/api/reports/cash-flow
/api/orders?status=pending&limit=5
/api/sales?limit=5
/api/store-settings
/api/store-stats
```

En conexiones 3G venezolanas (300-500ms RTT por request), esto resulta en:
- 12 conexiones TCP simultáneas (HTTP/2 multiplexa, pero el overhead de headers + TLS sigue)
- ~3-5 segundos de skeleton visible
- Saturación del ancho de banda disponible (~500KB de responses combinados)

## Solución: `GET /api/dashboard`

Un endpoint consolidado que ejecuta todas las queries en paralelo **en el servidor** (donde la latencia a PostgreSQL es <5ms) y devuelve un único JSON.

### Arquitectura

```
ANTES:
  Browser ──12 requests──→ API ──12 queries──→ PostgreSQL
  (300ms x 12 = 3.6s de latencia de red)

DESPUÉS:
  Browser ──1 request──→ API ──12 queries en paralelo──→ PostgreSQL
  (300ms x 1 = 300ms de latencia de red + ~20ms de queries)
```

### Response Schema

```typescript
interface DashboardResponse {
  // Ventas del día
  today: {
    totalSales: number;      // USD
    totalCount: number;      // # ventas
    avgTicket: number;       // USD
    totalProfit: number;     // USD
    vsSameDayLastWeek: number; // % cambio
    topProducts: Array<{ name: string; quantity: number }>;
    salesByMethod: Record<string, number>;
  };

  // Gráfico semanal
  weekly: {
    dailyBreakdown: Array<{ day: string; amount: number }>;
  };

  // Financiero
  financial: {
    grossMargin: number; // %
  };

  // Cuentas por cobrar
  receivable: {
    totalPending: number;
    accounts: Array<{
      id: string;
      customerName: string;
      customerPhone: string | null;
      balanceUsd: string;
      dueDate: string | null;
      createdAt: string;
    }>;
  };

  // Inventario
  inventory: {
    lowStock: number;
    criticalStock: number;
  };

  // Alertas inteligentes
  alerts: Array<{
    id: string;
    icon: string;
    title: string;
    suggestion: string;
    actionLabel: string;
    actionTo: string;
    severity: "critical" | "warning" | "info";
  }>;

  // Tasa de cambio
  exchangeRate: {
    rateBcv: number;
    rateEur: number | null;
  } | null;

  // Flujo de caja
  cashFlow: {
    projection7d: { net: number };
  };

  // Pedidos pendientes
  orders: {
    pending: Array<{
      id: string;
      customerName: string;
      customerPhone: string;
      total: number;
      paymentMethod: string;
      createdAt: string;
    }>;
    pendingCount: number;
  };

  // Ventas recientes
  recentSales: Array<{
    id: string;
    totalUsd: string;
    channel: string;
    createdAt: string;
  }>;

  // Tienda online
  store: {
    enabled: boolean;
    ordersThisWeek: number;
    revenueThisWeek: number;
  };
}
```

### Implementación

#### 1. Crear `apps/api/src/routes/dashboard.ts`

```typescript
import { Hono } from "hono";
import type { AppEnv } from "../types";

export const dashboardRoutes = new Hono<AppEnv>();

dashboardRoutes.get("/dashboard", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");
  const user = c.get("user");

  // Execute all queries in parallel — server-side latency is <5ms each
  const [
    daily,
    weekly,
    financial,
    receivable,
    inventory,
    alerts,
    rate,
    cashFlow,
    pendingOrders,
    recentSales,
    storeSettings,
    storeStats,
  ] = await Promise.allSettled([
    fetchDailyReport(db, businessId),
    fetchWeeklyReport(db, businessId),
    fetchFinancialReport(db, businessId),
    fetchReceivable(db, businessId),
    fetchInventoryReport(db, businessId),
    fetchAlerts(db, businessId),
    fetchExchangeRate(businessId),
    fetchCashFlow(db, businessId),
    fetchPendingOrders(db, businessId),
    fetchRecentSales(db, businessId),
    fetchStoreSettings(db, businessId),
    fetchStoreStats(db, businessId),
  ]);

  // Build response — each section is independent, failures are isolated
  return c.json({
    today: daily.status === "fulfilled" ? daily.value : null,
    weekly: weekly.status === "fulfilled" ? weekly.value : null,
    financial: financial.status === "fulfilled" ? financial.value : null,
    receivable: receivable.status === "fulfilled" ? receivable.value : null,
    inventory: inventory.status === "fulfilled" ? inventory.value : null,
    alerts: alerts.status === "fulfilled" ? alerts.value : [],
    exchangeRate: rate.status === "fulfilled" ? rate.value : null,
    cashFlow: cashFlow.status === "fulfilled" ? cashFlow.value : null,
    orders: pendingOrders.status === "fulfilled" ? pendingOrders.value : null,
    recentSales: recentSales.status === "fulfilled" ? recentSales.value : [],
    store: storeSettings.status === "fulfilled" && storeStats.status === "fulfilled"
      ? { ...storeSettings.value, ...storeStats.value }
      : null,
  });
});
```

#### 2. Extraer funciones de los reports existentes

Cada `fetchXxx` es una función pura que recibe `(db, businessId)` y devuelve datos. Se extraen de los handlers existentes en `reports.ts`, `orders.ts`, `sales.ts` sin duplicar lógica.

Crear `apps/api/src/services/dashboard-queries.ts` con las funciones extraídas.

#### 3. Registrar en app.ts

```typescript
import { dashboardRoutes } from "./routes/dashboard";
api.route("/", dashboardRoutes);
```

#### 4. Actualizar el frontend

```typescript
// pages/index.vue — ANTES: 12 calls
const [dailyResult, weeklyResult, ...] = await Promise.allSettled([...]);

// pages/index.vue — DESPUÉS: 1 call
const { data } = await $api<DashboardResponse>("/api/dashboard");
if (data.today) { ... }
if (data.weekly) { ... }
```

### Caching (opcional, fase 2)

El endpoint puede cachear en Redis por 30 segundos:
```typescript
const cacheKey = `dashboard:${businessId}`;
const cached = await redis?.get(cacheKey);
if (cached) return c.json(JSON.parse(cached));
// ... compute ...
await redis?.set(cacheKey, JSON.stringify(response), "EX", 30);
```

Esto es útil si el dueño recarga el dashboard frecuentemente.

### Migración (backward compatible)

1. Crear el endpoint `/api/dashboard` (nuevo, no rompe nada)
2. Actualizar el frontend para usar el nuevo endpoint
3. Los endpoints individuales siguen funcionando (otros componentes los usan)
4. No se eliminan los endpoints individuales

### Tests

```typescript
describe("GET /api/dashboard", () => {
  it("returns all sections in a single response", async () => {
    const res = await app.request("/api/dashboard", { headers: authHeaders });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("today");
    expect(body).toHaveProperty("weekly");
    expect(body).toHaveProperty("exchangeRate");
  });

  it("isolates failures — one section failing doesn't break others", async () => {
    // Mock exchange rate to fail
    const res = await app.request("/api/dashboard", { headers: authHeaders });
    const body = await res.json();
    expect(body.exchangeRate).toBeNull();
    expect(body.today).not.toBeNull(); // other sections still work
  });
});
```

### Métricas de éxito

| Métrica | Antes | Después |
|---------|-------|---------|
| Requests al API por carga de dashboard | 12 | 1 |
| Latencia percibida (3G, 300ms RTT) | ~3.6s | ~350ms |
| Bytes transferidos (headers overhead) | ~12KB headers | ~1KB headers |
| Queries a PostgreSQL | 12 (secuenciales desde browser) | 12 (paralelas en servidor) |
