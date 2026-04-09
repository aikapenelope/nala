# Nala: Especificación Final de Producto

> Documento definitivo que consolida capacidades, arquitectura y funcionamiento. Referencia para construir el producto.

---

## 1. Qué es Nala

Backoffice operativo para comerciantes y PyMEs en mercados emergentes, empezando por Venezuela. Ventas, inventario, clientes, cuentas, reportes y contabilidad en un solo lugar. Tres formas de acceso: escritorio (experiencia completa), móvil PWA (misma funcionalidad), WhatsApp (acceso rápido bidireccional). Funciona sin internet. Inteligencia integrada en cada pantalla.

**Nicho:** El dueño-operador de 1-30 empleados. Panaderías, ferreterías, tiendas de ropa, restaurantes, autopartes, peluquerías, bodegas, farmacias.

**Posicionamiento:** Fácil como un cuaderno, potente como un ERP, inteligente como un socio que sabe de números.

---

## 2. Principios de Diseño

1. **Producto completo, experiencia simple.** La potencia está disponible, no impuesta. Cada pantalla tiene UN propósito claro.
2. **Offline-first.** Los datos viven en el dispositivo. Se sincronizan cuando hay conexión. El usuario nunca ve un spinner ni un error de red.
3. **Inteligencia invisible.** La IA está integrada en cada pantalla. El usuario ve resultados ("se acaba en 2 días"), no algoritmos.
4. **WhatsApp como canal, no como interfaz.** La app es la experiencia completa. WhatsApp es el acceso rápido para consultas y cobros.
5. **Construido desde cero.** No montado sobre ERPNext, Odoo ni otro ERP. El producto ES el diferenciador.

---

## 3. Capacidades Completas

### 3.1 Vender

- Registro de venta en 3-4 toques: grid de productos (más vendidos primero) → toque para agregar → botón "Cobrar $XX" → método de pago → confirmado
- Búsqueda por texto con autocompletado + escáner de código de barras (cámara del celular)
- 7 métodos de pago: efectivo, Pago Móvil, Binance, Zinli, transferencia, Zelle, fiado
- Fiado vinculado al cliente (genera cuenta por cobrar automáticamente)
- Descuentos por línea y por ticket (porcentaje o monto fijo)
- Gestión de mesas para restaurantes (vista visual con estado: libre, ocupada, cuenta pedida)
- Seguimiento de repartidores y vendedores (quién vendió qué, con PIN)
- Descuento automático de ingredientes por receta (restaurantes): al vender un plato, los ingredientes se descuentan del inventario
- Cotizaciones: crear, enviar por WhatsApp, convertir en venta con un toque
- Anulación de ventas con motivo obligatorio (queda en log de actividad)
- Historial de ventas con filtros: fecha, vendedor, método de pago, producto
- Funciona offline. Sincroniza cuando hay internet

### 3.2 Inventario

- Productos con variantes (talla, color, referencia, modelo). Estructura: producto padre → variantes hijas, cada una con SKU, stock, costo, precio propio
- Unidades de medida con conversión: producto se vende en unidades pero se compra en cajas (1 caja = 12 unidades)
- Fechas de vencimiento con alertas
- Semáforo de stock visual: verde (OK), amarillo (bajo), rojo (crítico), gris (sin movimiento 60+ días)
- Predicción de agotamiento: "Se acaba en ~X días" junto a cada producto (basado en velocidad de venta)
- Análisis de rentabilidad por producto: margen bruto, rotación, contribución al ingreso, score de rentabilidad
- Detección de productos muertos (sin movimiento 60+ días)
- Importación masiva desde Excel con mapeo inteligente de columnas
- Conteo físico con escáner: escanear código de barras → confirmar cantidad → ajustar stock
- Categorías pre-configuradas por tipo de negocio (editables)
- Recetas con cálculo de costo automático (restaurantes)
- Edición inline: toque en precio o stock para editar directo en la tabla/lista
- Historial de precios por producto con contexto: alerta cuando el costo sube y el margen baja

### 3.3 Clientes y CRM

