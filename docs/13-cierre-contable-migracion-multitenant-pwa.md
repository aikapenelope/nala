# Decisiones: Cierre Contable, Migración Legacy, Multi-tenant, PWA vs Desktop

---

## 1. Cierre Contable: Cómo Funciona en la Realidad

### El problema real

No todos los comerciantes registran cada venta en el sistema. En la realidad de una PyME venezolana:

- Las ventas grandes o a crédito sí se registran (el dueño quiere saber quién le debe)
- Las ventas pequeñas en efectivo muchas veces no se registran (es rápido, el cliente paga y se va)
- Los gastos se registran a medias (el dueño guarda facturas pero no siempre las carga al sistema)

Forzar al usuario a registrar todo no funciona. Se va a otro sistema más simple o vuelve al cuaderno. La estrategia es hacer que registrar sea tan rápido que no haya razón para no hacerlo, y complementar con cuadre de caja para cerrar el gap.

### Flujo de cierre diario en Nova

**Paso 1: Cuadre de caja (el usuario cuenta el efectivo)**

Al final del día, el dueño o cajero toca "Cerrar día". Nova pregunta:

```
¿Cuánto efectivo hay en caja? [________]
```

El usuario cuenta los billetes y pone el número. Nova compara:

```
Efectivo contado:           $500
Ventas en efectivo hoy:     $380
Fondo de caja inicial:      $100
Efectivo esperado:          $480
────────────────────────────────
Diferencia:                 +$20
```

**Paso 2: Resolver la diferencia**

Si hay diferencia (casi siempre la hay), Nova ofrece opciones:

| Situación | Nova sugiere |
|---|---|
| Efectivo contado > esperado (+$20) | "Hay $20 más de lo esperado. ¿Son ventas no registradas?" → Sí: registra venta genérica por $20 en efectivo. No: registra como "diferencia de caja" |
| Efectivo contado < esperado (-$15) | "Faltan $15. ¿Hubo un gasto no registrado?" → Sí: registra gasto. No: registra como "faltante de caja" |
| Efectivo contado = esperado | "Caja cuadrada. Todo bien." |

Las diferencias de caja quedan registradas en el log de actividad con fecha, hora, usuario, y monto. Si hay faltantes frecuentes, Nova alerta al dueño.

**Paso 3: Cierre automático**

Después del cuadre, Nova automáticamente:

1. Genera resumen del día (ventas por método de pago, gastos, ganancia estimada)
2. Genera asientos contables del día (ventas → cuenta 4101, gastos → cuenta 6XXX, etc.)
3. Registra diferencia de caja si la hubo (cuenta 9999 "Diferencias de caja")
4. Ejecuta backup
5. Envía resumen al dueño por push notification (y WhatsApp si está configurado)
6. Resetea el fondo de caja para el día siguiente

**Paso 4: Cierre mensual (para el contador)**

Al final del mes, el dueño toca "Enviar al contador". Nova genera:

- Excel con todos los asientos del mes (incluyendo diferencias de caja)
- Resumen de ventas por método de pago
- Resumen de gastos por categoría
- P&L simplificado
- Libro de ventas formato SENIAT

El contador recibe un paquete completo. Las diferencias de caja están documentadas. El contador decide cómo tratarlas contablemente.

### Lo que NO hacemos

- No obligamos a registrar cada venta individual
- No bloqueamos el cierre si hay diferencia
- No hacemos contabilidad de partida doble visible al usuario
- No generamos balance general ni estados financieros auditables
- No calculamos impuestos (eso es trabajo del contador)

---

## 2. Migración desde Sistemas Legacy

### Qué se migra

| Dato | Desde Fina/Excel | Formato | Prioridad |
|---|---|---|---|
| Productos | Nombre, SKU, precio, costo, stock, categoría | CSV/Excel | Alta |
| Clientes | Nombre, teléfono, email, saldo pendiente | CSV/Excel | Alta |
| Proveedores | Nombre, contacto, teléfono | CSV/Excel | Media |
| Historial de ventas | No se migra | - | - |
| Configuración | No se migra (se re-configura en onboarding) | - | - |

### Qué NO se migra

- **Historial de ventas:** No tiene sentido. Se empieza de cero. El historial viejo queda en el sistema anterior como referencia
- **Configuración:** Cada sistema tiene su propia estructura. Es más rápido re-configurar en el onboarding de Nova (5 minutos) que intentar mapear configuraciones
- **Asientos contables:** El contador ya tiene eso en su sistema. No se duplica

### Flujo de importación

