# Extras Propuestos para Fina: Secciones B a J

> Features adicionales que se pueden agregar para modernizar Fina a 2026. Organizados por categoría con detalle de implementación, prioridad y complejidad.

---

## B. Integraciones Modernas

### B1. API REST Pública

**Qué es:** Una interfaz programática que permite a desarrolladores externos conectar sus sistemas con Fina.

**Casos de uso en Venezuela:**

- Conectar Fina con la página web del negocio para mostrar inventario en tiempo real
- Conectar con pasarelas de pago locales (Pago Móvil C2P, Mercantil, BVC, BNC, InstaPago)
- Conectar con Binance Pay y Zinli para pagos en cripto/USD
- Permitir que el contador del negocio consulte datos sin entrar a Fina
- Conectar con sistemas de delivery (PedidosYa, Yummy, etc.)

**Endpoints esenciales:**

| Endpoint | Método | Descripción |
|---|---|---|
| `/productos` | GET, POST, PUT | Consultar, crear y actualizar productos |
| `/ventas` | GET, POST | Consultar y registrar ventas |
| `/inventario` | GET, PUT | Consultar y ajustar inventario |
| `/clientes` | GET, POST, PUT | Gestión de clientes |
| `/cuentas` | GET | Consultar cuentas por cobrar/pagar |
| `/reportes` | GET | Generar reportes financieros |
| `/webhooks` | POST, DELETE | Registrar y eliminar webhooks |

**Autenticación:** API Keys por negocio con permisos configurables (solo lectura, lectura/escritura).

**Complejidad:** Alta
**Prioridad:** Media (pocos usuarios la usarían directamente, pero habilita todas las demás integraciones)

### B2. Webhooks

**Qué es:** Notificaciones automáticas que Fina envía a una URL externa cuando ocurre un evento.

**Eventos disponibles:**

| Evento | Cuándo se dispara | Uso típico |
|---|---|---|
| `venta.creada` | Se registra una venta | Notificar al contador, actualizar dashboard externo |
| `inventario.bajo` | Un producto baja del mínimo | Enviar alerta por email/Telegram |
| `pago.recibido` | Se registra un pago de cliente | Actualizar estado de cuenta |
| `cliente.nuevo` | Se registra un nuevo cliente | Agregar a lista de contactos |
| `gasto.registrado` | Se registra un gasto | Notificar al contador |
| `cierre.diario` | Se cierra el día de ventas | Enviar resumen diario por email |

**Complejidad:** Media
**Prioridad:** Media (depende de que exista la API REST primero)

### B3. Pasarelas de Pago Locales

**Integraciones prioritarias para Venezuela:**

| Pasarela | Prioridad | Razón |
|---|---|---|
| Pago Móvil C2P (Mercantil/BVC/BNC) | Alta | El método de pago más usado en Venezuela |
| Binance Pay | Alta | Muy popular para pagos en USDT |
| Zinli | Media | Creciendo rápido como billetera USD |
| InstaPago | Media | Pasarela independiente con buena cobertura |
| BDV Botón de Pago | Media | Banco con mayor base de clientes |

**Flujo de integración:**

1. Cliente compra → Fina genera orden de pago
2. Cliente paga por la pasarela seleccionada
3. Pasarela confirma el pago vía webhook/callback
4. Fina registra el pago automáticamente en la cuenta del cliente
5. Se actualiza inventario y se genera comprobante

**Complejidad:** Alta (cada pasarela tiene su propia API y proceso de afiliación)
**Prioridad:** Alta

### B4. Integración Contable

**Formatos de exportación:**

- CSV estructurado con columnas contables estándar (fecha, cuenta, debe, haber, descripción)
- Excel con formato de libro diario
- Plantillas específicas para sistemas contables venezolanos: Galac, Profit Plus, Saint, A2 Softway
- PDF de libros de compras/ventas para SENIAT

**Catálogo de cuentas configurable:** El contador del negocio configura una vez qué cuenta contable corresponde a cada tipo de transacción en Fina. Después, cada exportación sale con los asientos ya armados.

