# Dashboard y PWA: Rediseño Basado en Investigación de Square, Shopify y Mejores Prácticas 2026

---

## Lo que Aprendimos de la Investigación

### Square (redesign mayo 2025)

Lo más relevante que hizo Square:

1. **Modos por tipo de negocio.** Durante el onboarding preguntan qué tipo de negocio eres y pre-configuran toda la interfaz. Feature discovery subió 80%. Nala ya hace esto (pre-configurar por tipo de negocio en onboarding). Confirmado como patrón correcto.

2. **Dashboard app separada del POS.** Square tiene dos apps: POS (para vender) y Dashboard (para analizar). En el Dashboard app móvil, curaron solo las herramientas de backoffice más esenciales. No metieron todo. Seleccionaron lo que un dueño necesita ver en el celular.

3. **Daily sales summary email** (marzo 2026). Nuevo feature: email diario con métricas, comparativas de tendencias, e insights accionables para "optimizar operaciones del día siguiente". Nala ya tiene esto por WhatsApp + push. Confirmado.

4. **Offline payments mejorados** (abril 2026). "Offline payments will now trigger more reliably -- whether it's a full internet outage or just a dropped connection." Confirma que offline es importante incluso en EEUU.

### Shopify

El Home del admin de Shopify muestra:
- Performance metrics (ventas, tráfico, órdenes)
- **Tailored recommendations** basadas en datos en tiempo real

La clave: no solo datos, sino **recomendaciones accionables**. "Basado en tus datos, te sugerimos hacer X."

### F1Studioz (guía de diseño dashboards SaaS 2026)

El concepto más importante: **"Data Vomit"** -- mostrar todo no es mostrar valor. La mayoría de dashboards fallan porque confunden comprehensiveness con usefulness.

**Los 3 tipos de dashboard:**
1. **Operacional:** "¿Qué está pasando ahora?" -- para el cajero/vendedor durante el día
2. **Analítico:** "¿Por qué pasó?" -- para el dueño al final del día
3. **Estratégico:** "¿Cómo vamos?" -- para el dueño el lunes o fin de mes

**El error #1:** Intentar hacer los 3 en una pantalla. Resultado: nadie entiende nada.