```
1. Usuario toca "Importar datos" en Configuración
2. Selecciona tipo: Productos / Clientes / Proveedores
3. Sube archivo (CSV, Excel, XLS, XLSX)
4. Nova detecta columnas por nombre de header:
   - "Producto" o "Nombre" o "Descripción" → nombre
   - "Precio" o "PVP" o "Precio Venta" → precio
   - "Costo" o "Precio Compra" → costo
   - "Stock" o "Cantidad" o "Existencia" → stock
   - "SKU" o "Código" o "Referencia" → sku
   - "Categoría" o "Tipo" o "Rubro" → categoría
5. Si no detecta automáticamente, muestra mapeo manual:
   "¿Qué columna es el nombre del producto?" → dropdown con columnas del Excel
6. Preview: "Vamos a importar 150 productos. Aquí van los primeros 5:"
   [tabla con 5 productos de ejemplo]
7. Validación:
   - "3 productos no tienen precio" → marcar en amarillo
   - "2 productos tienen nombres duplicados" → marcar en rojo
   - "SKU 'CAM-001' ya existe en tu inventario" → opción: actualizar o saltar
8. Usuario confirma → importación ejecuta
9. Resumen: "150 productos importados. 3 sin precio (se les asignó $0). 2 duplicados saltados."
```

### Importación inteligente con LLM (v2)

Para archivos desordenados (Excel del cuaderno del dueño con columnas sin nombre, datos mezclados), el LLM puede interpretar:

- "Esta columna tiene números entre 1 y 1000, probablemente es stock"
- "Esta columna tiene números con decimales entre 0.50 y 500, probablemente es precio"
- "Esta columna tiene texto largo, probablemente es nombre del producto"

Esto es v2. En v1, el mapeo es manual/semi-automático por nombre de header.

---

## 3. Multi-tenant: Arquitectura

### Modelo: Pool (shared database, shared schema, row-level isolation)

Una sola base de datos PostgreSQL para todos los tenants. Cada tabla tiene columna `business_id`. PostgreSQL Row Level Security (RLS) garantiza aislamiento a nivel de base de datos.

**Por qué pool y no schema-per-tenant o database-per-tenant:**

| Modelo | Costo infra | Complejidad ops | Aislamiento | Para Nova |
|---|---|---|---|---|
| Database per tenant | Alto (una DB por negocio) | Alta (miles de DBs) | Máximo | No. Inviable con miles de negocios |
| Schema per tenant | Medio | Alta (migraciones por schema) | Alto | No. Complejidad de mantenimiento |
| **Pool + RLS** | **Bajo (una DB)** | **Baja (una migración)** | **Alto (RLS)** | **Sí. Estándar SaaS 2026** |

### Implementación

```sql
-- Cada tabla tiene business_id
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  sku TEXT,
  cost NUMERIC(12,2),
  price NUMERIC(12,2),
  stock INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice en business_id para performance
CREATE INDEX idx_products_business ON products(business_id);

-- Habilitar RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Política: solo ver/modificar datos de tu negocio
CREATE POLICY tenant_isolation ON products
  FOR ALL
  USING (business_id = current_setting('app.current_business_id')::uuid)
  WITH CHECK (business_id = current_setting('app.current_business_id')::uuid);

-- El backend setea el tenant en cada request
-- (middleware de autenticación)
SET app.current_business_id = 'uuid-del-negocio';

-- Después de esto, cualquier query solo ve datos de ese negocio:
SELECT * FROM products; -- solo devuelve productos de ese negocio
INSERT INTO products (name, price) VALUES ('Pan', 1.50);
-- automáticamente se valida que business_id coincida
```

### Middleware en el backend

```typescript
// Middleware que setea el tenant en cada request
async function tenantMiddleware(req, res, next) {
  const businessId = req.user.businessId; // del JWT
  
  // Setear RLS context para esta conexión
  await db.query("SET app.current_business_id = $1", [businessId]);
  
  next();
}

// Todas las queries después de esto están filtradas automáticamente
// No hay que poner WHERE business_id = X en ningún lado
```

### Qué garantiza

- Un negocio **nunca** puede ver datos de otro negocio
- Si un desarrollador olvida poner WHERE business_id, RLS lo filtra igual
- Las migraciones de schema se aplican una vez para todos los tenants
- El backup es uno solo para toda la base de datos
- Performance: índices en business_id + RLS tiene overhead mínimo (<5%)

---

## 4. PWA vs Desktop: Una Sola App, Dos Prioridades

### No son dos productos

Es **una sola aplicación Nuxt 4** que se adapta al dispositivo con CSS responsive + componentes condicionales. Un solo codebase. Un solo deploy. Un solo URL.

- En desktop: layout con sidebar + área principal ancha
- En móvil: layout con tabs inferiores + cards apiladas
- La PWA se instala desde el navegador en móvil (ícono en pantalla de inicio)

### Qué prioriza cada versión

El patrón de backoffice en EEUU (Square, Shopify, Lightspeed) en 2026:

**Desktop = análisis + configuración.** El dueño se sienta al final del día o el lunes a revisar números, configurar productos, exportar al contador.

**Móvil = acción + captura de datos.** El dueño usa el celular durante el día para vender, escanear, cobrar, ver cómo va.

