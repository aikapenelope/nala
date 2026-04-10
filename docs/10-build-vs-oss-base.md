# Decisión: Construir Desde Cero vs Montar Sobre OSS Existente

> Análisis de si vale la pena usar ERPNext, Odoo, o algún otro sistema open source como base para Nova, o construir desde cero.

---

## Los Candidatos OSS

### ERPNext (Frappe)
- **Qué es:** ERP open source completo. Contabilidad, inventario, ventas, CRM, HR, manufactura, POS, proyectos. 30,000+ clientes. 50,000+ GitHub stars.
- **Stack:** Python (Frappe Framework), MariaDB, Redis, Node.js
- **Licencia:** GPL-3.0 (copyleft -- cualquier modificación debe ser open source también)
- **Hosting:** Frappe Cloud desde $5/mes, o self-hosted

### Odoo
- **Qué es:** ERP modular. Community Edition es open source, Enterprise es propietaria. 12M+ usuarios.
- **Stack:** Python, PostgreSQL, JavaScript
- **Licencia:** LGPL-3.0 (Community), Propietaria (Enterprise). Muchos módulos útiles son solo Enterprise
- **Hosting:** Odoo.com desde $24.90/usuario/mes, o self-hosted

### uniCenta oPOS
- **Qué es:** POS open source para retail y hospitality. Más limitado que ERPNext/Odoo.
- **Stack:** Java, MySQL/PostgreSQL
- **Licencia:** GPL-3.0

### Loyverse (no es OSS pero es gratis)
- **Qué es:** POS gratis. No es open source. No se puede montar encima.
- **Descartado:** No se puede customizar ni usar como base.

---

## La Comparación Real

### Opción A: Montar Nova sobre ERPNext

**Lo que ganas:**
- Contabilidad completa ya construida (libro diario, mayor, balance, P&L, multi-moneda)
- Inventario con variantes, lotes, números de serie
- POS funcional
- CRM básico
- Gestión de compras y proveedores
- Roles y permisos granulares
- API REST incluida
- Reportes extensos
- 15+ años de desarrollo, bugs resueltos, edge cases cubiertos

**Lo que pierdes:**

| Aspecto | Lo que Nova necesita | Lo que ERPNext ofrece | Gap |
|---|---|---|---|
| **PWA offline-first** | Arquitectura offline-first con IndexedDB y Service Workers | App web tradicional. No funciona offline | Enorme. Habría que reescribir el frontend completo |
| **Simplicidad** | 2 roles, pantallas mínimas, onboarding en 5 min | 50+ DocTypes, cientos de campos, onboarding de días/semanas | Habría que esconder el 90% de ERPNext |
| **WhatsApp bidireccional** | Chat como canal de entrada/salida integrado | No tiene. Hay plugins de terceros pero son básicos | Hay que construirlo de cero de todas formas |
| **IA integrada** | Predicciones, narrativas, alertas inteligentes en cada pantalla | No tiene IA. Es un ERP tradicional | Hay que construirlo de cero |
| **OCR de facturas** | Foto → datos → inventario | No tiene | Hay que construirlo de cero |
| **Experiencia móvil** | PWA optimizada para celulares Android de $100 | Responsive pero pesado. No optimizado para móvil | Habría que rehacer el frontend |
| **Tasa BCV automática** | Específico de Venezuela | No existe | Custom development |
| **Gamificación** | Ranking, metas, rachas para vendedores | No tiene | Custom development |
| **Velocidad** | <2s en 3G | ERPNext es notoriamente lento. Usuarios reportan problemas de performance con bases de datos grandes | Problema estructural |
| **Stack** | Nuxt 4 (Vue 3), TypeScript, PostgreSQL | Python (Frappe), MariaDB, jQuery | Stack completamente diferente al que queremos |

**El problema fundamental:** ERPNext es un ERP que hay que simplificar. Nova es un producto simple que tiene que ser potente. Son filosofías opuestas. Simplificar ERPNext es más trabajo que construir Nova desde cero, porque tienes que:

1. Entender el framework Frappe (curva de aprendizaje de semanas)
2. Esconder/deshabilitar el 90% de los módulos y campos
3. Reescribir el frontend completo para que sea PWA offline-first
4. Construir toda la capa de IA desde cero de todas formas
5. Construir toda la integración WhatsApp desde cero de todas formas
6. Construir el OCR desde cero de todas formas
7. Lidiar con la licencia GPL-3.0 (todo tu código debe ser open source)
8. Lidiar con actualizaciones de ERPNext que rompen tus customizaciones
9. Performance: ERPNext con MariaDB es lento para el tipo de queries que Nova necesita

