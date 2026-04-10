# Nala vs Fina: Comparación de Features + Estructura del Dashboard

---

## 1. Infra Confirmada

Redis 7 ya está en el data plane (10.0.1.20) junto con PostgreSQL 16+pgvector, PgBouncer, y MinIO. No hay que agregar nada para Redis.

```
Control Plane (cx23, 10.0.1.10)     App Plane A (cx33, 10.0.1.30)
┌─────────────────────────┐         ┌─────────────────────────┐
│ Coolify                 │         │ Nala Frontend (Nuxt 4)  │
│ Traefik (reverse proxy) │         │ Nala Backend (Hono)     │
│ Monitoring              │         │ WhatsApp Webhook        │
└─────────────────────────┘         └─────────────────────────┘
                                              │
Data Plane (cx33, 10.0.1.20)                  │ red privada
┌─────────────────────────┐                   │ 10.0.1.0/24
│ PostgreSQL 16 + pgvector│◄──────────────────┘
│ PgBouncer               │
│ Redis 7                 │
│ MinIO                   │
└─────────────────────────┘
```

---

## 2. Fina vs Nala: Qué Tiene Fina que Nala Cubre, Qué Dejamos Fuera

### Lo que Fina tiene y Nala CUBRE (igual o mejor)

| Feature de Fina | Cómo lo cubre Nala | Mejor/Igual/Diferente |
|---|---|---|
| Dashboard en tiempo real (facturación, ganancia, alertas, cuentas) | Dashboard con ventas del día, comparativa automática, 3 tarjetas, alertas inteligentes | Mejor (comparativas, IA narrativa) |
| Inventario por talla/color/referencia | Inventario con variantes (producto padre → variantes hijas con SKU) | Igual |
| Control de fechas de vencimiento | Fechas de vencimiento con alertas | Igual |
| Inventario por modelo/referencia (autopartes) | Variantes con SKU por modelo | Igual |
| Importación/exportación Excel y PDF | Importación Excel con mapeo inteligente + exportación PDF/Excel | Mejor (mapeo automático) |
| Alertas de inventario bajo | Semáforo de stock + predicción de agotamiento ("se acaba en ~X días") | Mejor (predicción) |
| Registro de ventas | Venta en 3-4 toques con grid de más vendidos | Mejor (más rápido) |
| Control de vendedores | PIN por usuario + log de actividad + gamificación | Mejor (accountability + motivación) |
| Gestión de cuentas bancarias y caja | Cuentas por cobrar/pagar con código de color + cuadre de caja automático | Mejor (cuadre automático) |
| Cuentas por cobrar y pagar | Cobro por WhatsApp en un toque + alertas predictivas de flujo de caja | Mejor (WhatsApp + predicción) |
| Soporte Bs. y USD | Multi-moneda con tasa BCV automática + historial de tasa por transacción | Mejor (tasa automática) |
| Múltiples métodos de pago | 7 métodos: efectivo, Pago Móvil, Binance, Zinli, transferencia, Zelle, fiado | Mejor (más métodos) |
| Resumen financiero (ingresos, costos, gastos, ganancia) | 7 reportes pre-construidos + narrativa IA + comparativas automáticas | Mejor (IA + comparativas) |
| Gráficos visuales | Gráficos en reportes desktop + narrativa IA que explica los números | Mejor (IA explica) |
| Estadísticas del negocio | Dashboard + reportes + alertas inteligentes | Mejor |
| Estadísticas por cliente | Perfil automático con historial, frecuencia, ticket promedio, segmentos | Mejor (perfil completo) |
| Campañas de SMS | Campañas por WhatsApp (segmentadas, personalizadas) | Mejor (WhatsApp > SMS) |
| Analíticas de campañas | Segmentación automática de clientes (VIP, en riesgo, con deuda, etc.) | Mejor |
| 100% en la nube | PWA online-first con cache agresivo | Mejor (funciona sin internet) |
| Multi-dispositivo | Desktop + móvil PWA + WhatsApp bidireccional | Mejor (3 formas de acceso) |
| Usuarios ilimitados | Dueño + Empleados con PIN (plan Pro) | Igual (ilimitados en Pro) |
| Sincronización en tiempo real | Sincronización + cache local para velocidad | Mejor |
| Onboarding asistido | Onboarding interactivo en la app + asistido en plan Negocio | Mejor (no depende de humano para empezar) |
| Soporte técnico gratuito | Soporte por WhatsApp en plan Negocio | Igual |
| Centro de tutoriales | Onboarding interactivo dentro de la app con datos reales | Mejor (aprende haciendo) |

