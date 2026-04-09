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

## 4. OCR: Desde la PWA, No Desde WhatsApp

### El problema con WhatsApp

WhatsApp comprime las imágenes antes de enviarlas. Incluso con la opción "HD quality" activada:
- Las fotos se redimensionan y comprimen
- Los videos se limitan a 720p
- La resolución original se pierde
- Los detalles finos (números pequeños en una factura, texto en un recibo) se vuelven ilegibles

Para OCR, la calidad de la imagen es crítica. Un número borroso ("$150" vs "$450") puede generar un error de registro.

### La solución: OCR desde la PWA

La PWA tiene acceso directo a la cámara del dispositivo vía la API `getUserMedia` / `<input type="file" capture="camera">`. La foto se toma a resolución completa del sensor de la cámara (12-48MP en celulares modernos, incluso los de gama media).

**Flujo:**

1. El usuario abre Nala (PWA) en su celular
2. Va a "Registrar gasto" o "Escanear factura"
3. Toca el botón de cámara
4. Toma foto de la factura/recibo con la cámara nativa (resolución completa)
5. La imagen se envía al backend (o se procesa localmente si hay modelo OCR ligero)
6. OCR extrae: proveedor, monto, fecha, items, impuestos
7. Nala muestra los datos extraídos: "Proveedor: Harina Venezuela. Monto: $150. Items: 10 sacos Harina PAN. ¿Registrar como gasto?"
8. El usuario confirma o corrige
9. Se registra el gasto y se actualiza inventario si aplica

**Implementación técnica:**

| Opción | Pros | Contras | Costo |
|---|---|---|---|
| **Google Vision API** | Muy preciso, soporta español, rápido | Requiere conexión a internet | $1.50 por 1,000 imágenes |
| **AWS Textract** | Extrae tablas y formularios, muy preciso | Más caro, requiere internet | $1.50-15 por 1,000 páginas |
| **PaddleOCR (self-hosted)** | Gratis, open-source, buena precisión | Requiere GPU para velocidad, más setup | Gratis (costo de servidor) |
| **LLM con visión (GPT-4o-mini)** | Entiende contexto, no solo texto. Puede interpretar facturas desordenadas | Más lento, más caro por imagen | ~$0.01-0.03 por imagen |

**Decisión para v1:** Google Vision API para OCR base + GPT-4o-mini para interpretar el resultado y mapearlo a campos del sistema. Costo total: ~$0.01-0.04 por factura escaneada. Para un negocio que escanea 30 facturas/mes: ~$0.30-1.20/mes.

**Modo offline:** Si no hay internet al momento de tomar la foto, la imagen se guarda localmente y se procesa cuando vuelve la conexión. El usuario ve: "Factura guardada. Se procesará cuando haya internet."

### Qué pasa con WhatsApp entonces

WhatsApp sigue siendo útil para entrada de TEXTO (consultas, ventas simples, cobros). Pero para imágenes que requieren OCR, la PWA es el canal correcto. Si un usuario envía una foto por WhatsApp, Nala puede intentar procesarla pero con un disclaimer: "La imagen puede tener baja calidad. Para mejor resultado, usa el escáner en la app."