**Portal del contador:** URL dedicada donde el contador descarga los reportes sin necesidad de que el dueño se los envíe.

**Complejidad:** Media
**Prioridad:** Alta

---

## C. Inteligencia Artificial y Automatización

### C1. Predicción de Demanda

**Qué hace:** Analiza el historial de ventas y predice qué productos se van a agotar y cuándo reordenar.

**Cómo funciona:**

- Algoritmo de series temporales sobre datos de ventas (mínimo 3 meses de historial)
- Considera estacionalidad (diciembre vende más, agosto menos)
- Considera tendencias (producto que cada mes vende más)
- Genera alertas: "El producto X se agotará en ~7 días. Sugerimos pedir Y unidades."

**Valor para el usuario:** Evita quedarse sin stock de productos estrella y evita sobre-stockear productos de baja rotación.

**Complejidad:** Alta
**Prioridad:** Media

### C2. Chatbot IA para Soporte

**Qué hace:** Asistente virtual dentro de Fina que responde preguntas del usuario sobre cómo usar el sistema.

**Ejemplos de interacción:**

- "¿Cómo agrego un producto nuevo?" → Guía paso a paso
- "¿Cuánto vendí esta semana?" → Consulta la base de datos y responde con el número
- "¿Cuáles son mis productos más vendidos?" → Genera ranking en tiempo real

**Implementación:** LLM conectado a la base de datos del negocio con permisos de solo lectura. Puede usar modelos como GPT-4o-mini o Claude Haiku para mantener costos bajos.

**Complejidad:** Media-Alta
**Prioridad:** Baja (nice-to-have, no crítico)

### C3. Análisis de Rentabilidad por Producto

**Qué hace:** Identifica automáticamente qué productos generan más ganancia y cuáles son "productos muertos" (no se venden o tienen margen negativo).

**Métricas que calcula:**

| Métrica | Descripción |
|---|---|
| Margen bruto por producto | (Precio venta - Costo) / Precio venta |
| Rotación de inventario | Unidades vendidas / Stock promedio |
| Contribución al ingreso total | % que representa cada producto del total |
| Días en inventario | Cuántos días lleva un producto sin venderse |
| Score de rentabilidad | Combinación ponderada de margen + rotación |

**Alertas automáticas:**

- "Tienes 12 productos que no se venden hace más de 60 días"
- "Tu producto estrella es X con 35% de margen y 15 ventas/semana"
- "El producto Y tiene margen negativo (-5%). Revisa el precio."

**Complejidad:** Media
**Prioridad:** Alta (impacto directo en la ganancia del negocio)

### C4. Generación Automática de Reportes Narrativos

**Qué hace:** En lugar de solo gráficos y números, genera un resumen en texto natural.

**Ejemplo de reporte generado:**

> "Este mes vendiste $4,250 USD, un 12% más que el mes pasado. Tu producto más vendido fue Hamburguesa Clásica (145 unidades). Tus gastos fijos subieron 8% por el aumento del alquiler. Tu ganancia neta fue $1,890 USD. Recomendación: el producto Ensalada César tiene buen margen (40%) pero solo vendiste 8 unidades. Considera promocionarlo."

**Complejidad:** Media
**Prioridad:** Media

### C5. Detección de Anomalías

**Qué hace:** Identifica movimientos inusuales que podrían indicar errores o problemas.

**Alertas que genera:**

- "Se registró una venta de $500 cuando el promedio es $25. ¿Es correcto?"
- "El inventario de Producto X bajó 50 unidades sin venta registrada"
- "Hoy se hicieron 3 anulaciones de venta. El promedio es 0.2/día"
- "El cajero Juan registró un descuento de 80% en 5 transacciones"

**Complejidad:** Media
**Prioridad:** Alta (prevención de pérdidas y errores)

### C6. Asistente de Precios

**Qué hace:** Sugiere precios basados en costos, margen deseado y comportamiento de ventas.

**Funcionalidades:**

