# Nova: WhatsApp como Entrada + Diferenciadores Adicionales

> Addendum al documento de visión. WhatsApp no solo es salida, también es entrada. Y features adicionales que hacen que Nova destaque.

---

## 1. WhatsApp Como Entrada: Sí Es Posible Sin Verificación Enterprise

### Lo que cambió

La versión anterior asumía que necesitábamos la verificación multi-tenant de Meta (el proceso complicado que está en curso). Eso es para ser **BSP** (Business Solution Provider) -- es decir, para ofrecer WhatsApp API a terceros.

Pero para que **Nova use la API para sí misma** (un solo número de WhatsApp de Nova), el proceso es mucho más simple:

| Requisito | Detalle |
|---|---|
| Cuenta de Facebook Business | Gratis, se crea en business.facebook.com |
| Número de teléfono | Un número que no esté registrado en WhatsApp personal |
| BSP (Business Solution Provider) | 360dialog, WhatsAble, Twilio, o acceso directo a Cloud API |
| Verificación de negocio | Verificación básica de Facebook Business (no es la verificación enterprise de Meta) |
| Tiempo de setup | 30-60 minutos |

**No necesitamos ser BSP. No necesitamos verificación enterprise. Solo necesitamos una cuenta de Cloud API como cualquier negocio.**

### Costos de WhatsApp Cloud API

| Tipo de mensaje | Quién inicia | Costo (LATAM aprox.) |
|---|---|---|
| Service (soporte) | El usuario escribe primero | 1,000/mes GRATIS, luego ~$0.003-0.01 |
| Utility (transaccional) | Nova envía | ~$0.005-0.02 por mensaje |
| Marketing (promocional) | Nova envía | ~$0.03-0.07 por mensaje |
| Authentication (OTP) | Nova envía | ~$0.02-0.04 por mensaje |

**Las primeras 1,000 conversaciones de servicio al mes son gratis.** Esto cubre la mayoría de los casos de entrada para un negocio pequeño.

---

## 2. Cómo Funciona WhatsApp Como Entrada en Nova

El dueño del negocio le escribe al número de WhatsApp de Nova y el sistema ejecuta la acción. No es un chatbot genérico. Es un **asistente que entiende comandos naturales** y los traduce en operaciones reales dentro del sistema.

### Comandos por WhatsApp

| El usuario escribe | Nova responde | Qué pasa en el sistema |
|---|---|---|
| "cuánto vendí hoy" | "$420 en 23 ventas. 12% más que el martes pasado. Top: Pan Campesino (85u)" | Consulta de ventas del día |
| "cuánto me debe Juan" | "Juan Pérez te debe $65. Última compra: hace 12 días. ¿Le envío recordatorio?" | Consulta de cuenta por cobrar |
| "sí" (respuesta al anterior) | "Listo, le envié recordatorio a Juan al 0412-XXX-XXXX" | Envía mensaje de cobro al cliente |
| "inventario bajo" | "3 productos con stock crítico: Harina PAN (5u, ~2 días), Queso (2kg, ~1 día), Servilletas (1 paq)" | Consulta de inventario filtrado |
| "registra venta 3 pan campesino pago móvil" | "Venta registrada: 3x Pan Campesino = $4.50. Pago Móvil. ¿Correcto?" | Crea venta en el sistema |
| "sí" | "Venta #247 confirmada. Inventario actualizado." | Confirma y descuenta inventario |
| "cómo me fue esta semana" | Resumen semanal completo con comparativa | Genera reporte |
| "manda reporte al contador" | "Reporte enviado a tu contador (0414-XXX-XXXX). Incluye: libro de ventas, gastos, P&L" | Genera y envía PDF |
| "quién no viene hace un mes" | "8 clientes no compran hace 30+ días: María ($45 promedio), Pedro ($30)... ¿Les envío campaña?" | Consulta de segmento |
| "precio del pan campesino" | "Pan Campesino: costo $0.80, precio $1.50, margen 47%. Vendes ~25/día" | Consulta de producto |
| "sube el precio del pan campesino a 1.80" | "Precio actualizado: Pan Campesino $1.50 → $1.80. Nuevo margen: 56%" | Actualiza precio |
| "foto" + [imagen de factura] | "Factura detectada: Proveedor Harina Venezuela, $150, 10 sacos Harina PAN. ¿Registro como gasto?" | OCR + registro de gasto |

### Cómo se implementa

