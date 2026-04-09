# Decisiones Técnicas: Roles, Contabilidad, WhatsApp y OCR

> Decisiones de diseño basadas en investigación del mercado, cómo lo hace Fina, y cómo funciona en producción.

---

## 1. Roles: 2, No 5

### Cómo lo hace Fina

Fina no tiene sistema de roles. Todos los usuarios ven todo. La única distinción es operativa: el módulo de ventas distingue entre repartidores, mesoneros y vendedores para saber quién atendió cada venta, pero no hay restricción de acceso. Usuarios ilimitados en todos los planes.

### Cómo lo hacen los competidores

- **Square:** Roles simples. Owner y Employee. El Employee tiene permisos configurables pero la mayoría de negocios pequeños usan solo esos dos
- **Loyverse:** Owner, Manager, Cashier. Pero en la práctica el 90% de negocios pequeños solo usa Owner y Cashier
- **Toast:** Roles más granulares pero es para restaurantes con 20+ empleados
- **Shopify POS:** Staff con permisos por PIN. Cada empleado tiene un PIN y permisos configurables

### La decisión para Nala

**2 roles: Dueño y Empleado.** Razones:

1. **El usuario target tiene 1-5 empleados.** No necesita Gerente, Inventarista, Contador como roles separados. El dueño hace todo eso
2. **Fina no tiene roles y tiene 4,000 clientes.** La gente no lo pide porque no lo necesita. Pero SÍ necesitan que el cajero no vea cuánto gana el negocio
3. **Más roles = más configuración = más fricción.** El dueño no quiere configurar 5 roles con permisos por módulo. Quiere un switch: "este usuario puede ver costos y reportes, sí o no"
4. **El PIN por usuario es más importante que los roles.** Saber QUIÉN hizo cada venta es más valioso que restringir acceso. Cada empleado tiene su PIN, cada acción queda registrada

**Cómo funciona:**

| Rol | Ve ventas | Registra ventas | Ve costos/margen | Ve reportes financieros | Configura | Ve log de actividad |
|---|---|---|---|---|---|---|
| Dueño | Sí | Sí | Sí | Sí | Sí | Sí |
| Empleado | Solo las suyas | Sí (con su PIN) | No | No | No | No |

**Futuro (v2+):** Si hay demanda, se puede agregar un tercer rol (Gerente) que ve reportes pero no configura. Pero no en v1.

**Multi-negocio:** Cada suscripción es 1 negocio. Si el dueño tiene 2 tiendas, paga 2 suscripciones (o plan Negocio + $15/mes por tienda adicional). Cada negocio tiene su propia base de datos, usuarios y configuración. El dueño puede cambiar entre negocios desde la misma cuenta.

---

## 2. Contabilidad: El Flujo Correcto

### Cómo lo hace Fina

Fina tiene un módulo de "Resumen Financiero" que muestra ingresos, costos, gastos, ganancia bruta y neta con gráficos. Permite exportar en Excel y PDF. No tiene catálogo de cuentas, no genera asientos contables, no tiene formatos para sistemas contables específicos, no tiene portal del contador. El flujo actual del usuario de Fina es:

```
Fina → Exportar Excel → Enviar por WhatsApp al contador → Contador transcribe manualmente a su sistema
```

### El problema

El contador recibe un Excel genérico que no tiene formato contable. Tiene que interpretar qué es cada línea, asignar cuentas contables, y transcribir todo. Esto genera errores, demoras, y el dueño termina pagando más horas al contador.

### El flujo mejorado para Nala

```
Nala → Genera Excel con formato contable (ya tiene cuentas asignadas) → Botón "Enviar al contador" → WhatsApp con archivo adjunto → Contador importa directo en su sistema
```

**Paso a paso:**

1. **Setup (una sola vez):** Cuando el negocio se registra, Nala pre-configura un catálogo de cuentas contables basado en el tipo de negocio (panadería, ferretería, restaurante, etc.). Las cuentas más comunes ya están asignadas:
   - Ventas en efectivo → 4101
   - Ventas por transferencia → 4102
   - Costo de mercancía vendida → 5101
   - Gastos de alquiler → 6201
   - Gastos de servicios → 6202
   - etc.

2. **Día a día (automático):** Cada venta, gasto y pago que se registra en Nala se traduce automáticamente a un asiento contable. El usuario no hace nada. No ve asientos. No sabe qué es un "debe" y un "haber".

3. **Fin de mes (un botón):** El dueño toca "Enviar al contador". Nala genera:
   - Excel con formato de libro diario (fecha, cuenta, debe, haber, descripción, referencia)
   - Resumen de ventas por método de pago
   - Resumen de gastos por categoría
   - P&L simplificado (ingresos - costos - gastos = ganancia)
   - Libro de ventas en formato SENIAT (si aplica)