- Calculadora de precio sugerido: costo + margen deseado + impuestos
- Alerta cuando el costo de un producto sube y el precio de venta no se ha ajustado
- Simulador: "Si subes el precio 10%, estimamos que venderás 5% menos unidades pero ganarás 4% más"

**Complejidad:** Media
**Prioridad:** Baja

---

## D. Seguridad

### D1. Autenticación de Dos Factores (2FA/MFA)

**Qué es:** Una capa adicional de seguridad al iniciar sesión. Además de la contraseña, el usuario debe ingresar un código temporal.

**Opciones de implementación:**

| Método | Complejidad | Costo |
|---|---|---|
| Código por email | Baja | Gratis |
| Código por SMS (Twilio) | Baja | ~$0.05/SMS |
| App autenticadora (Google Authenticator, Authy) | Media | Gratis |

**Recomendación:** Empezar con código por email (gratis y simple). Agregar app autenticadora como opción avanzada.

**Complejidad:** Baja
**Prioridad:** Alta

### D2. Roles y Permisos Granulares

**Qué es:** Definir qué puede hacer cada usuario dentro del sistema.

**Roles sugeridos:**

| Rol | Permisos |
|---|---|
| **Dueño/Admin** | Acceso total. Configura todo. Ve reportes financieros. |
| **Gerente** | Ve reportes, gestiona inventario, aprueba descuentos. No configura usuarios. |
| **Cajero** | Solo registra ventas y cobros. No ve reportes financieros ni costos. |
| **Inventarista** | Solo gestiona inventario. No ve ventas ni finanzas. |
| **Mesonero/Vendedor** | Solo registra pedidos/ventas asignadas. No ve nada más. |
| **Contador** | Solo ve reportes financieros y exportaciones contables. No modifica nada. |
| **Solo lectura** | Ve todo pero no puede modificar nada. Para socios o inversionistas. |

**Permisos configurables por módulo:** Cada rol puede tener acceso habilitado/deshabilitado a: Inventario, Ventas, Cuentas, Reportes, Marketing, Configuración.

**Complejidad:** Media
**Prioridad:** Alta

### D3. Auditoría de Acciones (Log de Actividad)

**Qué es:** Registro de quién hizo qué y cuándo dentro del sistema.

**Eventos que se registran:**

- Inicio/cierre de sesión
- Creación, edición y eliminación de productos
- Registro y anulación de ventas
- Modificación de precios
- Cambios en inventario (ajustes manuales)
- Descuentos aplicados
- Cambios en configuración del sistema

**Formato del log:** Fecha/hora | Usuario | Acción | Detalle | IP

**Valor:** Permite al dueño saber si un empleado anuló ventas, modificó precios o hizo ajustes de inventario sospechosos.

**Complejidad:** Baja-Media
**Prioridad:** Alta

### D4. Cifrado y Estándares de Seguridad

**Mejoras necesarias:**

| Aspecto | Estado Actual | Mejora |
|---|---|---|
| Cifrado en tránsito | Probablemente HTTPS (no especificado) | Garantizar TLS 1.3 en todas las conexiones |
| Cifrado en reposo | No especificado | AES-256 para datos sensibles (contraseñas, datos financieros) |
| Contraseñas | No especificado | Hashing con bcrypt/argon2. Política de contraseña mínima. |
| Sesiones | No especificado | Tokens JWT con expiración. Cierre de sesión por inactividad. |

**Complejidad:** Media
**Prioridad:** Alta

### D5. Backups con Restauración

**Qué es:** El usuario puede restaurar sus datos a un punto anterior en caso de error.

**Implementación:**

- Backups automáticos diarios
- Retención de 30 días
- Botón "Restaurar datos al día X" en el panel de administración
- Confirmación por email/2FA antes de restaurar

**Complejidad:** Media
**Prioridad:** Media

---

## E. E-commerce y Omnicanalidad

### E1. Tienda Online Integrada

**Qué es:** Un catálogo web público vinculado al inventario de Fina donde los clientes pueden ver productos y hacer pedidos.

**Funcionalidades:**