- **LLM (GPT-4o-mini / Claude Haiku)** parsea el mensaje del usuario y lo convierte en una acción estructurada
- **Function calling** ejecuta la acción en el backend de Nova (misma API que usa la app web)
- **Confirmación** antes de cualquier acción que modifique datos (ventas, precios, gastos)
- **Contexto de conversación** se mantiene por 5 minutos (para flujos de "¿le envío recordatorio?" → "sí")
- **Fallback:** Si Nova no entiende, responde: "No entendí. Puedes preguntarme sobre ventas, inventario, clientes o cuentas. O abre la app para más opciones"

### Qué SÍ se puede hacer por WhatsApp

- Consultar cualquier dato (ventas, inventario, clientes, cuentas, reportes)
- Registrar ventas simples ("3 pan campesino, pago móvil")
- Actualizar precios
- Enviar cobros a clientes
- Enviar reportes al contador
- Lanzar campañas a segmentos
- Registrar gastos con foto de factura (OCR)
- Recibir alertas y actuar sobre ellas ("¿pido más harina?" → "sí")

### Qué NO se puede hacer por WhatsApp (mejor en la app)

- Gestionar inventario completo (agregar productos con variantes, recetas, etc.)
- Ver gráficos y reportes visuales detallados
- Configurar roles, usuarios, cuentas contables
- Hacer conteo físico de inventario
- Gestionar mesas de restaurante
- Cualquier cosa que requiera ver una tabla o una lista larga

### La experiencia dual

El dueño tiene dos formas de interactuar con Nova:

| Situación | Usa |
|---|---|
| Está en el negocio, frente a la PC o tablet | La app (escritorio/PWA) -- experiencia completa |
| Está en la calle, en el carro, en la casa | WhatsApp -- consultas rápidas y acciones simples |
| Quiere ver un reporte detallado | La app |
| Quiere saber cuánto vendió hoy | WhatsApp (más rápido que abrir la app) |
| Quiere registrar una venta compleja | La app |
| Quiere registrar una venta simple | WhatsApp |
| Quiere cobrarle a un cliente | WhatsApp (un mensaje y listo) |
| Quiere configurar algo | La app |

**No compiten. Se complementan.** WhatsApp es el acceso rápido. La app es el acceso completo.

---

## 3. Diferenciadores Adicionales para que Nova Destaque

### 3.1 Foto = Dato (OCR Inteligente)

**Qué es:** Tomar foto de cualquier documento y que Nova extraiga los datos automáticamente.

| Foto de... | Nova extrae | Acción |
|---|---|---|
| Factura de proveedor | Proveedor, monto, items, fecha | Registra gasto + actualiza inventario |
| Recibo de pago | Monto, referencia, banco | Registra pago recibido en cuenta del cliente |
| Lista de productos (papel) | Nombres, precios, cantidades | Carga productos al inventario |
| Nota de entrega | Items entregados, cantidades | Confirma recepción de mercancía |

**Funciona por WhatsApp** (enviar foto al número de Nova) **y en la app** (botón de cámara).

**Implementación:** Google Vision API o AWS Textract para OCR + LLM para interpretar el contenido y mapearlo a campos del sistema.

**Por qué destaca:** Ningún competidor en Venezuela tiene esto. Elimina la entrada manual de datos, que es lo que más tiempo consume.

### 3.2 Modo Negocio Cerrado (Night Mode)

**Qué es:** Cuando el negocio cierra, Nova automáticamente:

1. Genera el cierre de caja (cuadre automático)
2. Envía resumen del día al dueño (push + WhatsApp)
3. Detecta discrepancias: "La caja debería tener $420 pero se registraron $405. Diferencia: $15"
4. Genera los asientos contables del día
5. Ejecuta backup
6. Prepara el reporte para el contador si es fin de mes

**El dueño no hace nada.** Solo recibe el resumen y confirma si todo está bien.

**Configuración:** El dueño define hora de cierre (ej: 8pm) o toca "Cerrar día" manualmente.

### 3.3 Benchmark Anónimo ("¿Cómo voy vs otros?")

**Qué es:** Comparar el rendimiento del negocio con otros negocios similares en Nova (datos anonimizados y agregados).

| Métrica | Tu negocio | Promedio panaderías en Nova |
|---|---|---|
| Ticket promedio | $3.20 | $2.80 |
| Margen bruto | 45% | 38% |
| Productos activos | 35 | 42 |
| Ventas/día promedio | $420 | $350 |

**Mensaje:** "Tu panadería vende 20% más que el promedio. Tu margen es 7 puntos mejor. Pero tienes menos variedad de productos que negocios similares."

**Por qué destaca:** Ningún competidor en Venezuela ofrece esto. Le da al dueño contexto de cómo le va vs. el mercado. Es un feature que solo es posible cuando tienes muchos negocios en la plataforma.

