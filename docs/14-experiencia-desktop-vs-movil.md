# Nala: Experiencia Desktop vs Móvil -- Diseño por Contexto de Uso

> Cómo lo hacen Square, Shopify y Lightspeed en EEUU, qué datos respaldan las decisiones, y cómo Nala adapta cada experiencia al contexto real del comerciante venezolano.

---

## Cómo lo Hacen en EEUU

### Square: Dos productos, un ecosistema

Square separa explícitamente la experiencia:

- **Square POS App (móvil/tablet):** Es donde ocurren las ventas. Grid de productos, checkout rápido, pagos con tarjeta/contactless, propinas, recibos. Funciona offline. El cajero o dueño lo usa todo el día en el mostrador.
- **Square Dashboard (desktop, navegador):** Es donde se analiza el negocio. Reportes de ventas, gestión de inventario completa, configuración de empleados y permisos, gestión de dispositivos remotos, marketing, nómina. El dueño lo abre al final del día o el lunes.

Square llama al dashboard "Track business performance and manage your sales and POS settings from any computer." La app móvil tiene "in-app reporting" pero solo métricas top-line (ventas brutas, conteo, reembolsos). Los reportes detallados están en desktop.

### Shopify: Admin en desktop, POS en móvil

Shopify es aún más explícito en la separación:

- **Shopify POS App (solo móvil/tablet):** Procesar ventas, aceptar pagos, escanear productos, gestionar caja. No se puede usar en desktop. Es exclusivamente una herramienta de punto de venta.
- **Shopify Admin (desktop + móvil):** Todo lo demás. Productos, inventario, órdenes, clientes, reportes, configuración, apps, marketing. Es el backoffice completo. Funciona en desktop y en la app móvil de Shopify (no la de POS).

La tabla de Shopify es reveladora: checkout, pagos, hardware, escaneo de barras -- solo en la app POS. Productos, inventario, órdenes, reportes, configuración -- en el Admin (desktop).

### Lightspeed: Desktop-first con app complementaria

Lightspeed es desktop-first. El backoffice completo (inventario con matrices, órdenes de compra, reportes avanzados, programa de lealtad) vive en el navegador. La app móvil es para ventas en el piso y consultas rápidas de stock.

### El patrón común

Los tres sistemas más exitosos de EEUU siguen el mismo patrón:

| Contexto | Dispositivo | Función principal | Cuándo se usa |
|---|---|---|---|
| **En el mostrador** | Móvil/tablet | Vender, cobrar, escanear | Todo el día, durante operación |
| **En la oficina/casa** | Desktop/laptop | Analizar, configurar, reportar | Final del día, lunes, fin de mes |

No es que el móvil sea "menos". Es que cada dispositivo se usa en un contexto diferente con necesidades diferentes.

---

## Datos de Uso Real (2025-2026)

| Dato | Fuente | Implicación para Nala |
|---|---|---|
| 59.6% del tráfico web global es móvil | SQ Magazine 2025 | La mayoría de usuarios accederán desde el celular |
| Usuarios móviles hacen 4.8 sesiones/día vs 2.1 en desktop | SQ Magazine 2025 | Móvil = sesiones cortas y frecuentes. Desktop = sesiones largas y pocas |
| Desktop domina en horario laboral B2B (64% de visitas 9am-5pm) | SQ Magazine 2025 | El dueño que se sienta a revisar números lo hace en desktop |
| Scrolling depth es 33% mayor en desktop | SQ Magazine 2025 | Reportes detallados y tablas largas funcionan mejor en desktop |
| 61% de búsquedas móviles resultan en acción en <1 hora | SQ Magazine 2025 | Móvil = acción inmediata (vender, cobrar, consultar) |
| Conversión desktop (4.3%) > móvil (2.2%) | SQ Magazine 2025 | Decisiones complejas (configurar, analizar) se hacen mejor en desktop |
| En LATAM, móvil creció 5.9% YoY (mayor crecimiento global) | SQ Magazine 2025 | Venezuela es mobile-first. La PWA es la experiencia principal |
| En África, 84% del tráfico es móvil | SQ Magazine 2025 | Mercados emergentes = mobile-first. Nala debe priorizar móvil |