### Opción B: Montar Nova sobre Odoo Community

Mismos problemas que ERPNext, más:
- Los módulos más útiles (contabilidad avanzada, POS completo, marketing) son solo Enterprise (propietario, $24.90/usuario/mes)
- La Community Edition es limitada para lo que necesitamos
- Licencia LGPL es mejor que GPL pero sigue siendo copyleft
- Odoo es aún más pesado y complejo que ERPNext

### Opción C: Construir desde cero

**Lo que pierdes:**
- Meses de desarrollo para features que ERPNext ya tiene (contabilidad, inventario avanzado, reportes)
- Edge cases que ERPNext ya resolvió en 15 años

**Lo que ganas:**

| Aspecto | Ventaja |
|---|---|
| **Control total del stack** | Nuxt 4  TypeScript + PostgreSQL. El stack que conocemos y que es óptimo para PWA offline-first |
| **PWA offline-first nativa** | No es un parche sobre un ERP web. Es la arquitectura desde el día 1 |
| **Simplicidad real** | No hay que esconder nada. Cada pantalla se diseña para el usuario target |
| **Velocidad** | Sin el overhead de un framework ERP. Queries directas a PostgreSQL. <2s en 3G |
| **IA integrada** | Se diseña desde el principio como parte del producto, no como plugin |
| **WhatsApp nativo** | Integrado en la arquitectura, no bolted-on |
| **Sin deuda técnica heredada** | No hay 15 años de código legacy que mantener |
| **Licencia propia** | Apache 2.0. Sin restricciones copyleft |
| **Diferenciación** | El producto ES el diferenciador. Si montas sobre ERPNext, eres "ERPNext con skin" |

---

## La Decisión

**Construir desde cero.** Razones:

1. **Lo que hace diferente a Nova (offline, IA, WhatsApp, OCR, simplicidad) hay que construirlo de cero de todas formas.** Montar sobre ERPNext no ahorra ese trabajo. Solo agrega complejidad.

2. **El 80% de lo que ERPNext ofrece, Nova no lo necesita.** Nova no necesita manufactura, MRP, proyectos, HR, nómina, website builder, e-commerce, helpdesk. Cargar con todo eso es peso muerto.

3. **El 20% que sí necesita (inventario, ventas, cuentas, reportes) no es tan complejo de construir.** Un CRUD de productos con variantes, un registro de ventas, cuentas por cobrar/pagar, y reportes agregados son semanas de desarrollo, no meses. La complejidad está en la experiencia, no en el backend.

4. **La contabilidad de Nova es un puente, no un módulo.** No necesitamos libro mayor, balance general, estados financieros auditables. Necesitamos exportar un Excel con formato contable. Eso es una función, no un módulo de ERP.

5. **Performance.** ERPNext/Odoo son lentos para el tipo de experiencia que queremos (<2s en 3G, offline-first). Optimizar un ERP existente para eso es más difícil que construir algo ligero desde cero.

6. **El stack no coincide.** ERPNext es Python/MariaDB/jQuery. Nova es TypeScript/PostgreSQL/Vue. Forzar un stack diferente al que el equipo domina es contraproducente.

---

## Qué SÍ tomar de los OSS existentes

No construir sobre ellos, pero sí aprender de ellos:

| De quién | Qué tomar |
|---|---|
| **ERPNext** | Modelo de datos de inventario (variantes, lotes, unidades de medida). Estructura de plan de cuentas contable. Flujo de compras (orden de compra → recepción → factura) |
| **Odoo** | UX de POS (pantalla de venta rápida). Modelo modular de pricing |
| **Loyverse** | Simplicidad del POS. Flujo de venta en 3 toques. Diseño mobile-first |
| **Square** | Onboarding en minutos. Dashboard que responde UNA pregunta: "¿cómo me fue hoy?" |
| **Fina** | Que la simplicidad gana. Que el soporte humano importa. Que Venezuela tiene reglas propias |

---

## Resumen

| Opción | Tiempo a MVP | Complejidad | Control | Diferenciación | Recomendación |
|---|---|---|---|---|---|
| ERPNext como base | 4-6 meses (parece menos pero la customización es lenta) | Alta (aprender Frappe, esconder módulos, reescribir frontend) | Bajo (atado a Frappe, GPL) | Baja (eres "ERPNext con skin") | No |
| Odoo como base | 5-7 meses | Muy alta (Community limitado, Enterprise es propietario) | Muy bajo | Baja | No |
| Desde cero | 4-5 meses | Media (construyes solo lo que necesitas) | Total | Alta (el producto ES el diferenciador) | **Sí** |