- Perfil automático por cliente: historial de compras, frecuencia de visita, ticket promedio, productos favoritos, método de pago preferido, saldo pendiente
- Segmentos automáticos: VIP (top 10% gasto), frecuentes (1+/semana), en riesgo (30+ días sin compra), nuevos (últimos 30 días), con deuda, inactivos (90+ días)
- Badges visuales en toda la app (al ver un cliente en cualquier pantalla)
- Ficha completa con timeline de compras y gráfico de gasto mensual
- Notas del vendedor por cliente
- Cobro por WhatsApp desde la ficha (un toque)
- Campañas por segmento: seleccionar segmento → generar mensajes personalizados → enviar por WhatsApp

### 3.4 Cuentas por Cobrar y Pagar

- Vista dividida: Por cobrar | Por pagar
- Código de color por antigüedad: verde (<15 días), amarillo (15-30), rojo (>30)
- Cobro masivo por WhatsApp: "Cobrar a todos los vencidos" genera mensajes personalizados
- Registro de pagos con conciliación básica: "¿Este pago de $50 por Pago Móvil es de Juan?" → Sí/No
- Resumen: total por cobrar, total por pagar, balance neto
- Alertas predictivas de flujo de caja: proyecta ingresos y gastos, alerta si viene un déficit, sugiere cobros

### 3.5 Reportes

- 7 reportes pre-construidos (no configurables, pero completos):
  1. Resumen del día: ventas, gastos, ganancia, comparativa con día anterior y mismo día semana pasada
  2. Resumen semanal/mensual: tendencias, top productos, top clientes
  3. Rentabilidad por producto: margen, rotación, contribución, score
  4. Movimiento de inventario: entradas, salidas, ajustes, valorización
  5. Cuentas por cobrar aging: desglose por antigüedad
  6. Ventas por vendedor: ranking, totales, ticket promedio
  7. Resumen financiero: ingresos, costos, gastos, ganancia bruta/neta (P&L simplificado)
- Cada reporte tiene: gráfico visual + tabla con números + párrafo narrativo generado por IA
- Selector de periodo: hoy, esta semana, este mes, mes anterior, rango personalizado
- Todos los montos en USD con equivalente en Bs. (tasa BCV del día)
- Exportación PDF y Excel
- Botón "Enviar al contador por WhatsApp"
- Resumen diario automático (push notification a las 9pm)
- Resumen semanal automático (lunes 8am)

### 3.6 Contabilidad (Puente al Contador)

Nala no es un sistema contable. Es un puente entre las operaciones del negocio y el contador.

- Catálogo de cuentas pre-configurado por tipo de negocio. El contador lo ajusta una vez
- Cada venta, gasto y pago genera asientos contables automáticamente (invisible para el usuario)
- Botón "Enviar al contador": genera paquete completo (Excel libro diario + resumen ventas/gastos + P&L) y abre WhatsApp con archivo adjunto
- Libros de compras y ventas en formato SENIAT
- Formatos específicos para Galac y Profit Plus en v2
- El usuario nunca ve "debe", "haber", ni "asiento contable". Solo ve "Enviar al contador"

### 3.7 OCR de Facturas (Foto = Dato)

Desde la PWA (cámara nativa, resolución completa). No por WhatsApp (comprime imágenes).

**Motor v1:** GPT-4o-mini vision. Un solo API call hace OCR + interpretación + matching. No microservicio. Función dentro del backend.

**Flujo:**
1. Usuario toca "Escanear factura" → cámara nativa → foto a resolución completa
2. Imagen al backend → GPT-4o-mini vision extrae: proveedor, fecha, cada línea de producto con cantidad y precio
3. Matching con inventario:
   - **SKU exacto encontrado:** actualiza stock automáticamente, sin preguntar
   - **Nombre similar encontrado (fuzzy match):** muestra match sugerido, usuario confirma
   - **No encontrado:** abre formulario de producto nuevo pre-llenado con datos de la factura
4. Usuario confirma → se registra gasto + se actualiza inventario
5. Tabla de alias por proveedor: cada match confirmado se aprende para la próxima vez

**Costo:** ~$0.005-0.01 por factura. ~$0.15-0.30/mes por negocio (30 facturas).