**Privacidad:** Datos 100% anonimizados y agregados. Ningún negocio puede ver datos de otro negocio individual. Solo promedios por categoría.

### 3.4 Asistente de Compras al Proveedor

**Qué es:** Nova genera automáticamente la lista de compras que el dueño necesita hacer al proveedor.

**Flujo:**

1. Nova analiza: stock actual + velocidad de venta + día de la semana + historial
2. Genera lista: "Esta semana necesitas pedir: 10 sacos Harina PAN ($150), 5kg Queso ($40), 20 paq Servilletas ($10). Total estimado: $200"
3. El dueño revisa y ajusta si quiere
4. Nova genera mensaje para el proveedor y abre WhatsApp: "Hola Distribuidora X, necesito: 10 sacos Harina PAN, 5kg Queso..."
5. Cuando llega la mercancía, el dueño toca "Recibido" y el inventario se actualiza

**Por qué destaca:** Cierra el ciclo completo de inventario. No solo alerta que falta algo, sino que genera la orden y la envía.

### 3.5 Historial de Precios con Contexto

**Qué es:** Cada producto tiene un historial de precios (costo y venta) con contexto de por qué cambió.

| Fecha | Costo | Precio venta | Margen | Contexto |
|---|---|---|---|---|
| 15 Mar | $0.80 | $1.50 | 47% | - |
| 1 Abr | $0.95 | $1.50 | 37% | Costo subió. Alerta: margen bajó 10 puntos |
| 2 Abr | $0.95 | $1.80 | 47% | Precio ajustado por el dueño |

**Alerta automática:** "El costo de Harina PAN subió 19% este mes. Tu precio de venta no ha cambiado. Tu margen bajó de 47% a 37%. ¿Quieres ajustar el precio?"

**Por qué destaca:** En Venezuela, los costos cambian constantemente por inflación y tipo de cambio. Este feature es crítico y ningún competidor lo tiene.

### 3.6 Modo Multi-Moneda Inteligente

**Qué es:** No solo convertir Bs./USD. Entender que en Venezuela los precios se piensan en USD pero se pagan en Bs., y que la tasa cambia todos los días.

**Funcionalidades:**

- Precios de productos siempre en USD (la referencia estable)
- Al cobrar, Nova calcula automáticamente el equivalente en Bs. a tasa BCV del momento
- Si el cliente paga en Bs., Nova registra el monto en Bs. Y el equivalente en USD
- Reportes siempre muestran ambas monedas
- Alerta si la tasa cambió más de 2% en un día: "La tasa BCV subió 3% hoy. Tus precios en Bs. se actualizaron automáticamente"
- Historial de tasa aplicada por cada transacción (para el contador)

### 3.7 Gamificación para Empleados

**Qué es:** Elementos de juego para motivar a vendedores y cajeros.

| Elemento | Cómo funciona |
|---|---|
| Ranking diario | "Juan lleva $180 en ventas hoy. María lleva $150. Pedro lleva $120" |
| Meta del día | "Meta de hoy: $500. Llevas $320 (64%)" -- barra de progreso visual |
| Racha | "Juan lleva 5 días consecutivos superando la meta" |
| Logros | "Primera venta del día", "Venta más grande de la semana", "100 ventas este mes" |
| Resumen del vendedor | Cada vendedor ve SU rendimiento al iniciar sesión (no el de otros, a menos que sea ranking) |

**Configuración:** El dueño activa/desactiva gamificación. Define meta diaria. Todo lo demás es automático.

**Por qué destaca:** Ningún sistema administrativo en Venezuela tiene gamificación. Es un diferenciador fuerte para negocios con varios empleados. Motiva sin necesidad de supervisión constante.

### 3.8 Modo Entrenamiento (Onboarding Interactivo)

**Qué es:** En lugar de tutoriales en video, Nova enseña al usuario DENTRO de la app con datos reales.

**Flujo:**

1. El usuario nuevo abre Nova por primera vez
2. Nova dice: "Vamos a registrar tu primera venta. Toca aquí"
3. El usuario toca, selecciona un producto de ejemplo
4. "Ahora selecciona cómo pagó el cliente"
5. "Listo. Esa fue tu primera venta. Así de fácil"
6. "Ahora veamos tu inventario. Toca aquí para ver tus productos"
7. Cada paso es interactivo, con datos reales del negocio (no datos de ejemplo)

**Después del onboarding:** Tips contextuales aparecen la primera vez que el usuario entra a cada sección. "Esta es tu lista de clientes. Toca cualquier nombre para ver su historial." Después de verlo una vez, no aparece más.