### Lo que Fina tiene y Nala DEJA FUERA (a propósito)

| Feature de Fina | Por qué Nala no lo tiene |
|---|---|
| Gestión de mesas (restaurantes) | Nala no atiende restaurantes. Decidido en doc 12 |
| Descuento automático de ingredientes por receta | Feature de restaurantes. Fuera de scope |
| Seguimiento de repartidores | Feature de restaurantes/delivery. Fuera de scope |
| Roles de mesonero | Feature de restaurantes. Fuera de scope |
| Programa de partners | No es un feature del producto. Es un programa comercial. Se puede agregar después si hay demanda |
| Pago único (acceso de por vida) | Modelo de negocio diferente. Nala es SaaS con plan gratis + suscripción |

### Lo que Nala tiene y Fina NO tiene

| Feature de Nala | Valor |
|---|---|
| Funciona sin internet (cache + cola de ventas) | Crítico en Venezuela |
| WhatsApp bidireccional (entrada + salida) | Consultar, vender, cobrar por chat |
| OCR de facturas (foto → datos → inventario) | Elimina entrada manual |
| Inteligencia en cada pantalla (predicciones, comparativas, narrativas) | Le dice al dueño qué hacer |
| Tasa BCV automática | Elimina búsqueda manual diaria |
| Cierre de día automático con cuadre de caja | Detecta discrepancias |
| Roles con PIN y log de actividad | Accountability por empleado |
| 2FA por email | Seguridad básica que Fina no tiene |
| Cobro por WhatsApp en un toque | Más rápido que buscar y escribir manualmente |
| Segmentación automática de clientes | VIP, en riesgo, con deuda, inactivos |
| Alertas predictivas de flujo de caja | "El viernes podrías tener déficit" |
| Historial de precios con alertas de margen | "El costo subió, tu margen bajó" |
| Gamificación para vendedores | Ranking, metas, rachas |
| Catálogo compartible por WhatsApp (v2) | Link con productos para que clientes pidan |
| Benchmark anónimo vs negocios similares | "Tu panadería vende 20% más que el promedio" |
| Asistente de compras al proveedor | Genera orden y la envía por WhatsApp |
| Exportación contable con formato de libro diario | Puente directo al contador |
| Importación desde sistemas legacy | Migrar desde Fina/Excel |
| Plan gratis | Fina no tiene plan gratis |

---

## 3. Estructura del Dashboard

### Dashboard Desktop

```
┌──────────┬──────────────────────────────────────────────────────┐
│          │  Bodega Juan                    Bs/USD: Bs.36.50     │
│ NALA     │                                                      │
│          │  ┌────────────────────────────────────────────────┐  │
│ ● Inicio │  │                                                │  │
│          │  │         $420 vendidos hoy                      │  │
│   Vender │  │         ▲ 12% vs martes pasado                 │  │
│          │  │         23 ventas · ticket prom: $18.26         │  │
│   Invent.│  │                                                │  │
│          │  └────────────────────────────────────────────────┘  │
│   Client.│                                                      │
│          │  ┌────────────┐ ┌────────────┐ ┌────────────────┐   │
│   Cuentas│  │ 💰 $95     │ │ 📦 3 prod. │ │ 📊 $1,850      │   │
│          │  │ por cobrar │ │ stock bajo │ │ este mes       │   │
│   Report.│  │ 4 clientes │ │            │ │ ▲ 8% vs ant.  │   │
│          │  └────────────┘ └────────────┘ └────────────────┘   │
│   Contab.│                                                      │
│          │  ┌─────────────────────┐  ┌──────────────────────┐  │
│   Config.│  │ Ventas últimos 7d   │  │ Alertas              │  │
│          │  │                     │  │                      │  │
│          │  │ Lu ████████ $420    │  │ ⚠ Harina PAN:       │  │
│          │  │ Ma ██████ $350      │  │   ~2 días. ¿Pedir   │  │
│          │  │ Mi ██████████ $520  │  │   al proveedor?     │  │
│          │  │ Ju █████ $300       │  │   [Sí] [No]         │  │
│          │  │ Vi ████████████ $620│  │                      │  │
│          │  │ Sa ██████████████$780│  │ ⚠ Juan debe $65    │  │
│          │  │ Do ████ $280        │  │   hace 35 días       │  │
│          │  │                     │  │   [Cobrar]           │  │
│          │  └─────────────────────┘  │                      │  │
│          │                           │ ⚠ 3 anulaciones     │  │
│          │  Top 5 productos hoy      │   hoy (prom: 0.2)   │  │
│          │  ┌────────────────────┐   │   [Ver detalle]      │  │
│          │  │ # │Producto │ U │$ │   │                      │  │
│          │  │ 1 │Pan Camp.│ 85│127│  └──────────────────────┘  │
│          │  │ 2 │Café c/L │ 42│ 42│                            │
│          │  │ 3 │Queso Bl.│ 15│ 45│  Resumen IA               │
│          │  │ 4 │Harina   │ 12│ 24│  "Hoy vendiste 12% más    │
│          │  │ 5 │Aceite D.│  8│ 36│  que el martes pasado.     │
│          │  └────────────────────┘   Tu producto estrella fue  │
│          │                           Pan Campesino. Mañana es  │
│          │                           miércoles, históricamente │
│          │                           tu mejor día."            │
└──────────┴──────────────────────────────────────────────────────┘
```