**Migración v2+:** PaddleOCR self-hosted como microservicio cuando haya 1,000+ negocios.

### 3.8 WhatsApp Bidireccional

**Infraestructura:** WhatsApp Cloud API directo (Meta), sin BSP en v1. Webhook HTTPS en servidor Nala. LLM (GPT-4o-mini) interpreta mensajes entrantes y ejecuta acciones.

**Salida (Nala → usuario):**
- Resúmenes diarios y semanales automáticos
- Alertas críticas (stock agotado, anomalía)
- Cobros a clientes (mensaje personalizado con monto)
- Reportes al contador (PDF adjunto)
- Campañas de marketing por segmento
- Recibos digitales de venta

**Entrada (usuario → Nala):**
- Consultar: "cuánto vendí hoy", "cuánto me debe Juan", "inventario bajo"
- Actuar: "registra venta 3 pan campesino pago móvil", "sube precio del pan a 1.80"
- Cobrar: "cobra a todos los que deben más de 30 días"
- Confirmar: responder "sí" a sugerencias de Nala

**Lo que NO se hace por WhatsApp:** gestión completa de inventario, reportes visuales detallados, configuración, conteo físico, OCR de facturas.

**Costos:** 1,000 conversaciones de servicio/mes gratis. Mensajes utility ~$0.01, marketing ~$0.05. Total ~$2-5/mes por negocio.

### 3.9 Control y Seguridad

- **2 roles:** Dueño (ve todo, configura todo) y Empleado (solo vende y consulta, no ve costos ni reportes financieros)
- **PIN por usuario:** cada empleado tiene PIN propio. Cada acción queda registrada con quién la hizo
- **Log de actividad:** login/logout, ventas, anulaciones, cambios de precio, ajustes de inventario, descuentos. Formato: fecha/hora | usuario | acción | detalle
- **2FA por email** para el Dueño
- **Cierre de día automático:** cuadre de caja, detección de discrepancias ("la caja debería tener $420 pero se registraron $405"), resumen al dueño, asientos contables del día, backup
- **Backups automáticos** con indicador visible: "Último respaldo: hace 2 horas"
- **Tasa BCV automática** (actualización diaria, sin configuración)
- **Gamificación para vendedores:** ranking diario, meta del día con barra de progreso, rachas, logros

### 3.10 Multi-moneda

- Precios de productos siempre en USD (referencia estable)
- Al cobrar, Nala calcula equivalente en Bs. a tasa BCV del momento
- Si el cliente paga en Bs., se registra monto en Bs. y equivalente en USD
- Reportes siempre muestran ambas monedas
- Alerta si la tasa cambió más de 2% en un día
- Historial de tasa aplicada por cada transacción (para el contador)
- Tasa paralela configurable manualmente (además de BCV)

---

## 4. Arquitectura Técnica

### 4.1 Stack

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend | Nuxt 3 (Vue), PWA offline-first | SSR + PWA nativo. Offline con Service Workers. TypeScript. Ligero |
| DB local | IndexedDB (Dexie.js) | Almacenamiento offline en el navegador. Sincronización automática |
| Backend | Node.js + Hono/Fastify, TypeScript | Rápido, ligero, mismo lenguaje que frontend |
| Base de datos | PostgreSQL + pg_trgm + pgvector | Relacional sólido. Fuzzy matching para OCR. Búsqueda semántica futura |
| Cache | Redis | Sesiones, tasa BCV, colas de sincronización y mensajes WhatsApp |
| Storage | MinIO (S3-compatible) | Fotos de productos, PDFs de reportes, imágenes de facturas, backups |
| IA | OpenRouter (GPT-4o-mini primary) + Groq (fallback) | OpenRouter da acceso a múltiples modelos con un solo API key. GPT-4o-mini para OCR vision + narrativas + WhatsApp. Groq como fallback (Llama 3, inferencia ultra-rápida). ~$0.001/consulta |
| WhatsApp | Meta Cloud API directo | Sin BSP. Webhook HTTPS. 1,000 conversaciones servicio/mes gratis |
| Notificaciones | Web Push API + Twilio (SMS fallback) | Push gratis vía PWA. SMS como respaldo |
| Hosting | Hetzner | Económico, confiable. Infra existente con Coolify y Traefik |
| CI/CD | GitHub Actions + Coolify | Deploy automático |