4. **Envío:** Se abre WhatsApp con el archivo adjunto y un mensaje prellenado: "Hola [nombre contador], aquí está el reporte contable de [mes] de [nombre negocio]."

5. **El contador:** Recibe el Excel, lo abre, y puede importarlo directamente en su sistema (Galac, Profit Plus, o simplemente lo usa como está). Las cuentas ya están asignadas. No tiene que transcribir nada.

**Lo que NO hacemos:**
- No hacemos contabilidad completa (balance general, estados financieros auditables)
- No hacemos declaraciones de impuestos
- No hacemos retenciones de IVA/ISLR
- No hacemos portal del contador en v1 (es más simple enviar por WhatsApp)
- No competimos con Alegra ni con Galac. Somos el puente entre el negocio y el contador

**Formatos de exportación en v1:**
- Excel con formato contable estándar (universal, cualquier contador lo entiende)
- PDF resumen (para el dueño)

**Formatos adicionales en v2:**
- Formato específico Galac (TXT)
- Formato específico Profit Plus (CSV)
- Portal del contador (URL dedicada)

---

## 3. WhatsApp: Arquitectura en Producción

### Cómo funciona técnicamente

La WhatsApp Cloud API es una API REST que Meta hospeda. Nala no hospeda WhatsApp. Nala se conecta a la API de Meta a través de un BSP (Business Solution Provider) o directamente.

**Arquitectura:**

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│  Usuario     │────▶│  WhatsApp    │────▶│  Meta Cloud API │────▶│  Webhook     │
│  (su celular)│◀────│  (app)       │◀────│  (servidores    │◀────│  (servidor   │
│              │     │              │     │   de Meta)      │     │   de Nala)   │
└─────────────┘     └──────────────┘     └─────────────────┘     └──────┬───────┘
                                                                        │
                                                                        ▼
                                                                 ┌──────────────┐
                                                                 │  Nala Backend│
                                                                 │  (API +      │
                                                                 │   LLM +      │
                                                                 │   PostgreSQL)│
                                                                 └──────────────┘