---

## Diseño de Nala por Contexto

### Móvil PWA: Centro de Acción

**Cuándo se usa:** Durante el día, en el negocio, con el celular en la mano o en el mostrador. Sesiones cortas (1-3 minutos), frecuentes (10-20 veces al día).

**Qué prioriza:** Velocidad de ejecución. Cada acción en el menor número de toques posible.

**Pantallas principales (en orden de frecuencia de uso):**

#### 1. Vender (la más usada)

```
┌─────────────────────────┐
│ 🔍 Buscar...    [📷]    │  ← búsqueda + escáner barras
├─────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐│
│ │ Pan │ │Café │ │Queso││  ← grid: más vendidos primero
│ │$1.50│ │$1.00│ │$3.00││    (ordenados por frecuencia)
│ └─────┘ └─────┘ └─────┘│
│ ┌─────┐ ┌─────┐ ┌─────┐│
│ │Harin│ │Aceit│ │Azúca││
│ │$2.00│ │$4.50│ │$1.80││
│ └─────┘ └─────┘ └─────┘│
├─────────────────────────┤
│ Pan Campesino    x3  ✕  │  ← ticket actual
│ Café con Leche   x1  ✕  │    (swipe left para eliminar)
├─────────────────────────┤
│   [ Cobrar $5.50 ]      │  ← botón grande, color primario
├────┬────┬────┬────┬────┤
│ 🏠 │ 💲 │ 📦 │ 👤 │ ⋯ │
└────┴────┴────┴────┴────┘
```

- Toque en producto = agrega al ticket (cantidad 1)
- Toque de nuevo = incrementa cantidad
- Long press = editar cantidad/precio/descuento
- Escáner de barras abre cámara nativa
- Botón "Cobrar" lleva a selector de método de pago (iconos grandes)
- 3-4 toques para completar una venta

#### 2. Inicio (dashboard rápido)

```
┌─────────────────────────┐
│                         │
│     $420                │  ← número grande, centrado
│     vendidos hoy        │
│     ▲ 12% vs ayer       │  ← verde si sube, rojo si baja
│                         │
├────────────┬────────────┤
│  💰 $95    │  📦 3      │  ← 2 tarjetas
│  x cobrar  │  stock bajo│
├────────────┴────────────┤
│ ⚠ Harina PAN: ~2 días  │  ← alerta más urgente
│ ⚠ Juan debe $65 (35d)  │  ← segunda alerta
├─────────────────────────┤
│                         │
│  [  + Nueva venta  ]    │  ← acceso rápido
│  [  📷 Escanear factura]│  ← acceso rápido
│                         │
├────┬────┬────┬────┬────┤
│ 🏠 │ 💲 │ 📦 │ 👤 │ ⋯ │
└────┴────┴────┴────┴────┘
```

- Sin gráficos complejos. Un número, una tendencia, dos tarjetas, dos alertas
- Botones de acción rápida: nueva venta y escanear factura
- Todo visible sin scroll

#### 3. Inventario (consulta rápida)

```
┌─────────────────────────┐
│ 🔍 Buscar producto...   │
├─────────────────────────┤
│ 🔴 Harina PAN     5u   │  ← semáforo de color
│    ~2 días              │  ← predicción
├─────────────────────────┤
│ 🟡 Aceite Diana   12u  │
│    ~5 días              │
├─────────────────────────┤
│ 🟢 Queso Blanco   45u  │
│    ~15 días             │
├─────────────────────────┤
│ 🟢 Pan Campesino  200u │
│    ~8 días              │
├─────────────────────────┤
│ ⬜ Servilletas XL  50u  │  ← gris = sin movimiento
│    sin ventas 45 días   │
├────┬────┬────┬────┬────┤
│ 🏠 │ 💲 │ 📦 │ 👤 │ ⋯ │
└────┴────┴────┴────┴────┘
```