### 4.2 Arquitectura de alto nivel

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTES                                 │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │Escritorio│  │  Móvil   │  │  Tablet  │  │  WhatsApp    │   │
│  │ (Chrome) │  │  (PWA)   │  │  (PWA)   │  │  (Cloud API) │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │
│       │              │              │               │           │
│       └──────────────┴──────────────┘               │           │
│                      │                              │           │
│              ┌───────┴───────┐              ┌───────┴───────┐   │
│              │  IndexedDB    │              │  Meta Cloud   │   │
│              │  (offline)    │              │  API          │   │
│              └───────┬───────┘              └───────┬───────┘   │
└──────────────────────┼──────────────────────────────┼───────────┘
                       │ sync cuando hay internet     │ webhook
                       ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVIDOR (Hetzner)                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Nala Backend (Node.js)                  │   │
│  │                                                         │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐  │   │
│  │  │  API    │ │  Sync   │ │WhatsApp │ │  OCR        │  │   │
│  │  │  REST   │ │  Engine │ │ Handler │ │  (GPT-4o-   │  │   │
│  │  │         │ │         │ │ + LLM   │ │   mini)     │  │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └──────┬──────┘  │   │
│  │       └───────────┴───────────┴──────────────┘         │   │
│  └───────────────────────────┬─────────────────────────────┘   │
│                              │                                  │
│  ┌───────────┐  ┌───────────┴───────────┐  ┌───────────────┐  │
│  │   Redis   │  │     PostgreSQL        │  │    MinIO       │  │
│  │  (cache,  │  │  (datos, pg_trgm,     │  │  (archivos,   │  │
│  │   colas)  │  │   pgvector, aliases)  │  │   imágenes)   │  │
│  └───────────┘  └───────────────────────┘  └───────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Traefik (reverse proxy, SSL, routing)                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Coolify (deploy, containers)                           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                       │
                       ▼ (API calls salientes)
┌─────────────────────────────────────────────────────────────────┐
│                   SERVICIOS EXTERNOS                            │
│                                                                 │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  │
│  │ OpenRouter │  │  Groq     │  │  Meta     │  │  BCV      │  │
│  │ (GPT-4o-  │  │ (Llama 3  │  │ (WhatsApp │  │  (tasa    │  │
│  │  mini, IA)│  │  fallback)│  │  Cloud)   │  │  cambio)  │  │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Flujo offline-first

```
ONLINE:
  PWA ←→ Backend ←→ PostgreSQL
  (IndexedDB se sincroniza como cache local)

OFFLINE:
  PWA ←→ IndexedDB (todas las operaciones)
  (cola de cambios pendientes)

RECONEXIÓN:
  IndexedDB → cola de cambios → Backend → PostgreSQL
  PostgreSQL → cambios de otros dispositivos → IndexedDB
  (resolución de conflictos: último escritor gana, con log)
```

**Qué funciona offline:**
- Registrar ventas
- Consultar inventario y precios
- Consultar clientes
- Ver último dashboard cacheado
- Escanear código de barras

**Qué requiere internet:**
- OCR de facturas (API de OpenAI)
- WhatsApp (API de Meta)
- Sincronización con otros dispositivos
- Reportes con narrativa IA
- Tasa BCV actualizada

### 4.4 Modelo de datos principal

```
businesses
  ├── users (PIN, rol: owner/employee)
  ├── products
  │     ├── product_variants (sku, stock, costo, precio, atributos)
  │     └── product_aliases (alias_text, supplier_id → product_id)
  ├── recipes (product_id → ingredientes con cantidades)
  ├── customers
  │     └── customer_segments (auto-calculados)
  ├── sales
  │     ├── sale_items (product_variant_id, cantidad, precio, descuento)
  │     └── sale_payments (método, monto, referencia, tasa_bcv)
  ├── expenses (proveedor, monto, items, factura_imagen_url)
  ├── accounts_receivable (customer_id, monto, fecha, estado)
  ├── accounts_payable (supplier_id, monto, fecha, estado)
  ├── accounting_entries (fecha, cuenta, debe, haber, referencia)
  ├── activity_log (user_id, acción, detalle, timestamp)
  ├── exchange_rates (fecha, tasa_bcv, tasa_paralela)
  └── settings (tipo_negocio, moneda, métodos_pago, hora_cierre)
```