```

**Flujo de un mensaje entrante (usuario → Nala):**

1. El usuario envía "cuánto vendí hoy" al número de WhatsApp de Nala
2. WhatsApp entrega el mensaje a los servidores de Meta (Cloud API)
3. Meta envía un webhook HTTP POST al servidor de Nala con el payload del mensaje
4. El servidor de Nala recibe el webhook, extrae el texto del mensaje
5. El texto se envía al LLM (GPT-4o-mini) con el contexto del negocio del usuario para interpretar la intención
6. El LLM devuelve una acción estructurada: `{ action: "query_sales", period: "today" }`
7. El backend ejecuta la query en PostgreSQL
8. El resultado se formatea como mensaje de texto
9. El backend llama a la API de Meta para enviar la respuesta al usuario
10. El usuario recibe: "$420 en 23 ventas. 12% más que el martes pasado"

**Flujo de un mensaje saliente (Nala → usuario):**

1. El cron de cierre diario (9pm) se ejecuta en el backend
2. Genera el resumen del día para cada negocio activo
3. Llama a la API de Meta para enviar el mensaje al dueño
4. El dueño recibe el resumen en WhatsApp

### Componentes necesarios en la infra

| Componente | Qué hace | Dónde vive |
|---|---|---|
| **Webhook endpoint** | Recibe mensajes de Meta. HTTPS obligatorio con SSL válido | Servidor Nala (Hetzner) detrás de Traefik |
| **Message processor** | Parsea el webhook, identifica al usuario, extrae el mensaje | Servicio Node.js en el backend de Nala |
| **LLM router** | Envía el mensaje al LLM, recibe la intención, ejecuta la acción | Servicio Node.js que llama a OpenAI/Anthropic API |
| **WhatsApp sender** | Envía mensajes de vuelta vía Meta Cloud API | Módulo del backend que hace POST a graph.facebook.com |
| **Message queue** | Cola para mensajes salientes (resúmenes, alertas, campañas) | Redis (ya lo tenemos) |
| **Template manager** | Gestiona las plantillas de mensaje aprobadas por Meta | Tabla en PostgreSQL + panel admin |

### Requisitos de Meta

- **Cuenta de Facebook Business** (gratis)
- **App en Meta for Developers** (gratis)
- **Número de teléfono** dedicado para Nala (no puede estar registrado en WhatsApp personal)
- **Verificación de negocio** en Facebook Business (básica, no enterprise)
- **Plantillas de mensaje** aprobadas por Meta para mensajes salientes (marketing, utility)
- **Webhook URL** con HTTPS y SSL válido

### Costos estimados

| Concepto | Costo |
|---|---|
| 1,000 conversaciones de servicio/mes | Gratis (Meta no cobra) |
| Mensajes utility (confirmaciones, alertas) | ~$0.005-0.02 por mensaje |
| Mensajes marketing (campañas, resúmenes) | ~$0.03-0.07 por mensaje |
| BSP fee (360dialog o similar) | ~$0-50/mes dependiendo del volumen |
| LLM (GPT-4o-mini) por mensaje procesado | ~$0.001 por mensaje |

**Para un negocio típico:** ~50 mensajes entrantes/mes + ~60 salientes/mes = ~$2-5/mes total en costos de WhatsApp + LLM. Esto se absorbe en la suscripción Pro ($19/mes).

### Sin BSP vs con BSP

| Opción | Pros | Contras |
|---|---|---|
| **Directo a Meta Cloud API** | Gratis (solo pagas por mensajes), control total | Requiere setup técnico, gestionar tokens, manejar rate limits |
| **Vía BSP (360dialog, WhatsAble)** | Dashboard de gestión, analytics, soporte, setup más fácil | Fee mensual adicional ($0-50/mes) |

**Decisión para v1:** Empezar con acceso directo a Meta Cloud API (gratis, tenemos el equipo técnico). Migrar a BSP solo si el volumen lo justifica.

---

## 4. OCR: Desde la PWA, Directo a la Base de Datos

### Por qué no por WhatsApp

WhatsApp comprime las imágenes antes de enviarlas. Incluso con "HD quality":
- Las fotos se redimensionan y comprimen
- Los detalles finos (números pequeños, SKUs, montos) se vuelven ilegibles
- Un "$150" borroso puede leerse como "$450"

Para OCR, la calidad de la imagen es crítica. La PWA accede a la cámara nativa del dispositivo a resolución completa (12-48MP). Sin compresión. Sin intermediarios.

### Motor OCR: GPT-4o-mini con visión (v1) → PaddleOCR self-hosted (v2+)

**Decisión v1: GPT-4o-mini vision hace OCR + interpretación en un solo paso.** No microservicio. Una función dentro del backend.

**Por qué GPT-4o-mini y no PaddleOCR para v1:**

| Aspecto | PaddleOCR + LLM (2 pasos) | GPT-4o-mini vision (1 paso) |
|---|---|---|
| Precisión end-to-end | Similar (OCR + LLM corrige) | Similar o mejor (ve imagen completa con contexto) |
| Infra adicional | Microservicio Docker (2 CPU, 2GB RAM) | Cero. Una llamada a API |
| Carga en CPU del servidor | Alta (compite con backend, DB, Redis) | Cero (se procesa en servidores de OpenAI) |
| Costo por factura | ~$0.003 (OCR gratis + LLM) | ~$0.005-0.01 |
| Costo 30 facturas/mes | ~$0.09 | ~$0.15-0.30 |
| Complejidad de deploy | Docker container, mantener modelo, actualizar | Una llamada a API. Nada que mantener |
| Escalabilidad | Limitada por CPU. 500 negocios simultáneos saturan | Ilimitada. OpenAI escala por ti |
| Facturas desordenadas | OCR lee texto, LLM interpreta después | Ve la imagen completa, entiende contexto visual |
| Vendor lock-in | Ninguno | Dependencia de OpenAI |

**GPT-4o-mini gana para v1 porque:**
1. **Cero carga en CPU.** Con varios usuarios simultáneos, PaddleOCR compite por CPU con todo lo demás en Hetzner
2. **Simplicidad.** Un API call, no un microservicio + API call. Menos código, menos bugs
3. **Costo negligible.** $0.15 vs $0.09 por negocio/mes. En un plan de $19/mes, irrelevante
4. **Mejor en facturas desordenadas.** Recibos térmicos borrosos, facturas a mano, PDFs mal escaneados -- GPT-4o-mini entiende contexto visual

**Migración a PaddleOCR en v2+:** Cuando haya 1,000+ negocios y el costo de API suba, PaddleOCR self-hosted reduce costos 10-20x. Se extrae la función a un microservicio. Pero no en v1.

**No es microservicio en v1.** Es una función dentro del backend:

```typescript
async function extractInvoiceData(imageBuffer: Buffer, businessProducts: Product[]): Promise<InvoiceData> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}` }
        },
        {
          type: "text",
          text: `Extrae de esta factura: proveedor, fecha, número, y cada línea de producto con descripción, cantidad, precio unitario y total. Devuelve JSON estructurado.
          
          Productos existentes en inventario para matching:
          ${businessProducts.map(p => `${p.id}: ${p.name} (SKU: ${p.sku || 'N/A'})`).join('\n')}
          
          Para cada línea, intenta matchear con un producto existente por nombre similar o SKU exacto.`
        }
      ]
    }],
    response_format: { type: "json_object" }
  });
  return JSON.parse(response.choices[0].message.content);
}
```