- Lista ordenada por urgencia (rojo primero)
- Swipe right en un producto = editar stock rápido
- Toque = ver detalle (precio, costo, margen, historial)
- Búsqueda instantánea + escáner de barras

#### 4. Cobros (acción directa)

```
┌─────────────────────────┐
│ Pendientes por cobrar   │
│ Total: $285             │
├─────────────────────────┤
│ 🔴 Juan Pérez    $65   │  ← rojo = >30 días
│    hace 35 días         │
│    [Cobrar por WhatsApp]│  ← un toque
├─────────────────────────┤
│ 🟡 María García  $120  │  ← amarillo = 15-30 días
│    hace 22 días         │
│    [Cobrar por WhatsApp]│
├─────────────────────────┤
│ 🟢 Pedro López   $100  │  ← verde = <15 días
│    hace 8 días          │
│    [Cobrar por WhatsApp]│
├─────────────────────────┤
│ [Cobrar a todos]        │  ← genera mensajes para todos
├────┬────┬────┬────┬────┤
│ 🏠 │ 💲 │ 📦 │ 👤 │ ⋯ │
└────┴────┴────┴────┴────┘
```

#### 5. Escanear factura (OCR)

```
┌─────────────────────────┐
│                         │
│    [  📷 Tomar foto  ]  │  ← abre cámara nativa
│                         │
│    o                    │
│                         │
│    [  📁 Subir imagen ] │  ← desde galería
│                         │
├─────────────────────────┤
│ Últimas facturas:       │
│ • #234 Dist. Harina     │
│   15/04 - $260 ✅       │
│ • #112 Proveedor ABC    │
│   12/04 - $180 ✅       │
├────┬────┬────┬────┬────┤
│ 🏠 │ 💲 │ 📦 │ 👤 │ ⋯ │
└────┴────┴────┴────┴────┘
```

### Desktop: Centro de Análisis

**Cuándo se usa:** Al final del día, el lunes, fin de mes. En la casa o en una PC en el negocio. Sesiones largas (15-60 minutos), pocas (1-3 veces al día).

**Qué prioriza:** Profundidad de información. Ver el panorama completo, tomar decisiones, configurar.

**Layout principal:**

```
┌──────────┬──────────────────────────────────────────────────┐
│          │                                                  │
│  Inicio  │  Panadería Don Pedro          Bs/USD: 36.50     │
│          │                                                  │
│  Vender  │  ┌────────────────────────────────────────────┐  │
│          │  │         $420 vendidos hoy                  │  │
│  Invent. │  │         ▲ 12% vs martes pasado             │  │
│          │  │         23 ventas · ticket prom: $18.26     │  │
│  Clientes│  └────────────────────────────────────────────┘  │
│          │                                                  │
│  Cuentas │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│          │  │ $95      │ │ 3 prod.  │ │ $1,850 este mes  │ │
│  Reportes│  │ x cobrar │ │ stock ↓  │ │ ▲ 8% vs anterior │ │
│          │  └──────────┘ └──────────┘ └──────────────────┘ │
│  Contab. │                                                  │
│          │  Ventas últimos 7 días          Alertas          │
│  Config. │  Lu ████████████ $520          ⚠ Harina PAN:   │
│          │  Ma ████████ $420                ~2 días. Pedir  │
│          │  Mi ██████████████ $580          al proveedor?   │
│          │  Ju ██████ $350                                  │
│          │  Vi ████████████████ $620      ⚠ Juan debe $65  │
│          │  Sa ████████████████████ $780    hace 35 días    │
│          │  Do ████ $280                                    │
│          │                                ⚠ 3 anulaciones  │
│          │  Top productos hoy               hoy (prom: 0.2)│
│          │  ┌──────────────────────────┐                    │
│          │  │ # │ Producto    │ Cant │$ │                   │
│          │  │ 1 │ Pan Camp.   │  85  │127│                  │
│          │  │ 2 │ Café c/L    │  42  │ 42│                  │
│          │  │ 3 │ Queso Bl.   │  15  │ 45│                  │
│          │  │ 4 │ Harina PAN  │  12  │ 24│                  │
│          │  │ 5 │ Aceite D.   │   8  │ 36│                  │
│          │  └──────────────────────────┘                    │
└──────────┴──────────────────────────────────────────────────┘
```

