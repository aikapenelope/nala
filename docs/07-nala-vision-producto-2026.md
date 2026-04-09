# Nala: Visión de Producto 2026 (v2)

> Un sistema administrativo completo para PyMEs venezolanas. Potente en escritorio, igual de potente en móvil, con WhatsApp como canal de salida. No es un chatbot. Es un producto de verdad.

---

## Corrección de Rumbo

La versión anterior de este documento se inclinó demasiado hacia "WhatsApp es la interfaz". Eso convierte a Nala en un bot, no en un producto. Y se parece demasiado a Aurora (voice-first, conversacional).

Nala es diferente:

- **Aurora** = PWA voice-first para interacción con clientes finales del negocio
- **Nala** = Sistema administrativo completo para el dueño y sus empleados

Nala es una **aplicación de verdad** con pantallas, tablas, gráficos, formularios y flujos completos. Funciona en escritorio (pantalla grande, teclado, mouse) y en móvil (PWA, táctil, bolsillo). WhatsApp es un canal de salida para notificaciones y cobros, no la interfaz principal.

---

## La Tesis Revisada

El dueño de una PyME venezolana necesita un sistema que:

1. **Sea completo:** Ventas, inventario, cuentas, clientes, reportes, contabilidad. Todo en un lugar
2. **Sea fácil:** Cada pantalla tiene un propósito claro. No hay menús con 47 opciones. Pero todo está ahí cuando lo necesitas
3. **Sea potente:** Gráficos que se entienden, reportes que dicen algo útil, alertas que te ahorran dinero
4. **Funcione siempre:** Offline, en 3G, en un celular de $100, en una PC vieja con Chrome
5. **Se sienta 2026:** Rápido, bonito, inteligente. No un formulario de los 2000 con fondo gris

---

## Los 3 Pilares (Revisados)

### Pilar 1: Producto completo, experiencia simple

Nala tiene todas las capacidades de un sistema administrativo profesional. Pero cada feature se presenta de la forma más simple posible. La potencia está disponible, no impuesta.

- En escritorio: layout completo con sidebar, tablas con filtros, gráficos interactivos, atajos de teclado
- En móvil: la misma funcionalidad adaptada a pantalla táctil, con navegación por tabs y gestos
- Misma base de datos, misma sesión, cambio fluido entre dispositivos

### Pilar 2: Offline-first como arquitectura

No es un "modo offline" que se activa cuando falla internet. Es la forma en que Nala funciona siempre. Los datos viven en el dispositivo. Se sincronizan cuando hay conexión. El usuario nunca ve un spinner de carga ni un error de red.

### Pilar 3: Inteligencia integrada en cada pantalla

La IA no es un módulo aparte. Está integrada en cada pantalla del producto:

- En inventario: predicciones de agotamiento junto a cada producto
- En ventas: comparativa automática con periodos anteriores
- En clientes: segmentos y alertas junto al perfil
- En reportes: narrativas generadas junto a los gráficos
- En cobros: priorización inteligente de a quién cobrar primero

No hay un "botón de IA". La inteligencia es parte del producto como el color es parte del diseño.

---

## Experiencia en Escritorio (Desktop)

El dueño o gerente que trabaja desde una PC o laptop tiene acceso a la experiencia completa.

### Layout principal

