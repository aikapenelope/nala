# Nova: WhatsApp -- Arquitectura Detallada, Seguridad y Alcance

---

## 1. Vale la Pena?

**Sí, pero solo para lo que tiene sentido.** WhatsApp no es un reemplazo de la PWA. Es un canal complementario para 3 cosas específicas:

1. **Notificaciones salientes** (Nova → usuario): resúmenes, alertas, cobros. Esto es puro valor, bajo riesgo.
2. **Consultas de solo lectura** (usuario → Nova): "cuánto vendí hoy", "cuánto me debe Juan". No modifica datos, bajo riesgo.
3. **Acciones simples con confirmación** (usuario → Nova): "cobra a Juan", "sube el precio del pan a 1.80". Modifica datos, requiere confirmación explícita.

Lo que NO debe hacer WhatsApp: registrar ventas complejas, gestionar inventario, configurar el negocio, importar datos. Eso es PWA.

---

## 2. Qué Hace WhatsApp (Alcance Exacto)

### Salida (Nova → usuario) -- Sin riesgo

| Mensaje | Cuándo | Contenido | Riesgo |
|---|---|---|---|
| Resumen diario | 9pm automático | Ventas del día, ganancia, top producto, alertas | Ninguno (solo lectura) |
| Resumen semanal | Lunes 8am | Comparativa semanal, tendencias | Ninguno |
| Alerta de stock | Cuando un producto baja del mínimo | "Harina PAN: quedan 5 unidades (~2 días)" | Ninguno |
| Alerta de anomalía | Cuando se detecta algo inusual | "3 anulaciones hoy, promedio es 0.2" | Ninguno |
| Cobro a cliente | Cuando el dueño toca "Cobrar" en la PWA | Mensaje personalizado al cliente con monto | Ninguno (el dueño inicia desde la PWA) |
| Reporte al contador | Cuando el dueño toca "Enviar al contador" | PDF adjunto con datos contables | Ninguno (el dueño inicia desde la PWA) |

Estos mensajes los genera Nova y los envía vía Meta Cloud API. El usuario no interactúa. Solo recibe.

### Entrada solo lectura (usuario → Nova) -- Bajo riesgo

| El usuario escribe | Nova responde | Modifica datos? |
|---|---|---|
| "cuánto vendí hoy" | "$420 en 23 ventas. ▲12% vs ayer" | No |
| "cuánto me debe Juan" | "Juan Pérez: $65, hace 35 días" | No |
| "inventario bajo" | "3 productos: Harina PAN (5u), Queso (2kg), Servilletas (1paq)" | No |
| "cómo me fue esta semana" | Resumen con comparativa | No |
| "precio del pan campesino" | "Costo $0.80, precio $1.50, margen 47%" | No |
| "quién no viene hace un mes" | "8 clientes: María ($45 prom), Pedro ($30)..." | No |
| "cuánto tengo en caja" | "Efectivo: $320, Pago Móvil: $180, Total: $500" | No |

Estas son consultas. Nova lee la base de datos y responde. No cambia nada.

### Entrada con acción (usuario → Nova) -- Riesgo medio, requiere confirmación

| El usuario escribe | Nova responde | Después de confirmación |
|---|---|---|
| "cobra a Juan" | "¿Envío recordatorio de cobro a Juan Pérez por $65? [Sí/No]" | Envía mensaje WhatsApp a Juan |
| "cobra a todos los que deben" | "4 clientes deben $285 total. ¿Envío recordatorio a todos? [Sí/No]" | Envía mensajes a los 4 |
| "sube el precio del pan a 1.80" | "¿Cambio precio Pan Campesino de $1.50 a $1.80? Nuevo margen: 56% [Sí/No]" | Actualiza precio en DB |
| "registra gasto $50 electricidad" | "¿Registro gasto de $50 en categoría Servicios? [Sí/No]" | Inserta gasto en DB |

**Regla de oro: TODA acción que modifica datos requiere confirmación explícita ("Sí").** Nova nunca modifica datos solo porque el usuario escribió algo. Siempre pregunta primero.

### Lo que WhatsApp NO hace (solo PWA)