**Pantallas exclusivas o priorizadas en desktop:**

#### Reportes detallados

- Gráficos interactivos (hover para ver valores, click para filtrar)
- Tablas con ordenamiento por columna, filtros, búsqueda
- Narrativa IA debajo de cada gráfico
- Comparativas lado a lado (este mes vs anterior, este año vs anterior)
- Exportación PDF/Excel
- Selector de periodo con calendario visual

#### Inventario completo

- Tabla editable inline (click en celda para editar precio, stock, costo)
- Columnas visibles: nombre, SKU, stock, costo, precio, margen %, estado, predicción
- Filtros: categoría, estado (rojo/amarillo/verde/gris), proveedor
- Ordenamiento por cualquier columna
- Bulk actions: seleccionar varios → cambiar categoría, ajustar precio %, archivar
- Gestión de variantes (expandir producto para ver tallas/colores)

#### Configuración de productos

- Formulario completo: nombre, SKU, descripción, categoría, costo, precio, proveedor, unidad de medida, stock mínimo, foto
- Variantes: agregar atributos (talla, color) y generar combinaciones
- Unidades de medida con conversión (1 caja = 12 unidades)

#### Gestión de usuarios

- Lista de empleados con PIN, rol (Dueño/Empleado), estado activo/inactivo
- Log de actividad filtrable por usuario, fecha, tipo de acción
- Gamificación: ranking de vendedores, metas, rachas (vista completa con historial)

#### Exportación contable

- Preview del paquete contable antes de enviar
- Selección de periodo
- Catálogo de cuentas editable
- Descarga directa (PDF, Excel) + envío por WhatsApp

#### Importación de datos

- Subir Excel/CSV
- Mapeo de columnas (visual, drag-and-drop)
- Preview de datos importados
- Validación con errores marcados
- Solo disponible en desktop (pantalla muy pequeña en móvil para mapear columnas)

---

## Funcionalidades por Dispositivo (Tabla Definitiva)

| Funcionalidad | Móvil PWA | Desktop | Notas |
|---|---|---|---|
| **Registrar venta** | Prioridad (toques + escáner) | Disponible (teclado + mouse) | Móvil es más rápido en el mostrador |
| **Escanear código de barras** | Prioridad (cámara nativa) | Disponible (webcam) | Cámara del celular es superior |
| **Escanear factura OCR** | Prioridad (cámara nativa, resolución completa) | Disponible (subir imagen) | Cámara del celular da mejor calidad |
| **Dashboard del día** | Condensado (1 número + 2 tarjetas + 2 alertas) | Completo (gráficos + tablas + alertas + top productos) | Móvil responde "¿cómo voy?". Desktop responde "¿por qué?" |
| **Consultar stock** | Lista con semáforo + búsqueda | Tabla completa con filtros y edición inline | Móvil para consulta rápida. Desktop para gestión |
| **Cobrar por WhatsApp** | Prioridad (abre WhatsApp nativo) | Disponible (abre WhatsApp Web) | Más natural desde el celular |
| **Ver perfil de cliente** | Card con datos clave + historial resumido | Ficha completa con timeline + gráfico de gasto | Móvil para consulta rápida al atender |
| **Notificaciones/alertas** | Prioridad (push nativo, siempre visible) | Disponible (push en navegador) | El dueño tiene el celular siempre encima |
| **Cierre de día** | Formulario simplificado (contar caja + confirmar) | Formulario completo + resumen detallado | Ambos pueden cerrar. Desktop muestra más detalle |
| **Reportes detallados** | Scroll vertical simplificado | Prioridad (gráficos + tablas + narrativa + exportación) | Desktop para análisis profundo |
| **Gestionar inventario completo** | Edición básica (un producto a la vez) | Prioridad (tabla editable, bulk actions, variantes) | Desktop para gestión masiva |
| **Configurar productos con variantes** | No disponible (demasiado complejo para pantalla pequeña) | Prioridad (formulario completo) | Solo desktop |
| **Importar datos (Excel/CSV)** | No disponible | Prioridad (mapeo de columnas, preview) | Solo desktop |
| **Exportación contable** | Botón "Enviar al contador" (genera + abre WhatsApp) | Preview + descarga + envío | Móvil para enviar rápido. Desktop para revisar antes |
| **Configuración del negocio** | Básica (nombre, métodos de pago) | Prioridad (completa: usuarios, roles, cuentas, categorías) | Desktop para configuración inicial y cambios |
| **Campañas WhatsApp** | Disponible (seleccionar segmento + enviar) | Prioridad (crear campaña + preview + segmentación avanzada) | Desktop para crear. Móvil para enviar |
| **Log de actividad** | No disponible (tabla demasiado grande) | Prioridad (filtrable por usuario, fecha, acción) | Solo desktop |