---

## 5. Experiencia de Usuario

### 5.1 Escritorio

Layout con sidebar izquierda (navegación) + área principal. Tablas con filtros, edición inline, atajos de teclado (F2 nueva venta, Enter confirmar). Gráficos interactivos en reportes. Experiencia completa sin limitaciones.

### 5.2 Móvil (PWA)

Barra inferior con 5 tabs: Inicio | Vender | Inventario | Clientes | Más. Misma funcionalidad que escritorio con layout adaptado. Botones grandes (48px mínimo), gestos (swipe para acciones), pull-to-refresh, indicador de conexión siempre visible. Escáner de código de barras con cámara nativa.

### 5.3 Onboarding

Patrón de Square: 5 pasos, 5 minutos, sin llamar a soporte.

1. "¿Qué tipo de negocio?" → selector visual con íconos
2. Nala pre-configura: categorías, cuentas contables, métodos de pago
3. "¿Tienes productos en Excel?" → Sí (sube) / No (agrega uno: nombre + precio)
4. "¿Tienes empleados?" → Sí (crea PIN) / No
5. Tutorial interactivo guía la primera venta dentro de la app con datos reales

### 5.4 Patrones de UX adoptados

| Origen | Patrón | Implementación en Nala |
|---|---|---|
| Loyverse | Venta en 3 toques | Grid de productos (más vendidos primero) → toque agrega → botón "Cobrar" |
| Square | Dashboard de una pregunta | Un número grande (ventas del día) + indicador de tendencia + 3 tarjetas + 3 alertas máximo |
| Square | Onboarding en minutos | 5 pasos con pre-configuración por tipo de negocio |
| ERPNext | Inventario con variantes | Producto padre → variantes hijas con SKU, stock, precio propio |
| ERPNext | Unidades de medida | UoM de venta vs UoM de compra con factor de conversión |
| ERPNext | Plan de cuentas | Estructura jerárquica pre-configurada por tipo de negocio |
| Fina | Simplicidad radical | Cada pantalla tiene UN propósito. No hay menús con 47 opciones |
| Fina | Soporte humano | Plan Negocio incluye onboarding asistido. Gratis/Pro tienen tutorial interactivo |
| Fina | Entender Venezuela | Bs./USD, Pago Móvil, mesoneros, recetas, cortes de luz |

---

## 6. Diferenciadores

| # | Feature | Detalle |
|---|---|---|
| 1 | WhatsApp bidireccional | Consultar, vender, cobrar por chat. Cloud API directo, sin BSP |
| 2 | Foto = Dato (OCR) | Cámara PWA → GPT-4o-mini vision → matching con inventario → registro automático |
| 3 | Cierre de día automático | Cuadre de caja, discrepancias, resumen, asientos contables. Sin tocar nada |
| 4 | Benchmark anónimo | Rendimiento vs negocios similares en la plataforma (datos anonimizados) |
| 5 | Asistente de compras | Genera orden al proveedor basada en predicciones, envía por WhatsApp |
| 6 | Historial de precios | Alerta cuando costo sube y margen baja. Sugiere ajuste |
| 7 | Multi-moneda inteligente | USD/Bs. con tasa BCV automática. Historial de tasa por transacción |
| 8 | Gamificación | Ranking vendedores, metas, rachas, logros |
| 9 | Onboarding interactivo | Aprende dentro de la app con datos reales. Sin videos |
| 10 | Catálogo compartible | Link web ligero con productos y precios. Cliente pide por WhatsApp |
| 11 | Alertas predictivas de flujo de caja | Proyecta ingresos/gastos. Alerta déficit. Sugiere cobros |
| 12 | Inteligencia en cada pantalla | Predicciones, comparativas, narrativas integradas donde se necesitan |
| 13 | Offline-first | Funciona sin internet como estado normal |

