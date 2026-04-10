# Decisiones: Catálogo de Cliente, Stack Técnico, Estrategia Offline

---

## 1. Página de Catálogo para Clientes

### La idea

Cada negocio en Nala tiene una URL pública con su catálogo de productos. El comerciante comparte el link por WhatsApp, redes sociales, o impreso en el local. El cliente ve productos con fotos y precios, selecciona lo que quiere, deja sus datos, y el pedido le llega al comerciante.

### Por qué sí funciona

- Miles de negocios venezolanos ya venden por WhatsApp enviando fotos una por una. Esto lo automatiza
- WhatsApp Business tiene "WhatsApp Shop" con catálogo integrado, lo que valida que el concepto funciona
- No es e-commerce. No hay pago online, no hay carrito complejo, no hay logística. Es un formulario de pedido que genera un contacto
- El comerciante no necesita saber nada de tecnología. El catálogo se genera automáticamente desde su inventario en Nala

### Cómo funciona

**URL:** `nala.app/tienda/bodega-juan` (o dominio personalizado en v2)

**Lo que ve el cliente (página pública, no necesita cuenta):**

```
┌─────────────────────────────────────┐
│  Bodega Juan                        │
│  Av. Principal, Los Teques          │
│  📞 0412-XXX-XXXX                   │
├─────────────────────────────────────┤
│ 🔍 Buscar producto...               │
├─────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐            │
│ │ [foto]  │ │ [foto]  │            │
│ │Harina   │ │Aceite   │            │
│ │PAN 1kg  │ │Diana 1L │            │
│ │$2.00    │ │$4.50    │            │
│ │[+ Pedir]│ │[+ Pedir]│            │
│ └─────────┘ └─────────┘            │
│ ┌─────────┐ ┌─────────┐            │
│ │ [foto]  │ │ [foto]  │            │
│ │Azúcar   │ │Queso    │            │
│ │1kg      │ │Blanco   │            │
│ │$1.80    │ │$3.00/kg │            │
│ │[+ Pedir]│ │[+ Pedir]│            │
│ └─────────┘ └─────────┘            │
├─────────────────────────────────────┤
│ Tu pedido:                          │
│ • Harina PAN x2 = $4.00            │
│ • Aceite Diana x1 = $4.50          │
│ Total: $8.50                        │
├─────────────────────────────────────┤
│ Tu nombre: [____________]           │
│ Tu teléfono: [__________]           │
│ Nota: [_________________]           │
│                                     │
│ [ Enviar pedido ]                   │
└─────────────────────────────────────┘
```

**Lo que recibe el comerciante en Nala:**

- Notificación push: "Nuevo pedido de María García: Harina PAN x2, Aceite Diana x1. Total: $8.50"
- El pedido aparece en una sección "Pedidos" con estado: Nuevo → Confirmado → Entregado
- Botón "Contactar por WhatsApp" abre chat con el cliente con mensaje prellenado: "Hola María, recibimos tu pedido por $8.50. ¿Cómo quieres pagar?"

**Lo que NO es:**
- No es e-commerce (no hay pago online)
- No es delivery (no hay tracking de envío)
- No es marketplace (no hay múltiples vendedores)
- Es un formulario de pedido que genera un lead para que el comerciante lo contacte

**Implementación:** Página estática generada desde los datos del negocio. Se actualiza cuando el comerciante cambia productos/precios. Ligera (<100KB), carga rápido en 3G, funciona en cualquier celular.

**Cuándo se implementa:** v2. No es v1 porque requiere que los comerciantes tengan fotos de productos (muchos no las tienen al inicio).

---

## 2. Stack Técnico: Justificación de Cada Decisión

### Frontend: Nuxt 4 (Vue 3) -- Decisión Final

**Nuxt 4 es la versión estable actual** (v4.4.2, marzo 2026). No Nuxt 3. Nuxt 4 salió en julio 2025 con mejor estructura de proyecto, TypeScript mejorado, Vue Router v5, y CLI más rápido.

SvelteKit se evaluó como alternativa (5-8KB runtime vs 28-32KB de Nuxt, carga más rápida en 3G). Pero la decisión final es **Nuxt 4** por:

1. **Ya lo conocemos** (Aurora está en Nuxt). Cero curva de aprendizaje = semanas ahorradas
2. **Ecosistema maduro.** Más librerías, más plugins, más respuestas a problemas
3. **Contratación fácil.** 10x más devs Vue que Svelte en el mercado
4. **Producción probada.** GitLab, BMW, Alibaba, Nintendo usan Vue
5. **Para un backoffice, la diferencia de runtime (0.2s vs 0.8s) no es deal-breaker.** La velocidad de desarrollo sí lo es

### DB local: IndexedDB (vía Dexie.js)

**Qué es:** IndexedDB es una base de datos NoSQL que vive dentro del navegador del usuario. No es un reemplazo de PostgreSQL. Son complementarios:

- **PostgreSQL** = base de datos del servidor. Fuente de verdad. Donde viven todos los datos de todos los tenants
- **IndexedDB** = cache local en el dispositivo del usuario. Permite que la app funcione cuando no hay internet

**Por qué IndexedDB y no LocalStorage:**

| Aspecto | LocalStorage | IndexedDB |
|---|---|---|
| Capacidad | 5-10MB | 50MB+ (hasta GBs) |
| Tipo de datos | Solo strings | Objetos, arrays, blobs, archivos |
| API | Síncrona (bloquea la interfaz) | Asíncrona (no bloquea) |
| Índices | No (solo busca por key) | Sí (búsquedas complejas) |
| Transacciones | No | Sí (integridad de datos) |

Un negocio con 500 productos, 200 clientes, y 50 ventas del día necesita ~5-10MB de datos locales. LocalStorage no alcanza y bloquearía la interfaz al leer/escribir. IndexedDB maneja esto sin problemas.

**Dexie.js** es un wrapper que simplifica la API de IndexedDB (que es notoriamente difícil de usar directamente). Convierte esto:

```javascript
// IndexedDB crudo (horrible)
const request = indexedDB.open('NalaDB', 1);
request.onupgradeneeded = (event) => {
  const db = event.target.result;
  const store = db.createObjectStore('products', { keyPath: 'id' });
  store.createIndex('name', 'name');
};
request.onsuccess = (event) => {
  const db = event.target.result;
  const tx = db.transaction(['products'], 'readonly');
  const store = tx.objectStore('products');
  const req = store.getAll();
  req.onsuccess = () => console.log(req.result);
};
```

En esto:

```javascript
// Con Dexie.js (limpio)
const db = new Dexie('NalaDB');
db.version(1).stores({ products: 'id, name, sku, categoryId' });
const products = await db.products.toArray();
```

### Backend: Hono (decisión sobre Fastify)

**Por qué no Express:** Express tiene 15 años, es lento (2-3x más lento que Fastify en benchmarks), no tiene validación de schema incluida, y su API no es TypeScript-first.

**Hono vs Fastify:**

| Aspecto | Hono | Fastify |
|---|---|---|
| Tamaño | 14KB | ~200KB+ con plugins |
| Performance | Más rápido (benchmarks de routing) | Muy rápido (2-3x Express) |
| TypeScript | Nativo, excelente tipado | Bueno, pero requiere más config |
| Ecosistema | Creciendo, más joven | Maduro, muchos plugins |
| Runtime | Node, Bun, Deno, Cloudflare Workers | Node (principalmente) |
| Validación | Vía Zod (integración nativa) | JSON Schema (built-in) |

**Decisión: Hono.** Razones:
1. Ultra-ligero (14KB). Menos overhead en el servidor
2. TypeScript-first con tipado excelente (rutas tipadas, middleware tipado)
3. Funciona en múltiples runtimes (si en el futuro queremos mover a Bun o edge)
4. Integración nativa con Zod para validación (que ya usamos para structured output del LLM)
5. API moderna y limpia

---

## 3. Estrategia Offline: Online-First con Cache Agresivo

### Cambio de enfoque

El documento anterior decía "offline-first". Después de analizar la complejidad real, la decisión es **online-first con graceful degradation**. La diferencia es importante:

| Aspecto | Offline-first puro | Online-first con cache (elegido) |
|---|---|---|
| Dónde viven los datos | Local primero, servidor después | Servidor primero, cache local |
| Complejidad de sync | Muy alta (conflictos bidireccionales, CRDT) | Media (cola de operaciones pendientes) |
| Qué funciona sin internet | Todo | Ventas, consulta inventario/precios, dashboard cacheado |
| Qué requiere internet | Nada | OCR, WhatsApp, reportes IA, sync multi-dispositivo |
| Resolución de conflictos | Compleja (merge strategies) | Simple (cola FIFO, servidor es fuente de verdad) |
| Tiempo de desarrollo | +2-3 meses | +2-3 semanas |

### Por qué no offline-first puro

1. **La sincronización bidireccional es el problema más difícil en software.** Dos dispositivos editan el mismo producto offline. Cuando ambos se conectan, ¿cuál gana? Offline-first puro requiere CRDTs o merge strategies complejas. Para un MVP, es over-engineering
2. **La mayoría de la gente tiene internet.** Incluso en Venezuela, el 61.6% tiene internet. El problema no es "no hay internet nunca". Es "internet se cae 30 segundos" o "internet es lento"
3. **Lo que realmente necesitamos es resiliencia, no independencia.** El usuario necesita que la app no se rompa cuando falla internet. No necesita que funcione una semana sin conexión

### Cómo funciona en la práctica

**Con internet (estado normal):**
```
Usuario → App → API Backend → PostgreSQL
                    ↓
              IndexedDB (cache local se actualiza)
```

La app hace requests al servidor normalmente. Las respuestas se cachean en IndexedDB para acceso rápido y para cuando falle internet.

**Sin internet (graceful degradation):**
```
Usuario → App → IndexedDB (datos cacheados)
                    ↓
              Cola de operaciones pendientes (IndexedDB)
```

- Ventas se registran en IndexedDB con flag `synced: false`
- Consultas de inventario/precios usan datos cacheados (última versión conocida)
- Dashboard muestra datos cacheados con indicador "Última actualización: hace X minutos"
- OCR, WhatsApp, reportes IA no funcionan (requieren API externa)

**Cuando vuelve internet:**
```
Cola de operaciones pendientes → API Backend → PostgreSQL
                                      ↓
                                IndexedDB (se actualiza con datos frescos del servidor)
```

- Las ventas pendientes se envían al servidor en orden (FIFO)
- El servidor es la fuente de verdad. Si hay conflicto, el servidor gana
- El cache local se refresca con datos actualizados
- El usuario ve notificación: "Sincronizado. 3 ventas enviadas"

### Qué funciona sin internet

| Funcionalidad | Sin internet | Notas |
|---|---|---|
| Registrar ventas | Sí | Se guardan en cola, se sincronizan después |
| Consultar inventario | Sí (cacheado) | Datos de la última sincronización |
| Consultar precios | Sí (cacheado) | Datos de la última sincronización |
| Ver dashboard | Sí (cacheado) | Con indicador "datos de hace X min" |
| Escanear código de barras | Sí | Busca en cache local |
| Cobrar por WhatsApp | No | Requiere internet para abrir WhatsApp |
| OCR de facturas | No | Requiere API de OpenAI |
| WhatsApp bidireccional | No | Requiere API de Meta |
| Reportes con narrativa IA | No | Requiere API de OpenAI |
| Sincronización multi-dispositivo | No | Requiere servidor |
| Cierre de día | Parcial | Cuadre de caja sí, envío de resumen no |

### Beneficios incluso con internet

Online-first con cache no es solo para cuando no hay internet:

1. **Velocidad percibida:** Los datos están en IndexedDB. La app muestra datos locales instantáneamente mientras refresca del servidor en background. El usuario nunca ve "cargando..."
2. **Resiliencia a internet lento:** En 3G venezolano, un request puede tardar 3-5 segundos. Con cache local, la app responde en <100ms y actualiza cuando llega la respuesta del servidor
3. **Menos carga en el servidor:** Las consultas frecuentes (lista de productos, precios, dashboard) se sirven desde cache local. Solo se refrescan periódicamente o cuando hay cambios
4. **Tolerancia a micro-cortes:** Internet se cae 10 segundos. Sin cache, la app muestra error. Con cache, el usuario ni se entera