```
┌─────────────────────────────────────────────────────────┐
│  Nala          Panadería Don Pedro       Bs/USD: 36.50  │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│  Inicio  │   Hoy: $420 vendidos                        │
│          │   ▲ 12% vs martes pasado                    │
│  Vender  │                                              │
│          │   ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  Invent. │   │ 23 ventas│ │ $95 x cob│ │ 3 stock ↓│   │
│          │   └──────────┘ └──────────┘ └──────────┘   │
│  Clientes│                                              │
│          │   Ventas últimos 7 días                      │
│  Cuentas │   ████████████████████                       │
│          │   █████████████████                          │
│  Reportes│   ████████████████████████                   │
│          │   ██████████████████                         │
│  Contab. │                                              │
│          │   Top productos hoy        Alertas           │
│  Config. │   1. Pan campesino (85u)   ⚠ Harina PAN:   │
│          │   2. Cachitos (42u)          se acaba en     │
│          │   3. Café con leche (38u)    ~2 días         │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

### Pantallas principales en escritorio

#### Inicio (Dashboard)

- Número grande: ventas del día en USD (con equivalente en Bs. al lado)
- 3 tarjetas: total ventas, pendiente por cobrar, productos con stock bajo
- Gráfico de ventas de los últimos 7 días (barras, simple, con comparativa semana anterior en gris)
- Top 5 productos del día
- Panel de alertas inteligentes (máximo 5, priorizadas por impacto)
- Comparativa automática: "12% más que el martes pasado" o "15% menos, revisa qué pasó"

#### Vender

- Buscador de productos con autocompletado (escribir o escanear código de barras)
- Lista de venta activa con cantidades editables
- Selector de método de pago (iconos grandes: Efectivo, Pago Móvil, Binance, Zinli, Transferencia, Zelle, Fiado)
- Botón de cobrar que cierra la venta en un click
- Para restaurantes: vista de mesas con estado (libre, ocupada, cuenta pedida)
- Historial de ventas del día con filtros (por vendedor, por método de pago, por hora)
- Atajo de teclado: F2 para nueva venta, Enter para confirmar

#### Inventario

- Tabla de productos con columnas: nombre, stock, costo, precio, margen, estado
- Estado con semáforo visual: verde (OK), amarillo (bajo), rojo (crítico), gris (sin movimiento 60+ días)
- Columna de predicción: "Se acaba en ~X días" junto a cada producto
- Filtros rápidos: todos, stock bajo, sin movimiento, por categoría
- Edición inline: click en precio o stock para editar directo en la tabla
- Importación masiva desde Excel con mapeo inteligente de columnas
- Botón "Agregar producto" con formulario mínimo: nombre, costo, precio, stock inicial. Todo lo demás es opcional
- Vista de recetas (restaurantes): ingredientes por plato, costo calculado automáticamente

#### Clientes

- Lista de clientes con búsqueda instantánea
- Cada cliente muestra: nombre, última compra, frecuencia, total gastado, saldo pendiente
- Badges automáticos: "VIP", "Nuevo", "En riesgo", "Con deuda"
- Click en un cliente abre ficha completa:
  - Datos de contacto
  - Historial de compras (timeline visual)
  - Productos favoritos
  - Gráfico de gasto mensual
  - Saldo pendiente con botón "Cobrar por WhatsApp"
  - Notas del vendedor
- Segmentos predefinidos con un click: VIP, frecuentes, en riesgo, nuevos, con deuda, inactivos
- Desde cualquier segmento: "Enviar campaña" genera mensajes WhatsApp personalizados

#### Cuentas

- Vista dividida: Por cobrar | Por pagar
- Cada cuenta muestra: cliente/proveedor, monto, antigüedad, estado
- Código de color por antigüedad: verde (<15 días), amarillo (15-30), rojo (>30)
- Acciones rápidas: marcar como pagado, cobrar por WhatsApp, ver historial
- Resumen arriba: total por cobrar, total por pagar, balance neto
- Filtros: por antigüedad, por monto, por cliente

#### Reportes

- Reportes pre-construidos (no configurables, pero completos):
  - **Resumen del día:** ventas, gastos, ganancia, comparativa
  - **Resumen de la semana/mes:** tendencias, top productos, top clientes
  - **Rentabilidad por producto:** margen, rotación, contribución, score
  - **Movimiento de inventario:** entradas, salidas, ajustes, valorización
  - **Cuentas por cobrar aging:** desglose por antigüedad
  - **Ventas por vendedor:** ranking, comisiones, metas
  - **Resumen financiero:** ingresos, costos, gastos, ganancia bruta/neta (P&L simplificado)
- Cada reporte tiene:
  - Gráfico visual (barras o líneas, según el dato)
  - Tabla con los números
  - Párrafo narrativo generado por IA: "Este mes vendiste 8% más que el anterior. Tu producto estrella fue..."
  - Botón "Exportar PDF" y botón "Enviar al contador por WhatsApp"
- Selector de periodo: hoy, esta semana, este mes, mes anterior, rango personalizado
- Todos los montos en USD con equivalente en Bs. (tasa BCV del día)

#### Contabilidad (Puente)

- Catálogo de cuentas pre-configurado por tipo de negocio (editable por el contador)
- Vista de asientos generados automáticamente a partir de ventas, compras y gastos
- Exportación en formatos:
  - PDF con formato de libro diario
  - Excel con columnas contables estándar (fecha, cuenta, debe, haber, descripción)
  - Formato específico para Galac, Profit Plus, Saint (seleccionable)
- Libro de ventas y libro de compras en formato SENIAT
- Botón "Enviar al contador": genera el paquete completo y abre WhatsApp con el archivo adjunto
- Portal del contador (URL dedicada, solo lectura): el contador entra con su propio login y descarga lo que necesita

#### Configuración

- Datos del negocio (nombre, RIF, dirección, logo)
- Usuarios y roles:
  - **Dueño/Admin:** acceso total
  - **Gerente:** ve reportes, gestiona inventario, no configura usuarios
  - **Cajero:** solo vende y cobra, no ve costos ni reportes financieros
  - **Inventarista:** solo gestiona inventario
  - **Contador:** solo ve reportes y exportaciones contables
- Métodos de pago habilitados
- Categorías de productos
- Tasa de cambio: BCV automática (con opción de tasa manual paralela)
- Notificaciones: qué alertas recibir y por dónde (push, WhatsApp)
- Seguridad: 2FA, cambio de contraseña, sesiones activas
- Log de actividad: tabla con todas las acciones de todos los usuarios

---

## Experiencia en Móvil (PWA)

La misma funcionalidad, adaptada a pantalla pequeña. No es una versión recortada. Es la misma app con layout diferente.

### Navegación

Barra inferior con 5 tabs: Inicio | Vender | Inventario | Clientes | Más (cuentas, reportes, config)

### Diferencias con escritorio

| Acción | Escritorio | Móvil |
|---|---|---|
| Buscar producto | Escribir en buscador | Escribir o escanear código de barras con cámara |
| Ver inventario | Tabla completa con columnas | Lista con cards, swipe para acciones |
| Registrar venta | Click en productos + Enter | Tap en productos + botón grande "Cobrar" |
| Ver reportes | Gráficos + tablas lado a lado | Gráficos apilados, scroll vertical |
| Cobrar por WhatsApp | Click en botón, se abre WhatsApp web | Tap en botón, se abre WhatsApp nativo |
| Escanear código | Webcam (si tiene) | Cámara del celular (nativo, rápido) |

### Optimizaciones móviles

- Botones grandes (mínimo 48px) para dedos, no para mouse
- Gestos: swipe left en un producto para editar stock, swipe right para ver detalle
- Pull-to-refresh para sincronizar manualmente
- Indicador de estado de conexión siempre visible (verde = online, gris = offline)
- Notificaciones push nativas (inventario bajo, venta grande, anomalía, resumen del día)
- Modo landscape para tablets (layout de 2 columnas, similar a escritorio)

---

## WhatsApp como Canal de Salida (No Interfaz)

WhatsApp no es donde el usuario trabaja. Es donde Nala le **envía cosas** y donde el usuario **ejecuta cobros**. La diferencia es importante.

### Lo que sale por WhatsApp

| Qué | Cuándo | Cómo |
|---|---|---|
| Resumen diario | 9pm automático | Mensaje con: ventas, ganancia, top producto, alertas. Generado por Nala, enviado vía push o Twilio |
| Resumen semanal | Lunes 8am | Comparativa semanal, tendencias, recomendaciones |
| Cobro a cliente | Cuando el usuario toca "Cobrar" | Link wa.me con mensaje personalizado. El usuario toca y envía desde su WhatsApp |
| Recibo de venta | Cuando el usuario toca "Enviar recibo" | PDF generado + link wa.me |
| Campaña de marketing | Cuando el usuario la lanza desde Nala | Lista de mensajes personalizados listos para enviar por lista de difusión |
| Reporte al contador | Cuando el usuario toca "Enviar al contador" | PDF/Excel adjunto + link wa.me |
| Alerta crítica | Cuando ocurre (stock agotado, anomalía grave) | Push notification + opcionalmente WhatsApp |

### Lo que NO pasa por WhatsApp

- Registrar ventas (eso se hace en la app)
- Gestionar inventario (eso se hace en la app)
- Ver reportes completos (eso se hace en la app)
- Configurar el sistema (eso se hace en la app)
- Consultar clientes (eso se hace en la app)

WhatsApp es el **mensajero**, no el **cerebro**.

---

## Inteligencia Integrada en Cada Pantalla

La IA no es un módulo. Es una capa que enriquece cada pantalla del producto.

### Cómo se ve en cada pantalla

| Pantalla | Sin IA (Fina) | Con IA integrada (Nala) |
|---|---|---|
| **Inventario** | Lista de productos con stock | Cada producto tiene: "Se acaba en ~X días". Productos muertos marcados en gris. Semáforo de estado |
| **Dashboard** | Número de ventas del día | "Vendiste 12% más que el martes pasado. Tu mejor hora fue 10-11am. Mañana es miércoles, históricamente tu mejor día" |
| **Clientes** | Lista de nombres | Badges automáticos (VIP, en riesgo). "María no viene hace 12 días, normalmente viene cada 7" |
| **Reportes** | Gráficos y tablas | Párrafo narrativo debajo de cada gráfico explicando qué significan los números y qué hacer |
| **Cuentas por cobrar** | Lista de deudas | Ordenadas por probabilidad de cobro. "Juan siempre paga cuando le recuerdas. Pedro tiene 3 deudas vencidas" |
| **Ventas** | Historial de transacciones | "3 anulaciones hoy, el promedio es 0.2. Revisar cajero Juan" |
| **Producto individual** | Nombre, precio, stock | "Este producto tiene margen de 45% y se vende 3 veces al día. Es tu #2 más rentable" |

### Cómo se implementa

- Los insights se calculan en el backend con queries SQL + lógica simple (no necesita ML complejo para el 80% de los casos)
- Los reportes narrativos usan GPT-4o-mini / Claude Haiku (costo ~$0.001 por generación)
- Se pre-calculan en batch (no en tiempo real) para no depender de conexión
- Se cachean localmente para funcionar offline
- Se actualizan cuando hay sincronización

---

## Features Completos de Nala v1.0

### Ventas

- Registro de venta en 3-4 pasos (buscar/escanear → cantidad → método de pago → confirmar)
- Funciona offline con sincronización automática
- 7 métodos de pago: efectivo, Pago Móvil, Binance, Zinli, transferencia, Zelle, fiado
- Gestión de mesas para restaurantes (vista visual de mesas con estado)
- Seguimiento de repartidores
- Control por vendedor/mesonero (quién vendió qué)
- Descuento automático de ingredientes por receta
- Escaneo de código de barras (cámara en móvil, webcam en escritorio)
- Historial de ventas con filtros (fecha, vendedor, método de pago, producto)
- Anulación de ventas con motivo obligatorio (queda en log)
- Descuentos por porcentaje o monto fijo
- Cotizaciones: crear, enviar por WhatsApp, convertir en venta con un click

### Inventario

- Productos con variantes (talla, color, referencia, modelo)
- Fechas de vencimiento con alertas
- Semáforo de stock: verde, amarillo, rojo, gris (sin movimiento)
- Predicción de agotamiento por producto ("se acaba en ~X días")
- Importación masiva desde Excel con mapeo inteligente
- Conteo físico con escáner (escanear → confirmar cantidad → ajustar)
- Categorías de productos (pre-configuradas por tipo de negocio, editables)
- Recetas con cálculo de costo automático (restaurantes)
- Alertas de productos muertos (sin movimiento 60+ días)
- Análisis de rentabilidad: margen, rotación, score, junto a cada producto
- Edición inline en tabla (click/tap para editar precio o stock)

### Clientes y CRM

- Perfil automático: historial, frecuencia, ticket promedio, productos favoritos, saldo
- Segmentos automáticos: VIP, frecuentes, en riesgo, nuevos, con deuda, inactivos
- Badges visuales en toda la app (al ver un cliente en cualquier pantalla)
- Ficha completa con timeline de compras y gráfico de gasto
- Notas del vendedor por cliente
- Cobro por WhatsApp desde la ficha del cliente (un toque)
- Campañas por segmento: seleccionar segmento → generar mensajes → enviar por WhatsApp

### Cuentas

- Por cobrar y por pagar en vista dividida
- Código de color por antigüedad
- Cobro masivo por WhatsApp ("Cobrar a todos los vencidos")
- Registro de pagos con conciliación básica
- Resumen: total por cobrar, total por pagar, balance neto
- Historial de pagos por cliente/proveedor

### Reportes

- 7 reportes pre-construidos con gráficos + tablas + narrativa IA
- Selector de periodo flexible
- Exportación PDF y Excel
- Envío al contador por WhatsApp
- Comparativas automáticas (periodo actual vs anterior)
- Todos los montos en USD + Bs. (tasa BCV)

### Contabilidad

- Catálogo de cuentas pre-configurado (editable)
- Asientos automáticos desde ventas/compras/gastos
- Exportación: PDF libro diario, Excel contable, formatos Galac/Profit Plus/Saint
- Libros de compras/ventas formato SENIAT
- Portal del contador (URL dedicada, solo lectura)

### Seguridad

- 2FA por email
- 5 roles: Dueño, Gerente, Cajero, Inventarista, Contador
- Log de actividad completo
- Backups automáticos con indicador visible
- Cierre de sesión por inactividad
- Tasa BCV automática

### Plataforma

- PWA instalable (<500KB, <2s en 3G)
- Offline-first con sincronización automática
- Responsive: escritorio completo + móvil optimizado + tablet
- Notificaciones push
- WhatsApp como canal de salida (cobros, reportes, alertas, recibos)
- Escaneo de código de barras vía cámara

---

## Lo que NO tiene en v1.0

| Feature | Por qué esperar |
|---|---|
| API REST / Webhooks | Se agrega en v3 cuando haya demanda de integraciones |
| Tienda online | Requiere ecosistema de e-commerce. v3 |
| Multi-sucursal | <5% del mercado. v3 |
| Nómina | Complejidad legal. Fuera de scope |
| Programa de lealtad | v2, versión simple ("Compra 10, el 11 gratis") |
| Integración con marketplaces | Mercado mínimo en Venezuela |
| Embedded finance / préstamos | Requiere licencia financiera |
| Chatbot / modo conversacional | Nala es una app, no un bot |

---

## Modelo de Negocio

| Plan | Precio | Incluye |
|---|---|---|
| **Gratis** | $0/mes | 1 usuario, 50 productos, ventas ilimitadas, offline, dashboard básico, inventario |
| **Pro** | $19/mes | Usuarios ilimitados, productos ilimitados, inteligencia (predicciones, alertas, narrativas), 5 roles, cobros WhatsApp, exportación contable, 2FA, reportes completos |
| **Negocio** | $35/mes | Todo Pro + soporte prioritario, onboarding asistido, portal del contador, campañas WhatsApp, segmentación de clientes, cotizaciones |

---

## Stack Técnico

| Capa | Tecnología | Por qué |
|---|---|---|
| Frontend | Nuxt 3 (Vue) PWA | SSR + offline-first. Responsive nativo. TypeScript. Ligero |
| DB local | IndexedDB (Dexie.js) | Almacenamiento offline, sincronización |
| Backend | Node.js + Hono/Fastify | Rápido, TypeScript, ligero |
| Base de datos | PostgreSQL + pgvector | Relacional sólido, búsqueda semántica futura |
| Cache | Redis | Sesiones, tasa BCV, colas |
| Storage | MinIO | Fotos, PDFs, backups |
| IA | GPT-4o-mini / Claude Haiku | Narrativas, clasificación, anomalías (~$0.001/consulta) |
| Tasa BCV | Scraper / API pública | Actualización diaria |
| Notificaciones | Web Push + Twilio fallback | Push gratis, SMS como respaldo |
| WhatsApp | Links wa.me (v1) → BSP (v2) | Sin dependencia Meta API en v1 |
| Hosting | Hetzner (hel1) | Económico, ya tenemos infra |
| CI/CD | GitHub Actions + Coolify | Deploy automático |

---

## Roadmap

### v1.0 - Producto Completo (4-5 meses)

- PWA offline-first con experiencia completa en escritorio y móvil
- Ventas con todos los métodos de pago + escaneo de código de barras
- Inventario con variantes, vencimiento, semáforo, predicciones
- Clientes con perfil automático y segmentos
- Cuentas por cobrar/pagar con cobro por WhatsApp
- Reportes pre-construidos con gráficos + narrativa IA
- Exportación contable + portal del contador
- 5 roles, 2FA, log de actividad
- Tasa BCV automática
- Plan gratis funcional

### v2.0 - Crecimiento (3 meses después)

- Integración Pago Móvil C2P
- Campañas WhatsApp con segmentación
- Cotizaciones con aprobación online
- Programa de lealtad simple
- Órdenes de compra a proveedores
- Escáner OCR de recibos/facturas

### v3.0 - Escala (4 meses después)

- Multi-sucursal con transferencias
- API REST pública
- Tienda online básica
- Expansión LATAM (Colombia, Ecuador, Perú)

---

## Resumen

> **Nala es un sistema administrativo completo que se siente moderno, funciona sin internet, y tiene inteligencia integrada en cada pantalla. WhatsApp es su mensajero, no su interfaz. Es potente en escritorio y en el bolsillo.**

No es un bot. No es un chatbot. No es "WhatsApp con features". Es una aplicación profesional diseñada para que un dueño de negocio venezolano tenga en sus manos lo que antes solo tenían empresas grandes, pero sin la complejidad que viene con eso.