---

## Principios de Diseño por Dispositivo

### Móvil: 5 reglas

1. **Máximo 3 toques para cualquier acción frecuente.** Vender = 3 toques. Cobrar = 2 toques. Consultar stock = 1 toque + búsqueda
2. **Un propósito por pantalla.** La pantalla de venta es para vender. No tiene reportes, no tiene configuración, no tiene nada que distraiga
3. **Botones de 48px mínimo.** Dedos, no mouse. Áreas de toque generosas. Sin links pequeños
4. **Sin scroll horizontal.** Todo en una columna. Cards apiladas. Listas verticales
5. **Estado de conexión siempre visible.** Indicador verde/gris en la barra superior. El usuario siempre sabe si está online u offline

### Desktop: 5 reglas

1. **Información densa pero organizada.** Tablas con muchas columnas, gráficos con datos, sidebar con navegación. Aprovechar el espacio
2. **Edición inline.** Click en cualquier celda de una tabla para editar. Sin abrir formularios separados para cambios simples
3. **Atajos de teclado.** F2 = nueva venta. Ctrl+F = buscar. Enter = confirmar. Esc = cancelar. Tab = siguiente campo
4. **Filtros y ordenamiento en todo.** Cada tabla se puede filtrar por cualquier columna, ordenar ascendente/descendente, buscar
5. **Contexto siempre visible.** Sidebar con navegación + breadcrumbs + nombre del negocio + tasa BCV. El usuario siempre sabe dónde está

---

## Implementación Técnica

### Una sola app, layouts diferentes

```typescript
// composables/useDevice.ts
export function useDevice() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)')
  const isDesktop = useMediaQuery('(min-width: 1025px)')
  return { isMobile, isTablet, isDesktop }
}
```

```vue
<!-- layouts/default.vue -->
<template>
  <DesktopLayout v-if="isDesktop">
    <slot />
  </DesktopLayout>
  <MobileLayout v-else>
    <slot />
  </MobileLayout>
</template>
```

```
pages/
  index.vue              ← misma página, diferente layout
  sales/index.vue        ← lógica de venta compartida
  inventory/index.vue    ← lógica de inventario compartida

components/
  shared/                ← componentes usados en ambos
    ProductCard.vue
    SaleTicket.vue
    AlertBadge.vue
    PaymentSelector.vue
  desktop/               ← solo desktop
    Sidebar.vue
    DataTable.vue         ← tabla editable con filtros
    ChartPanel.vue
    InlineEditor.vue
  mobile/                ← solo móvil
    BottomTabs.vue
    SwipeableCard.vue
    QuickActionFAB.vue    ← floating action button
    CameraScanner.vue
```

### Misma API, mismos datos

No hay API separada para móvil y desktop. Es la misma API REST. La diferencia es solo presentación (qué componentes se renderizan). Los datos, la lógica de negocio, la autenticación, el RLS -- todo es idéntico.

### Offline: mismo comportamiento en ambos

IndexedDB + Service Workers funcionan igual en desktop Chrome y en la PWA móvil. Las ventas offline, la cola de sincronización, el cache del dashboard -- todo funciona en ambos dispositivos.