**Arquitectura del pipeline OCR en producción (v1):**

```
┌──────────────┐     ┌──────────────────────────────────┐     ┌──────────────┐
│  PWA         │     │  Nala Backend                    │     │  PostgreSQL  │
│  (cámara)    │────▶│                                  │────▶│              │
│              │     │  1. Recibe imagen                │     │  Gasto       │
│  Foto full   │     │  2. Carga productos del negocio  │     │  registrado  │
│  resolución  │     │  3. Llama GPT-4o-mini vision     │     │              │
│              │     │  4. Recibe JSON estructurado      │     │  Inventario  │
│              │◀────│  5. Devuelve datos al usuario     │     │  actualizado │
│  Confirma    │     │                                  │     │              │
└──────────────┘     └──────────────────────────────────┘     └──────────────┘
                              │
                              ▼ (API call, no microservicio)
                     ┌──────────────────┐
                     │  OpenAI API      │
                     │  GPT-4o-mini     │
                     │  (visión)        │
                     │                  │
                     │  OCR + interpreta│
                     │  + matchea       │
                     │  en 1 solo paso  │
                     └──────────────────┘
```

**Paso a paso del flujo:**

1. **PWA:** Usuario toca "Escanear factura" → cámara nativa → foto a resolución completa
2. **Upload:** Imagen al backend vía POST (o IndexedDB si offline, se procesa después)
3. **Backend:** Carga los productos del negocio desde PostgreSQL para matching
4. **GPT-4o-mini vision:** Recibe imagen + lista de productos. En un solo paso: lee el texto, detecta la tabla, extrae líneas, matchea con inventario, devuelve JSON estructurado
5. **Backend:** Presenta datos al usuario en la PWA para confirmación
6. **PWA:** Usuario confirma o corrige
7. **PostgreSQL:** Se registra gasto y se actualiza inventario

### Escenario 1: Factura del proveedor (producción)

```
Foto de factura
       │
       ▼
PaddleOCR extrae texto crudo:
  "DISTRIBUIDORA HARINA VE C.A."
  "FACTURA #00234"
  "FECHA: 15/04/2026"
  ┌─────────────────────────────────────────┐
  │ DESCRIPCION    │ CANT │ P.UNIT │ TOTAL  │
  │ HARINA PAN 1KG │  10  │  15.00 │ 150.00 │
  │ ACEITE DIANA 1L│   5  │   8.00 │  40.00 │
  │ AZUCAR 1KG     │  20  │   3.50 │  70.00 │
  │                │      │ TOTAL: │ 260.00 │
  └─────────────────────────────────────────┘
       │
       ▼
LLM interpreta y matchea con inventario:
  {
    "proveedor": "Distribuidora Harina VE",
    "factura": "00234",
    "fecha": "2026-04-15",
    "items": [
      {
        "descripcion_factura": "HARINA PAN 1KG",
        "cantidad": 10,
        "precio_unitario": 15.00,
        "total": 150.00,
        "match_inventario": "Harina PAN",        ← match encontrado
        "match_confianza": 0.97,
        "match_id": "prod_001"
      },
      {
        "descripcion_factura": "ACEITE DIANA 1L",
        "cantidad": 5,
        "precio_unitario": 8.00,
        "total": 40.00,
        "match_inventario": "Aceite Diana",       ← match encontrado
        "match_confianza": 0.95,
        "match_id": "prod_015"
      },
      {
        "descripcion_factura": "AZUCAR 1KG",
        "cantidad": 20,
        "precio_unitario": 3.50,
        "total": 70.00,
        "match_inventario": null,                  ← NO encontrado
        "match_confianza": 0,
        "match_id": null
      }
    ],
    "total": 260.00
  }
       │
       ▼
PWA muestra al usuario:
  ┌─────────────────────────────────────────────────┐
  │ Factura #00234 - Distribuidora Harina VE        │
  │ 15/04/2026                                      │
  │                                                 │
  │ ✅ Harina PAN x10 → $150.00  [actualizar stock] │
  │ ✅ Aceite Diana x5 → $40.00  [actualizar stock] │
  │ ⚠️  AZUCAR 1KG x20 → $70.00  [producto nuevo]  │
  │                                                 │
  │ Total: $260.00                                  │
  │                                                 │
  │ [Confirmar y registrar]  [Corregir]             │
  └─────────────────────────────────────────────────┘
```