| Acción | Desktop | Móvil PWA | Quién prioriza |
|---|---|---|---|
| **Registrar venta** | Sí (teclado) | Sí (toques + escáner) | Móvil prioriza |
| **Escanear factura OCR** | Posible (webcam) | Cámara nativa | Móvil prioriza |
| **Dashboard del día** | Completo (gráficos + tablas) | Condensado (número grande + 3 tarjetas) | Ambos |
| **Reportes detallados** | Tablas + gráficos + narrativa | Scroll vertical simplificado | Desktop prioriza |
| **Gestionar inventario** | Tabla editable inline | Lista con búsqueda + edición básica | Desktop prioriza |
| **Configurar productos** | Formulario completo con variantes | Posible pero no ideal | Desktop prioriza |
| **Exportación contable** | Generar + descargar | Botón "Enviar al contador" (WhatsApp) | Desktop prioriza |
| **Cobrar por WhatsApp** | Sí (abre WhatsApp Web) | Abre WhatsApp nativo | Móvil prioriza |
| **Notificaciones** | Push en navegador | Push nativo (más visible) | Móvil prioriza |
| **Cierre de día** | Formulario completo | Formulario simplificado | Ambos |
| **Configuración negocio** | Formulario completo | Posible pero no ideal | Desktop prioriza |
| **Importar datos** | Subir Excel + mapear columnas | No disponible (pantalla muy pequeña) | Solo desktop |

### Diseño móvil: centro de acción

La PWA en móvil no es un dashboard reducido. Es un **centro de acción** optimizado para lo que el dueño hace con el celular en la mano:

**Pantalla de inicio (móvil):**
```
┌─────────────────────────┐
│     $420 vendidos hoy   │  ← número grande
│     ▲ 12% vs ayer       │  ← tendencia
├─────────────────────────┤
│ 💰 $95    │ 📦 3 bajo  │  ← 2 tarjetas
│ x cobrar  │ stock      │
├─────────────────────────┤
│ ⚠ Harina PAN: 2 días   │  ← alerta principal
├─────────────────────────┤
│                         │
│  [  + Nueva venta  ]    │  ← botón grande
│                         │
├────┬────┬────┬────┬────┤
│ 🏠 │ 💲 │ 📦 │ 👤 │ ⋯ │  ← tabs
│Home│Vend│Inv │Cli │Más │
└────┴────┴────┴────┴────┘
```

**Pantalla de venta (móvil):**
```
┌─────────────────────────┐
│ 🔍 Buscar producto...   │  ← búsqueda + escáner
├─────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐│
│ │ Pan │ │Café │ │Queso││  ← grid más vendidos
│ │$1.50│ │$1.00│ │$3.00││
│ └─────┘ └─────┘ └─────┘│
│ ┌─────┐ ┌─────┐ ┌─────┐│
│ │Harin│ │Aceit│ │Azúca││
│ │$2.00│ │$4.50│ │$1.80││
│ └─────┘ └─────┘ └─────┘│
├─────────────────────────┤
│ Pan Campesino    x3     │  ← ticket actual
│ Café con Leche   x1     │
├─────────────────────────┤
│                         │
│  [ Cobrar $5.50 ]       │  ← botón grande
│                         │
└─────────────────────────┘
```

### Diseño desktop: centro de análisis

**Pantalla de inicio (desktop):**
```
┌──────────┬──────────────────────────────────────────────┐
│          │                                              │
│  Inicio  │   $420 vendidos hoy  ▲ 12% vs ayer          │
│          │                                              │
│  Vender  │   ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│          │   │ 23 ventas│ │ $95 x cob│ │ 3 stock ↓│   │
│  Invent. │   └──────────┘ └──────────┘ └──────────┘   │
│          │                                              │
│  Clientes│   Ventas últimos 7 días     Alertas          │
│          │   ████████ $420             ⚠ Harina PAN    │
│  Cuentas │   ██████ $350                se acaba en    │
│          │   ████████ $410                2 días        │
│  Reportes│   █████ $300                                 │
│          │   ████████████ $520         ⚠ Juan debe $65 │
│  Contab. │   ██████ $380                hace 35 días   │
│          │   ████████ $420                              │
│  Config. │                                              │
│          │   Top productos hoy                          │
│          │   1. Pan Campesino (85u) - $127.50           │
│          │   2. Café con Leche (42u) - $42.00           │
│          │   3. Queso Blanco (15kg) - $45.00            │
└──────────┴──────────────────────────────────────────────┘
```

### Componentes compartidos vs específicos

```
components/
  shared/           ← usados en ambos
    ProductCard.vue
    SaleItem.vue
    AlertBadge.vue
    CustomerBadge.vue
  desktop/          ← solo desktop
    Sidebar.vue
    DataTable.vue
    InlineEditor.vue
    ChartPanel.vue
  mobile/           ← solo móvil
    BottomTabs.vue
    SwipeCard.vue
    QuickActionButton.vue
    CameraScanner.vue

layouts/
  desktop.vue       ← sidebar + main area
  mobile.vue        ← tabs + stack

pages/
  index.vue         ← detecta dispositivo, carga layout correcto
  sales/
    index.vue       ← lógica compartida, layout adaptado
  inventory/
    index.vue
  ...
```

La detección es por viewport width (CSS media queries + `useMediaQuery` composable en Vue). No hay redirect ni URL diferente. Mismo URL, diferente layout.