- Catálogo de productos con fotos, precios y disponibilidad en tiempo real
- Carrito de compras
- Checkout con Pago Móvil C2P, Binance Pay, Zinli
- Sincronización automática con inventario de Fina (si se vende online, se descuenta del stock)
- URL personalizable: `tunegocio.fina.com.ve` o dominio propio
- Diseño responsive (móvil primero)

**Valor:** El negocio tiene presencia online sin necesidad de contratar un desarrollador web.

**Complejidad:** Alta
**Prioridad:** Media

### E2. Sincronización con Marketplaces

**Marketplaces relevantes en Venezuela:**

| Marketplace | Viabilidad | Detalle |
|---|---|---|
| MercadoLibre Venezuela | Media | Tiene API pero el mercado venezolano es limitado |
| Instagram Shopping | Alta | Muy usado en Venezuela. Catálogo vinculado a la tienda de Instagram |
| Facebook Marketplace | Media | Popular pero sin API formal para inventario |

**Complejidad:** Alta
**Prioridad:** Baja

### E3. Modo Offline / PWA

**Qué es:** Permitir que el sistema funcione sin conexión a internet y sincronice cuando vuelva la conexión.

**Crítico para Venezuela** donde los cortes de internet y electricidad son frecuentes.

**Funcionalidades offline:**

- Registrar ventas sin conexión
- Consultar inventario (última versión descargada)
- Consultar precios
- Cola de sincronización: cuando vuelve internet, todas las transacciones se suben automáticamente
- Indicador visual de "modo offline" y "sincronizando..."

**Implementación:** Progressive Web App (PWA) con Service Workers y IndexedDB para almacenamiento local.

**Complejidad:** Alta
**Prioridad:** Alta (diferenciador clave en Venezuela)

### E4. QR para Pagos

**Qué es:** Generar un código QR por cada transacción que el cliente escanea para pagar.

**Flujo:**

1. Cajero registra la venta en Fina
2. Fina genera un QR con el monto y referencia
3. Cliente escanea con su app bancaria o Binance
4. Pago se confirma automáticamente

**Complejidad:** Baja-Media
**Prioridad:** Media

---

## F. App Móvil Nativa / PWA

### F1. Progressive Web App (PWA) con Notificaciones Push

**Recomendación:** En lugar de app nativa (costosa de mantener en iOS y Android), implementar una PWA que se instala desde el navegador.

**Funcionalidades:**

- Se instala como app en el celular (ícono en pantalla de inicio)
- Notificaciones push: inventario bajo, venta registrada, pago recibido, resumen del día
- Funciona offline (ver E3)
- Escáner de código de barras usando la cámara del celular
- Interfaz optimizada para pantalla pequeña

**Ventajas sobre app nativa:**

- Una sola base de código (no hay que mantener iOS + Android por separado)
- No requiere publicación en App Store / Play Store
- Actualizaciones instantáneas (sin esperar aprobación de tiendas)
- Menor costo de desarrollo y mantenimiento

**Complejidad:** Media-Alta
**Prioridad:** Alta

### F2. Escáner de Código de Barras

**Qué es:** Usar la cámara del celular para escanear códigos de barras y buscar/agregar productos.

**Casos de uso:**

- Entrada rápida de productos al inventario
- Búsqueda rápida de producto al momento de vender
- Conteo de inventario físico (escanear y confirmar cantidad)

**Implementación:** Librería JavaScript de escaneo (ej: QuaggaJS, ZXing) integrada en la PWA.

**Complejidad:** Baja-Media
**Prioridad:** Media

---

## G. CRM y Fidelización de Clientes

### G1. Perfil de Cliente Enriquecido

**Qué es:** Ficha completa de cada cliente con todo su historial.

**Datos del perfil:**

- Nombre, teléfono, email, dirección
- Historial completo de compras (qué compró, cuándo, cuánto gastó)
- Frecuencia de visita (cada cuántos días compra)
- Ticket promedio
- Productos favoritos
- Método de pago preferido
- Saldo pendiente (si tiene crédito)
- Notas del vendedor

**Complejidad:** Baja-Media
**Prioridad:** Alta