| Acción | Por qué no por WhatsApp |
|---|---|
| Registrar ventas | Requiere seleccionar productos, cantidades, método de pago. Demasiado complejo para chat |
| Gestionar inventario | Agregar productos, variantes, importar Excel. Necesita formularios |
| Configurar el negocio | Usuarios, roles, categorías, métodos de pago. Necesita pantallas |
| Ver reportes con gráficos | WhatsApp no puede mostrar gráficos interactivos |
| OCR de facturas | WhatsApp comprime imágenes. OCR va por la PWA |
| Cierre de día | Requiere contar caja, confirmar montos. Necesita formulario |
| Importar datos | Subir Excel, mapear columnas. Solo desktop |

---

## 3. Arquitectura Técnica: Cómo Funciona en Producción

### El flujo completo de un mensaje entrante

```
1. Usuario envía "cuánto vendí hoy" desde su WhatsApp
                    │
                    ▼
2. WhatsApp (app) entrega al servidor de Meta
                    │
                    ▼
3. Meta Cloud API envía webhook HTTP POST a:
   https://api.nova.app/webhooks/whatsapp
                    │
                    ▼
4. Hono (backend Nova) recibe el webhook
   ├── Verifica firma del webhook (seguridad Meta)
   ├── Extrae: número de teléfono del remitente + texto del mensaje
   │
   ▼
5. Identificar al usuario
   ├── Busca en PostgreSQL: SELECT * FROM users WHERE phone = '+58412XXXXXXX'
   ├── Si no existe: responde "No tienes cuenta en Nova. Regístrate en nova.app"
   ├── Si existe: obtiene user_id Y business_id (el tenant)
   │
   ▼
6. Setear contexto de tenant
   ├── SET app.current_business_id = 'uuid-del-negocio'  (RLS)
   ├── Ahora todas las queries solo ven datos de ESE negocio
   │
   ▼
7. Verificar permisos
   ├── Si el usuario es Empleado: solo puede consultar (no modificar)
   ├── Si el usuario es Dueño: puede consultar Y modificar (con confirmación)
   │
   ▼
8. Interpretar el mensaje con LLM
   ├── Envía a OpenRouter (GPT-4o-mini):
   │   System prompt: "Eres el asistente de Nova. Interpreta el mensaje
   │   del usuario y devuelve una acción estructurada en JSON.
   │   Acciones posibles: query_sales, query_debt, query_inventory,
   │   query_price, send_collection, update_price, register_expense.
   │   Si la acción modifica datos, marca requires_confirmation: true"
   │
   │   User message: "cuánto vendí hoy"
   │
   ├── LLM responde (structured output):
   │   { "action": "query_sales", "period": "today", "requires_confirmation": false }
   │
   ▼
9. Ejecutar la acción
   ├── El backend (NO el LLM) ejecuta la query en PostgreSQL:
   │   SELECT SUM(total) as total, COUNT(*) as count FROM sales
   │   WHERE date = CURRENT_DATE
   │   (RLS filtra automáticamente por business_id)
   │
   ├── Calcula comparativa: vs mismo día semana pasada
   │
   ▼
10. Formatear respuesta
    ├── "$420 en 23 ventas. ▲12% vs martes pasado. Top: Pan Campesino (85u)"
    │
    ▼
11. Enviar respuesta vía Meta Cloud API
    ├── POST https://graph.facebook.com/v21.0/{phone_number_id}/messages
    ├── Body: { to: "+58412XXXXXXX", type: "text", text: { body: "..." } }
    │
    ▼
12. Usuario recibe la respuesta en WhatsApp
```

### Cómo identifica al usuario (por teléfono)