---

## 7. Modelo de Negocio

| Plan | Precio | Incluye |
|---|---|---|
| **Gratis** | $0/mes | 1 negocio, 1 usuario, 50 productos, ventas ilimitadas, offline, dashboard, inventario |
| **Pro** | $19/mes | 1 negocio, usuarios ilimitados (Dueño + Empleados con PIN), productos ilimitados, inteligencia, cobros WhatsApp, exportación contable, reportes completos |
| **Negocio** | $35/mes | Todo Pro + soporte prioritario, onboarding asistido, campañas WhatsApp, segmentación, cotizaciones. Negocios adicionales: +$15/mes cada uno |

**Monetización futura (v2+):** Comisión por cobros (Pago Móvil C2P integrado, 1-2%), formatos contables premium (Galac, Profit Plus), multi-sucursal ($10/mes por sucursal).

---

## 8. Roadmap

### v1.0 -- Producto Completo (4-5 meses)

PWA offline-first con experiencia completa en escritorio y móvil. Ventas con todos los métodos de pago + escáner. Inventario con variantes, vencimiento, semáforo, predicciones. Clientes con perfil automático y segmentos. Cuentas por cobrar/pagar con cobro por WhatsApp. Reportes pre-construidos con narrativa IA. Exportación contable + envío al contador. 2 roles con PIN, 2FA, log de actividad. Tasa BCV automática. WhatsApp bidireccional (Cloud API). OCR de facturas (GPT-4o-mini vision). Plan gratis funcional.

### v2.0 -- Crecimiento (3 meses después)

Integración Pago Móvil C2P (cobro directo). Campañas WhatsApp con segmentación. Cotizaciones con aprobación online. Programa de lealtad simple ("Compra 10, el 11 gratis"). Órdenes de compra a proveedores. Formatos contables Galac/Profit Plus. PaddleOCR self-hosted si el volumen lo justifica.

### v3.0 -- Escala (4 meses después)

Multi-sucursal con transferencias de inventario. API REST pública. Tienda online básica (catálogo con pedidos por WhatsApp). Expansión LATAM (Colombia, Ecuador, Perú).

---

## 9. Decisiones Técnicas Clave

| Decisión | Elección | Razón |
|---|---|---|
| Build vs OSS base | Desde cero | Lo que diferencia a Nala (offline, IA, WhatsApp, OCR, simplicidad) hay que construirlo de cero. ERPNext/Odoo agregan complejidad sin ahorrar ese trabajo |
| Roles | 2 (Dueño + Empleado) | PyMEs de 1-5 empleados no necesitan 5 roles. PIN por usuario para accountability |
| OCR motor | GPT-4o-mini vision vía OpenRouter (v1) | Un API call hace OCR + interpretación + matching. Cero carga en CPU. Groq como fallback para texto (sin vision) |
| OCR escala | PaddleOCR self-hosted (v2+) | Cuando haya 1,000+ negocios, reduce costos 10-20x como microservicio |
| WhatsApp | Cloud API directo, sin BSP | Setup en 30-60 min. 1,000 conversaciones servicio/mes gratis. Sin fee de BSP |
| LLM provider | OpenRouter (primary) + Groq (fallback) | OpenRouter: un API key para GPT-4o-mini, Claude, Gemini. Groq: inferencia ultra-rápida con Llama 3 como fallback si OpenRouter falla |
| Contabilidad | Puente, no módulo | Exportación con formato contable + envío por WhatsApp. No libro mayor ni balance |
| Frontend | Nuxt 3 PWA | SSR + offline-first nativo. TypeScript. Ligero (<500KB) |
| Base de datos | PostgreSQL + pg_trgm + pgvector | Fuzzy matching para OCR aliases. Búsqueda semántica futura |
| Hosting | Hetzner | Económico. Infra existente con Coolify/Traefik |
| Monolito vs micro | Monolito (v1) | Un solo deploy. Sin complejidad distribuida. Microservicios en v2+ si hay necesidad |
| Pricing | Gratis + $19 + $35 | Plan gratis como gancho de marketing. Pro para negocios serios. Negocio para multi-tienda |