### G2. Programa de Lealtad / Fidelización

**Qué es:** Sistema de puntos o descuentos por frecuencia de compra.

**Opciones:**

| Modelo | Cómo funciona | Ejemplo |
|---|---|---|
| Puntos por compra | 1 punto por cada $1 gastado. 100 puntos = $5 de descuento | Restaurantes, tiendas |
| Tarjeta de sellos digital | Compra 10, el 11 es gratis | Cafeterías, barberías |
| Descuento por frecuencia | 10% de descuento si compra 3 veces en el mes | Cualquier negocio |
| Nivel de cliente | Bronce/Plata/Oro según gasto acumulado | Tiendas de ropa |

**Implementación:** Todo digital dentro de Fina. El cliente no necesita app ni tarjeta física. Se identifica por teléfono o cédula.

**Complejidad:** Media
**Prioridad:** Media

### G3. Campañas por Email

**Qué es:** Envío de emails masivos a clientes con plantillas prediseñadas.

**Tipos de campaña:**

- Promociones y ofertas
- Felicitación de cumpleaños (si se tiene la fecha)
- Recordatorio de cobro (cuentas por cobrar)
- Resumen mensual para clientes frecuentes
- Nuevos productos disponibles

**Implementación:** Integración con servicio de email transaccional (Resend, Amazon SES, Mailgun). Tier gratuito de Resend: 3,000 emails/mes.

**Complejidad:** Baja-Media
**Prioridad:** Media

### G4. Segmentación de Clientes

**Qué es:** Agrupar clientes automáticamente por comportamiento de compra.

**Segmentos automáticos:**

| Segmento | Criterio |
|---|---|
| Clientes VIP | Top 10% por gasto total |
| Clientes frecuentes | Compran al menos 1 vez por semana |
| Clientes en riesgo | No compran hace más de 30 días |
| Clientes nuevos | Primera compra en los últimos 30 días |
| Clientes con deuda | Tienen saldo pendiente |
| Clientes inactivos | No compran hace más de 90 días |

**Uso:** Seleccionar un segmento y lanzar una campaña dirigida (WhatsApp, SMS o email).

**Complejidad:** Media
**Prioridad:** Alta

### G5. Encuestas de Satisfacción (NPS)

**Qué es:** Después de una compra, enviar una encuesta corta al cliente.

**Formato:** "Del 1 al 10, ¿qué tan probable es que nos recomiendes?" + comentario opcional.

**Canal de envío:** WhatsApp (link wa.me con mensaje prellenado) o email.

**Complejidad:** Baja
**Prioridad:** Baja

---

## H. Reportería Avanzada

### H1. Dashboards Personalizables

**Qué es:** El usuario elige qué métricas ver en su pantalla principal.

**Widgets disponibles:**

- Ventas del día/semana/mes
- Top 5 productos más vendidos
- Inventario bajo (productos por debajo del mínimo)
- Cuentas por cobrar vencidas
- Ganancia neta del mes
- Comparativa mes actual vs anterior
- Gráfico de ventas por hora del día
- Gráfico de ventas por día de la semana

**Implementación:** Drag-and-drop de widgets. El usuario arrastra los que quiere ver.

**Complejidad:** Media-Alta
**Prioridad:** Media

### H2. Reportes Programados

**Qué es:** Envío automático de reportes por email en horarios configurados.

**Opciones:**

| Frecuencia | Contenido | Destinatario típico |
|---|---|---|
| Diario (al cierre) | Resumen de ventas, caja, inventario bajo | Dueño |
| Semanal (lunes) | Comparativa semanal, top productos, clientes nuevos | Dueño/Gerente |
| Mensual (día 1) | Resumen financiero completo, P&L, inventario valorizado | Dueño/Contador |
| Personalizado | Lo que el usuario configure | Cualquiera |

**Formato:** PDF adjunto + resumen en el cuerpo del email.

**Complejidad:** Baja-Media
**Prioridad:** Media

### H3. Comparativas Periodo vs Periodo

**Qué es:** Comparar métricas entre dos periodos de tiempo.