**Por qué destaca:** Elimina la necesidad de tutoriales en video. El usuario aprende haciendo, no mirando.

### 3.9 Compartir Catálogo por WhatsApp

**Qué es:** Generar un catálogo visual de productos (con fotos y precios) que el dueño puede compartir con clientes por WhatsApp.

**Flujo:**

1. El dueño toca "Compartir catálogo" en la app
2. Selecciona categoría (o todos los productos)
3. Nova genera una página web ligera con los productos, fotos y precios (actualizada en tiempo real)
4. El dueño comparte el link por WhatsApp: "Mira nuestros productos: nova.app/catalogo/panaderia-don-pedro"
5. El cliente ve el catálogo en su navegador (no necesita instalar nada)
6. Opcionalmente: el cliente puede tocar "Pedir" y se abre un WhatsApp al negocio con el pedido prellenado

**No es e-commerce.** No hay carrito, no hay checkout, no hay pago online. Es un catálogo visual que facilita la comunicación. El pedido se cierra por WhatsApp como ya lo hacen hoy.

**Por qué destaca:** Muchos negocios venezolanos ya venden por WhatsApp enviando fotos una por una. Esto les da un catálogo profesional con un link, sin esfuerzo.

### 3.10 Alertas Predictivas de Flujo de Caja

**Qué es:** Nova predice si el negocio va a tener problemas de efectivo en los próximos días.

**Ejemplo:** "Basado en tus ventas promedio y los gastos programados, el viernes podrías tener un déficit de $80. Tienes $200 por cobrar que podrían cubrir eso. ¿Envío recordatorio de cobro a los 3 clientes con deuda más antigua?"

**Cómo funciona:**

- Proyecta ingresos basado en promedio de ventas por día de la semana
- Suma gastos fijos conocidos (alquiler, servicios, nómina)
- Suma cuentas por pagar con fecha próxima
- Calcula balance proyectado día por día
- Alerta si algún día el balance proyectado es negativo o muy bajo

**Por qué destaca:** Pasa de "te digo cómo te fue" a "te digo cómo te va a ir". Es el feature más valioso para un dueño de negocio que vive al día.

---

## 4. Resumen de Diferenciadores Únicos de Nova

| # | Diferenciador | Quién más lo tiene | Impacto |
|---|---|---|---|
| 1 | WhatsApp como entrada (consultar, vender, cobrar, registrar gastos por chat) | Nadie en este mercado | Alto |
| 2 | Foto = Dato (OCR de facturas, recibos, listas) | QuickBooks/FreshBooks (no en Venezuela) | Alto |
| 3 | Cierre de día automático con cuadre de caja | Toast (solo restaurantes EEUU) | Alto |
| 4 | Benchmark anónimo vs negocios similares | Nadie | Medio-Alto |
| 5 | Asistente de compras al proveedor (genera orden + envía por WhatsApp) | Nadie | Alto |
| 6 | Historial de precios con alertas de margen | Nadie en este mercado | Alto |
| 7 | Multi-moneda inteligente (Bs./USD con tasa BCV automática) | Nadie (los internacionales no entienden Venezuela) | Altísimo |
| 8 | Gamificación para empleados | Nadie en sistemas admin Venezuela | Medio |
| 9 | Onboarding interactivo dentro de la app | Algunos SaaS modernos, nadie en Venezuela | Medio-Alto |
| 10 | Catálogo compartible por WhatsApp | Nadie como feature integrado | Alto |
| 11 | Alertas predictivas de flujo de caja | QuickBooks (no en Venezuela) | Altísimo |
| 12 | Inteligencia integrada en cada pantalla (no módulo aparte) | Pocos globalmente, nadie en Venezuela | Alto |
| 13 | Offline-first (funciona sin internet como estado normal) | Loyverse (básico), nadie completo | Altísimo en Venezuela |

---

## 5. Actualización al Pilar de WhatsApp

El pilar 1 del documento de visión se actualiza:

**Antes:** "WhatsApp es el mensajero, no la interfaz"

**Ahora:** "WhatsApp es un canal bidireccional. La app es la experiencia completa. WhatsApp es el acceso rápido."

- **App (escritorio/móvil):** Experiencia completa. Todas las pantallas, gráficos, tablas, configuración. Para cuando estás trabajando en el negocio.
- **WhatsApp (entrada):** Consultas rápidas, ventas simples, cobros, registrar gastos con foto. Para cuando estás fuera del negocio o quieres algo rápido.
- **WhatsApp (salida):** Resúmenes, alertas, cobros a clientes, reportes al contador, campañas. Llegan solos.

Las tres formas de interactuar con Nova son igualmente potentes. Ninguna es secundaria.