**Componentes del dashboard desktop:**

1. **Header:** Nombre del negocio + tasa BCV del día
2. **Número principal:** Ventas del día en USD, grande y centrado
3. **Indicador de tendencia:** Comparativa automática vs mismo día semana pasada (verde/rojo)
4. **Métricas secundarias:** Total ventas, ticket promedio
5. **3 tarjetas:** Pendiente por cobrar (con # de clientes), productos stock bajo, ventas del mes con tendencia
6. **Gráfico de barras:** Ventas últimos 7 días. Hover para ver detalle. Click para ir al reporte
7. **Panel de alertas:** Máximo 3 alertas, priorizadas por impacto. Cada una con acción directa (botón)
8. **Top 5 productos:** Tabla simple con producto, unidades vendidas, monto
9. **Resumen IA:** Párrafo narrativo generado que explica los números y da recomendación

### Dashboard Móvil

```
┌─────────────────────────┐
│ Bodega Juan    Bs.36.50 │
├─────────────────────────┤
│                         │
│      $420               │
│      vendidos hoy       │
│      ▲ 12% vs ayer      │
│                         │
├────────────┬────────────┤
│  💰 $95    │  📦 3      │
│  x cobrar  │  stock bajo│
├────────────┴────────────┤
│ ⚠ Harina PAN: ~2 días  │
│   [Pedir al proveedor]  │
├─────────────────────────┤
│ ⚠ Juan debe $65 (35d)  │
│   [Cobrar por WhatsApp] │
├─────────────────────────┤
│                         │
│  [  + Nueva venta  ]    │
│  [  📷 Escanear fact.]  │
│                         │
├────┬────┬────┬────┬────┤
│ 🏠 │ 💲 │ 📦 │ 👤 │ ⋯ │
│Home│Vend│Inv │Cli │Más │
└────┴────┴────┴────┴────┘
```

**Componentes del dashboard móvil:**

1. **Header compacto:** Nombre del negocio + tasa BCV
2. **Número principal:** Ventas del día, grande
3. **Tendencia:** Comparativa vs ayer
4. **2 tarjetas:** Pendiente por cobrar + stock bajo
5. **2 alertas máximo:** Las más urgentes, con botón de acción directa
6. **2 botones de acción rápida:** Nueva venta + escanear factura
7. **Tabs de navegación:** 5 tabs en la parte inferior

---

## 4. Estructura de Navegación Completa

### Sidebar Desktop (7 secciones)

```
Inicio      → Dashboard (lo descrito arriba)
Vender      → Pantalla de venta rápida (grid + ticket + cobrar)
Inventario  → Tabla de productos (editable, filtrable, con semáforo)
Clientes    → Lista de clientes (con badges, segmentos, perfil)
Cuentas     → Por cobrar / Por pagar (dividido, con acciones)
Reportes    → 7 reportes pre-construidos
Contabilidad→ Exportación contable + envío al contador
Configuración→ Negocio, usuarios, métodos de pago, categorías
```

### Tabs Móvil (5 tabs)

```
Inicio   → Dashboard condensado
Vender   → Pantalla de venta (grid + escáner)
Inventario→ Lista con semáforo + búsqueda
Clientes → Lista con badges + búsqueda
Más      → Cuentas, Reportes, Contabilidad, Config, Cierre de día
```

### Flujo de cada sección

**Vender:**
```
Grid de productos (más vendidos) → Toque agrega al ticket
                                 → Búsqueda por texto
                                 → Escáner de código de barras
Ticket activo                    → Editar cantidad (long press)
                                 → Descuento (por línea o total)
                                 → Eliminar línea (swipe)
Cobrar                           → Selector de método de pago
                                 → Si fiado: seleccionar cliente
                                 → Confirmar → venta registrada
                                 → Opción: enviar recibo por WhatsApp
```

**Inventario:**
```
Tabla/lista de productos         → Semáforo de stock (rojo/amarillo/verde/gris)
                                 → Predicción "se acaba en ~X días"
                                 → Búsqueda + filtros (categoría, estado)
                                 → Edición inline (desktop) o tap (móvil)
Detalle de producto              → Nombre, SKU, costo, precio, margen
                                 → Variantes (si tiene)
                                 → Historial de precios
                                 → Proveedor
                                 → "Tu #2 más rentable" (insight IA)
Agregar producto                 → Formulario: nombre + precio (mínimo)
                                 → Opcional: SKU, costo, categoría, foto, variantes
Importar                         → Subir Excel → mapeo → preview → confirmar (solo desktop)
Escanear factura                 → Cámara → OCR → matching → confirmar → stock actualizado
```

**Clientes:**
```
Lista de clientes                → Badges: VIP, en riesgo, con deuda, nuevo
                                 → Búsqueda instantánea
                                 → Filtro por segmento
Perfil del cliente               → Datos de contacto
                                 → Historial de compras (timeline)
                                 → Frecuencia, ticket promedio, productos favoritos
                                 → Saldo pendiente
                                 → Botón "Cobrar por WhatsApp"
                                 → Notas del vendedor
Segmentos                        → VIP | Frecuentes | En riesgo | Nuevos | Con deuda | Inactivos
                                 → Desde segmento: "Enviar campaña WhatsApp"
```

**Cuentas:**
```
Vista dividida                   → Por cobrar | Por pagar (tabs)
Por cobrar                       → Lista por antigüedad (rojo > amarillo > verde)
                                 → Total pendiente arriba
                                 → Acciones: cobrar WhatsApp, marcar pagado
                                 → "Cobrar a todos los vencidos" (masivo)
Por pagar                        → Lista de deudas con proveedores
                                 → Marcar como pagado
Alertas de flujo de caja         → "El viernes podrías tener déficit de $80"
                                 → Sugiere cobros para cubrir
```

**Reportes:**
```
7 reportes pre-construidos:
1. Resumen del día               → Ventas, gastos, ganancia, comparativa
2. Resumen semanal/mensual       → Tendencias, top productos, top clientes
3. Rentabilidad por producto     → Margen, rotación, score
4. Movimiento de inventario      → Entradas, salidas, ajustes
5. Cuentas por cobrar aging      → Desglose por antigüedad
6. Ventas por vendedor           → Ranking, totales, ticket promedio
7. Resumen financiero (P&L)      → Ingresos - costos - gastos = ganancia

Cada reporte tiene:
  → Selector de periodo (hoy, semana, mes, rango)
  → Gráfico visual
  → Tabla con datos
  → Párrafo narrativo IA
  → Botón "Exportar PDF"
  → Botón "Enviar al contador"
  → Montos en USD + Bs.
```

**Contabilidad:**
```
Vista principal                  → Resumen: asientos del periodo, total debe/haber
Catálogo de cuentas              → Pre-configurado, editable por el contador
Exportar                         → Seleccionar periodo
                                 → Preview del paquete
                                 → Descargar (PDF, Excel)
                                 → "Enviar al contador por WhatsApp"
Libro de ventas SENIAT           → Generado automáticamente
```

**Configuración:**
```
Negocio                          → Nombre, RIF, dirección, logo, tipo de negocio
Usuarios                         → Lista de empleados con PIN, rol (Dueño/Empleado)
                                 → Agregar/desactivar usuarios
Métodos de pago                  → Habilitar/deshabilitar (efectivo, Pago Móvil, etc.)
Categorías                       → Editar categorías de productos
Tasa de cambio                   → BCV automática (indicador) + tasa paralela manual
Notificaciones                   → Qué alertas recibir, por dónde (push, WhatsApp)
Seguridad                        → 2FA, cambio de contraseña, sesiones activas
Log de actividad                 → Tabla filtrable (usuario, fecha, acción)
Cierre de día                    → Cuadre de caja + resumen + cierre
Importar datos                   → Subir Excel (productos, clientes, proveedores)
```