**El principio clave: Progressive Disclosure** (Shneiderman's Mantra):
> "Overview first, zoom and filter, then details-on-demand."

Resumen primero. Detalle solo cuando el usuario lo pide. No al revés.

---

## Qué Cambiar en el Dashboard de Nala

### Problema del diseño anterior

El dashboard del doc 16 tiene demasiado en una pantalla:
- Número principal + tendencia
- 3 tarjetas
- Gráfico de 7 días
- Panel de alertas
- Top 5 productos
- Resumen IA narrativo

Son 6 bloques de información. Para un dueño de bodega que abre la app a las 6am, es demasiado. Es "data vomit" light.

### El nuevo diseño: Progressive Disclosure

**Nivel 1 (lo que ves al abrir):** La respuesta a UNA pregunta: "¿Cómo me fue hoy?"

**Nivel 2 (scroll o tap):** Detalle de lo que te interesa

**Nivel 3 (navegación):** Reportes completos, inventario, configuración

---

## Dashboard Desktop Rediseñado

```
┌──────────┬──────────────────────────────────────────────────────┐
│          │                                                      │
│  NALA    │  ── NIVEL 1: La respuesta (sin scroll) ──────────── │
│          │                                                      │
│ ● Inicio │  ┌────────────────────────────────────────────────┐  │
│          │  │                                                │  │
│   Vender │  │    $420 vendidos hoy                          │  │
│          │  │    ▲ 12% vs martes pasado                     │  │
│   Invent.│  │    23 ventas · $18.26 ticket promedio          │  │
│          │  │                                                │  │
│   Client.│  └────────────────────────────────────────────────┘  │
│          │                                                      │
│   Cuentas│  ┌────────────┐ ┌────────────┐ ┌────────────────┐   │
│          │  │ 💰 $95     │ │ 📦 3 bajo  │ │ ⚠ 2 alertas   │   │
│   Report.│  │ por cobrar │ │ stock      │ │ que atender   │   │
│          │  └──────┬─────┘ └──────┬─────┘ └───────┬────────┘   │
│   Contab.│         │              │               │             │
│          │  ── NIVEL 2: Detalle (scroll down) ──────────────── │
│   Config.│                                                      │
│          │  Alertas que necesitan tu atención                   │
│          │  ┌──────────────────────────────────────────────┐   │
│          │  │ ⚠ Harina PAN: stock para ~2 días             │   │
│          │  │   Sugerencia: pedir 10 sacos al proveedor     │   │
│          │  │   [Generar orden de compra]  [Ignorar]        │   │
│          │  ├──────────────────────────────────────────────┤   │
│          │  │ ⚠ Juan Pérez debe $65 hace 35 días           │   │
│          │  │   Historial: siempre paga cuando le recuerdas │   │
│          │  │   [Cobrar por WhatsApp]  [Ignorar]            │   │
│          │  └──────────────────────────────────────────────┘   │
│          │                                                      │
│          │  Cómo te fue esta semana                             │
│          │  ┌──────────────────────────────────────────────┐   │
│          │  │ Lu $420 ████████████                          │   │
│          │  │ Ma $350 ██████████                            │   │
│          │  │ Mi $520 ██████████████                        │   │
│          │  │ Ju $300 ████████                              │   │
│          │  │ Vi $620 ████████████████                      │   │
│          │  │                                               │   │
│          │  │ "Esta semana vendiste $2,210, 8% más que la   │   │
│          │  │  anterior. Tu mejor día fue viernes. Tu       │   │
│          │  │  producto estrella: Pan Campesino."           │   │
│          │  │                          [Ver reporte completo]│   │
│          │  └──────────────────────────────────────────────┘   │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

**Qué cambió vs el diseño anterior:**

| Antes | Ahora | Por qué |
|---|---|---|
| 6 bloques visibles sin scroll | 3 bloques sin scroll (número + tarjetas + alertas) | Progressive disclosure. Nivel 1 responde "¿cómo me fue?" en 2 segundos |
| Top 5 productos siempre visible | Movido a Nivel 2 (dentro del reporte semanal) | No es información que necesitas al abrir la app |
| Gráfico de 7 días siempre visible | Movido a Nivel 2 (scroll down) | El dueño no necesita el gráfico cada vez que abre. Lo ve cuando quiere profundizar |
| Alertas como panel lateral | Alertas como cards accionables con sugerencia + botón | Patrón de Shopify: no solo datos, sino recomendaciones accionables |
| Resumen IA como bloque separado | Integrado dentro del gráfico semanal | No necesita su propio espacio. Es contexto del gráfico |
| 3 tarjetas (cobrar, stock, mes) | 3 tarjetas (cobrar, stock, alertas pendientes) | "Ventas del mes" es analítico, no operacional. Se mueve a reportes. "Alertas pendientes" es más accionable |

### Principio aplicado: Cada elemento es accionable

Nada en el dashboard es solo informativo. Todo tiene una acción:

| Elemento | Acción al hacer click/tap |
|---|---|
| "$420 vendidos hoy" | Abre detalle de ventas del día |
| "▲ 12% vs martes pasado" | Abre comparativa con semana anterior |
| "$95 por cobrar" | Abre lista de cuentas por cobrar |
| "3 stock bajo" | Abre inventario filtrado por stock bajo |
| "2 alertas" | Scroll a la sección de alertas |
| Alerta de stock | Botón "Generar orden de compra" |
| Alerta de cobro | Botón "Cobrar por WhatsApp" |
| Gráfico semanal | Click en un día abre detalle de ese día |
| "Ver reporte completo" | Abre reportes |

---

## Dashboard Móvil Rediseñado

```
┌─────────────────────────┐
│ Bodega Juan    Bs.36.50 │
├─────────────────────────┤
│                         │
│      $420               │  ← tap: detalle ventas
│      vendidos hoy       │
│      ▲ 12% vs ayer      │
│                         │
├────────────┬────────────┤
│  💰 $95    │  📦 3      │  ← tap: va a cuentas/inventario
│  x cobrar  │  stock bajo│
├────────────┴────────────┤
│                         │
│ ⚠ Harina PAN: ~2 días  │  ← tap: expande con acción
│                         │
├─────────────────────────┤
│                         │
│  [  + Nueva venta  ]    │  ← acción principal
│                         │
├────┬────┬────┬────┬────┤
│ 🏠 │ 💲 │ 📦 │ 👤 │ ⋯ │
│Home│Vend│Inv │Cli │Más │
└────┴────┴────┴────┴────┘
```

**Qué cambió vs el diseño anterior:**

| Antes | Ahora | Por qué |
|---|---|---|
| 2 alertas visibles | 1 alerta (la más urgente) | Menos ruido. Si hay más, se ve al hacer scroll |
| 2 botones de acción (venta + escanear) | 1 botón de acción (venta) | El escáner de facturas no es algo que se hace 10 veces al día. Está en el menú "Más" |
| Todo visible sin scroll | Todo visible sin scroll (pero menos cosas) | Mismo principio, menos elementos |

**Principio móvil: máximo 5 elementos visibles sin scroll.** Número principal + 2 tarjetas + 1 alerta + 1 botón de acción = 5. Nada más.

---

## Qué Quitar y Por Qué

| Elemento | Decisión | Razón |
|---|---|---|
| **Top 5 productos en el dashboard** | Quitar del Nivel 1. Mover a Nivel 2 (scroll) o a Reportes | No es información que necesitas al abrir. Es analítico, no operacional |
| **Gráfico de 7 días en el dashboard** | Quitar del Nivel 1. Mover a Nivel 2 (scroll) | El dueño no analiza tendencias cada vez que abre la app. Lo hace al final del día o el lunes |
| **Resumen IA como bloque separado** | Integrar dentro del contexto (gráfico semanal, alertas) | No necesita su propio espacio. Es más útil como contexto de otro dato |
| **"Ventas del mes" como tarjeta** | Quitar del dashboard. Mover a Reportes | Es estratégico, no operacional. El dashboard es operacional |
| **Segundo botón de acción en móvil** | Quitar "Escanear factura" del home. Mover a "Más" | Se usa 1-2 veces al día, no 20. No merece espacio premium |
| **Ticket promedio en el header** | Quitar del Nivel 1. Disponible al tap en el número principal | Es detalle, no resumen. Progressive disclosure |

## Qué Dejar y Por Qué

| Elemento | Decisión | Razón |
|---|---|---|
| **Número grande de ventas del día** | Mantener como elemento #1 | Es LA pregunta que el dueño quiere responder: "¿cómo me fue?" |
| **Comparativa automática** | Mantener junto al número | Contexto inmediato. Sin esto, "$420" no significa nada |
| **Tarjeta de cobros pendientes** | Mantener | Es accionable: tap → cobrar |
| **Tarjeta de stock bajo** | Mantener | Es accionable: tap → ver qué falta |
| **Alertas con acciones** | Mantener (máximo 2 desktop, 1 móvil) | Patrón Shopify: recomendaciones accionables, no solo datos |
| **Botón "Nueva venta"** | Mantener en móvil | Es la acción más frecuente |
| **Tasa BCV en el header** | Mantener | Contexto esencial para Venezuela |

## Qué Agregar (Nuevo)

| Elemento | Qué es | Por qué |
|---|---|---|
| **Alertas con sugerencia + acción** | Cada alerta incluye: qué pasa + por qué + qué hacer + botón para hacerlo | Patrón Shopify "tailored recommendations". No solo "stock bajo" sino "stock bajo, te sugerimos pedir X, [botón para hacerlo]" |
| **Estado de sincronización** | Indicador sutil: "Actualizado hace 2 min" o "Sin conexión - 3 ventas pendientes" | El usuario siempre sabe si sus datos están frescos |
| **Acceso rápido a última acción** | "Última venta: Pan Campesino x3, $4.50, hace 5 min" | Contexto de lo que acaba de pasar. Útil para verificar que se registró bien |

---

## Resumen: Principios de Diseño del Dashboard

1. **Progressive Disclosure.** Nivel 1: respuesta en 2 segundos. Nivel 2: detalle al scroll. Nivel 3: reportes completos
2. **Todo es accionable.** Nada es solo informativo. Cada elemento tiene un tap/click que hace algo útil
3. **Alertas con recomendación.** No "stock bajo". Sí "stock bajo, te sugerimos pedir X al proveedor, [botón]"
4. **Máximo 5 elementos en Nivel 1 móvil.** Número + 2 tarjetas + 1 alerta + 1 botón
5. **Máximo 3 bloques en Nivel 1 desktop.** Número + tarjetas + alertas. Gráficos y tablas en Nivel 2
6. **El dashboard es operacional, no analítico.** "¿Qué hago ahora?" no "¿Qué pasó el mes pasado?" Los reportes son para análisis
7. **Estado de conexión siempre visible.** El usuario siempre sabe si sus datos están frescos