La paradoja: construir desde cero parece más trabajo, pero en realidad es menos trabajo que customizar un ERP para que se comporte como algo que no es.

---

## Patrones y UX a Replicar (detalle)

Lo que tomamos de cada sistema, con especificaciones concretas para implementar en Nova.

### De ERPNext: Modelo de datos de inventario

**Estructura de producto con variantes:**
- Un producto padre ("Camisa") tiene atributos (Color, Talla)
- Cada combinación genera una variante ("Camisa - Azul - M") con su propio SKU, stock y precio
- Tabla `products` (padre) → tabla `product_variants` (hijos) con relación 1:N
- Cada variante tiene: sku, stock, costo, precio_venta, atributos (JSON)

**Unidades de medida:**
- Producto puede tener UoM principal (unidad, kg, litro, metro) y UoM de compra diferente (caja de 12, saco de 50kg)
- Factor de conversión: 1 caja = 12 unidades
- Al registrar compra en cajas, el inventario se actualiza en unidades

**Plan de cuentas contable:**
- Estructura jerárquica: Activos > Activos Corrientes > Caja y Bancos > Caja Principal
- Pre-configurado por tipo de negocio (panadería, ferretería, restaurante, tienda de ropa)
- Cada transacción genera asientos automáticos contra las cuentas configuradas

**Flujo de compras:**
- Orden de compra → Recepción de mercancía → Factura del proveedor
- En Nova simplificamos: el OCR de la factura hace los 3 pasos en uno (detecta proveedor, items, montos, actualiza inventario y registra cuenta por pagar)

### De Loyverse: Flujo de venta en 3 toques

**Pantalla de venta:**
1. Grid de productos con imagen/ícono y nombre (los más vendidos primero, ordenados por frecuencia)
2. Toque en producto → se agrega al ticket. Toque de nuevo → incrementa cantidad
3. Botón grande "Cobrar $XX.XX" → selector de método de pago → confirmar

**Lo que NO tiene Loyverse que Nova sí:**
- Búsqueda por texto y escáner de código de barras (Loyverse solo tiene grid)
- Descuentos por línea y por ticket
- Fiado (venta a crédito vinculada al cliente)
- Funciona offline con sincronización (Loyverse también, replicamos esto)

### De Square: Dashboard de una pregunta

**Pantalla de inicio de Square:**
- Un número grande: ventas del día
- Debajo: gráfico simple de las últimas horas
- Debajo: 3-4 métricas secundarias (transacciones, ticket promedio, comparativa)
- No hay 15 widgets. No hay configuración. Es una respuesta a "¿cómo me fue hoy?"

**En Nova:**
- Número grande: "$420 vendidos hoy" (USD, con Bs. en gris al lado)
- Indicador: "▲ 12% vs martes pasado" (verde si sube, rojo si baja)
- 3 tarjetas: ventas totales | pendiente por cobrar | productos stock bajo
- Panel de alertas inteligentes (máximo 3, las más urgentes)
- Nada más. Sin scroll. Todo visible en una pantalla

### De Square: Onboarding en minutos

**Flujo de Square:**
1. "¿Qué tipo de negocio?" (selector visual con íconos)
2. "¿Cómo se llama?" (un campo)
3. "Agrega tu primer producto" (nombre + precio, nada más)
4. Listo. Puedes vender

**En Nova:**
1. "¿Qué tipo de negocio tienes?" → Panadería (selector visual)
2. Nova pre-configura: categorías, cuentas contables, métodos de pago comunes para panaderías
3. "¿Tienes productos en Excel?" → Sí (sube) / No (agrega uno: nombre + precio)
4. "¿Tienes empleados?" → Sí (crea PIN para cada uno) / No (solo tú)
5. Listo. Tutorial interactivo guía la primera venta dentro de la app

### De Fina: Lo que no se toca

**Simplicidad radical:**
- Fina tiene 4,000 clientes con menos features que cualquier competidor
- La gente no quiere más features. Quiere menos problemas
- Cada pantalla tiene UN propósito. No hay menús con 47 opciones

**Soporte humano:**
- Configuración inicial asistida por un humano, gratis
- En Nova: el plan Negocio ($35/mes) incluye onboarding asistido
- El plan Gratis y Pro tienen onboarding interactivo dentro de la app (sin humano)

**Entender Venezuela:**
- Dualidad Bs./USD con tasa BCV
- Pago Móvil como método de pago principal
- Cortes de luz e internet frecuentes → offline-first
- Lenguaje local: "mesonero", "cachito", "bodega"
- SMS todavía se usa pero WhatsApp domina