**Comparativas disponibles:**

- Mes actual vs mes anterior
- Mes actual vs mismo mes del año pasado
- Semana actual vs semana anterior
- Rango personalizado vs rango personalizado

**Visualización:** Gráficos de barras lado a lado + tabla con variación porcentual.

**Complejidad:** Media
**Prioridad:** Media

### H4. KPIs Configurables

**KPIs sugeridos:**

| KPI | Fórmula | Utilidad |
|---|---|---|
| Ticket promedio | Ventas totales / Número de transacciones | Medir valor por cliente |
| Rotación de inventario | Costo de ventas / Inventario promedio | Eficiencia del inventario |
| Margen bruto | (Ventas - Costo) / Ventas × 100 | Rentabilidad |
| Días de inventario | Inventario / (Costo ventas / 365) | Cuánto dura el stock |
| Tasa de conversión | Ventas cerradas / Cotizaciones emitidas | Efectividad comercial |
| Clientes activos | Clientes con compra en últimos 30 días | Salud del negocio |

**Complejidad:** Media
**Prioridad:** Media

### H5. Exportación a Google Sheets

**Qué es:** Conexión directa con Google Sheets para que los datos se actualicen automáticamente.

**Implementación:** Google Sheets API. El usuario autoriza su cuenta de Google y selecciona qué datos exportar. Se actualiza cada hora o bajo demanda.

**Complejidad:** Media
**Prioridad:** Baja

---

## I. Gestión de Empleados

### I1. Control de Asistencia

**Qué es:** Registro de entrada y salida de empleados desde Fina.

**Funcionalidades:**

- Check-in / Check-out desde el celular o tablet del negocio
- Registro por PIN o código personal (no biométrico, para mantenerlo simple)
- Reporte de horas trabajadas por empleado por periodo
- Alertas de llegadas tarde

**Complejidad:** Baja
**Prioridad:** Baja

### I2. Comisiones por Vendedor

**Qué es:** Cálculo automático de comisiones basado en las ventas de cada vendedor.

**Configuración:**

- Porcentaje de comisión por vendedor (ej: 5% sobre ventas)
- Comisión diferenciada por producto o categoría
- Meta mensual con bonificación (ej: si vende más de $1,000, comisión sube a 7%)
- Reporte de comisiones por periodo

**Complejidad:** Baja-Media
**Prioridad:** Media

### I3. Metas y Objetivos

**Qué es:** Dashboard de rendimiento por empleado.

**Funcionalidades:**

- Definir meta mensual por vendedor (en monto o unidades)
- Barra de progreso visual: "Juan lleva $750 de $1,000 (75%)"
- Ranking de vendedores del mes
- Historial de cumplimiento de metas

**Complejidad:** Baja
**Prioridad:** Baja

### I4. Nómina Básica

**Qué es:** Cálculo simple de pagos a empleados.

**Funcionalidades:**

- Salario base por empleado
- Suma de comisiones del periodo
- Deducciones configurables (adelantos, préstamos)
- Cálculo de total a pagar
- Generación de recibo de pago en PDF

**Nota:** No es un sistema de nómina completo (no calcula prestaciones sociales, SSO, FAOV, etc.). Es un calculador básico para que el dueño sepa cuánto pagar.

**Complejidad:** Media
**Prioridad:** Baja

---

## J. Multi-sucursal y Escalabilidad

### J1. Gestión Multi-sucursal

**Qué es:** Administrar varias tiendas/sucursales desde una sola cuenta de Fina.

**Funcionalidades:**

- Dashboard consolidado: ver ventas de todas las sucursales en una pantalla
- Dashboard por sucursal: filtrar datos por ubicación
- Inventario independiente por sucursal
- Usuarios asignados a sucursales específicas
- Configuración de precios por sucursal (si aplica)

**Complejidad:** Alta
**Prioridad:** Media

### J2. Transferencias entre Sucursales

**Qué es:** Mover inventario de una sucursal a otra dentro del sistema.

**Flujo:**