El usuario se registra en Nova (PWA) con email + password (Clerk). Durante el registro o en configuración, agrega su número de teléfono. Ese número se guarda en la tabla `users`:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  clerk_id TEXT NOT NULL,           -- ID de Clerk
  email TEXT NOT NULL,
  phone TEXT,                       -- +58412XXXXXXX (para WhatsApp)
  role TEXT CHECK (role IN ('owner', 'employee')),
  pin TEXT,                         -- PIN de 4 dígitos (hasheado)
  whatsapp_enabled BOOLEAN DEFAULT false,  -- opt-in explícito
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
```

Cuando llega un mensaje de WhatsApp:
1. Se busca el número en `users.phone`
2. Si existe y `whatsapp_enabled = true`: se procesa
3. Si existe pero `whatsapp_enabled = false`: "Activa WhatsApp en tu cuenta de Nova para usar este servicio"
4. Si no existe: "No tienes cuenta en Nova"

**No es otra IA.** Es el mismo backend de Nova, el mismo PostgreSQL, el mismo RLS. El webhook de WhatsApp es solo otro endpoint de la API de Hono. La única diferencia es que el input viene de WhatsApp (texto) en vez de la PWA (clicks), y el output va a WhatsApp (texto) en vez de la PWA (HTML).

### Diagrama de componentes

```
┌─────────────────────────────────────────────────────────────┐
│                    App Plane (Hetzner 10.0.1.30)            │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                 Hono Backend                          │  │
│  │                                                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │  │
│  │  │ API Routes  │  │ WhatsApp    │  │ Cron Jobs    │  │  │
│  │  │ (PWA)       │  │ Webhook     │  │ (resúmenes)  │  │  │
│  │  │             │  │ Handler     │  │              │  │  │
│  │  │ /api/sales  │  │ /webhooks/  │  │ 9pm: resumen │  │  │
│  │  │ /api/products│ │  whatsapp   │  │ Lun: semanal │  │  │
│  │  │ /api/clients│  │             │  │              │  │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘  │  │
│  │         │                │                │           │  │
│  │         └────────────────┼────────────────┘           │  │
│  │                          │                            │  │
│  │                   ┌──────┴──────┐                     │  │
│  │                   │  Services   │                     │  │
│  │                   │             │                     │  │
│  │                   │ SalesService│                     │  │
│  │                   │ InventoryS. │                     │  │
│  │                   │ ClientsS.   │                     │  │
│  │                   │ AccountsS.  │                     │  │
│  │                   │ ReportsS.   │                     │  │
│  │                   └──────┬──────┘                     │  │
│  │                          │                            │  │
│  └──────────────────────────┼────────────────────────────┘  │
│                             │                               │
│  ┌──────────────────────────┼────────────────────────────┐  │
│  │                   Data Layer                          │  │
│  │                          │                            │  │
│  │  PostgreSQL ◄────────────┤                            │  │
│  │  (RLS por tenant)        │                            │  │
│  │                          │                            │  │
│  │  Redis ◄─────────────────┤                            │  │
│  │  (sesiones, tasa BCV,    │                            │  │
│  │   cola WhatsApp)         │                            │  │
│  └──────────────────────────┘                            │  │
└─────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
  ┌──────────────┐              ┌──────────────┐
  │  OpenRouter   │              │  Meta Cloud  │
  │  (LLM para   │              │  API         │
  │   interpretar │              │  (WhatsApp)  │
  │   mensajes)   │              │              │
  └──────────────┘              └──────────────┘