- Los productos con match (✅) se registran como gasto Y actualizan inventario automáticamente
- Los productos sin match (⚠️) abren el formulario de registro de producto nuevo pre-llenado con los datos de la factura (nombre, costo, cantidad). El usuario solo completa lo que falta (categoría, precio de venta) y guarda
- El match se aprende: la próxima vez que aparezca "AZUCAR 1KG" en una factura de este proveedor, Nala lo matchea automáticamente con el producto que el usuario creó

### Escenario 2: Productos con SKU (ropa, electrónica)

Cuando la factura tiene SKUs (ej: "CAM-AZL-M-001"):

1. PaddleOCR lee el SKU exacto
2. El backend busca match exacto por SKU en la tabla de productos (`WHERE sku = 'CAM-AZL-M-001'`)
3. **Si existe:** Se actualiza stock automáticamente. Sin preguntar. Match por SKU es 100% confiable
4. **Si no existe:** Se abre el formulario de producto nuevo en la PWA, pre-llenado con:
   - SKU: CAM-AZL-M-001 (del OCR)
   - Nombre sugerido: "Camisa Azul M" (el LLM interpreta el SKU si tiene patrón legible)
   - Costo: el precio unitario de la factura
   - Cantidad: la cantidad de la factura
   - El usuario completa: categoría, precio de venta, variantes si aplica
   - Guarda y el producto queda registrado con su SKU para futuros matches automáticos

**No preguntamos "¿es nuevo?".** Si el SKU no existe, es nuevo. Se abre el registro directo. Sin fricción.

### Escenario 3: Nombres genéricos y abreviaciones

Las facturas venezolanas usan abreviaciones inconsistentes. El mismo producto puede aparecer como:
- "HARINA PAN 1KG"
- "H.PAN 1K"
- "HP 1KG"
- "HARINA P.A.N."

**Cómo se resuelve:**

1. **Fuzzy matching por nombre:** Algoritmo de similitud de texto (trigrams en PostgreSQL con `pg_trgm`, o embedding search con `pgvector`). Busca el producto más parecido en el inventario
2. **Tabla de alias por proveedor:** Cuando el usuario confirma que "HP 1KG" = "Harina PAN", se guarda en una tabla `product_aliases`:

```sql
CREATE TABLE product_aliases (
  id SERIAL PRIMARY KEY,
  business_id INT REFERENCES businesses(id),
  supplier_id INT REFERENCES suppliers(id),
  alias_text TEXT NOT NULL,          -- "HP 1KG"
  product_id INT REFERENCES products(id),  -- → Harina PAN
  created_at TIMESTAMP DEFAULT NOW()
);
```

3. **La próxima vez:** Antes de fuzzy matching, se busca en la tabla de alias. Si "HP 1KG" del proveedor X ya tiene alias, se matchea instantáneamente sin LLM
4. **Con el tiempo:** Cada negocio construye su propia tabla de alias. El sistema se vuelve más rápido y preciso con cada factura procesada

### Costos en producción (v1 con GPT-4o-mini)

| Concepto | Costo |
|---|---|
| GPT-4o-mini vision por factura | ~$0.005-0.01 (imagen input + JSON output) |
| Storage de imágenes (MinIO) | Negligible (~1MB por factura) |
| Infra adicional | $0 (no hay microservicio, no hay carga en CPU) |
| **Total por factura** | **~$0.005-0.01** |
| **30 facturas/mes por negocio** | **~$0.15-0.30/mes** |

**Cuándo migrar a PaddleOCR (v2+):** Cuando el costo de API supere ~$500/mes (aprox. 1,000+ negocios activos escaneando). En ese punto, PaddleOCR self-hosted como microservicio reduce costos 10-20x. Pero para v1 con <500 negocios, GPT-4o-mini es más simple, más rápido de implementar, y el costo es absorbido por la suscripción.

### Modo offline

Si no hay internet al momento de tomar la foto:
1. La imagen se guarda en IndexedDB (almacenamiento local del navegador)
2. Se muestra: "Factura guardada. Se procesará cuando haya internet"
3. Cuando vuelve la conexión, la cola de sincronización envía la imagen al backend
4. Se procesa normalmente y el usuario recibe notificación push: "Factura #00234 procesada. Revisa los datos"