1. Sucursal A crea solicitud de transferencia: "Enviar 50 unidades de Producto X a Sucursal B"
2. Se genera guía de despacho
3. Sucursal B confirma recepción
4. Inventario se ajusta automáticamente en ambas sucursales

**Complejidad:** Media
**Prioridad:** Media (solo relevante si J1 existe)

### J3. Reportes Consolidados

**Qué es:** Vista unificada de todas las sucursales.

**Reportes:**

- Ventas totales de la empresa (todas las sucursales)
- Comparativa de rendimiento entre sucursales
- Inventario total consolidado
- P&L por sucursal y consolidado

**Complejidad:** Media
**Prioridad:** Media (solo relevante si J1 existe)

### J4. Multi-moneda Real

**Qué es:** Manejo profesional de múltiples monedas con tasa de cambio automática.

**Funcionalidades:**

- Tasa BCV (Banco Central de Venezuela) actualizada automáticamente
- Tasa paralela configurable manualmente
- Registro de ventas en Bs. o USD indistintamente
- Conversión automática al momento de la venta
- Reportes en ambas monedas
- Historial de tasas aplicadas por transacción

**Fuente de tasa BCV:** API pública del BCV o scraping de la página oficial (se actualiza diariamente).

**Complejidad:** Media
**Prioridad:** Alta (fundamental para cualquier negocio en Venezuela)

---

## Resumen de Prioridades

### Prioridad Alta (implementar primero)

| # | Feature | Sección | Complejidad |
|---|---|---|---|
| 1 | Modo Offline / PWA | E3, F1 | Alta |
| 2 | Roles y permisos granulares | D2 | Media |
| 3 | 2FA/MFA | D1 | Baja |
| 4 | Auditoría de acciones | D3 | Baja-Media |
| 5 | Pasarelas de pago locales | B3 | Alta |
| 6 | Integración contable (exportación) | B4 | Media |
| 7 | Multi-moneda con tasa BCV | J4 | Media |
| 8 | Análisis de rentabilidad por producto | C3 | Media |
| 9 | Detección de anomalías | C5 | Media |
| 10 | Perfil de cliente enriquecido | G1 | Baja-Media |
| 11 | Segmentación de clientes | G4 | Media |
| 12 | Cifrado y estándares de seguridad | D4 | Media |

### Prioridad Media (segunda fase)

| # | Feature | Sección | Complejidad |
|---|---|---|---|
| 13 | API REST pública | B1 | Alta |
| 14 | Webhooks | B2 | Media |
| 15 | Tienda online integrada | E1 | Alta |
| 16 | Predicción de demanda | C1 | Alta |
| 17 | Reportes narrativos con IA | C4 | Media |
| 18 | Programa de lealtad | G2 | Media |
| 19 | Campañas por email | G3 | Baja-Media |
| 20 | QR para pagos | E4 | Baja-Media |
| 21 | Dashboards personalizables | H1 | Media-Alta |
| 22 | Reportes programados | H2 | Baja-Media |
| 23 | Comparativas periodo vs periodo | H3 | Media |
| 24 | KPIs configurables | H4 | Media |
| 25 | Comisiones por vendedor | I2 | Baja-Media |
| 26 | Multi-sucursal | J1 | Alta |
| 27 | Escáner de código de barras | F2 | Baja-Media |
| 28 | Backups con restauración | D5 | Media |

### Prioridad Baja (tercera fase / nice-to-have)

| # | Feature | Sección | Complejidad |
|---|---|---|---|
| 29 | Chatbot IA para soporte | C2 | Media-Alta |
| 30 | Asistente de precios | C6 | Media |
| 31 | Sincronización con marketplaces | E2 | Alta |
| 32 | Encuestas NPS | G5 | Baja |
| 33 | Exportación a Google Sheets | H5 | Media |
| 34 | Control de asistencia | I1 | Baja |
| 35 | Metas y objetivos | I3 | Baja |
| 36 | Nómina básica | I4 | Media |
| 37 | Transferencias entre sucursales | J2 | Media |
| 38 | Reportes consolidados | J3 | Media |