```

**Punto clave:** Los Services son los mismos para PWA y WhatsApp. `SalesService.getTodaySales(businessId)` se llama igual desde un API route de la PWA que desde el WhatsApp webhook handler. No hay código duplicado. La diferencia es solo el input (HTTP request vs WhatsApp message) y el output (JSON response vs WhatsApp text).

---

## 4. Seguridad: Qué Puede Salir Mal y Cómo se Previene

### Riesgo 1: Alguien envía mensajes desde un número que no es suyo

**Mitigación:** El número debe estar registrado en Nova con `whatsapp_enabled = true`. El usuario activa WhatsApp desde la PWA (donde ya está autenticado con Clerk). No se puede activar por WhatsApp mismo.

### Riesgo 2: Teléfono robado -- el ladrón modifica datos por WhatsApp

**Mitigación:**
- Toda acción que modifica datos requiere confirmación ("¿Seguro? Sí/No")
- Las acciones de modificación tienen cooldown: máximo 5 modificaciones por hora por WhatsApp
- El dueño puede desactivar WhatsApp desde la PWA en cualquier momento
- Las acciones críticas (cambiar precios, registrar gastos grandes >$100) requieren PIN de 4 dígitos por WhatsApp: "Ingresa tu PIN para confirmar"
- Log de todas las acciones por WhatsApp (visible en la PWA)

### Riesgo 3: LLM interpreta mal el mensaje y ejecuta acción incorrecta

**Mitigación:**
- El LLM NO ejecuta acciones. Solo interpreta y devuelve un JSON estructurado
- El backend valida el JSON contra un schema Zod estricto
- Toda acción de modificación requiere confirmación del usuario
- Si el LLM no está seguro (confidence < 0.8), responde: "No entendí bien. ¿Quisiste decir X o Y?"
- Si el LLM falla (API down), responde: "No puedo procesar tu mensaje ahora. Usa la app en nova.app"

### Riesgo 4: Empleado usa WhatsApp para ver datos que no debería

**Mitigación:**
- Los empleados con rol `employee` solo pueden hacer consultas básicas por WhatsApp: ventas del día, precio de un producto
- No pueden: ver reportes financieros, ver costos/márgenes, modificar precios, ver cuentas por cobrar
- El backend verifica el rol antes de ejecutar cualquier acción

### Riesgo 5: Spam / abuso de la API de LLM

**Mitigación:**
- Rate limiting: máximo 30 mensajes por hora por usuario
- Si excede: "Has enviado muchos mensajes. Espera 10 minutos o usa la app"
- Mensajes de más de 500 caracteres se rechazan: "Mensaje muy largo. Sé más específico"
- Mensajes con contenido no relacionado al negocio se ignoran: "Solo puedo ayudarte con tu negocio en Nova"

### Riesgo 6: Costo de LLM se dispara

**Mitigación:**
- GPT-4o-mini vía OpenRouter: ~$0.001 por mensaje interpretado
- 30 mensajes/hora máximo × 24 horas = 720 mensajes/día máximo por usuario = ~$0.72/día peor caso
- En la práctica, un dueño envía ~5-10 mensajes/día = ~$0.005-0.01/día
- Prompt caching: el system prompt es idéntico para todos, se cachea (50% descuento)
- Si Groq está disponible para el modelo, se usa como fallback más barato para consultas simples

---

## 5. Implementación del Webhook

### Código del webhook handler

```typescript
// apps/api/src/routes/webhooks/whatsapp.ts
import { Hono } from 'hono';
import { verifyWebhook } from '../../middleware/whatsapp-verify';
import { interpretMessage } from '../../services/whatsapp/interpreter';
import { executeAction } from '../../services/whatsapp/executor';
import { sendWhatsAppMessage } from '../../services/whatsapp/sender';
import { db } from '../../db';

const whatsapp = new Hono();

// Verificación del webhook (Meta lo requiere al configurar)
whatsapp.get('/', (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');
  
  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    return c.text(challenge!, 200);
  }
  return c.text('Forbidden', 403);
});

// Recibir mensajes
whatsapp.post('/', verifyWebhook, async (c) => {
  const body = await c.req.json();
  
  // Extraer mensaje (Meta envía estructura anidada)
  const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message || message.type !== 'text') {
    return c.json({ status: 'ignored' }); // ignorar mensajes no-texto
  }
  
  const phone = message.from;       // "+58412XXXXXXX"
  const text = message.text.body;   // "cuánto vendí hoy"
  
  // 1. Identificar usuario por teléfono
  const user = await db.query(
    `SELECT id, business_id, role, whatsapp_enabled 
     FROM users WHERE phone = $1`,
    [phone]
  );
  
  if (!user || !user.whatsapp_enabled) {
    await sendWhatsAppMessage(phone, 
      "No tienes WhatsApp activado en Nova. Actívalo en nova.app/config");
    return c.json({ status: 'unauthorized' });
  }
  
  // 2. Rate limiting (Redis)
  const key = `wa:rate:${user.id}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 3600); // 1 hora
  if (count > 30) {
    await sendWhatsAppMessage(phone,
      "Has enviado muchos mensajes. Espera un momento o usa la app.");
    return c.json({ status: 'rate_limited' });
  }
  
  // 3. Setear tenant (RLS)
  await db.query("SET app.current_business_id = $1", [user.business_id]);
  
  // 4. Interpretar mensaje con LLM
  const action = await interpretMessage(text, user.role);
  
  // 5. Verificar permisos
  if (user.role === 'employee' && action.requires_owner) {
    await sendWhatsAppMessage(phone,
      "Solo el dueño puede hacer eso. Pídele que lo haga desde la app.");
    return c.json({ status: 'forbidden' });
  }
  
  // 6. Si requiere confirmación, preguntar
  if (action.requires_confirmation) {
    // Guardar acción pendiente en Redis (expira en 5 min)
    await redis.setex(`wa:pending:${user.id}`, 300, JSON.stringify(action));
    await sendWhatsAppMessage(phone, action.confirmation_message);
    return c.json({ status: 'awaiting_confirmation' });
  }
  
  // 7. Ejecutar acción y responder
  const result = await executeAction(action, user.business_id);
  await sendWhatsAppMessage(phone, result.message);
  
  // 8. Log
  await db.query(
    `INSERT INTO activity_log (business_id, user_id, action, detail, channel)
     VALUES ($1, $2, $3, $4, 'whatsapp')`,
    [user.business_id, user.id, action.type, text]
  );
  
  return c.json({ status: 'ok' });
});

export default whatsapp;
```

### El intérprete de mensajes (LLM)

```typescript
// apps/api/src/services/whatsapp/interpreter.ts
export async function interpretMessage(text: string, userRole: string) {
  const response = await openrouter.chat.completions.create({
    model: "openai/gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Eres el asistente de WhatsApp de Nova, un sistema de backoffice para comerciantes.
Interpreta el mensaje del usuario y devuelve una acción en JSON.

Acciones de solo lectura (cualquier rol):
- query_sales: consultar ventas (params: period)
- query_inventory: consultar inventario (params: filter)
- query_price: consultar precio de producto (params: product_name)
- query_debt: consultar deuda de cliente (params: client_name)
- query_clients: consultar clientes por segmento (params: segment)
- query_cash: consultar estado de caja

Acciones que modifican datos (solo dueño, requires_confirmation: true):
- send_collection: enviar cobro a cliente (params: client_name)
- send_collection_all: enviar cobro a todos los morosos
- update_price: cambiar precio (params: product_name, new_price)
- register_expense: registrar gasto (params: amount, category)

Si el usuario dice "sí" o "confirmo", devuelve: { action: "confirm_pending" }
Si no entiendes, devuelve: { action: "unknown", message: "sugerencia de qué preguntar" }

El rol del usuario es: ${userRole}`
      },
      { role: "user", content: text }
    ],
    response_format: { type: "json_object" }
  });
  
  return JSON.parse(response.choices[0].message.content);
}
```

### El ejecutor de acciones

```typescript
// apps/api/src/services/whatsapp/executor.ts
export async function executeAction(action: any, businessId: string) {
  switch (action.action) {
    case 'query_sales': {
      const sales = await salesService.getSummary(businessId, action.period);
      return {
        message: `$${sales.total} en ${sales.count} ventas. ${sales.trend}. Top: ${sales.topProduct}`
      };
    }
    case 'query_debt': {
      const debt = await accountsService.getClientDebt(businessId, action.client_name);
      return {
        message: `${debt.clientName}: $${debt.amount}, hace ${debt.days} días`
      };
    }
    case 'send_collection': {
      // Esto ya fue confirmado por el usuario
      await accountsService.sendCollectionWhatsApp(businessId, action.client_name);
      return { message: `Recordatorio enviado a ${action.client_name}` };
    }
    // ... más acciones
  }
}
```

---

## 6. Cuándo Implementar WhatsApp

**No en Fase 0-6.** WhatsApp es Fase 7 (semana 13). Razones:

1. El producto tiene que funcionar completo en la PWA primero
2. WhatsApp depende de que existan ventas, inventario, clientes, cuentas en la DB
3. Los Services (SalesService, InventoryService, etc.) se construyen en Fases 2-6. WhatsApp los reutiliza
4. Configurar Meta Cloud API requiere un dominio con SSL funcionando (que ya existe en Fase 0)

**Esfuerzo real de WhatsApp:** ~1 semana. El 80% del trabajo es el LLM interpreter + el webhook handler. Los Services ya existen. Es "conectar los cables".

---

## 7. Resumen

| Aspecto | Decisión |
|---|---|
| Vale la pena? | Sí, para notificaciones + consultas + acciones simples |
| Es otra IA? | No. Es el mismo backend, mismo PostgreSQL, mismo RLS. Solo otro endpoint |
| Cómo identifica al usuario? | Por número de teléfono registrado en la tabla `users` |
| Quién puede usarlo? | Solo usuarios con `whatsapp_enabled = true` (opt-in desde la PWA) |
| Qué puede hacer un Empleado? | Solo consultas de solo lectura |
| Qué puede hacer un Dueño? | Consultas + acciones con confirmación |
| Qué NO se hace por WhatsApp? | Ventas complejas, inventario, configuración, OCR, cierre de día |
| Seguridad? | Confirmación obligatoria, rate limiting, PIN para acciones críticas, log completo |
| Cuándo se implementa? | Fase 7 (semana 13). Después de que la PWA esté completa |
| Complejidad? | ~1 semana. Reutiliza todos los Services existentes |
